import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Local sandbox session — lets you test the whole app (studio, premium,
 * API keys, referrals, checkout, admin) WITHOUT Supabase or Postgres.
 *
 * How it works:
 *  - When Supabase env vars are missing, `resolveSession()` falls back to a
 *    signed `lv_sandbox_user` cookie set by `POST /api/dev/session`.
 *  - The cookie value is `userId.signature` (HMAC-SHA256). Unsigned or forged
 *    cookies are rejected, so the sandbox cannot impersonate another user.
 *  - When Supabase IS configured, the cookie is ignored — real auth wins.
 *  - Sandbox users get credits via the in-memory ledger and a referral code,
 *    so billing/referral flows can be exercised end-to-end locally.
 *
 * Temporary local-testing facility — remove once the product is live.
 */

const SANDBOX_COOKIE = "lv_sandbox_user";

/** signing secret: env override, else a random secret generated once per process */
let signingSecret: string = process.env.SANDBOX_COOKIE_SECRET ?? "";
if (!signingSecret) {
  signingSecret = createHmac("sha256", crypto.randomUUID()).digest("hex");
}

export function signSandboxUserId(userId: string): string {
  const signature = createHmac("sha256", signingSecret).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export interface SessionResolution {
  /** resolved user id — real Supabase user, or the sandbox cookie user */
  userId: string | undefined;
  /** true when Supabase env vars are present (real auth available) */
  supabaseConfigured: boolean;
  /** true when the user id came from the sandbox cookie */
  sandbox: boolean;
}

async function resolveSupabaseUser(): Promise<string | undefined> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id;
  } catch {
    return undefined;
  }
}

async function sandboxUserId(): Promise<string | undefined> {
  try {
    const { cookies } = await import("next/headers");
    const value = (await cookies()).get(SANDBOX_COOKIE)?.value;
    if (!value) return undefined;
    return verifySandboxUserId(value);
  } catch {
    return undefined;
  }
}

/**
 * Async resolver for API routes: real Supabase session when configured,
 * otherwise the sandbox cookie. Never throws.
 */
export async function resolveSession(): Promise<SessionResolution> {
  const configured = supabaseConfigured();
  if (configured) {
    const userId = await resolveSupabaseUser();
    return { userId, supabaseConfigured: true, sandbox: false };
  }
  const userId = await sandboxUserId();
  return { userId, supabaseConfigured: false, sandbox: Boolean(userId) };
}

/** Mint (once) a fresh sandbox user: id, credits, referral code. */
export async function createSandboxUser(name?: string): Promise<{
  userId: string;
  referralCode: string;
  credits: number;
}> {
  const { memoryGetBalance } = await import("@/lib/credits/memory-store");
  const { grantSandboxCredits } = await import("@/lib/credits/ledger");
  const { registerReferralCode } = await import("@/lib/referrals/store");

  const userId = `sandbox_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const slug = (name ?? "tester").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12) || "tester";
  const referralCode = `${slug}-${randomUUID().replaceAll("-", "").slice(0, 4)}`;

  await grantSandboxCredits(userId);
  registerReferralCode(referralCode, userId);

  return { userId, referralCode, credits: memoryGetBalance(userId) };
}

export function sandboxCookieName(): string {
  return SANDBOX_COOKIE;
}

export function verifySandboxUserId(value: string): string | undefined {
  const dot = value.lastIndexOf(".");
  if (dot <= 0 || dot === value.length - 1) return undefined;
  const userId = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = createHmac("sha256", signingSecret).update(userId).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  return userId;
}