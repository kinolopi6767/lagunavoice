/**
 * Preview audio cache — in-memory with TTL.
 * DB/storage-backed caching lands with the generation storage pipeline (M5).
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 300; // LRU cap — ~1,100 voices × 50KB would leak 50-150MB

interface CachedPreview {
  audio: Buffer;
  mimeType: string;
  cachedAt: number;
}

const store = new Map<string, CachedPreview>();

function sweepExpired(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.cachedAt > TTL_MS) store.delete(key);
  }
}

export function getPreview(key: string): CachedPreview | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry;
}

export function setPreview(key: string, audio: Buffer, mimeType: string): void {
  const now = Date.now();
  if (store.size >= MAX_ENTRIES) {
    sweepExpired(now);
  }
  if (store.size >= MAX_ENTRIES) {
    // still over the cap: evict the least-recently-set entry
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, e] of store) {
      if (e.cachedAt < oldestAt) {
        oldestAt = e.cachedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { audio, mimeType, cachedAt: now });
}
