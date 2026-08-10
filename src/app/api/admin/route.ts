import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  isAdminRequest,
  signAdminToken,
} from "@/lib/ops/admin";
import { listAllOrders } from "@/lib/payments/orders";
import { listFlags, listBans } from "@/lib/abuse/rules";
import { usageSummary } from "@/lib/costs/store";
import { listProviderOps } from "@/lib/ops/flags";
import { getBalance } from "@/lib/credits/ledger";
import { memoryAllUsers } from "@/lib/credits/memory-store";

/**
 * Admin API — password-gated (ADMIN_PASSWORD env; open in dev without it).
 */

const LoginSchema = z.object({ password: z.string() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (expected && parsed.data.password !== expected) {
    return NextResponse.json({ error: "Wrong password.", code: "forbidden" }, { status: 403 });
  }

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
