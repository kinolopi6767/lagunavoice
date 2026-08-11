"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Balance chip in the app header — links to /billing. Works for the real
 * session and the sandbox cookie (both resolve on /api/payments/orders).
 * Hidden when signed out.
 */
export function CreditsChip() {
  const [balance, setBalance] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/orders")
      .then((res) => (res.ok ? (res.json() as Promise<{ balance: number }>) : null))
      .then((d) => {
        if (!cancelled && d) setBalance(d.balance);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked || balance === null) return null;

  return (
    <Link
      href="/billing"
      className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      title="Credit balance — click to top up"
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 9.5a3.5 3.5 0 1 0-3.5 3.5c1 0 1.5-.5 2-1" strokeLinecap="round" />
      </svg>
      {balance.toLocaleString()} cr
    </Link>
  );
}
