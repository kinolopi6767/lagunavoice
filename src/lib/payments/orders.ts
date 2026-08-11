import { credit } from "@/lib/credits/ledger";

/**
 * Credit orders — in-memory until the DB arrives (then `credit_orders`).
 * Covers both payment paths: Razorpay (automated) and WhatsApp/UPI manual
 * (admin confirms after receiving the transfer).
 */

export type OrderStatus = "pending" | "paid" | "failed" | "refunded" | "manual_pending" | "manual_confirmed";
export type OrderProvider = "razorpay" | "whatsapp_manual" | "admin";

export interface CreditOrder {
  id: string;
  userId: string;
  packSlug: string;
  amount: number; // minor units
  currency: string;
  credits: number;
  status: OrderStatus;
  provider: OrderProvider;
  providerRef?: string;
  webhookId?: string;
  paidAt?: number;
  createdAt: number;
}

const orders = new Map<string, CreditOrder>();
const processedWebhooks = new Set<string>();

export function createOrder(input: {
  userId: string;
  packSlug: string;
  amount: number;
  credits: number;
  provider: OrderProvider;
  currency?: string;
}): CreditOrder {
  const order: CreditOrder = {
    id: `ord_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
    userId: input.userId,
    packSlug: input.packSlug,
    amount: input.amount,
    currency: input.currency ?? "INR",
    credits: input.credits,
    status: input.provider === "admin" ? "paid" : input.provider === "whatsapp_manual" ? "manual_pending" : "pending",
    provider: input.provider,
    createdAt: Date.now(),
  };
  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): CreditOrder | undefined {
  return orders.get(id);
}

export function listOrders(userId: string): CreditOrder[] {
  return [...orders.values()].filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function listAllOrders(status?: OrderStatus): CreditOrder[] {
  return [...orders.values()].filter((o) => !status || o.status === status).sort((a, b) => b.createdAt - a.createdAt);
}

export function hasWebhookProcessed(webhookId: string): boolean {
  return processedWebhooks.has(webhookId);
}

/**
 * credit the ledger + mark paid. Idempotent per order.
 * Dedupe is recorded only AFTER the ledger credit succeeds, so a failed
 * credit leaves the webhook unprocessed and the order unmarked (retry-safe).
 */
const confirmInFlight = new Set<string>();

export async function confirmOrderPaid(orderId: string, opts?: { webhookId?: string }): Promise<CreditOrder | null> {
  const order = orders.get(orderId);
  if (!order) return null;
  if (order.status === "paid" || (opts?.webhookId && processedWebhooks.has(opts.webhookId))) return order;
  if (confirmInFlight.has(orderId)) return order;

  confirmInFlight.add(orderId);
  try {
    const balance = await credit(order.userId, order.credits, `pack: ${order.packSlug} (${order.credits.toLocaleString()} credits)`);
    void balance;

    order.status = "paid";
    order.paidAt = Date.now();
    if (opts?.webhookId) {
      order.webhookId = opts.webhookId;
      processedWebhooks.add(opts.webhookId);
    }
    return order;
  } finally {
    confirmInFlight.delete(orderId);
  }
}

/**
 * Reject webhook confirmations whose paid amount doesn't match the pack.
 * Prevents underpayment credits if the payment gateway data is tampered/mismatched.
 */
export function assertAmountMatchesOrder(order: CreditOrder, paidAmount: number, currency: string): void {
  if (currency !== order.currency || paidAmount < order.amount) {
    throw new Error(`amount mismatch for order ${order.id}: expected ${order.currency} ${order.amount}, got ${currency} ${paidAmount}`);
  }
}

/** admin manual confirmation (WhatsApp/UPI flow) */
export async function confirmManualOrder(orderId: string): Promise<CreditOrder | null> {
  const order = orders.get(orderId);
  if (!order) return null;
  if (order.provider === "razorpay") return order; // razorpay orders are webhook-confirmed
  return confirmOrderPaid(orderId);
}

export function setOrderRef(orderId: string, providerRef: string): void {
  const order = orders.get(orderId);
  if (order) order.providerRef = providerRef;
}
