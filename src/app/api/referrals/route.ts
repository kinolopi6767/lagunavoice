import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/sandbox/session";
import { grantReferralBonus } from "@/lib/credits/ledger";
import { REFERRAL_BONUS, claimReferral } from "@/lib/referrals/store";

/**
 * Referral program — claim a referral code at signup to earn bonus credits.
 * POST /api/referrals { code } — the referee gets the signup bonus; the
 * referrer gets the referral bonus (once per pair).
 *
 * In-memory referral tracking until the DB `referrals` table is wired.
 */

const ClaimSchema = z.object({
  code: z.string().min(4).max(40),
});

export async function POST(request: Request) {
  const { userId: refereeId, supabaseConfigured } = await resolveSession();
  if (!refereeId) {
    const error = supabaseConfigured
      ? { error: "Sign in required.", code: "unauthorized" as const }
      : { error: "Authentication is being configured — use the local test playground.", code: "billing_unavailable" as const };
    return NextResponse.json(error, { status: supabaseConfigured ? 401 : 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ClaimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const claim = claimReferral(parsed.data.code, refereeId);
  switch (claim.status) {
    case "not_found":
      return NextResponse.json({ error: "Unknown referral code.", code: "not_found" }, { status: 404 });
    case "self":
      return NextResponse.json({ error: "You can't refer yourself.", code: "invalid_request" }, { status: 400 });
    case "already_claimed":
      return NextResponse.json({ ok: true, alreadyClaimed: true });
    case "claimed":
      await grantReferralBonus(refereeId, claim.referrerId);
      return NextResponse.json({ ok: true, bonusCredits: REFERRAL_BONUS });
  }
}

export { registerReferralCode } from "@/lib/referrals/store";