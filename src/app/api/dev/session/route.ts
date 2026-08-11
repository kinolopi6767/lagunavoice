import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientIp } from "@/lib/http/client-ip";
import {
  createSandboxUser,
  sandboxCookieName,
  signSandboxUserId,
  supabaseConfigured,
  verifySandboxUserId,
} from "@/lib/sandbox/session";

/**
 * Local test playground session.
 *
 * GET  /api/dev/session — status: is Supabase configured, sandbox active?
 * POST /api/dev/session { action: "enter", name? } — mint a sandbox user
 *      (2,000 test credits + a referral code) and set the SIGNED sandbox
 *      cookie (HMAC — forging another user's id is impossible).
 * POST /api/dev/session { action: "exit" } — clear the sandbox cookie.
 *
 * Minting is capped at 3 users/day per IP (sandbox referral codes must not
 * farm the referral bonus).
 *
 * Temporary local-testing facility: only meaningful while Supabase auth is
 * NOT configured (the cookie is ignored once real auth exists).
 */

const MAX_MINTS_PER_IP_PER_DAY = 3;
const MAX_TRACKED_KEYS = 2_000;
const mintCounts = new Map<string, number>();

function consumeMint(ip: string): boolean {
  // prune stale per-day keys once the map grows large
  if (mintCounts.size >= MAX_TRACKED_KEYS) {
    const today = new Date().toISOString().slice(0, 10);
    for (const key of mintCounts.keys()) {
      if (!key.endsWith(today)) mintCounts.delete(key);
    }
  }
  const key = `${ip}:${new Date().toISOString().slice(0, 10)}`;
  const used = mintCounts.get(key) ?? 0;
  if (used >= MAX_MINTS_PER_IP_PER_DAY) return false;
  mintCounts.set(key, used + 1);
  return true;
}

export async function GET() {
  const configured = supabaseConfigured();
  if (configured) {
    return NextResponse.json({ supabaseConfigured: true, sandbox: false });
  }
  const cookieStore = await cookies();
  const raw = cookieStore.get(sandboxCookieName())?.value;
  const userId = raw ? verifySandboxUserId(raw) : undefined;
  return NextResponse.json({ supabaseConfigured: false, sandbox: Boolean(userId), userId });
}

export async function POST(request: Request) {
  if (supabaseConfigured()) {
    return NextResponse.json(
      { error: "Real authentication is configured — sandbox mode is off.", code: "forbidden" },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const action = String(body?.action ?? "");

  if (action === "exit") {
    const res = NextResponse.json({ ok: true, sandbox: false });
    res.cookies.delete(sandboxCookieName());
    return res;
  }

  if (action !== "enter") {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const ip = clientIp(request);
  if (!consumeMint(ip)) {
    return NextResponse.json(
      { error: "Sandbox user mint limit reached for today.", code: "rate_limited" },
      { status: 429 },
    );
  }

  const name = typeof body?.name === "string" && body.name.trim() ? body.name.slice(0, 24) : undefined;
  const user = await createSandboxUser(name);

  const res = NextResponse.json({
    ok: true,
    sandbox: true,
    userId: user.userId,
    referralCode: user.referralCode,
    credits: user.credits,
    hint: "Sandbox mode: real auth is not configured, so this cookie acts as your signed-in session.",
  });
  res.cookies.set(sandboxCookieName(), signSandboxUserId(user.userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}