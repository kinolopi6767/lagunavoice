"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdminData {
  balance: number | null;
  orders: Array<{
    id: string;
    userId: string;
    packSlug: string;
    amount: number;
    credits: number;
    status: string;
    provider: string;
  }>;
  flags: Array<{ id: string; rule: string; severity: string; status: string; userId?: string; evidence: Record<string, unknown> }>;
  bans: Array<{ userId: string; type: string; reason: string; expiresAt?: number }>;
  usage: { today: Array<{ provider: string; chars: number; sttSeconds: number; requests: number; errored: number; costCents: number }>; totalCostCentsToday: number };
  providers: Array<{ provider: string; enabled: boolean; reason?: string }>;
}

export function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState("1000");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin");
    if (!res.ok) {
      return; // not authed — stay on login
    }
    const d = (await res.json()) as AdminData;
    setData(d);
    setAuthed(true);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin")
      .then((res) => (res.ok ? (res.json() as Promise<AdminData>) : null))
      .then((d) => {
        if (!cancelled && d) {
          setData(d);
          setAuthed(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function login() {
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      await load();
    } else {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? "Wrong password.");
    }
  }

  async function grant() {
    setMessage(null);
    const res = await fetch("/api/admin/grant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: grantEmail, amount: Number(grantAmount) }),
    });
    const d = await res.json().catch(() => null);
    setMessage(res.ok ? `Granted ${grantAmount} credits → balance ${d?.balance}` : d?.error ?? "Failed");
    load();
  }

  async function confirmOrder(id: string) {
    await fetch("/api/payments/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function toggleProvider(provider: string, enabled: boolean) {
    await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, enabled }),
    });
    load();
  }

  async function resolveFlag(id: string) {
    await fetch("/api/admin/flags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: "actioned" }),
    });
    load();
  }

  if (!authed) {
    return (
      <Card className="mx-auto mt-20 max-w-sm">
        <CardHeader>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Password is set via the ADMIN_PASSWORD env var.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button onClick={login} className="w-full">Sign in</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return <p className="p-10">Loading…</p>;

  return (
    <div className="space-y-6">
      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Balance (demo user)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.balance?.toLocaleString() ?? "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open flags</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.flags.filter((f) => f.status === "open").length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active bans</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{data.bans.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Today&apos;s provider cost</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">${(data.usage.totalCostCentsToday / 100).toFixed(2)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Manual actions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="user id or email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} />
              <Input type="number" className="w-28" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
              <Button onClick={grant}>Grant credits</Button>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Pending manual orders (WhatsApp/UPI)</p>
              {data.orders.filter((o) => o.status === "manual_pending").length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                data.orders.filter((o) => o.status === "manual_pending").map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{o.packSlug} · {o.credits.toLocaleString()} cr · {o.userId.slice(0, 8)}</span>
                    <Button size="sm" variant="outline" onClick={() => confirmOrder(o.id)}>Confirm paid</Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Provider kill-switches</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.providers.map((p) => (
              <div key={p.provider} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="font-medium">{p.provider}</span>
                <Button size="sm" variant={p.enabled ? "outline" : "default"} onClick={() => toggleProvider(p.provider, !p.enabled)}>
                  {p.enabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Disabling a provider returns 503 for its voices (research/08 kill-switch pattern).
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Abuse flags (R1–R24)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags — clean.</p>
          ) : (
            data.flags.slice(0, 20).map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>
                  <b>{f.rule}</b> · {f.severity} · {f.status}
                  {f.userId ? ` · user ${f.userId.slice(0, 8)}` : ""}
                </span>
                <Button size="sm" variant="ghost" disabled={f.status !== "open"} onClick={() => resolveFlag(f.id)}>
                  Resolve
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Provider COGS (today)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.usage.today.length === 0 ? (
            <p className="text-sm text-muted-foreground">No provider usage recorded yet today.</p>
          ) : (
            data.usage.today.map((r) => (
              <div key={r.provider} className="flex justify-between rounded-md border p-2 text-sm">
                <span className="font-medium">{r.provider}</span>
                <span>{r.chars.toLocaleString()} chars · {r.requests} req · {r.errored} err · ${(r.costCents / 100).toFixed(2)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
