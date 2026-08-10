/**
 * Referral program store — code registry + claimed pairs.
 * In-memory until the DB `referrals` table is wired (research/06).
 */

const REFERRAL_BONUS = 2_500;

const claimedPairs = new Set<string>();
const referralCodes = new Map<string, string>(); // code → referrerUserId

/** Register a user's personal referral code (called at signup). */
export function registerReferralCode(code: string, userId: string): void {
  referralCodes.set(code, userId);
}

/** Resolve a code to its owner, or undefined. */
export function getReferralCodeOwner(code: string): string | undefined {
  return referralCodes.get(code);
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
  return { status: "claimed", referrerId };
}

export { REFERRAL_BONUS };