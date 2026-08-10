import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, profiles } from "@/db/schema";
import {
  InsufficientCreditsError as MemoryInsufficient,
  memoryApply,
  memoryGetBalance,
  memoryGrantReferralBonus,
  memoryGrantSignupBonus,
  memoryLedgerHistory,
  type LedgerEntry,
} from "@/lib/credits/memory-store";
import { SIGNUP_BONUS_CREDITS } from "@/lib/pricing/packs";

/**
 * Credit ledger — the money path.
 *
 * Two backends with identical semantics:
 *  - Postgres (Supabase): guarded UPDATE + append-only ledger rows
 *  - in-memory fallback: used until DATABASE_URL is configured, so the whole
 *    payment flow can be built and demoed without a database
 *
 * Atomicity: the DB path uses a WHERE-guarded update inside a transaction;
 * the memory path is atomic because the process is single-threaded.
 */

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

/** legacy alias kept for routes that guard pre-billing states */
export class BillingUnavailableError extends Error {
  constructor() {
    super("Billing is not configured yet");
    this.name = "BillingUnavailableError";
  }
}

const dbConfigured = () => Boolean(process.env.DATABASE_URL);

/**
 * Run the Postgres path, falling back to the in-memory store when the
 * connection fails (misconfigured/unreachable DATABASE_URL). Keeps the app
 * usable locally and in demos instead of 500ing on every billing call.
 */
async function withFallback<T>(label: string, dbPath: () => Promise<T>, memPath: () => T): Promise<T> {
  try {
    return await dbPath();
  } catch (err) {
    console.error(`[ledger] ${label}: DB path failed, falling back to memory`, err);
    return memPath();
  }
}

export async function getBalance(userId: string): Promise<number> {
  if (!dbConfigured()) return memoryGetBalance(userId);
  return withFallback(
    "getBalance",
    async () => {
      const [row] = await db
        .select({ balance: profiles.creditsBalance })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return row?.balance ?? 0;
    },
    () => memoryGetBalance(userId),
  );
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

  if (!dbConfigured()) {
    try {
      return memoryApply(userId, -amount, {
        type: "generation_debit",
        generationId,
        description: description ?? "generation",
      });
    } catch (err) {
      if (err instanceof MemoryInsufficient) throw new InsufficientCreditsError();
      throw err;
    }
  }

  const result = await withFallback(
    "debitCredits",
    () =>
      db.transaction(async (tx) => {
        const [updated] = await tx
          .update(profiles)
          .set({
            creditsBalance: sql`${profiles.creditsBalance} - ${amount}`,
            updatedAt: new Date(),
          })
          .where(and(eq(profiles.id, userId), sql`${profiles.creditsBalance} >= ${amount}`))
          .returning({ balance: profiles.creditsBalance });

        if (!updated) return null;

        await tx.insert(creditLedger).values({
          userId,
          type: "generation_debit",
          amount: -amount,
          balanceAfter: updated.balance,
          generationId,
          description: description ?? "generation",
        });

        return updated.balance;
      }),
    () =>
      memoryApply(userId, -amount, {
        type: "generation_debit",
        generationId,
        description: description ?? "generation",
      }),
  );

  if (result === null) throw new InsufficientCreditsError();
  return result;
}

/** Refund credits for a failed generation. Always succeeds (adds back). */
export async function refundCredits(opts: {
  userId: string;
  amount: number;
  generationId: string;
  description?: string;
}): Promise<number> {
  const { userId, amount, generationId, description } = opts;

  if (!dbConfigured()) {
    return memoryApply(userId, amount, {
      type: "refund",
      generationId,
      description: description ?? "refunded failed generation",
    });
  }

  return withFallback(
    "refundCredits",
    () =>
      db.transaction(async (tx) => {
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
      }),
    () =>
      memoryApply(userId, amount, {
        type: "refund",
        generationId,
        description: description ?? "refunded failed generation",
      }),
  );
}

/** credit an order/allowance — used by the payment webhook */
export async function credit(userId: string, amount: number, description: string): Promise<number> {
  if (!dbConfigured()) {
    return memoryApply(userId, amount, { type: "purchase", description });
  }

  return withFallback(
    "credit",
    () =>
      db.transaction(async (tx) => {
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
          type: "purchase",
          amount,
          balanceAfter: updated?.balance ?? amount,
          description,
        });

        return updated?.balance ?? amount;
      }),
    () => memoryApply(userId, amount, { type: "purchase", description }),
  );
}

/** signup bonus — once per account */
export async function grantSignupBonus(userId: string): Promise<number> {
  if (!dbConfigured()) return memoryGrantSignupBonus(userId);
  const balance = await getBalance(userId);
  if (balance > 0) return balance;
  return credit(userId, 2_000, "signup bonus");
}

/** referral bonus for the referrer */
export async function grantReferralBonus(userId: string, referrerId: string): Promise<void> {
  if (!dbConfigured()) {
    memoryGrantReferralBonus(userId, referrerId);
    return;
  }
  await credit(referrerId, 2_500, `referral bonus for inviting ${userId.slice(0, 8)}`);
}

export async function ledgerHistory(userId: string, limit = 50): Promise<LedgerEntry[]> {
  if (!dbConfigured()) return memoryLedgerHistory(userId, limit);
  return withFallback(
    "ledgerHistory",
    async () => {
      const rows = await db
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId))
        .orderBy(sql`${creditLedger.createdAt} desc`)
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        amount: r.amount,
        balanceAfter: r.balanceAfter,
        generationId: r.generationId ?? undefined,
        orderId: r.orderId ?? undefined,
        description: r.description ?? undefined,
        createdAt: r.createdAt.getTime(),
      }));
    },
    () => memoryLedgerHistory(userId, limit),
  );
}

/**
 * Sandbox-only grant: credits for the local test user, always on the
 * in-memory store (a sandbox id is not a real profile row).
 */
export async function grantSandboxCredits(userId: string): Promise<number> {
  const memo = await import("@/lib/credits/memory-store");
  return memo.memoryApply(userId, SIGNUP_BONUS_CREDITS, {
    type: "signup_bonus",
    description: "sandbox signup bonus",
  });
}
