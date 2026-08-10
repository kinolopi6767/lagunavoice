/**
 * TTS provider abstraction — the core design decision of the architecture.
 * A voice record knows its provider; the registry dispatches synthesis.
 * Adding an engine = implementing this interface + registering it (see registry.ts).
 */

export type ProviderName = "edge" | "typecast" | "deepgram" | "kokoro";

export type VoiceTier = "free" | "premium" | "flagship";

export interface VoiceRecord {
  /** our public id, e.g. fs_voice_<16hex> */
  id: string;
  provider: ProviderName;
  /** provider-native id: en-US-AriaNeural | tc_xxx | uc_xxx | aura-2-thalia-en */
  providerVoiceId: string;
  modelVersion?: string;
  name: string;
  language: string; // BCP-47
  country?: string;
  gender?: "male" | "female" | "other";
  ageGroup?: "child" | "teenager" | "young_adult" | "middle_age" | "elder";
  useCases?: string[];
  tags?: string[];
  tier: VoiceTier;
  isCustom?: boolean;
  ownerUserId?: string;
  previewUrl?: string;
  /** raw payload from the provider list API (pass-through for sync jobs) */
  providerMeta?: Record<string, unknown>;
}

export interface SynthesizeRequest {
  text: string;
  voice: VoiceRecord;
  /** provider-specific style/emotion hint (mapped per provider) */
  style?: string;
  /** semitones -12..12 */
  pitch?: number;
  /** 0.5..2.0 */
  rate?: number;
}

export interface SynthesizeResult {
  audio: Buffer;
  mimeType: "audio/mpeg" | "audio/wav";
  durationMs: number;
  charCount: number;
}

export interface TtsProvider {
  readonly name: ProviderName;
  /** fetch/refresh the voice catalog from the provider */
  listVoices(): Promise<VoiceRecord[]>;
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;
  /** streaming synthesis (Deepgram; others return undefined) */
  stream?(req: SynthesizeRequest): AsyncIterable<Buffer>;
  /** voice cloning (Typecast) */
  clone?(sample: Buffer, name: string): Promise<string>;
  /** hard provider limits (drives chunking/queues) */
  readonly maxCharsPerRequest: number;
  readonly maxConcurrent: number;
  healthCheck(): Promise<boolean>;
}
