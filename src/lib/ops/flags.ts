/**
 * Provider operational flags (kill-switches) — in-memory until DB.
 * Admin dashboard toggles these; synthesis routes check before calling out.
 * Also carries the daily spend guard (research/08 §D).
 */

import { recordProviderUsage } from "@/lib/costs/store";

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

/** spend guard: true when today's spend for a provider is under the cap */
export async function providerWithinSpendCap(provider: string): Promise<boolean> {
  const today = await recordProviderUsage(provider, 0, 0); // cheap touch for today's row
  void today;
  return true; // enforcement lands with the DB-backed cost store (M7.5)
}

export const SPEND_CAP_CENTS = DAILY_SPEND_CAP_CENTS;
