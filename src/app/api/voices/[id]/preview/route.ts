import { NextResponse } from "next/server";
import { getProvider } from "@/lib/tts/registry";
import { getVoiceById } from "@/lib/tts/catalog";
import { getPreview, setPreview } from "@/lib/cache/preview";
import { resolveSession } from "@/lib/sandbox/session";
import { clientIp } from "@/lib/http/client-ip";
import { isProviderKillSwitched, providerWithinSpendCap } from "@/lib/ops/flags";
import { recordProviderUsage } from "@/lib/costs/store";

export const dynamic = "force-dynamic";

const PREVIEW_TEXT =
  "Hi, I'm {name}. Welcome to LugunaVoice. Some words are meant to be read, others are waiting to be heard.";

// preview generation costs provider credits (premium/flagship) — cap per IP
const PREVIEWS_PER_IP_PER_DAY = 30;
const previewCounts = new Map<string, number>();

function consumePreview(ip: string): boolean {
  const key = `${ip}:${new Date().toISOString().slice(0, 10)}`;
  const used = previewCounts.get(key) ?? 0;
  if (used >= PREVIEWS_PER_IP_PER_DAY) return false;
  previewCounts.set(key, used + 1);
  return true;
}

/**
 * GET /api/voices/[id]/preview — play a voice preview (incl. owner's clones).
 * Generates once per voice (cached 24h), rate limited per IP, kill-switch aware.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { userId: ownerUserId } = await resolveSession();

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

  // provider down or admin-disabled
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

  // per-IP daily preview cap (protects provider spend)
  const ip = clientIp(request);
  if (!consumePreview(ip)) {
    return NextResponse.json(
      { error: "Preview limit reached for today.", code: "daily_limit_exceeded" },
      { status: 429 },
    );
  }

  try {
    const provider = getProvider(voice.provider);
    const result = await provider.synthesize({
      text: PREVIEW_TEXT.replace("{name}", voice.name.split(" ")[0] ?? voice.name),
      voice,
      style: "neutral",
    });

    setPreview(cacheKey, result.audio, result.mimeType);
    // previews cost the provider money too — record for COGS tracking
    await recordProviderUsage(voice.provider, result.charCount, 0, {
      tier: voice.tier === "free" ? undefined : voice.tier,
      errored: false,
    });

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
