"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ReferralsPanel() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/referrals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      setError(d?.error ?? "Could not claim code.");
      return;
    }
    setMessage(
      d?.alreadyClaimed
        ? "This code was already claimed for your account."
        : `Referral bonus of ${d?.bonusCredits?.toLocaleString() ?? "2,500"} credits added.`,
    );
    setCode("");
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Claim a referral code</CardTitle>
          <CardDescription>Have a friend&apos;s code? Enter it to give them a referral bonus and unlock yours.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="ref-code">Referral code</Label>
          <div className="flex gap-2">
            <Input id="ref-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="lug-abc123" />
            <Button onClick={claim} disabled={!code.trim()}>Claim</Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
          <CardDescription>Free growth, the honest way</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Every account gets a referral code at signup.</p>
          <p>• When someone claims your code, they get the signup bonus and you get <b>2,500 bonus credits</b>.</p>
          <p>• One claim per friend pair — no self-referrals, no multi-account farming (we flag those).</p>
          <p>• Bonus credits are non-expiring.</p>
        </CardContent>
      </Card>
    </div>
  );
}
