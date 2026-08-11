/**
 * Per-provider usage & cost tracking (COGS) — in-memory until the DB
 * `provider_usage_daily` table is wired (then Deepgram `billing/breakdown`
 * + tags feed the same view per research/09).
 */

export interface UsageRow {
  provider: string;
  chars: number;
  sttSeconds: number;
  requests: number;
  errored: number;
  costCents: number;
}

/** wholesale rates (USD per 1,000 chars) — research/01 + 05 */
const RATES: Record<string, { premium: number; flagship: number }> = {
  edge: { premium: 0, flagship: 0 },
  typecast: { premium: 0.08, flagship: 0 },
  deepgram: { premium: 0, flagship: 0.03 }, // Aura-2
};
const STT_RATE_PER_MIN_CENTS = 0.43; // Nova-3 $0.0043/min → cents per 1000s

const byDate = new Map<string, Map<string, UsageRow>>();
const MAX_DAYS = 90; // keep COGS history for 90 days, then drop the oldest

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function pruneOldDays(): void {
  if (byDate.size <= MAX_DAYS) return;
  const oldest = [...byDate.keys()].sort().slice(0, byDate.size - MAX_DAYS);
  for (const k of oldest) byDate.delete(k);
}

export async function recordProviderUsage(
  provider: string,
  chars: number,
  sttSeconds: number,
  opts?: { tier?: "premium" | "flagship"; errored?: boolean },
): Promise<UsageRow> {
  pruneOldDays();
  const key = todayKey();
  const day = byDate.get(key) ?? new Map<string, UsageRow>();
  const row: UsageRow = day.get(provider) ?? {
    provider,
    chars: 0,
    sttSeconds: 0,
    requests: 0,
    errored: 0,
    costCents: 0,
  };

  row.chars += chars;
  row.sttSeconds += sttSeconds;
  row.requests += 1;
  if (opts?.errored) row.errored += 1;

  const rate = opts?.tier === "flagship" ? RATES[provider]?.flagship : RATES[provider]?.premium;
  row.costCents += Math.round((chars / 1_000) * (rate ?? 0) * 100);
  row.costCents += Math.round((sttSeconds / 60) * STT_RATE_PER_MIN_CENTS);

  day.set(provider, row);
  byDate.set(key, day);
  return row;
}

export async function usageSummary(): Promise<{
  today: UsageRow[];
  totalCostCentsToday: number;
}> {
  const rows = [...(byDate.get(todayKey())?.values() ?? [])];
  return {
    today: rows,
    totalCostCentsToday: rows.reduce((a, r) => a + r.costCents, 0),
  };
}
