import { listProviders } from "@/lib/tts/registry";
import type { VoiceRecord } from "@/lib/tts/types";

/**
 * Voice catalog service.
 *
 * Two modes:
 *  1. DB mode (once Supabase exists): voices are upserted into the `voices`
 *     table (drizzle) and queried from Postgres (search, filters, pagination).
 *  2. Memory mode (pre-M2 setup / no DATABASE_URL): the catalog is fetched
 *     from the providers at first request, cached in-process with a TTL.
 *
 * The public API surface is identical in both modes, so the library UI and
 * routes do not change when the DB goes live.
 */

interface CatalogState {
  voices: VoiceRecord[];
  loadedAt: number;
  loading: Promise<void> | null;
}

const state: CatalogState = { voices: [], loadedAt: 0, loading: null };
const TTL_MS = 60 * 60 * 1000; // 1 hour

const voiceSort = (a: VoiceRecord, b: VoiceRecord) => a.name.localeCompare(b.name);

export interface SearchOptions {
  q?: string;
  language?: string;
  gender?: string;
  tier?: string;
  provider?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  voices: VoiceRecord[];
  total: number;
}

/** fetch from all registered providers and normalize */
async function fetchCatalog(): Promise<VoiceRecord[]> {
  const all: VoiceRecord[] = [];
  for (const provider of listProviders()) {
    try {
      const voices = await provider.listVoices();
      all.push(...voices);
    } catch (err) {
      console.error(`[catalog] provider ${provider.name} sync failed`, err);
    }
  }
  return all.sort(voiceSort);
}

/** ensure the catalog is loaded (memoized, concurrent-safe) */
function ensureLoaded(): Promise<void> {
  if (state.voices.length > 0 && Date.now() - state.loadedAt < TTL_MS) {
    return Promise.resolve();
  }
  if (state.loading) return state.loading;

  state.loading = (async () => {
    try {
      state.voices = await fetchCatalog();
      state.loadedAt = Date.now();
    } finally {
      state.loading = null;
    }
  })();
  return state.loading;
}

export async function searchVoices(opts: SearchOptions = {}): Promise<SearchResult> {
  await ensureLoaded();

  const q = opts.q?.trim().toLowerCase();
  let voices = state.voices;

  if (q) {
    voices = voices.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q) ||
        v.providerVoiceId.toLowerCase().includes(q),
    );
  }
  if (opts.language) {
    voices = voices.filter((v) => v.language.toLowerCase() === opts.language!.toLowerCase());
  }
  if (opts.gender) {
    voices = voices.filter((v) => v.gender === opts.gender);
  }
  if (opts.tier) {
    voices = voices.filter((v) => v.tier === opts.tier);
  }
  if (opts.provider) {
    voices = voices.filter((v) => v.provider === opts.provider);
  }

  const total = voices.length;
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 60;

  return { voices: voices.slice(offset, offset + limit), total };
}

export async function getVoiceById(id: string): Promise<VoiceRecord | null> {
  await ensureLoaded();
  return state.voices.find((v) => v.id === id) ?? null;
}

export async function listLanguages(): Promise<string[]> {
  await ensureLoaded();
  const langs = new Set(state.voices.map((v) => v.language));
  return [...langs].sort((a, b) => a.localeCompare(b));
}

/** count of voices per tier (for stats display) */
export async function catalogStats(): Promise<{ total: number; free: number; premium: number; flagship: number }> {
  await ensureLoaded();
  return {
    total: state.voices.length,
    free: state.voices.filter((v) => v.tier === "free").length,
    premium: state.voices.filter((v) => v.tier === "premium").length,
    flagship: state.voices.filter((v) => v.tier === "flagship").length,
  };
}

/** refresh trigger for the nightly sync job */
export async function refreshCatalog(): Promise<number> {
  const voices = await fetchCatalog();
  state.voices = voices;
  state.loadedAt = Date.now();
  return voices.length;
}
