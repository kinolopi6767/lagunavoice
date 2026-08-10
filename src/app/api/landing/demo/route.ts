import { NextResponse } from "next/server";
import { z } from "zod";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { DEMO_MAX_CHARS, DEMO_STYLES, DEMO_VOICES } from "@/lib/tts/demo-voices";
import { moderateText } from "@/lib/security/moderation";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { consumeDemoGeneration, getDemoRemaining } from "@/lib/rate-limit/demo";
import { isProviderKillSwitched } from "@/lib/ops/flags";

/**
 * POST /api/landing/demo — no-signup voice demo (FameSpeak-style).
 *
 * Body: { text, voice, style, turnstileToken? }
 * Response 200: { audioBase64, mimeType, durationMs, remaining }
 *
 * Guards (in order): Turnstile → moderation → rate limit → validation.
 */

const DemoRequestSchema = z.object({
  text: z.string().min(1).max(DEMO_MAX_CHARS),
  voice: z.string(),
  style: z.string().default("neutral"),
  turnstileToken: z.string().optional(),
});

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  const parsed = DemoRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", code: "invalid_request" },
      { status: 400 },
    );
  }

  const { text, voice, style, turnstileToken } = parsed.data;

  // 1. CAPTCHA (skip when not configured — dev mode)
  const captcha = await verifyTurnstileToken(turnstileToken ?? null);
  if (!captcha.success) {
    return NextResponse.json(
      { error: "Robot check failed. Please try again.", code: "captcha_failed" },
      { status: 403 },
    );
  }

  // 2. Content moderation (skip when not configured)
  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
    return NextResponse.json(
      { error: "This text can't be used.", code: "content_policy" },
      { status: 400 },
    );
  }

  // 3. Rate limit (12/day per IP)
  const limit = consumeDemoGeneration(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Daily demo limit reached. Create a free account for unlimited free voices.", code: "daily_limit_exceeded" },
      { status: 429 },
    );
  }

  // 4. Validation: voice must be in the demo catalog (id scheme matches catalog)
  const voiceRecord = DEMO_VOICES.find((v) => v.id === voice);
  if (!voiceRecord) {
    return NextResponse.json(
      { error: "Choose one of the preview voices.", code: "invalid_voice" },
      { status: 400 },
    );
  }
  // resolve through the live catalog so provider details stay in sync
  const resolved = await getVoiceById(voiceRecord.id);
  if (!resolved) {
    return NextResponse.json(
      { error: "This voice is unavailable right now.", code: "not_found" },
      { status: 404 },
    );
  }

  const styleValid = DEMO_STYLES.some((s) => s.id === style);
  if (!styleValid) {
    return NextResponse.json(
      { error: "Unknown style.", code: "invalid_request" },
      { status: 400 },
    );
  }

  // 5. Synthesize via the Edge provider (kill-switch aware)
  try {
    const provider = getProvider(resolved.provider);
    const disabled = isProviderKillSwitched(resolved.provider);
    if (disabled) {
      return NextResponse.json(
        { error: "We could not reach the voice engine. Please try again.", code: "voice_engine_unavailable" },
        { status: 503 },
      );
    }
    const result = await provider.synthesize({
      text,
      voice: resolved,
      style,
    });

    return NextResponse.json({
      audioBase64: result.audio.toString("base64"),
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      remaining: getDemoRemaining(ip),
    });
  } catch (err) {
    console.error("[demo] synthesis failed", err);
    return NextResponse.json(
      { error: "We could not reach the voice engine. Please try again.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }
}
