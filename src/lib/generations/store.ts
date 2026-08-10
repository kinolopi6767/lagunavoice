import { getProvider } from "@/lib/tts/registry";
import { moderateText } from "@/lib/security/moderation";
import type { VoiceRecord } from "@/lib/tts/types";

/**
 * Developer API generation store — async + poll model (FameSpeak-style).
 * In-memory until the DB `generations` table is wired.
 * Idempotency + char caps are enforced by the API routes.
 */

export interface ApiGeneration {
  id: string;
  userId: string;
  voiceId: string;
  provider: string;
  tier: "free" | "premium" | "flagship";
  status: "processing" | "completed" | "failed";
  text: string;
  textLength: number;
  style?: string;
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
  creditsCharged: number;
  error?: string;
  createdAt: number;
}

const generations = new Map<string, ApiGeneration>();
const TTL_MS = 60 * 60 * 1_000;

export function getGeneration(id: string): ApiGeneration | undefined {
  const gen = generations.get(id);
  if (!gen) return undefined;
  if (Date.now() - gen.createdAt > TTL_MS) {
    generations.delete(id);
    return undefined;
  }
  return gen;
}

export function listGenerations(userId: string, limit = 20): ApiGeneration[] {
  return [...generations.values()]
    .filter((g) => g.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

/**
 * Start a generation job. Returns the generation record — poll by id.
 * chunking respects the provider's per-request char cap.
 */
export function startGeneration(opts: {
  id: string;
  userId: string;
  voice: VoiceRecord;
  text: string;
  style?: string;
  pitch?: number;
  rate?: number;
  tag?: string;
}): ApiGeneration {
  const { id, userId, voice, text, style, pitch, rate, tag } = opts;
  const provider = getProvider(voice.provider);
  const charCount = Array.from(text).length;

  const gen: ApiGeneration = {
    id,
    userId,
    voiceId: voice.id,
    provider: voice.provider,
    tier: voice.tier,
    status: "processing",
    text,
    textLength: charCount,
    style,
    creditsCharged: voice.tier === "flagship" ? charCount * 2 : voice.tier === "premium" ? charCount : 0,
    createdAt: Date.now(),
  };
  generations.set(id, gen);

  void (async () => {
    try {
      // chunk at provider caps (single gen is usually 1 chunk; long text splits)
      const maxChars = Math.min(provider.maxCharsPerRequest, 2_000);
      const chunks = charCount <= maxChars ? [text] : splitText(text, maxChars);
      const audios: Buffer[] = [];
      let durationMs = 0;

      for (const chunk of chunks) {
        const result = await provider.synthesize({ text: chunk, voice, style, pitch, rate, tag });
        audios.push(result.audio);
        durationMs += result.durationMs ?? 0;
      }

      const audio = audios.length === 1 ? audios[0] : Buffer.concat(audios);

      gen.audioBase64 = audio.toString("base64");
      gen.mimeType = "audio/mpeg";
      gen.durationMs = durationMs;
      gen.status = "completed";
    } catch (err) {
      gen.status = "failed";
      gen.error = (err as Error).message;
    } finally {
      setTimeout(() => generations.delete(id), TTL_MS);
    }
  })();

  return gen;
}

function splitText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut < maxChars * 0.5) cut = maxChars;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export { moderateText };
