import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, profiles } from "@/db/schema";

/**
 * Credit ledger — the money path. Append-only ledger + guarded balance update.
 * Requires the Postgres database (Supabase). Until it exists, premium
 * generation stays locked (the Studio route reports "billing not configured").
 *
 * Atomicity: the guarded UPDATE ... WHERE credits_balance >= :n either
 * succeeds or returns no row — concurrent requests cannot overspend.
 * Refunds re-credit and append a `refund` ledger row.
 */

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export class BillingUnavailableError extends Error {
  constructor() {
    super("Billing is not configured yet");
    this.name = "BillingUnavailableError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: profiles.creditsBalance })
    .from(profiles)
    .where(eq(profiles.id, userId));
  return row?.balance ?? 0;
}

/**
 * Debit `amount` credits for a generation. Throws InsufficientCreditsError
 * if the balance is too low. Returns the new balance.
 */
export async function debitCredits(opts: {
  userId: string;
  amount: number;
  generationId: string;
  description?: string;
}): Promise<number> {
  const { userId, amount, generationId, description } = opts;

  if (amount <= 0) throw new Error("debit amount must be positive");

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(profiles)
      .set({
        creditsBalance: sql`${profiles.creditsBalance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(and(eq(profiles.id, userId), sql`${profiles.creditsBalance} >= ${amount}`))
      .returning({ balance: profiles.creditsBalance });

    if (!updated) {
      return null;
    }

    await tx.insert(creditLedger).values({
      userId,
      type: "generation_debit",
      amount: -amount,
      balanceAfter: updated.balance,
      generationId,
      description: description ?? "generation",
    });

    return updated.balance;
  });

  if (result === null) {
    throw new InsufficientCreditsError();
  }
  return result;
}

/**
 * Refund `amount` credits for a failed generation. Always succeeds (adds back).
 */
export async function refundCredits(opts: {
  userId: string;
  amount: number;
  generationId: string;
  description?: string;
}): Promise<number> {
  const { userId, amount, generationId, description } = opts;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(profiles)
      .set({
        creditsBalance: sql`${profiles.creditsBalance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, userId))
      .returning({ balance: profiles.creditsBalance });

    await tx.insert(creditLedger).values({
      userId,
      type: "refund",
      amount,
      balanceAfter: updated?.balance ?? amount,
      generationId,
      description: description ?? "refunded failed generation",
    });

    return updated?.balance ?? amount;
  });
}

/** ledger history for the dashboard (last N entries) */
export async function ledgerHistory(userId: string, limit = 50) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(sql`${creditLedger.createdAt} desc`)
    .limit(limit);
}
