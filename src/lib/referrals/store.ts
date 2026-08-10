/**
 * Referral program store — code registry + claimed pairs.
 * In-memory until the DB `referrals` table is wired (research/06).
 */

const REFERRAL_BONUS = 2_500;

const claimedPairs = new Set<string>();
const referralCodes = new Map<string, string>(); // code → referrerUserId

interface ClaimEntry {
  referrerId: string;
  refereeId: string;
  claimedAt: number;
}

// reverse index: userId → their referral code
const userCodeIndex = new Map<string, string>();
// claim history (newest first) for the dashboard summary
const claimLog: ClaimEntry[] = [];

/** Register a user's personal referral code (called at signup). */
export function registerReferralCode(code: string, userId: string): void {
  referralCodes.set(code, userId);
  userCodeIndex.set(userId, code);
}

/** Resolve a code to its owner, or undefined. */
export function getReferralCodeOwner(code: string): string | undefined {
  return referralCodes.get(code);
}

/** A user's own referral code (auto-minted if missing), or undefined. */
export function getOrCreateReferralCode(userId: string): string | undefined {
  const existing = userCodeIndex.get(userId);
  if (existing) return existing;
  if (referralCodes.size === 0) return undefined;
  const generated = `${userId.slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
  registerReferralCode(generated, userId);
  return generated;
}

export interface ReferralSummary {
  code: string;
  bonusPerClaim: number;
  claimsCount: number;
  totalBonusEarned: number;
  recentClaims: Array<{ refereeId: string; claimedAt: number }>;
}

/** Dashboard data for a user: their code + how many people claimed it. */
export function getReferralSummary(userId: string): ReferralSummary | undefined {
  const code = getOrCreateReferralCode(userId);
  if (!code) return undefined;
  const claims = claimLog.filter((c) => c.referrerId === userId);
  return {
    code,
    bonusPerClaim: REFERRAL_BONUS,
    claimsCount: claims.length,
    totalBonusEarned: claims.length * REFERRAL_BONUS,
    recentClaims: claims
      .sort((a, b) => b.claimedAt - a.claimedAt)
      .map((c) => ({ refereeId: c.refereeId, claimedAt: c.claimedAt })),
  };
}

/**
 * Attempt to claim a referral code for a referee.
 * Returns the referrer user id when the claim is accepted.
 */
export function claimReferral(
  code: string,
  refereeId: string,
): { status: "claimed"; referrerId: string } | { status: "not_found" | "self" | "already_claimed"; referrerId?: undefined } {
  const referrerId = referralCodes.get(code);
  if (!referrerId) return { status: "not_found" };
  if (referrerId === refereeId) return { status: "self" };

  const pairKey = `${referrerId}:${refereeId}`;
  if (claimedPairs.has(pairKey)) return { status: "already_claimed" };
  claimedPairs.add(pairKey);
  claimLog.push({ referrerId, refereeId, claimedAt: Date.now() });
  return { status: "claimed", referrerId };
}

export { REFERRAL_BONUS };