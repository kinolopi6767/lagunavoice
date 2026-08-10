/**
 * Provider operational flags (kill-switches) — in-memory until DB.
 * Admin dashboard toggles these; synthesis routes check before calling out.
 * Also carries the daily spend guard (research/08 §D).
 */

import { usageSummary } from "@/lib/costs/store";

interface ProviderOps {
  enabled: boolean;
  disabledReason?: string;
}

const flags = new Map<string, ProviderOps>([
  ["edge", { enabled: true }],
  ["typecast", { enabled: true }],
  ["deepgram", { enabled: true }],
]);

const DAILY_SPEND_CAP_CENTS = 500; // $5/day per provider (build-plan)

export function isProviderKillSwitched(provider: string): string | null {
  const ops = flags.get(provider);
  if (!ops || ops.enabled) return null;
  return ops.disabledReason ?? "provider disabled by admin";
}

export function setProviderEnabled(provider: string, enabled: boolean, reason?: string): void {
  flags.set(provider, { enabled, disabledReason: reason });
}

export function listProviderOps(): Array<{ provider: string; enabled: boolean; reason?: string }> {
  return [...flags.entries()].map(([provider, ops]) => ({
    provider,
    enabled: ops.enabled,
    reason: ops.disabledReason,
  }));
}

/**
 * Spend guard: true when today's recorded cost for a provider is under the
 * daily cap. Uses the in-memory COGS store until the DB table is wired
 * (costs accrue on completion, so the check gates the NEXT request).
 */
export async function providerWithinSpendCap(provider: string): Promise<boolean> {
  const { today } = await usageSummary();
  const row = today.find((r) => r.provider === provider);
  return (row?.costCents ?? 0) < DAILY_SPEND_CAP_CENTS;
}

export const SPEND_CAP_CENTS = DAILY_SPEND_CAP_CENTS;
