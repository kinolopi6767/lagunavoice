import type {
  SynthesizeRequest,
  SynthesizeResult,
  TtsProvider,
  VoiceRecord,
} from "@/lib/tts/types";

/**
 * TypecastProvider — premium tier (api.typecast.ai, X-API-KEY).
 *
 * Model: ssfm-v30 (37 languages, smart emotion presets); fallback ssfm-v21.
 * Voices: tc_* built-in (public catalog), uc_* custom clones (owner-only — M6).
 * Credits: 1 credit = 1 char (billed by our ledger, not here).
 * Cost: Lite $15/mo, $0.07-0.09/1K chars wholesale (research/01 §19).
 *
 * Env-gated: without TYPECAST_API_KEY the provider is inert (no voices,
 * synthesize throws) so the app degrades gracefully.
 */

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`${provider} is not configured (missing API key)`);
    this.name = "ProviderNotConfiguredError";
  }
}

const API_BASE = "https://api.typecast.ai";

interface TypecastVoice {
  voice_id: string;
  voice_name: string;
  models?: Array<{ version?: string; emotions?: string[] }>;
  gender?: string;
  age?: string;
  use_cases?: string[];
  voice_type?: "original" | "custom";
}

/** our style names → Typecast emotion presets + intensity */
const STYLE_MAP: Record<string, { preset: string; intensity: number }> = {
  neutral: { preset: "normal", intensity: 1.0 },
  cheerful: { preset: "happy", intensity: 1.2 },
  calm: { preset: "normal", intensity: 0.4 },
  serious: { preset: "normal", intensity: 1.6 },
  excited: { preset: "toneup", intensity: 1.2 },
};

export class TypecastProvider implements TtsProvider {
  readonly name = "typecast" as const;
  readonly maxCharsPerRequest = 2_000;
  readonly maxConcurrent = 5;

  private apiKey(): string | null {
    return process.env.TYPECAST_API_KEY ?? null;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const key = this.apiKey();
    if (!key) {
      throw new ProviderNotConfiguredError("Typecast");
    }
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    return res;
  }

  async listVoices(): Promise<VoiceRecord[]> {
    try {
      const res = await this.request("/v1/voices");
      if (!res.ok) {
        console.error(`[typecast] listVoices ${res.status}: ${await res.text()}`);
        return [];
      }
      const data = (await res.json()) as TypecastVoice[] | { voices?: TypecastVoice[] };
      const voices = Array.isArray(data) ? data : (data.voices ?? []);
      const builtIn = voices.filter((v) => v.voice_id?.startsWith("tc_"));
      const language = "eng";

      return builtIn.map((v) => {
        const modelVersion = v.models?.[0]?.version;
        const [gender, ageGroup] = normalizeMetadata(v.gender, v.age);
        return {
          id: `fs_voice_${v.voice_id}`,
          provider: "typecast" as const,
          providerVoiceId: v.voice_id,
          modelVersion,
          name: v.voice_name,
          language,
          gender,
          ageGroup,
          useCases: v.use_cases,
          tier: "premium" as const,
          providerMeta: v as unknown as Record<string, unknown>,
        };
      });
    } catch (err) {
      if (err instanceof ProviderNotConfiguredError) return [];
      console.error("[typecast] listVoices failed", err);
      return [];
    }
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const style = STYLE_MAP[req.style ?? "neutral"] ?? STYLE_MAP.neutral;

    // ssfm-v30 max 2,000 chars/request; caller must chunk (long-form worker, M5)
    if (Array.from(req.text).length > this.maxCharsPerRequest) {
      throw new Error(`Typecast supports at most ${this.maxCharsPerRequest} chars per request`);
    }

    const body = {
      voice_id: req.voice.providerVoiceId,
      text: req.text,
      model: req.voice.modelVersion === "ssfm-v21" ? "ssfm-v21" : "ssfm-v30",
      prompt: {
        emotion_type: "preset",
        emotion_preset: style.preset,
        emotion_intensity: style.intensity,
      },
      output: {
        audio_format: "mp3",
        target_lufs: -16, // consistent loudness across voices (research/07)
        audio_pitch: req.pitch ?? 0,
        audio_tempo: req.rate ?? 1.0,
      },
      // fixed seed per long-form job → identical prosody across chunks
      seed: req.seed,
    };

    // word-level timestamps (research/07 A.7): same credit cost, best SRT source
    const res = await this.request("/v1/text-to-speech/with-timestamps", {
      method: "POST",
      body: JSON.stringify({ ...body, granularity: "word" }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[typecast] synthesize ${res.status}: ${detail.slice(0, 300)}`);
      throw new Error(`Typecast synthesis failed (${res.status})`);
    }

    const data = (await res.json()) as {
      audio?: string; // base64
      audio_base64?: string;
      words?: Array<{ text?: string; start?: number; end?: number }>;
      characters?: Array<{ text?: string; start?: number; end?: number }>;
    };

    const audioB64 = data.audio ?? data.audio_base64;
    if (!audioB64) {
      throw new Error("Typecast response missing audio");
    }
    const audio = Buffer.from(audioB64, "base64");

    // start/end are in SECONDS per the API contract
    const words = (data.words ?? data.characters ?? [])
      .filter((w) => typeof w.start === "number" && typeof w.end === "number")
      .map((w) => ({
        word: w.text ?? "",
        startMs: Math.round((w.start ?? 0) * 1_000),
        endMs: Math.round((w.end ?? 0) * 1_000),
      }))
      .filter((w) => w.word.length > 0);

    return {
      audio,
      mimeType: "audio/mpeg",
      durationMs: words.length > 0 ? words[words.length - 1].endMs : 0,
      charCount: Array.from(req.text).length,
      words: words.length > 0 ? words : undefined,
    };
  }

  /**
   * Instant cloning — POST /v1/voices/clone (multipart/form-data).
   * Verified contract (research/07 B.1.1): file WAV/MP3 5–150s ≤25MB,
   * name 1–30 chars, model ssfm-v21|v30 → { voice_id: "uc_…" }.
   * Clones are bound to the model and speak every language it supports.
   */
  async clone(
    sample: Buffer,
    name: string,
    opts?: { model?: "ssfm-v21" | "ssfm-v30"; language?: string },
  ): Promise<string> {
    const key = this.apiKey();
    if (!key) throw new ProviderNotConfiguredError("Typecast");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(sample)], { type: "audio/mpeg" }), "sample.mp3");
    form.append("name", name.slice(0, 30));
    form.append("model", opts?.model ?? "ssfm-v30");

    const res = await fetch(`${API_BASE}/v1/voices/clone`, {
      method: "POST",
      headers: { "X-API-KEY": key },
      body: form,
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[typecast] clone ${res.status}: ${detail.slice(0, 300)}`);
      throw new Error(`Voice cloning failed (${res.status})`);
    }

    const data = (await res.json()) as { voice_id?: string };
    if (!data.voice_id) {
      throw new Error("Typecast clone response missing voice_id");
    }
    return data.voice_id;
  }

  /** free a clone slot — DELETE /v1/voices/{voice_id} */
  async deleteClone(voiceId: string): Promise<void> {
    const res = await this.request(`/v1/voices/${voiceId}`, { method: "DELETE" });
    if (!res.ok) {
      console.error(`[typecast] deleteClone ${res.status}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey()) return false;
    try {
      const res = await this.request("/v1/subscription");
      return res.ok;
    } catch {
      return false;
    }
  }
}

function normalizeMetadata(
  gender?: string,
  age?: string,
): [VoiceRecord["gender"], VoiceRecord["ageGroup"]] {
  const g = (gender ?? "").toLowerCase();
  const genderNorm =
    g === "male" || g === "female" ? g : ("other" as const);

  const ageMap: Record<string, VoiceRecord["ageGroup"]> = {
    child: "child",
    teenager: "teenager",
    young_adult: "young_adult",
    middle_age: "middle_age",
    elder: "elder",
  };
  return [genderNorm, ageMap[(age ?? "").toLowerCase()] ?? undefined];
}
