import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getOrder, listOrders, confirmManualOrder } from "@/lib/payments/orders";
import { isAdminRequest } from "@/lib/ops/admin";

/**
 * GET /api/payments/orders — the user's purchase history.
 */
export async function GET() {
  let userId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
    }
    userId = data.user.id;
  } catch {
    return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ orders: listOrders(userId) });
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
