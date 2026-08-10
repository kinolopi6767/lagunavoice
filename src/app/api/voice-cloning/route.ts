import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { z } from "zod";
import ffmpegStatic from "ffmpeg-static";
import { createClient } from "@/lib/supabase/server";
import { getProvider } from "@/lib/tts/registry";
import {
  recordConsent,
  registerCustomVoice,
  slotsRemaining,
} from "@/lib/tts/custom-voices";

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegStatic ?? "ffmpeg";

/**
 * POST /api/voice-cloning — Typecast instant cloning with consent.
 *
 * Guards (research/07 B.4): authenticated user → sample size + duration
 * (5–150s, probed server-side with ffmpeg) → consent attestation recorded
 * BEFORE the provider call → clone slot check (50) → Typecast clone →
 * owner-scoped custom voice registered → preview available.
 *
 * Body: { sampleBase64, sampleMime, name, language?, consent, sampleHash }
 */

const CloneSchema = z.object({
  sampleBase64: z.string().min(1),
  sampleMime: z.enum(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/webm"]).default("audio/mpeg"),
  name: z.string().min(1).max(30),
  language: z.string().max(8).optional(),
  consent: z.boolean().refine((v) => v === true, { message: "consent required" }),
  sampleHash: z.string().max(128).optional(),
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

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function POST(request: Request) {
  // 1. Authenticated user required
  let userId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ error: "Sign in to clone voices.", code: "unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  } catch {
    return NextResponse.json(
      { error: "Voice cloning is being configured — try again soon.", code: "billing_unavailable" },
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

  const { sampleBase64, name, language, sampleHash } = parsed.data;
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

  // 3. Consent attestation recorded BEFORE the provider call (immutable)
  recordConsent({
    userId,
    voiceId: "pending", // replaced after clone
    sampleHash: sampleHash ?? `sha256:${sample.length}:${Date.now()}`,
    attestation: `I attest I own the rights to this voice sample and consent to it being cloned. (${new Date().toISOString()})`,
    language,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  // 4. Slot check
  const remaining = slotsRemaining(userId);
  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Clone slot limit reached (50). Delete one to continue.", code: "slots_exhausted" },
      { status: 409 },
    );
  }

  // 5. Clone via Typecast
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

    registerCustomVoice(voice, userId, sampleHash);

    return NextResponse.json({ voice, slotsRemaining: slotsRemaining(userId) - 1 }, { status: 201 });
  } catch (err) {
    console.error("[voice-cloning] clone failed", err);
    return NextResponse.json(
      { error: "Cloning failed. Try another sample.", code: "clone_failed" },
      { status: 502 },
    );
  }
}
