import type { ProviderName, TtsProvider } from "@/lib/tts/types";
import { EdgeTtsProvider } from "@/lib/tts/edge";

/**
 * Provider registry — the only place engines are wired together.
 * Typecast (M3) and Deepgram (M4) implement the same interface and are added here.
 */

const providers = new Map<ProviderName, TtsProvider>([
  ["edge", new EdgeTtsProvider()],
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
