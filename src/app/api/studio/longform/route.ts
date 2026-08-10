import { NextResponse } from "next/server";
import { z } from "zod";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { consumeFreeChars } from "@/lib/rate-limit/caps";
import { startLongFormJob } from "@/lib/tts/longform";
import { createClient } from "@/lib/supabase/server";
import {
  BillingUnavailableError,
  InsufficientCreditsError,
  debitCredits,
  refundCredits,
} from "@/lib/credits/ledger";

/**
 * POST /api/studio/longform — long-form generation (up to 100k chars).
 * Returns { jobId } — poll GET /api/studio/longform/:id for progress + result.
 *
 * Free voices: IP-capped (same 100k chars/day pool). Premium: 1 credit/char,
 * debited up front, refunded on failure.
 */

const MAX_CHARS = 100_000;

const LongFormSchema = z.object({
  text: z.string().min(10).max(MAX_CHARS),
  voiceId: z.string(),
  style: z.string().default("neutral"),
  pitch: z.number().min(-12).max(12).optional(),
  rate: z.number().min(0.5).max(2).optional(),
});

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  const parsed = LongFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const { text, voiceId, style, pitch, rate } = parsed.data;
  const charCount = Array.from(text).length;

  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    return NextResponse.json({ error: "This text can't be used.", code: "content_policy" }, { status: 400 });
  }

  const voice = await getVoiceById(voiceId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  const jobId = crypto.randomUUID();

  // ---------- free tier (Edge) ----------
  if (voice.tier === "free") {
    const cap = consumeFreeChars(`ip:${ip}`, charCount);
    if (!cap.allowed) {
      return NextResponse.json(
        { error: "Daily free-character limit reached. Register for more.", code: "daily_limit_exceeded" },
        { status: 429 },
      );
    }
    startLongFormJob({ id: jobId, text, voice, style, pitch, rate, tag: `guest:${ip}` });
    return NextResponse.json({ jobId, status: "processing", estimatedChars: charCount });
  }

  // ---------- premium / flagship ----------
  let userId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ error: "Sign in to use premium voices.", code: "unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  } catch {
    return NextResponse.json(
      { error: "Premium billing is being configured — free voices work.", code: "billing_unavailable" },
      { status: 503 },
    );
  }

  const creditRate = voice.tier === "flagship" ? 2 : 1;
  const credits = charCount * creditRate;

  try {
    await debitCredits({ userId, amount: credits, generationId: jobId, description: `longform: ${voice.name}` });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "Not enough credits. Top up to continue.", code: "insufficient_credits" }, { status: 402 });
    }
    if (err instanceof BillingUnavailableError) {
      return NextResponse.json({ error: "Premium billing is being configured.", code: "billing_unavailable" }, { status: 503 });
    }
    throw err;
  }

  startLongFormJob({
    id: jobId,
    text,
    voice,
    style,
    pitch,
    rate,
    tag: `${userId}:longform`,
    onDone: async (failed) => {
      if (failed) {
        try {
          await refundCredits({ userId, amount: credits, generationId: jobId, description: "refunded failed longform" });
        } catch (err) {
          console.error("[longform] refund failed (manual action needed)", err);
        }
      }
    },
  });

  return NextResponse.json({ jobId, status: "processing", estimatedCredits: credits });
}
