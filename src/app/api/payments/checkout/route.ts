import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/sandbox/session";
import { getPack, getPlan, priceInr } from "@/lib/pricing/packs";
import { createOrder, setOrderRef } from "@/lib/payments/orders";
import { createPaymentLink, RazorpayNotConfiguredError } from "@/lib/payments/razorpay";

/**
 * POST /api/payments/checkout — create a credit pack or monthly plan purchase.
 *
 * { type: "pack" | "plan", slug }
 * Returns { orderId, checkoutUrl } — Razorpay Payment Link when configured;
 * otherwise the order is created as manual_pending (WhatsApp/UPI flow) and
 * the UI directs the user to contact us / admin confirms on payment.
 */

const CheckoutSchema = z.object({
  type: z.enum(["pack", "plan"]),
  slug: z.string(),
});

export async function POST(request: Request) {
  // user session required (real session, or sandbox cookie without Supabase)
  const { userId, supabaseConfigured } = await resolveSession();
  let email: string | undefined;
  if (!userId) {
    if (supabaseConfigured) {
      return NextResponse.json({ error: "Sign in to buy credits.", code: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Payments are being configured — try again soon, or use the local test playground.", code: "billing_unavailable" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const product = parsed.data.type === "pack" ? getPack(parsed.data.slug) : getPlan(parsed.data.slug);
  if (!product) {
    return NextResponse.json({ error: "Unknown product.", code: "not_found" }, { status: 404 });
  }

  const credits = parsed.data.type === "pack"
    ? (product as { credits: number }).credits
    : (product as { premiumCredits: number }).premiumCredits;

  const amountInrPaise = priceInr(product.priceUsd);

  const order = createOrder({
    userId,
    packSlug: product.slug,
    amount: amountInrPaise,
    credits,
    provider: "razorpay",
  });

  try {
    const link = await createPaymentLink({
      amountPaise: amountInrPaise,
      description: `LugunaVoice ${product.name} — ${credits.toLocaleString()} credits`,
      orderId: order.id,
      customerEmail: email,
    });
    setOrderRef(order.id, link.id);
    return NextResponse.json({ orderId: order.id, checkoutUrl: link.shortUrl, status: order.status });
  } catch (err) {
    if (err instanceof RazorpayNotConfiguredError) {
      // fall back to the manual WhatsApp/UPI flow
      order.status = "manual_pending";
      order.provider = "whatsapp_manual";
      return NextResponse.json({
        orderId: order.id,
        checkoutUrl: null,
        status: order.status,
        message: "Automated payments are being configured — order created for manual confirmation.",
      });
    }
    console.error("[checkout] failed", err);
    return NextResponse.json(
      { error: "Could not create the payment. Please try again.", code: "payment_error" },
      { status: 502 },
    );
  }
}
