import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiKey, hasScope, getIdempotencyResult, setIdempotencyResult, rateLimitCheck } from "@/lib/keys/store";
import { getVoiceById } from "@/lib/tts/catalog";
import { startGeneration } from "@/lib/generations/store";
import { moderateText } from "@/lib/security/moderation";
import { isProviderKillSwitched, providerWithinSpendCap } from "@/lib/ops/flags";
import { checkGenerationVelocity, isBanned } from "@/lib/abuse/rules";
import { InsufficientCreditsError, debitCredits, refundCredits } from "@/lib/credits/ledger";
import { recordProviderUsage } from "@/lib/costs/store";

/**
 * POST /api/v1/tts/generations — developer API (async + poll).
 *
 * Auth: Authorization: Bearer lug_...
 * Idempotency: Idempotency-Key header — replays return the original result
 * (never double-charged). Rate limited per key (rpm).
 *
 * Body: { text, voice, style?, pitch?, rate? }
 * Response 202: { id, status, estimatedCredits } → poll GET /api/v1/generations/:id
 */

const GenerationSchema = z.object({
  text: z.string().min(1).max(10_000),
  voice: z.string(),
  style: z.string().max(32).optional(),
  pitch: z.number().min(-12).max(12).optional(),
  rate: z.number().min(0.5).max(2).optional(),
});

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export async function POST(request: Request) {
  // 1. API key auth
  const token = bearerToken(request);
  const record = token ? verifyApiKey(token) : null;
  if (!record) {
    return NextResponse.json({ error: "Missing or invalid API key.", code: "invalid_api_key" }, { status: 401 });
  }
  if (!hasScope(record, "tts:generate")) {
    return NextResponse.json({ error: "This key cannot generate audio.", code: "forbidden" }, { status: 403 });
  }
  if (isBanned(record.userId)) {
    return NextResponse.json({ error: "Account restricted.", code: "account_restricted" }, { status: 403 });
  }
  if (checkGenerationVelocity(`user:${record.userId}`, record.userId)) {
    return NextResponse.json(
      { error: "Too many requests. Slow down and try again.", code: "rate_limited" },
      { status: 429 },
    );
  }

  // 2. Rate limit
  const limit = rateLimitCheck(record);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1_000)) } },
    );
  }

  // 3. Idempotency — replay returns the original generation (never recharges)
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    const previous = getIdempotencyResult(`k:${record.id}:${idempotencyKey}`);
    if (previous) {
      return NextResponse.json(
        { id: previous, status: "processing", replay: true },
        { status: 202 },
      );
    }
  }

  // 4. Validate body
  const body = await request.json().catch(() => null);
  const parsed = GenerationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }
  const { text, voice: voiceId, style, pitch, rate } = parsed.data;

  // 5. Moderation
  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    return NextResponse.json({ error: "This text can't be used.", code: "content_policy" }, { status: 400 });
  }

  // 6. Voice resolution + kill-switch
  const voice = await getVoiceById(voiceId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }
  const disabled = isProviderKillSwitched(voice.provider);
  if (disabled) {
    return NextResponse.json(
      { error: "Voice engine temporarily unavailable.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // daily spend guard (COGS)
  if (!(await providerWithinSpendCap(voice.provider))) {
    return NextResponse.json(
      { error: "Voice engine daily spend limit reached.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }

  // 7. Credits: premium = 1/char, flagship = 2/char, free = 0.
  //    Debited atomically before synthesis, refunded automatically on failure.
  const charCount = Array.from(text).length;
  const creditRate = voice.tier === "flagship" ? 2 : voice.tier === "premium" ? 1 : 0;
  const credits = charCount * creditRate;
  const generationId = `gen_${crypto.randomUUID().replaceAll("-", "")}`;

  if (credits > 0) {
    try {
      await debitCredits({ userId: record.userId, amount: credits, generationId, description: `api: ${voice.name}` });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "Not enough credits. Top up to continue.", code: "insufficient_credits" },
          { status: 402 },
        );
      }
      throw err;
    }
  }

  // 8. Start generation (refund on provider failure).
  //    Record the idempotency result only now — after the debit succeeded —
  //    so a failed request can be safely retried with the same key.
  if (idempotencyKey) {
    setIdempotencyResult(`k:${record.id}:${idempotencyKey}`, generationId);
  }
  startGeneration({
    id: generationId,
    userId: record.userId,
    voice,
    text,
    style,
    pitch,
    rate,
    tag: `${record.userId}:api:${record.id}`,
    onDone: async (failed) => {
      await recordProviderUsage(voice.provider, charCount, 0, {
        tier: voice.tier === "flagship" ? "flagship" : "premium",
        errored: failed,
      });
      if (failed && credits > 0) {
        try {
          await refundCredits({ userId: record.userId, amount: credits, generationId, description: "refunded failed API generation" });
        } catch (refundErr) {
          console.error("[v1] refund failed (manual action needed)", refundErr);
        }
      }
    },
  });

  return NextResponse.json(
    { id: generationId, status: "processing", estimatedCredits: credits },
    { status: 202 },
  );
}
