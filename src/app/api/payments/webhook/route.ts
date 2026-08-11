import { NextResponse } from "next/server";
import {
  parseRazorpayEvent,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";
import {
  assertAmountMatchesOrder,
  confirmOrderPaid,
  getOrder,
  hasWebhookProcessed,
} from "@/lib/payments/orders";

/**
 * POST /api/payments/webhook — Razorpay payment events.
 *
 * Security (research/08):
 *  1. HMAC-SHA256 signature verified on the RAW body (never re-serialized)
 *  2. Dedupe on the event id — replays cannot double-credit
 *  3. Only `payment.captured` (or payment_link.paid) triggers crediting
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature.", code: "invalid_signature" }, { status: 400 });
  }

  let event: ReturnType<typeof parseRazorpayEvent>;
  try {
    event = parseRazorpayEvent(rawBody);
  } catch (err) {
    console.error("[webhook] malformed event body", err);
    return NextResponse.json({ error: "Invalid event body.", code: "invalid_request" }, { status: 400 });
  }

  // dedupe replays
  if (hasWebhookProcessed(event.id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const orderRef = event.payload?.payment_link?.entity?.reference_id;
  const order = orderRef ? getOrder(orderRef) : undefined;

  if (!order) {
    // event for an order we don't track (or DB-mode order) — ack quietly
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventName = event.event ?? "";
  const captured =
    eventName === "payment.captured" ||
    eventName === "payment_link.paid" ||
    event.payload?.payment?.entity?.status === "captured";

  if (!captured) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // amount integrity: never credit more than the pack price (INR paise)
  // `payment_link.paid` carries the amount on payment_link.entity.amount_paid;
  // direct card events carry it on payment.entity.amount
  const paidAmount =
    event.payload?.payment_link?.entity?.amount_paid ??
    event.payload?.payment?.entity?.amount;
  if (typeof paidAmount === "number" && paidAmount > 0) {
    try {
      assertAmountMatchesOrder(order, paidAmount, "INR");
    } catch (err) {
      console.error("[webhook] amount mismatch — NOT crediting", err);
      return NextResponse.json({ error: "Amount mismatch.", code: "amount_mismatch" }, { status: 400 });
    }
  }

  await confirmOrderPaid(order.id, { webhookId: event.id });

  return NextResponse.json({ ok: true });
}
