import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { consumeFreeChars } from "@/lib/rate-limit/caps";

/**
 * POST /api/studio/generate — free-tier (Edge) generation for the Studio.
 *
 * Guests: capped by IP (20 generations / 100k chars per day).
 * Registered users: same cap for now; M3 moves this to per-account credits
 * and persists generations to the DB.
 *
 * Body: { text, voiceId, style?, pitch?, rate? }
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

  // 2. Voice must exist and be free-tier for now
  const voice = await getVoiceById(voiceId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }
  if (voice.tier !== "free") {
    return NextResponse.json(
      { error: "Premium voices arrive with credits — coming soon.", code: "premium_unavailable" },
      { status: 402 },
    );
  }

  // 3. Daily caps
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

  // 4. Synthesize
  try {
    const provider = getProvider(voice.provider);
    const result = await provider.synthesize({ text, voice, style, pitch, rate });

    return NextResponse.json({
      audioBase64: result.audio.toString("base64"),
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      charCount,
      remainingChars: cap.remainingChars,
    });
  } catch (err) {
    console.error("[studio] synthesis failed", err);
    return NextResponse.json(
      { error: "We could not reach the voice engine. Please try again.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }
}
