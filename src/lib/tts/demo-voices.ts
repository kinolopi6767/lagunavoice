import type { VoiceRecord } from "@/lib/tts/types";

/**
 * Curated demo voices for the no-signup landing generator.
 * IDs match the catalog scheme (`fs_voice_edge_<ShortName>`) so the demo
 * resolves through the real catalog (lib/tts/catalog.ts) — the same voice
 * works in the demo, the library and the Studio.
 */
export const DEMO_VOICES: VoiceRecord[] = [
  { id: "fs_voice_edge_en-US-AndrewMultilingualNeural", provider: "edge", providerVoiceId: "en-US-AndrewMultilingualNeural", name: "Andrew", language: "en-US", country: "United States", gender: "male", tier: "free" },
  { id: "fs_voice_edge_en-US-AriaNeural", provider: "edge", providerVoiceId: "en-US-AriaNeural", name: "Aria", language: "en-US", country: "United States", gender: "female", tier: "free" },
  { id: "fs_voice_edge_en-GB-RyanNeural", provider: "edge", providerVoiceId: "en-GB-RyanNeural", name: "Ryan", language: "en-GB", country: "United Kingdom", gender: "male", tier: "free" },
  { id: "fs_voice_edge_en-GB-SoniaNeural", provider: "edge", providerVoiceId: "en-GB-SoniaNeural", name: "Sonia", language: "en-GB", country: "United Kingdom", gender: "female", tier: "free" },
  { id: "fs_voice_edge_en-AU-NatashaNeural", provider: "edge", providerVoiceId: "en-AU-NatashaNeural", name: "Natasha", language: "en-AU", country: "Australia", gender: "female", tier: "free" },
  { id: "fs_voice_edge_en-IN-NeerjaExpressiveNeural", provider: "edge", providerVoiceId: "en-IN-NeerjaExpressiveNeural", name: "Neerja", language: "en-IN", country: "India", gender: "female", tier: "free" },
  { id: "fs_voice_edge_hi-IN-MadhurNeural", provider: "edge", providerVoiceId: "hi-IN-MadhurNeural", name: "Madhur", language: "hi-IN", country: "India", gender: "male", tier: "free" },
  { id: "fs_voice_edge_es-ES-ElviraNeural", provider: "edge", providerVoiceId: "es-ES-ElviraNeural", name: "Elvira", language: "es-ES", country: "Spain", gender: "female", tier: "free" },
  { id: "fs_voice_edge_fr-FR-HenriNeural", provider: "edge", providerVoiceId: "fr-FR-HenriNeural", name: "Henri", language: "fr-FR", country: "France", gender: "male", tier: "free" },
  { id: "fs_voice_edge_de-DE-KatjaNeural", provider: "edge", providerVoiceId: "de-DE-KatjaNeural", name: "Katja", language: "de-DE", country: "Germany", gender: "female", tier: "free" },
  { id: "fs_voice_edge_pt-BR-FranciscaNeural", provider: "edge", providerVoiceId: "pt-BR-FranciscaNeural", name: "Francisca", language: "pt-BR", country: "Brazil", gender: "female", tier: "free" },
  { id: "fs_voice_edge_ja-JP-NanamiNeural", provider: "edge", providerVoiceId: "ja-JP-NanamiNeural", name: "Nanami", language: "ja-JP", country: "Japan", gender: "female", tier: "free" },
];

export const DEMO_STYLES = [
  { id: "neutral", name: "Neutral" },
  { id: "cheerful", name: "Cheerful" },
  { id: "calm", name: "Calm" },
  { id: "serious", name: "Serious" },
  { id: "excited", name: "Excited" },
];

export const DEMO_MAX_CHARS = 260;
