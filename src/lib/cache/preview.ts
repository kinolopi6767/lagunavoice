/**
 * Preview audio cache — in-memory with TTL.
 * DB/storage-backed caching lands with the generation storage pipeline (M5).
 */

const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedPreview {
  audio: Buffer;
  mimeType: string;
  cachedAt: number;
}

const store = new Map<string, CachedPreview>();

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
  store.set(key, { audio, mimeType, cachedAt: Date.now() });
}
