import { REFERRAL_BONUS_CREDITS } from "@/lib/pricing/packs";

/**
 * In-memory credit store — used until the Postgres database is configured
 * (then `lib/credits/ledger.ts` runs against the real `profiles` +
 * `credit_ledger` tables). Same semantics: append-only ledger entries,
 * balance derived from the ledger, atomic within the process.
 */

export interface LedgerEntry {
  id: string;
  userId: string;
  type:
    | "purchase"
    | "signup_bonus"
    | "referral_bonus"
    | "monthly_allowance"
    | "generation_debit"
    | "stream_debit"
    | "refund"
    | "manual_adjust"
    | "rollover_expiry";
  amount: number;
  balanceAfter: number;
  generationId?: string;
  orderId?: string;
  description?: string;
  createdAt: number;
}

const balances = new Map<string, number>();
const ledger: LedgerEntry[] = [];

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export function memoryGetBalance(userId: string): number {
  return balances.get(userId) ?? 0;
}

/** ids whose signup bonus was already granted — survives a spent-to-zero balance */
const signupGranted = new Set<string>();
/** generationIds already refunded — prevents double refunds on retried callbacks */
const refundedGenerations = new Set<string>();

export function memoryIsSignupGranted(userId: string): boolean {
  return signupGranted.has(userId);
}

export function memoryMarkSignupGranted(userId: string): void {
  signupGranted.add(userId);
}

export function memoryMarkRefunded(userId: string, generationId: string): boolean {
  const key = `${userId}:${generationId}`;
  if (refundedGenerations.has(key)) return false;
  refundedGenerations.add(key);
  return true;
}

export function memoryApply(userId: string, amount: number, entry: Omit<LedgerEntry, "userId" | "amount" | "balanceAfter" | "createdAt" | "id">): number {
  const balance = memoryGetBalance(userId);
  const next = balance + amount;
  if (next < 0) {
    throw new InsufficientCreditsError();
  }
  balances.set(userId, next);
  ledger.push({
    id: `mem_${ledger.length + 1}_${Date.now().toString(36)}`,
    userId,
    amount,
    balanceAfter: next,
    createdAt: Date.now(),
    ...entry,
  });
  return next;
}

export function memoryLedgerHistory(userId: string, limit = 50): LedgerEntry[] {
  return ledger.filter((e) => e.userId === userId).slice(-limit).reverse();
}
export function memoryGrantReferralBonus(userId: string, referrerId: string): void {
  memoryApply(referrerId, REFERRAL_BONUS_CREDITS, {
    type: "referral_bonus",
    description: `referral bonus for inviting ${userId.slice(0, 8)}`,
  });
}

export function memoryAllUsers(): Array<{ userId: string; balance: number }> {
  return [...balances.entries()].map(([userId, balance]) => ({ userId, balance }));
}
