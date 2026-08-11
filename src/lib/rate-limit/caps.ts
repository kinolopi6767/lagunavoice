/**
 * Daily usage caps — per user (session) or per IP (guests).
 *
 * M2 stand-in: in-memory with a 100k-char/day free limit per IP, mirroring
 * the `user_limits` table from the schema. M3 (auth + payments) swaps this
 * for the DB-backed version so caps follow accounts across devices.
 */

const EDGE_DAILY_CHARS = 100_000;
const GUEST_DAILY_GENERATIONS = 20;

interface DayCounter {
  date: string; // YYYY-MM-DD (UTC)
  chars: number;
  generations: number;
}

const users = new Map<string, DayCounter>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getEntry(key: string): DayCounter {
  const entry = users.get(key);
  const today = todayKey();
  if (!entry || entry.date !== today) {
    const fresh = { date: today, chars: 0, generations: 0 };
    users.set(key, fresh);
    return fresh;
  }
  return entry;
}

export interface CapResult {
  allowed: boolean;
  remainingChars: number;
  reason?: "daily_char_limit" | "daily_generation_limit";
}

/** consume chars for a free (Edge) generation; guests also use a generation slot */
export function consumeFreeChars(key: string, chars: number, opts?: { guest?: boolean }): CapResult {
  const entry = getEntry(key);
  if (opts?.guest && entry.generations >= GUEST_DAILY_GENERATIONS) {
    return { allowed: false, remainingChars: EDGE_DAILY_CHARS - entry.chars, reason: "daily_generation_limit" };
  }
  if (entry.chars + chars > EDGE_DAILY_CHARS) {
    return { allowed: false, remainingChars: EDGE_DAILY_CHARS - entry.chars, reason: "daily_char_limit" };
  }
  entry.chars += chars;
  entry.generations += 1;
  return { allowed: true, remainingChars: EDGE_DAILY_CHARS - entry.chars };
}

/** consume a generation slot for guests (no session) */
export function consumeGuestGeneration(key: string): CapResult {
  const entry = getEntry(key);
  if (entry.generations >= GUEST_DAILY_GENERATIONS) {
    return { allowed: false, remainingChars: 0, reason: "daily_generation_limit" };
  }
  entry.generations += 1;
  return { allowed: true, remainingChars: EDGE_DAILY_CHARS - entry.chars };
}

export function getFreeRemainingChars(key: string): number {
  const entry = getEntry(key);
  return Math.max(0, EDGE_DAILY_CHARS - entry.chars);
}

export function freeDailyLimit(): number {
  return EDGE_DAILY_CHARS;
}
