import { NextResponse } from "next/server";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { getPreview, setPreview } from "@/lib/cache/preview";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PREVIEW_TEXT =
  "Hi, I'm {name}. Welcome to LugunaVoice. Some words are meant to be read, others are waiting to be heard.";

/**
 * GET /api/voices/[id]/preview — play a voice preview (incl. owner's clones).
 * Generates once per voice, then serves from cache (24h TTL).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let ownerUserId: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) ownerUserId = data.user.id;
  } catch {
    // guests can preview stock voices only
  }

  const voice = await getVoiceById(id, ownerUserId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  const cacheKey = `preview:${voice.provider}:${voice.providerVoiceId}`;
  const cached = getPreview(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached.audio), {
      headers: {
        "content-type": cached.mimeType,
        "cache-control": "public, max-age=86400",
      },
    });
  }

  try {
    const provider = getProvider(voice.provider);
    const result = await provider.synthesize({
      text: PREVIEW_TEXT.replace("{name}", voice.name.split(" ")[0] ?? voice.name),
      voice,
      style: "neutral",
    });

    setPreview(cacheKey, result.audio, result.mimeType);

    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "content-type": result.mimeType,
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error(`[preview] synthesis failed for ${id}`, err);
    return NextResponse.json(
      { error: "Could not generate preview. Please try again.", code: "voice_engine_unavailable" },
      { status: 503 },
    );
  }
}
