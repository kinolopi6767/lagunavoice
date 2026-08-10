"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface ReferralSummary {
  code: string;
  bonusPerClaim: number;
  claimsCount: number;
  totalBonusEarned: number;
  recentClaims: Array<{ refereeId: string; claimedAt: number }>;
}

export function ReferralsPanel() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-session">("loading");
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referrals")
      .then((r) => (r.ok ? (r.json() as Promise<ReferralSummary>) : null))
      .then((d) => {
        if (cancelled) return;
        if (d) {
          setSummary(d);
          setStatus("ready");
        } else {
          setStatus("no-session");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyCode() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      setMessage(`Your code: ${summary.code}`);
    }
  }

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
    if (d?.alreadyClaimed) {
      setMessage("This code was already claimed for your account.");
    } else {
      setMessage(
        `Referral bonus of ${(d?.bonusCredits ?? 2_500).toLocaleString()} credits added to your balance.`,
      );
    }
    setCode("");
  }

  if (status === "loading") {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  if (status === "no-session") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Sign in to see your referrals</CardTitle>
          <CardDescription>
            Every account gets a personal referral code. Sign in to share yours and earn
            2,500 bonus credits per friend.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button asChild className="flex-1">
            <a href="/signup">Create an account</a>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <a href="/login">Sign in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Friends referred
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.claimsCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bonus earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.totalBonusEarned.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bonus per friend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.bonusPerClaim.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">credits, non-expiring</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your referral code</CardTitle>
              <CardDescription>
                Share this code with friends. When they claim it at signup, you both earn.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <code className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-center font-mono text-lg font-semibold tracking-wide">
                {summary.code}
              </code>
              <Button onClick={copyCode} disabled={copied}>
                {copied ? "Copied!" : "Copy code"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Claim a referral code</CardTitle>
            <CardDescription>
              Have a friend&apos;s code? Enter it to unlock your signup bonus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="ref-code">Referral code</Label>
            <div className="flex gap-2">
              <Input
                id="ref-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. sahil-ab12"
                className="font-mono"
              />
              <Button onClick={claim} disabled={!code.trim()}>
                Claim
              </Button>
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
            <p className="flex gap-2"><span className="text-primary">✓</span> Every account gets a referral code at signup.</p>
            <p className="flex gap-2">
              <span className="text-primary">✓</span>
              <span>
                When someone claims your code, they get the signup bonus and you get{" "}
                <b className="text-foreground">2,500 bonus credits</b>.
              </span>
            </p>
            <p className="flex gap-2">
              <span className="text-primary">✓</span>
              <span>One claim per friend pair — self-referrals and multi-account farming are flagged.</span>
            </p>
            <p className="flex gap-2"><span className="text-primary">✓</span> Bonus credits never expire.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent claims</CardTitle>
          <CardDescription>Friends who claimed your code</CardDescription>
        </CardHeader>
        <CardContent>
          {(!summary || summary.recentClaims.length === 0) ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-sm font-medium">No claims yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share your code and your first bonus lands here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {summary.recentClaims.map((c) => (
                <div
                  key={c.refereeId + c.claimedAt}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <span className="font-mono text-xs">{c.refereeId}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.claimedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · +{(summary.bonusPerClaim ?? 2_500).toLocaleString()} credits
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}