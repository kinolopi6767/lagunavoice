import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  adminConfigured,
  adminCookieOptions,
  adminLockoutState,
  clearFailedLogins,
  isAdminRequest,
  recordFailedLogin,
  signAdminToken,
} from "@/lib/ops/admin";
import { listAllOrders } from "@/lib/payments/orders";
import { listFlags, listBans } from "@/lib/abuse/rules";
import { usageSummary } from "@/lib/costs/store";
import { listProviderOps } from "@/lib/ops/flags";
import { getBalance } from "@/lib/credits/ledger";
import { memoryAllUsers } from "@/lib/credits/memory-store";
import { clientIp } from "@/lib/http/client-ip";

/**
 * Admin API — password-gated (ADMIN_PASSWORD env). Fail-closed: when the
 * password is not configured the admin area is unavailable, not open.
 */

const LoginSchema = z.object({ password: z.string() });

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin is not configured (ADMIN_PASSWORD unset).", code: "admin_unavailable" },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const lock = adminLockoutState(ip);
  if (lock.lockedUntil > Date.now()) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later.", code: "rate_limited" },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD!;
  const supplied = Buffer.from(parsed.data.password);
  const want = Buffer.from(expected);
  if (supplied.length !== want.length || !timingSafeEqual(supplied, want)) {
    recordFailedLogin(ip);
    return NextResponse.json({ error: "Wrong password.", code: "forbidden" }, { status: 403 });
  }
  clearFailedLogins(ip);

  const token = signAdminToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions());
  return res;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin only.", code: "forbidden" }, { status: 403 });
  }

  const usage = await usageSummary();
  const users = memoryAllUsers();
  const demoUser = users[0]?.userId;

  return NextResponse.json({
    balance: demoUser ? await getBalance(demoUser) : null,
    orders: listAllOrders(),
    flags: listFlags(),
    bans: listBans(),
    usage,
    providers: listProviderOps(),
  });
}
