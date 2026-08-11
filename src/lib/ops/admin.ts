import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin session — password-gated via env ADMIN_PASSWORD.
 * Login sets a signed cookie `lv_admin` (HMAC(expires, password)).
 * Without ADMIN_PASSWORD the admin area is CLOSED by default (fail-closed),
 * not open — an admin that forgets to configure the password cannot expose
 * the panel by accident. Set ADMIN_PASSWORD to enable it.
 */

const COOKIE_NAME = "lv_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1_000;
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

function secret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

export function adminConfigured(): boolean {
  return Boolean(secret());
}

export function adminLockoutState(ip: string): { lockedUntil: number } {
  const entry = failedLogins.get(ip);
  if (entry && entry.lockedUntil > Date.now()) return { lockedUntil: entry.lockedUntil };
  return { lockedUntil: 0 };
}

/** record a failed login; returns true once the IP is locked out */
export function recordFailedLogin(ip: string): boolean {
  const now = Date.now();
  const entry = failedLogins.get(ip) ?? { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil > now) return true;
  if (entry.lockedUntil > 0 && entry.lockedUntil <= now) {
    entry.count = 0;
    entry.lockedUntil = 0;
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.count = 0;
    entry.lockedUntil = now + LOCKOUT_MS;
    failedLogins.set(ip, entry);
    return true;
  }
  failedLogins.set(ip, entry);
  return false;
}

export function clearFailedLogins(ip: string): void {
  failedLogins.delete(ip);
}

export function signAdminToken(): string {
  const pw = secret() ?? "";
  const expires = Date.now() + SESSION_TTL_MS;
  const sig = createHmac("sha256", pw).update(String(expires)).digest("hex");
  return `${expires}.${sig}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  if (!secret()) return false; // fail closed: no password configured → no access
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", secret()!).update(expires).digest("hex");
  return safeEqual(sig, expected);
}

export function adminCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS / 1_000 };
}

/** route-level admin check from a NextRequest */
export function isAdminRequest(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return verifyAdminToken(match?.[1] ?? null);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
