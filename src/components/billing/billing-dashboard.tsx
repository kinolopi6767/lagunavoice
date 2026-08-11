"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CREDIT_PACKS } from "@/lib/pricing/packs";

interface Order {
  id: string;
  packSlug: string;
  amount: number;
  currency: string;
  credits: number;
  status: string;
  provider: string;
  createdAt: number;
}

interface LedgerEntry {
  type: string;
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt: number;
}

interface BillingData {
  orders: Order[];
  balance: number;
  recentLedger: LedgerEntry[];
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  paid: { label: "Paid", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "secondary" },
  manual_pending: { label: "Awaiting confirmation", variant: "outline" },
  manual_confirmed: { label: "Confirmed", variant: "default" },
};

const TYPE_LABEL: Record<string, string> = {
  purchase: "Purchase",
  signup_bonus: "Signup bonus",
  referral_bonus: "Referral bonus",
  monthly_allowance: "Monthly allowance",
  generation_debit: "Generation",
  stream_debit: "Streaming",
  refund: "Refund",
  manual_adjust: "Adjustment",
};

function formatDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BillingDashboard() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/payments/orders")
      .then((res) => {
        if (res.status === 401) {
          setUnauthorized(true);
          return null;
        }
        return res.ok ? (res.json() as Promise<BillingData>) : null;
      })
      .then((d) => {
        if (d) {
          setData(d);
          setUnauthorized(false);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buy(slug: string) {
    setBusySlug(slug);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "pack", slug }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ ok: false, text: d?.error ?? "Could not create the order." });
        return;
      }
      if (d.checkoutUrl) {
        window.open(d.checkoutUrl, "_blank", "noopener");
        return;
      }
      setMessage({
        ok: true,
        text: `Order ${d.orderId} created — automated payments are being configured, so complete it via WhatsApp/UPI and an admin confirms it manually (or confirm it in /admin while testing).`,
      });
      load();
    } catch {
      setMessage({ ok: false, text: "Could not reach the server." });
    } finally {
      setBusySlug(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  if (unauthorized || !data) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardContent className="space-y-4 p-6 text-center">
          <p className="font-medium">Sign in to view billing</p>
          <p className="text-sm text-muted-foreground">
            Your credit balance, packs and order history live here. No auth configured yet? Use
            the test playground to enter sandbox mode first.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/test">Sandbox mode</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const orders = data.orders;
  const balance = data.balance;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credit balance</CardTitle>
          <CardDescription>
            {balance.toLocaleString()} credits — premium voices use 1 credit per character,
            flagship voices 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <p className="text-4xl font-bold tabular-nums">{balance.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">
            ≈ {Math.floor(balance / 1000).toLocaleString()}k characters of premium speech
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.slug} className="flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{pack.name}</CardTitle>
              <CardDescription>${pack.priceUsd} one-time</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums">{pack.credits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits · never expire</p>
              </div>
              <Button
                onClick={() => buy(pack.slug)}
                disabled={busySlug !== null}
                className="w-full"
              >
                {busySlug === pack.slug ? "Creating order…" : `Buy for $${pack.priceUsd}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {message ? (
        <p
          className={
            message.ok
              ? "rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
              : "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">Orders</CardTitle>
            <CardDescription>Credit purchases and their status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {orders.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No orders yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Buy a pack above to top up your balance.
                </p>
              </div>
            ) : (
              orders.map((o) => {
                const s = STATUS_LABEL[o.status] ?? { label: o.status, variant: "outline" as const };
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {o.packSlug} pack · {o.credits.toLocaleString()} credits
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.id.slice(0, 14)}… · {o.currency} {o.amount.toLocaleString()} ·{" "}
                        {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-lg">Credit activity</CardTitle>
            <CardDescription>Your most recent ledger entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentLedger.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center">
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate in the Studio to see debits and refunds here.
                </p>
              </div>
            ) : (
              data.recentLedger.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {TYPE_LABEL[e.type] ?? e.type}
                      {e.description ? <span className="text-muted-foreground"> — {e.description}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.createdAt)} · balance {e.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-medium tabular-nums ${
                      e.amount >= 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {e.amount >= 0 ? "+" : ""}
                    {e.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
