import { NextResponse } from "next/server";
import { z } from "zod";
import { DeepgramProvider } from "@/lib/tts/deepgram";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { isProviderKillSwitched, providerWithinSpendCap } from "@/lib/ops/flags";
import { resolveSession } from "@/lib/sandbox/session";
import { clientIp } from "@/lib/http/client-ip";
import { checkGenerationVelocity, isBanned, recordModerationStrike } from "@/lib/abuse/rules";
import { recordProviderUsage } from "@/lib/costs/store";
import {
  InsufficientCreditsError,
  debitCredits,
  refundCredits,
} from "@/lib/credits/ledger";

/**
 * POST /api/studio/stream — flagship streaming preview (Deepgram).
 *
 * Deepgram REST returns audio from the first byte, so we pipe chunks to the
 * browser as they arrive (sub-500ms first byte with Aura-2, research/05).
 * Response: audio/mpeg streamed (ReadableStream). Billing: 2 credits/char,
 * debited before streaming; aborted streams refund unused credits.
 *
 * Guests: limited to 5 stream requests/day per IP (cost control).
 */

const MAX_CHARS = 1_000; // streaming is for short previews
const GUEST_DAILY_STREAMS = 5;

// in-memory guest stream counter (DB-backed in M7, same pattern as the demo)
const streamCounts = new Map<string, number>();

function consumeGuestStream(ip: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${today}`;
  if (streamCounts.size > 10_000) {
    for (const k of streamCounts.keys()) if (!k.endsWith(`:${today}`)) streamCounts.delete(k);
  }
  const used = streamCounts.get(key) ?? 0;
  if (used >= GUEST_DAILY_STREAMS) return false;
  streamCounts.set(key, used + 1);
  return true;
}

const StreamSchema = z.object({
  text: z.string().min(1).max(MAX_CHARS),
  voiceId: z.string(),
  rate: z.number().min(0.7).max(1.5).optional(),
  pronunciations: z
    .array(z.object({ word: z.string().max(64), pronounce: z.string().max(128) }))
    .max(500)
    .optional(),
});

export async function POST(request: Request) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  const parsed = StreamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const { text, voiceId, rate, pronunciations } = parsed.data;
  const charCount = Array.from(text).length;

  // ban check + velocity throttle (same guards as studio/generate)
  const session = await resolveSession();
  if (session.userId) {
    const ban = isBanned(session.userId);
    if (ban) {
      return NextResponse.json(
        { error: "Account temporarily restricted. Contact support.", code: "account_restricted" },
        { status: 403 },
      );
    }
    if (checkGenerationVelocity(`user:${session.userId}`, session.userId)) {
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

  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    if (session.userId) recordModerationStrike(session.userId);
    return NextResponse.json({ error: "This text can't be used.", code: "content_policy" }, { status: 400 });
  }

  const voice = await getVoiceById(voiceId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }
  if (voice.provider !== "deepgram") {
    return NextResponse.json(
      { error: "Streaming is a flagship (Deepgram) feature.", code: "unsupported_for_voice" },
      { status: 400 },
    );
  }

  // provider kill-switch
  const disabled = isProviderKillSwitched(voice.provider);
  if (disabled) {
    return NextResponse.json(
      { error: "This voice engine is temporarily unavailable.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // daily spend guard (COGS)
  if (!(await providerWithinSpendCap("deepgram"))) {
    return NextResponse.json(
      { error: "This voice engine has reached its daily spend limit.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // guests = no user id at all (signed-out with Supabase, or no sandbox cookie)
  const isGuest = !session.userId;
  const userId = session.userId;

  // guest rate limit applies to guests only (signed-in users bill on credits)
  if (isGuest && !consumeGuestStream(ip)) {
    return NextResponse.json(
      { error: "Streaming preview limit reached for today.", code: "daily_limit_exceeded" },
      { status: 429 },
    );
  }

  // flagship billing: signed-in users pay 2 credits/char, refunded on failure
  // (guests stay within their free daily stream cap)
  const generationId = crypto.randomUUID();
  const credits = charCount * 2;
  if (!isGuest) {
    try {
      await debitCredits({ userId: userId!, amount: credits, generationId, description: `stream: ${voice.name}` });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "Not enough credits. Top up to continue.", code: "insufficient_credits" },
          { status: 402 },
        );
      }
      return NextResponse.json(
        { error: "Premium billing is being configured — free voices work.", code: "billing_unavailable" },
        { status: 503 },
      );
    }
  }

  const provider = new DeepgramProvider();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.stream({
          text,
          voice,
          rate,
          pronunciations,
          tag: `${userId ?? "guest"}:stream:${generationId}`,
        })) {
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
        await recordProviderUsage(voice.provider, charCount, 0, { tier: "flagship" });
      } catch (err) {
        console.error("[stream] deepgram failed", err);
        if (!isGuest) {
          try {
            await refundCredits({ userId: userId!, amount: credits, generationId, description: "refunded failed stream" });
          } catch (refundErr) {
            console.error("[stream] refund failed (manual action needed)", refundErr);
          }
        }
        await recordProviderUsage(voice.provider, 0, 0, { tier: "flagship", errored: true });
        controller.error(err);
      }
    },
    // client aborted mid-stream: they never received the full audio, refund
    async cancel() {
      if (!isGuest) {
        try {
          await refundCredits({ userId: userId!, amount: credits, generationId, description: "refunded aborted stream" });
        } catch (err) {
          console.error("[stream] abort refund failed (manual action needed)", err);
        }
      }
      await recordProviderUsage(voice.provider, 0, 0, { tier: "flagship", errored: true });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "audio/wav", // linear16 wrapped in WAV by the player
      "x-lv-generation": generationId,
      "x-lv-chars": String(charCount),
      "x-lv-credits": String(!isGuest ? credits : 0),
    },
  });
}