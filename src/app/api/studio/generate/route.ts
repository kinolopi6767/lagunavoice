import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { consumeFreeChars } from "@/lib/rate-limit/caps";
import { createClient } from "@/lib/supabase/server";
import {
  BillingUnavailableError,
  InsufficientCreditsError,
  debitCredits,
  refundCredits,
} from "@/lib/credits/ledger";

/**
 * POST /api/studio/generate — Studio generation.
 *
 * Free (Edge) voices: capped per IP (100k chars/day), no credits.
 * Premium (Typecast) voices: 1 credit = 1 char, debited atomically before
 * synthesis and refunded automatically if synthesis fails.
 *
 * Requires Supabase session + DB for premium. Guests and pre-DB setups get
 * free voices only (BillingUnavailableError).
 */

const MAX_CHARS = 5_000;

const GenerateSchema = z.object({
  text: z.string().min(1).max(MAX_CHARS),
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
  const parsed = GenerateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const { text, voiceId, style, pitch, rate } = parsed.data;
  const charCount = Array.from(text).length;

  // 1. Moderation (skip when not configured)
  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    return NextResponse.json(
      { error: "This text can't be used.", code: "content_policy" },
      { status: 400 },
    );
  }

  // 2. Voice must exist (stock + the caller's custom clones)
  let sessionUserId: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) sessionUserId = data.user.id;
  } catch {
    // Supabase not configured — stock voices only
  }
  const voice = await getVoiceById(voiceId, sessionUserId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  // cloned voices are owner-only
  if (voice.isCustom && voice.ownerUserId !== sessionUserId) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  // 3a. Free voices — per-IP daily caps, no credits
  if (voice.tier === "free") {
    const cap = consumeFreeChars(`ip:${ip}`, charCount);
    if (!cap.allowed) {
      return NextResponse.json(
        {
          error:
            cap.reason === "daily_char_limit"
              ? "Daily free-character limit reached. Register for more."
              : "Daily generation limit reached.",
          code: "daily_limit_exceeded",
        },
        { status: 429 },
      );
    }

    try {
      const provider = getProvider(voice.provider);
      const result = await provider.synthesize({ text, voice, style, pitch, rate });
      return NextResponse.json({
        audioBase64: result.audio.toString("base64"),
        mimeType: result.mimeType,
        durationMs: result.durationMs,
        charCount,
        tier: "free",
        remainingChars: cap.remainingChars,
      });
    } catch (err) {
      console.error("[studio] free synthesis failed", err);
      return NextResponse.json(
        { error: "We could not reach the voice engine. Please try again.", code: "voice_engine_unavailable" },
        { status: 503 },
      );
    }
  }

  // 3b. Premium / flagship — session + credits required
  if (!sessionUserId) {
    return NextResponse.json(
      { error: "Sign in to generate with premium voices.", code: "unauthorized" },
      { status: 401 },
    );
  }
  const userId = sessionUserId;

  const provider = getProvider(voice.provider);
  const generationId = crypto.randomUUID();

  let debited = 0;
  try {
    // atomic debit: 1 credit per char (flagship voices = 2× set by voice tier)
    const creditRate = voice.tier === "flagship" ? 2 : 1;
    debited = charCount * creditRate;
    await debitCredits({
      userId,
      amount: debited,
      generationId,
      description: `voice: ${voice.name} (${voice.provider}, ${voice.tier})`,
    });

    const result = await provider.synthesize({ text, voice, style, pitch, rate });

    return NextResponse.json({
      audioBase64: result.audio.toString("base64"),
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      charCount,
      tier: voice.tier,
      creditsCharged: debited,
    });
  } catch (err) {
    // refund anything we debited when synthesis failed
    if (debited > 0) {
      try {
        await refundCredits({
          userId,
          amount: debited,
          generationId,
          description: "refunded failed generation",
        });
      } catch (refundErr) {
        console.error("[studio] refund failed (manual action needed)", refundErr);
      }
    }

    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough credits. Top up to continue.", code: "insufficient_credits" },
        { status: 402 },
      );
    }
    if (err instanceof BillingUnavailableError) {
      return NextResponse.json(
        { error: "Premium billing is being configured — free voices work.", code: "billing_unavailable" },
        { status: 503 },
      );
    }
    console.error("[studio] premium synthesis failed", err);
    return NextResponse.json(
      { error: "We could not reach the voice engine. Please try again.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }
}
