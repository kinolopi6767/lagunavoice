import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSandboxUser,
  sandboxCookieName,
  supabaseConfigured,
} from "@/lib/sandbox/session";

/**
 * Local test playground session.
 *
 * GET  /api/dev/session — status: is Supabase configured, sandbox active?
 * POST /api/dev/session { action: "enter", name? } — mint a sandbox user
 *      (2,000 test credits + a referral code) and set the sandbox cookie.
 * POST /api/dev/session { action: "exit" } — clear the sandbox cookie.
 *
 * Temporary local-testing facility: only meaningful while Supabase auth is
 * NOT configured (the cookie is ignored once real auth exists).
 */
export async function GET() {
  const configured = supabaseConfigured();
  if (configured) {
    return NextResponse.json({ supabaseConfigured: true, sandbox: false });
  }
  const cookieStore = await cookies();
  const userId = cookieStore.get(sandboxCookieName())?.value;
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
  res.cookies.set(sandboxCookieName(), user.userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}