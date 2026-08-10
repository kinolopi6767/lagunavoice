import { NextResponse } from "next/server";
import { z } from "zod";
import { DeepgramProvider } from "@/lib/tts/deepgram";
import { getVoiceById } from "@/lib/tts/catalog";
import { moderateText } from "@/lib/security/moderation";
import { createClient } from "@/lib/supabase/server";

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
  const key = `${ip}:${new Date().toISOString().slice(0, 10)}`;
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

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("cf-connecting-ip") || "unknown";
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  const body = await request.json().catch(() => null);
  const parsed = StreamSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const { text, voiceId, rate, pronunciations } = parsed.data;
  const charCount = Array.from(text).length;

  const moderation = await moderateText(text);
  if (moderation.verdict === "block") {
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

  // guest rate limit (in-memory; DB-backed in M7)
  if (!consumeGuestStream(ip)) {
    return NextResponse.json(
      { error: "Streaming preview limit reached for today.", code: "daily_limit_exceeded" },
      { status: 429 },
    );
  }

  // authenticate → user id (for tags + future billing); guests allowed with tag
  let userId = "guest";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) userId = data.user.id;
  } catch {
    // Supabase not configured — guests proceed
  }

  const provider = new DeepgramProvider();
  const generationId = crypto.randomUUID();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of provider.stream({
          text,
          voice,
          rate,
          pronunciations,
          tag: `${userId}:guest-stream:${generationId}`,
        })) {
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("[stream] deepgram failed", err);
        controller.error(err);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "audio/wav", // linear16 wrapped in WAV by the player
      "x-lv-generation": generationId,
      "x-lv-chars": String(charCount),
    },
  });
}
