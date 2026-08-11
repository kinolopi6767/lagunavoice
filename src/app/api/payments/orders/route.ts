import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrder, listOrders, confirmManualOrder } from "@/lib/payments/orders";
import { isAdminRequest } from "@/lib/ops/admin";
import { resolveSession } from "@/lib/sandbox/session";
import { getBalance, ledgerHistory } from "@/lib/credits/ledger";

/**
 * GET /api/payments/orders — the user's purchase history + balance + recent
 * ledger (feeds the /billing page). Works with the real Supabase session OR
 * the sandbox cookie (no env).
 */
export async function GET() {
  const session = await resolveSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
  }

  const [balance, recentLedger] = await Promise.all([
    getBalance(session.userId),
    ledgerHistory(session.userId, 12),
  ]);

  return NextResponse.json({
    orders: listOrders(session.userId),
    balance,
    recentLedger: recentLedger.map((e) => ({
      type: e.type,
      amount: e.amount,
      balanceAfter: e.balanceAfter,
      description: e.description,
      createdAt: e.createdAt,
    })),
  });
}

/**
 * POST /api/payments/orders/[id]/confirm — ADMIN only.
 * Confirms a manual (WhatsApp/UPI) order after the transfer is received.
 */
const ConfirmSchema = z.object({ id: z.string() });

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin only.", code: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const order = getOrder(parsed.data.id);
  if (!order) {
    return NextResponse.json({ error: "Order not found.", code: "not_found" }, { status: 404 });
  }

  await confirmManualOrder(order.id);
  return NextResponse.json({ ok: true, order });
}
