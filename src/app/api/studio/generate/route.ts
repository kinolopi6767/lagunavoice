import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { consumeFreeChars } from "@/lib/rate-limit/caps";
import { resolveSession } from "@/lib/sandbox/session";
import { clientIp } from "@/lib/http/client-ip";
import { splitText } from "@/lib/tts/text";
import {
  BillingUnavailableError,
  InsufficientCreditsError,
  debitCredits,
  refundCredits,
} from "@/lib/credits/ledger";
import {
  checkGenerationVelocity,
  isBanned,
  recordModerationStrike,
} from "@/lib/abuse/rules";
import { isProviderKillSwitched, providerWithinSpendCap } from "@/lib/ops/flags";
import { recordProviderUsage } from "@/lib/costs/store";

/**
 * POST /api/studio/generate — Studio generation.
 *
 * Free (Edge) voices: capped per IP (100k chars/day), no credits.
 * Premium (Typecast) voices: 1 credit = 1 char, debited atomically before
 * synthesis and refunded automatically if synthesis fails.
 *
 * Abuse guards (research/08): ban check → moderation (3 strikes → temp ban)
 * → generation velocity → provider kill-switch → daily caps → synthesis.
 * Every call records provider usage for COGS tracking.
 */

const MAX_CHARS = 5_000;

const GenerateSchema = z.object({
  text: z.string().min(1).max(MAX_CHARS),
  voiceId: z.string(),
  style: z.string().default("neutral"),
  pitch: z.number().min(-12).max(12).optional(),
  rate: z.number().min(0.5).max(2).optional(),
});

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

  // 0a. Session + ban check
  const { userId: sessionUserId } = await resolveSession();
  if (sessionUserId) {
    const ban = isBanned(sessionUserId);
    if (ban) {
      return NextResponse.json(
        { error: "Account temporarily restricted. Contact support.", code: "account_restricted" },
        { status: 403 },
      );
    }
    if (checkGenerationVelocity(`user:${sessionUserId}`, sessionUserId)) {
      return NextResponse.json(
        { error: "Too many requests. Slow down and try again.", code: "rate_limited" },
        { status: 429 },
      );
    }
  } else if (checkGenerationVelocity(`ip:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again.", code: "rate_limited" },
      { status: 429 },
    );
  }

  // 1. Moderation (skip when not configured) — 3 strikes → temp ban
  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    if (sessionUserId) recordModerationStrike(sessionUserId);
    return NextResponse.json(
      { error: "This text can't be used.", code: "content_policy" },
      { status: 400 },
    );
  }

  // 2. Voice must exist (stock + the caller's custom clones)
  const voice = await getVoiceById(voiceId, sessionUserId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  // cloned voices are owner-only
  if (voice.isCustom && voice.ownerUserId !== sessionUserId) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  // 2b. Provider kill-switch
  const disabled = isProviderKillSwitched(voice.provider);
  if (disabled) {
    return NextResponse.json(
      { error: "This voice engine is temporarily unavailable.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // 2c. Daily spend guard (COGS): block once the provider's cap is hit
  if (!(await providerWithinSpendCap(voice.provider))) {
    return NextResponse.json(
      { error: "This voice engine has reached its daily spend limit.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // 3a. Free voices — daily caps (per user when signed in, per IP as guest), no credits
  if (voice.tier === "free") {
    const freeKey = sessionUserId ? `user:${sessionUserId}` : `ip:${ip}`;
    const cap = consumeFreeChars(freeKey, charCount, { guest: !sessionUserId });
    if (!cap.allowed) {
      return NextResponse.json(
        {
          error:
            cap.reason === "daily_char_limit"
              ? "Daily free-character limit reached. Register for more."
              : "Daily free-generation limit reached. Register for more.",
          code: "daily_limit_exceeded",
        },
        { status: 429 },
      );
    }

    try {
      const provider = getProvider(voice.provider);
      const result = await provider.synthesize({ text, voice, style, pitch, rate });
      await recordProviderUsage(voice.provider, charCount, 0, { errored: false });
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
      await recordProviderUsage(voice.provider, 0, 0, { errored: true });
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

    // providers cap chars/request (typecast 2,000) — chunk and stitch like long-form
    const chunks = splitText(text, provider.maxCharsPerRequest);
    if (chunks.length === 0) {
      return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
    }
    const parts: Buffer[] = [];
    let durationMs = 0;
    let mimeType: "audio/mpeg" | "audio/wav" = "audio/mpeg";
    for (const chunk of chunks) {
      const part = await provider.synthesize({ text: chunk, voice, style, pitch, rate });
      parts.push(part.audio);
      durationMs += part.durationMs;
      mimeType = part.mimeType;
    }
    const audio = parts.length > 1 ? Buffer.concat(parts) : parts[0];
    await recordProviderUsage(voice.provider, charCount, 0, { tier: voice.tier === "flagship" ? "flagship" : "premium" });

    return NextResponse.json({
      audioBase64: audio.toString("base64"),
      mimeType,
      durationMs,
      charCount,
      tier: voice.tier,
      creditsCharged: debited,
      chunked: chunks.length > 1,
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
