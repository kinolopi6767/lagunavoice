import type { ProviderName, TtsProvider } from "@/lib/tts/types";
import { EdgeTtsProvider } from "@/lib/tts/edge";
import { TypecastProvider } from "@/lib/tts/typecast";
import { DeepgramProvider } from "@/lib/tts/deepgram";

/**
 * Provider registry — the only place engines are wired together.
 * All three tiers are registered; providers degrade gracefully when their
 * API key is missing (no voices, clear errors on synthesize).
 */

const providers = new Map<ProviderName, TtsProvider>([
  ["edge", new EdgeTtsProvider()],
  ["typecast", new TypecastProvider()],
  ["deepgram", new DeepgramProvider()],
]);

export function getProvider(name: ProviderName): TtsProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Provider "${name}" is not registered`);
  }
  return provider;
}

export function listProviders(): TtsProvider[] {
  return [...providers.values()];
}