import { createHmac } from "node:crypto";

/**
 * Admin session — password-gated via env ADMIN_PASSWORD.
 * Login sets a signed cookie `lv_admin` (HMAC(expires, password)).
 * Dev mode: without ADMIN_PASSWORD the admin area is open (logged warning).
 */

const COOKIE_NAME = "lv_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1_000;

function secret(): string | null {
  return process.env.ADMIN_PASSWORD ?? null;
}

export function signAdminToken(): string {
  const pw = secret() ?? "dev";
  const expires = Date.now() + SESSION_TTL_MS;
  const sig = createHmac("sha256", pw).update(String(expires)).digest("hex");
  return `${expires}.${sig}`;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  if (!secret()) return true; // dev mode
  const [expires, sig] = token.split(".");
  if (!expires || !sig) return false;
  if (Number(expires) < Date.now()) return false;
  const expected = createHmac("sha256", secret()!).update(expires).digest("hex");
  return expected === sig;
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
