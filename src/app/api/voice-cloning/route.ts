import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { z } from "zod";
import ffmpegStatic from "ffmpeg-static";
import { resolveSession } from "@/lib/sandbox/session";
import { clientIp } from "@/lib/http/client-ip";
import { getProvider } from "@/lib/tts/registry";
import { isProviderKillSwitched, providerWithinSpendCap } from "@/lib/ops/flags";
import { InsufficientCreditsError, debitCredits, refundCredits } from "@/lib/credits/ledger";
import { CLONE_CREDIT_COST } from "@/lib/pricing/packs";
import {
  cloneAttemptsRemaining,
  recordCloneAttempt,
  recordConsent,
  registerCustomVoice,
  slotsRemaining,
  updateConsentVoiceId,
} from "@/lib/tts/custom-voices";

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegStatic ?? "ffmpeg";

/**
 * POST /api/voice-cloning — Typecast instant cloning with consent.
 *
 * Guards (research/07 B.4): authenticated user → provider configured +
 * kill-switch + spend cap → sample size + duration (5–150s, probed with
 * ffmpeg) → clone attempt cap (5/h) → slot check (50) → consent attestation
 * recorded (bound to the SERVER-computed SHA-256 of the sample) → credits
 * debited (2,500/attempt, refunded on failure) → Typecast clone →
 * owner-scoped custom voice registered → preview available.
 *
 * Body: { sampleBase64, sampleMime, name, language?, consent }
 */

const CloneSchema = z.object({
  sampleBase64: z.string().min(1),
  sampleMime: z.enum(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/webm"]).default("audio/mpeg"),
  name: z.string().min(1).max(30),
  language: z.string().max(8).optional(),
  consent: z.boolean().refine((v) => v === true, { message: "consent required" }),
});

const MIN_DURATION_S = 5;
const MAX_DURATION_S = 150;
const MAX_SAMPLE_BYTES = 25 * 1_024 * 1_024;

/** probe audio duration (seconds) using ffmpeg */
async function probeDuration(sample: Buffer): Promise<number | null> {
  const dir = await mkdtemp(join(tmpdir(), "luguna-clone-"));
  const file = join(dir, "sample.mp3");
  try {
    await writeFile(file, sample);
    const { stderr } = await execFileAsync(FFMPEG, ["-i", file, "-f", "null", "-"], {
      maxBuffer: 8 * 1_024 * 1_024,
    });
    const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
    if (!match) return null;
    const [, h, m, s] = match;
    return Number(h) * 3_600 + Number(m) * 60 + Number(s);
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function POST(request: Request) {
  // 1. Authenticated user required (real session, or sandbox cookie without Supabase)
  const { userId, supabaseConfigured } = await resolveSession();
  if (!userId) {
    if (supabaseConfigured) {
      return NextResponse.json({ error: "Sign in to clone voices.", code: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Voice cloning is being configured — try again soon, or use the local test playground.", code: "billing_unavailable" },
      { status: 503 },
    );
  }

  // 1b. Provider must actually be configured (not just registered)
  if (!process.env.TYPECAST_API_KEY) {
    return NextResponse.json(
      { error: "Voice cloning is being configured — try again soon.", code: "billing_unavailable" },
      { status: 503 },
    );
  }
  if (isProviderKillSwitched("typecast")) {
    return NextResponse.json(
      { error: "This voice engine is temporarily unavailable.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }
  if (!(await providerWithinSpendCap("typecast"))) {
    return NextResponse.json(
      { error: "This voice engine has reached its daily spend limit.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // 2. Validate + probe the sample
  const body = await request.json().catch(() => null);
  const parsed = CloneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const { sampleBase64, name, language } = parsed.data;
  const sample = Buffer.from(sampleBase64, "base64");

  if (sample.length === 0) {
    return NextResponse.json({ error: "Empty sample.", code: "invalid_request" }, { status: 400 });
  }
  if (sample.length > MAX_SAMPLE_BYTES) {
    return NextResponse.json(
      { error: "Sample must be under 25 MB.", code: "sample_too_large" },
      { status: 400 },
    );
  }

  const duration = await probeDuration(sample);
  if (duration === null) {
    return NextResponse.json(
      { error: "Could not read the audio. Use a WAV or MP3 file.", code: "invalid_audio" },
      { status: 400 },
    );
  }
  if (duration < MIN_DURATION_S || duration > MAX_DURATION_S) {
    return NextResponse.json(
      {
        error: `Sample must be ${MIN_DURATION_S}–${MAX_DURATION_S} seconds (got ${Math.round(duration)}s).`,
        code: "invalid_duration",
      },
      { status: 400 },
    );
  }

  // 3. Clone attempt cap (5/hour — failed clones still cost provider time)
  if (cloneAttemptsRemaining(userId) <= 0) {
    return NextResponse.json(
      { error: "Too many clone attempts. Try again in an hour.", code: "rate_limited" },
      { status: 429 },
    );
  }
  recordCloneAttempt(userId);

  // 4. Slot check
  const remaining = slotsRemaining(userId);
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Clone slot limit reached (50). Delete one to continue.", code: "slots_exhausted" },
      { status: 409 },
    );
  }

  // 5. Content hash — bound to the SERVER-computed SHA-256 of the actual
  //    sample (client-sent hashes are ignored; must match what was cloned).
  const contentHash = `sha256:${createHash("sha256").update(sample).digest("hex")}`;

  // 6. Bill credits (refunded if the clone fails)
  const generationId = crypto.randomUUID();
  try {
    await debitCredits({ userId, amount: CLONE_CREDIT_COST, generationId, description: `voice clone: ${name}` });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits to clone a voice. Top up to continue.", code: "insufficient_credits" },
        { status: 402 },
      );
    }
    throw err;
  }

  // 6b. Consent attestation — recorded only after the debit succeeds, so a
  //     rejected payment never leaves an unbound "pending" consent row.
  recordConsent({
    userId,
    voiceId: "pending", // bound to the real clone id after success (updateConsentVoiceId)
    sampleHash: contentHash,
    attestation: `I attest I own the rights to this voice sample and consent to it being cloned. (${new Date().toISOString()})`,
    language,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  // 7. Clone via Typecast
  try {
    const provider = getProvider("typecast");
    const cloneId = await provider.clone!(sample, name, { model: "ssfm-v30", language });

    const publicId = `fs_voice_${cloneId}`;
    const voice = {
      id: publicId,
      provider: "typecast" as const,
      providerVoiceId: cloneId,
      modelVersion: "ssfm-v30",
      name,
      language: language ?? "eng",
      gender: "other" as const,
      tier: "premium" as const,
      isCustom: true,
      ownerUserId: userId,
      tags: ["clone"],
      providerMeta: { cloned: true },
    };

    registerCustomVoice(voice, userId, contentHash);
    updateConsentVoiceId(userId, contentHash, publicId);

    // slotsRemaining() already reflects the registered clone — no -1
    return NextResponse.json(
      { voice, slotsRemaining: slotsRemaining(userId), creditsCharged: CLONE_CREDIT_COST },
      { status: 201 },
    );
  } catch (err) {
    console.error("[voice-cloning] clone failed", err);
    try {
      await refundCredits({ userId, amount: CLONE_CREDIT_COST, generationId, description: "refunded failed clone" });
    } catch (refundErr) {
      console.error("[voice-cloning] refund failed (manual action needed)", refundErr);
    }
    return NextResponse.json(
      { error: "Cloning failed. Try another sample.", code: "clone_failed" },
      { status: 502 },
    );
  }
}
