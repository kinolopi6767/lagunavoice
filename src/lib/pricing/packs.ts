/**
 * Credit packs & monthly plans (build-plan §3, updated).
 *
 * Economics: 1 credit = 1 char premium (Typecast), 2 credits/char flagship
 * (Deepgram). Non-expiring packs; monthly allowances roll over 90 days.
 */

export interface CreditPack {
  slug: string;
  name: string;
  priceUsd: number;
  credits: number;
}

export interface MonthlyPlan {
  slug: string;
  name: string;
  priceUsd: number;
  premiumCredits: number;
  flagshipCredits: number;
  maxCharsPerGeneration: number;
  longFormMaxChars: number;
  cloning: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { slug: "starter", name: "Starter pack", priceUsd: 5, credits: 15_000 },
  { slug: "creator", name: "Creator pack", priceUsd: 10, credits: 35_000 },
  { slug: "pro", name: "Pro pack", priceUsd: 20, credits: 80_000 },
  { slug: "studio", name: "Studio pack", priceUsd: 49, credits: 220_000 },
];

export const MONTHLY_PLANS: MonthlyPlan[] = [
  {
    slug: "starter",
    name: "Starter",
    priceUsd: 5,
    premiumCredits: 15_000,
    flagshipCredits: 0,
    maxCharsPerGeneration: 50_000,
    longFormMaxChars: 50_000,
    cloning: false,
  },
  {
    slug: "creator",
    name: "Creator",
    priceUsd: 10,
    premiumCredits: 25_000,
    flagshipCredits: 5_000,
    maxCharsPerGeneration: 100_000,
    longFormMaxChars: 100_000,
    cloning: false,
  },
  {
    slug: "pro",
    name: "Pro",
    priceUsd: 20,
    premiumCredits: 50_000,
    flagshipCredits: 15_000,
    maxCharsPerGeneration: 500_000,
    longFormMaxChars: 500_000,
    cloning: true,
  },
  {
    slug: "studio",
    name: "Studio",
    priceUsd: 49,
    premiumCredits: 150_000,
    flagshipCredits: 40_000,
    maxCharsPerGeneration: 2_000_000,
    longFormMaxChars: 2_000_000,
    cloning: true,
  },
];

export const SIGNUP_BONUS_CREDITS = 2_000;
export const REFERRAL_BONUS_CREDITS = 2_500;

export function getPack(slug: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.slug === slug);
}

export function getPlan(slug: string): MonthlyPlan | undefined {
  return MONTHLY_PLANS.find((p) => p.slug === slug);
}
