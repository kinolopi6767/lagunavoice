import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration — Payment Links + webhook verification (HMAC-SHA256).
 * Basic auth: key_id:key_secret (Razorpay API convention).
 * Env-gated: without RAZORPAY_KEY_ID/SECRET, checkout returns an error and
 * the manual WhatsApp/UPI flow (admin-confirmed) is the active path.
 */

const API_BASE = "https://api.razorpay.com/v1";

export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super("Razorpay is not configured");
    this.name = "RazorpayNotConfiguredError";
  }
}

function credentials(): { keyId: string; keySecret: string } {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new RazorpayNotConfiguredError();
  return { keyId, keySecret };
}

export interface PaymentLinkOptions {
  amountPaise: number; // INR minor units
  description: string;
  orderId: string; // our credit_order id
  customerEmail?: string;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
}

/** create a Razorpay Payment Link for a credit pack purchase */
export async function createPaymentLink(opts: PaymentLinkOptions): Promise<PaymentLinkResult> {
  const { keyId, keySecret } = credentials();

  const res = await fetch(`${API_BASE}/payment_links`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: opts.amountPaise,
      currency: "INR",
      description: opts.description.slice(0, 99),
      reference_id: opts.orderId,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/billing`,
      callback_method: "get",
      notes: { order_id: opts.orderId },
      customer: opts.customerEmail ? { email: opts.customerEmail } : undefined,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[razorpay] createPaymentLink failed", res.status, detail.slice(0, 300));
    throw new Error(`Could not create payment link (${res.status})`);
  }

  const data = (await res.json()) as { id?: string; short_url?: string };
  if (!data.id || !data.short_url) throw new Error("Razorpay response missing link data");

  return { id: data.id, shortUrl: data.short_url };
}

/**
 * Verify a Razorpay webhook signature: HMAC-SHA256(webhookSecret, rawBody)
 * compared against the `X-Razorpay-Signature` header. Must run on the RAW
 * request body — never on a re-serialized object.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** dedupe: Razorpay replays events — the webhook id must be unique per order */
export interface RazorpayEvent {
  event: string;
  id: string;
  payment?: { id?: string; status?: string };
  payload?: {
    payment?: { entity?: { id?: string; status?: string; amount?: number } };
    payment_link?: { entity?: { id?: string; reference_id?: string; status?: string; amount_paid?: number } };
  };
}

export function parseRazorpayEvent(rawBody: string): RazorpayEvent {
  return JSON.parse(rawBody) as RazorpayEvent;
}
