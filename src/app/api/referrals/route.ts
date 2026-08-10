import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { grantReferralBonus } from "@/lib/credits/ledger";

/**
 * Referral program — claim a referral code at signup to earn bonus credits.
 * POST /api/referrals { code } — the referee gets the signup bonus; the
 * referrer gets the referral bonus (once per pair).
 *
 * In-memory referral tracking until the DB `referrals` table is wired.
 */

const REFERRAL_BONUS = 2_500;

const claimedPairs = new Set<string>();
const referralCodes = new Map<string, string>(); // code → referrerUserId

export function registerReferralCode(code: string, userId: string): void {
  referralCodes.set(code, userId);
}

const ClaimSchema = z.object({
  code: z.string().min(4).max(40),
});

export async function POST(request: Request) {
  let refereeId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
    refereeId = data.user.id;
  } catch {
    return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const referrerId = referralCodes.get(parsed.data.code);
  if (!referrerId) {
    return NextResponse.json({ error: "Unknown referral code.", code: "not_found" }, { status: 404 });
  }
  if (referrerId === refereeId) {
    return NextResponse.json({ error: "You can't refer yourself.", code: "invalid_request" }, { status: 400 });
  }

  const pairKey = `${referrerId}:${refereeId}`;
  if (claimedPairs.has(pairKey)) {
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }
  claimedPairs.add(pairKey);

  await grantReferralBonus(refereeId, referrerId);

  return NextResponse.json({ ok: true, bonusCredits: REFERRAL_BONUS });
}
