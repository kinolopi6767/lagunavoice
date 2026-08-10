import type { ProviderName, TtsProvider } from "@/lib/tts/types";
import { EdgeTtsProvider } from "@/lib/tts/edge";
import { TypecastProvider } from "@/lib/tts/typecast";

/**
 * Provider registry — the only place engines are wired together.
 * Deepgram (M4) implements the same interface and is added here.
 */

const providers = new Map<ProviderName, TtsProvider>([
  ["edge", new EdgeTtsProvider()],
  ["typecast", new TypecastProvider()],
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

export function isProviderEnabled(name: ProviderName): boolean {
  return providers.has(name);
}
