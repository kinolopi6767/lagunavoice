import { DeepgramClient } from "@deepgram/sdk";
import { ALL_DEEPGRAM_VOICES, type DeepgramVoiceSeed } from "@/lib/tts/deepgram-voices";
import { ProviderNotConfiguredError } from "@/lib/tts/typecast";
import type {
  SynthesizeRequest,
  SynthesizeResult,
  TtsProvider,
  VoiceRecord,
} from "@/lib/tts/types";

/**
 * DeepgramProvider — flagship tier (api.deepgram.com, @deepgram/sdk).
 *
 * - Aura-2 $0.030/1k chars (flagship) · Aura-1 $0.015/1k (research/05).
 * - Streaming: WebSocket (linear16) + REST returns audio from the first byte.
 * - No cloning, no SSML; pronunciation = inline IPA overrides.
 * - Every request carries `tag=lv:...` for per-user COGS reporting
 *   (billing/breakdown API, research/09).
 * - mip_opt_out default true (protects user content; pricing impact per
 *   research/05 §1.1 — toggle via env DEEPGRAM_MIP_OPT_OUT).
 */

const API_BASE = "https://api.deepgram.com";

const AGE_MAP: Record<string, VoiceRecord["ageGroup"]> = {
  "Young Adult": "young_adult",
  Adult: "young_adult",
  Mature: "middle_age",
};

function toVoiceRecord(seed: DeepgramVoiceSeed, flagship: boolean): VoiceRecord {
  const [model, name, gender, age, accent, useCases] = seed;
  const langTag = model.split("-").pop() ?? "en";
  const lang = langTag === "en" ? "en" : langTag === "es" ? "es" : langTag === "ja" ? "ja" : langTag === "de" ? "de" : langTag === "fr" ? "fr" : langTag === "it" ? "it" : "nl";
  return {
    id: `fs_voice_${model}`,
    provider: "deepgram",
    providerVoiceId: model,
    modelVersion: flagship ? "aura-2" : "aura-1",
    name,
    language: lang,
    country: accent.includes("-") ? accent.split("-")[1] : undefined,
    gender: gender === "feminine" ? "female" : "male",
    ageGroup: AGE_MAP[age],
    useCases: [...useCases],
    tier: "flagship",
    providerMeta: { accent, model },
  };
}

/**
 * inline IPA pronunciation override: `Take \{"word":"dupilumab","pronounce":"..."\} twice daily.`
 *
 * One-pass replacement: sequential replaceAll would corrupt earlier inserts
 * when an override's JSON happens to contain a later word. We insert
 * sentinel tokens per word first, then substitute tokens in a single pass.
 */
export function injectPronunciations(
  text: string,
  pronunciations?: Array<{ word: string; pronounce: string }>,
): string {
  if (!pronunciations?.length) return text;

  const SENTINEL = "\u0001LV\u0002";
  let out = text;
  const replacements = new Map<string, string>();

  pronunciations.forEach(({ word, pronounce }, i) => {
    if (!word) return;
    const token = `${SENTINEL}${i}${SENTINEL}`;
    out = out.replaceAll(word, token);
    replacements.set(token, `\\{${JSON.stringify({ word, pronounce }).slice(1, -1)}\\}`);
  });

  for (const [token, override] of replacements) {
    out = out.replaceAll(token, override);
  }
  return out;
}

export class DeepgramProvider implements TtsProvider {
  readonly name = "deepgram" as const;
  readonly maxCharsPerRequest = 2_000;
  readonly maxConcurrent = 15;

  private client(): DeepgramClient {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) throw new ProviderNotConfiguredError("Deepgram");
    return new DeepgramClient({ apiKey });
  }

  private mipOptOut(): boolean {
    return (process.env.DEEPGRAM_MIP_OPT_OUT ?? "true") !== "false";
  }

  async listVoices(): Promise<VoiceRecord[]> {
    if (!process.env.DEEPGRAM_API_KEY) return [];
    return ALL_DEEPGRAM_VOICES.map((v) => toVoiceRecord(v, v[0].includes("aura-2")));
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const client = this.client();
    const text = injectPronunciations(req.text, req.pronunciations);
    const speed = clampSpeed(req.rate);
    const tag = req.tag ? `lv:${req.tag}` : undefined;

    const response = await client.speak.v1.audio.generate({
      text,
      model: req.voice.providerVoiceId,
      encoding: "mp3",
      container: "mp3",
      speed,
      tag,
      mip_opt_out: this.mipOptOut(),
    });

    const chunks: Buffer[] = [];
    const body = response.stream();
    if (!body) throw new Error("Deepgram returned no stream");
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const audio = Buffer.concat(chunks);

    if (audio.length === 0) {
      throw new Error("Deepgram returned empty audio");
    }

    return {
      audio,
      mimeType: "audio/mpeg",
      durationMs: 0, // no timestamps from TTS (SRT round-trip via STT in M5)
      charCount: Array.from(req.text).length,
    };
  }

  /** realtime streaming — WebSocket, raw linear16 (16/24 kHz) */
  async *stream(req: SynthesizeRequest): AsyncGenerator<Buffer> {
    const client = this.client();
    const text = injectPronunciations(req.text, req.pronunciations);

    const connection = await client.speak.v1.connect({
      model: req.voice.providerVoiceId,
      encoding: "linear16",
      sample_rate: "24000",
    });

    // Promise-driven chunk queue: yield as WebSocket messages arrive so the
    // browser hears the first audio within ~1 message (sub-second TTFB)
    // instead of after the whole utterance is synthesized.
    const queue: Buffer[] = [];
    const HIGH_WATER = 128;
    let notify: (() => void) | null = null;
    let flushed = false;
    let streamError: Error | null = null;

    const wake = () => {
      const fn = notify;
      notify = null;
      fn?.();
    };

    try {
      await connection.waitForOpen();
      connection.sendText({ type: "Speak", text });
      connection.sendFlush({ type: "Flush" });

      connection.on("message", (message) => {
        if (typeof message === "string") {
          queue.push(Buffer.from(message, "base64"));
          wake();
        } else if (message.type === "Flushed") {
          flushed = true;
          wake();
        }
      });
      connection.on("error", (err) => {
        // must terminate the drain loop, otherwise the pull would hang forever
        streamError = err instanceof Error ? err : new Error(String(err));
        flushed = true;
        wake();
      });

      while (!flushed || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
          // backpressure: pause pulling until the WebSocket consumer drains
          if (queue.length >= HIGH_WATER) {
            while (queue.length >= HIGH_WATER && !flushed) {
              await new Promise<void>((resolve) => {
                notify = resolve;
              });
            }
          }
        } else {
          await new Promise<void>((resolve) => {
            notify = resolve;
          });
        }
      }
      if (streamError) throw streamError;
    } finally {
      connection.close();
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!process.env.DEEPGRAM_API_KEY) return false;
    try {
      const res = await fetch(`${API_BASE}/v1/projects`, {
        headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
        cache: "no-store",
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

function clampSpeed(rate?: number): number {
  const speed = rate ?? 1.0;
  return Math.min(1.5, Math.max(0.7, speed));
}
