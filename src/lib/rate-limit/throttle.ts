/**
 * Generic fixed-window rate limiter (in-memory, M5-stand-in).
 * Bounded memory: entries prune stale buckets once the map grows large.
 * Keys are caller-defined (user id, IP, email…).
 */
export function createThrottle(opts: { max: number; windowMs: number; maxTracked?: number }) {
  const { max, windowMs } = opts;
  const maxTracked = opts.maxTracked ?? 5_000;
  const hits = new Map<string, number[]>();

  return {
    /** consume a slot; returns allowed + how long to wait if blocked */
    check(key: string): { allowed: boolean; retryAfterMs: number } {
      const now = Date.now();
      if (hits.size >= maxTracked) {
        for (const [k, arr] of hits) {
          const fresh = arr.filter((t) => now - t < windowMs);
          if (fresh.length === 0) hits.delete(k);
          else hits.set(k, fresh);
        }
      }
      const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (list.length >= max) {
        const oldest = Math.min(...list);
        return { allowed: false, retryAfterMs: oldest + windowMs - now };
      }
      list.push(now);
      hits.set(key, list);
      return { allowed: true, retryAfterMs: 0 };
    },
    clear(key: string): void {
      hits.delete(key);
    },
  };
}
