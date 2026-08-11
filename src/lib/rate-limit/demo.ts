/**
 * Guest demo rate limiter — in-memory daily cap per IP (12 generations/day).
 *
 * M1 stand-in: Supabase/Postgres may not exist yet. M2 replaces this with the
 * DB-backed `ip_sessions` table (planning/04) so limits survive restarts and
 * spread across instances. Vercel's serverless keeps one warm instance per
 * region — fine for the 12/day demo cap, wrong for production limits.
 */

const DAILY_LIMIT = 12;

interface Counter {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

const store = new Map<string, Counter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDemoRemaining(ip: string): number {
  const entry = store.get(ip);
  if (!entry || entry.date !== todayKey()) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - entry.count);
}

/**
 * Consume one demo generation. Returns { allowed, remaining }.
 */
export function consumeDemoGeneration(ip: string): { allowed: boolean; remaining: number } {
  const key = todayKey();
  const entry = store.get(ip);

  if (!entry || entry.date !== key) {
    store.set(ip, { date: key, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}
