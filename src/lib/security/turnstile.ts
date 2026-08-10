/**
 * Cloudflare Turnstile server-side verification.
 * No-op (allowed) when TURNSTILE_SECRET_KEY is not configured (local dev).
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  /** verify response */
  response?: Record<string, unknown>;
  /** why verification was skipped (dev mode) */
  skipped?: boolean;
}

export async function verifyTurnstileToken(token: string | null): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    return { success: true, skipped: true };
  }

  if (!token) {
    return { success: false };
  }

  const form = new URLSearchParams({
    secret,
    response: token,
  });

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    body: form,
    cache: "no-store",
  });

  const data = (await res.json()) as { success: boolean } & Record<string, unknown>;
  return { success: data.success === true, response: data };
}
