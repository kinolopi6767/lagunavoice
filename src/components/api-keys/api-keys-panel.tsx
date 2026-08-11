"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    } catch {
      window.prompt("Copy manually:", text);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={copy}>
      {copied ? "Copied!" : label}
    </Button>
  );
}

function relativeTime(ts?: number) {
  if (!ts) return null;
  const s = Math.max(1, Math.round((Date.now() - ts) / 1_000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/keys")
      .then(async (r) => {
        if (r.status === 401) {
          setUnauthorized(true);
          return null;
        }
        if (!r.ok) throw new Error("load_failed");
        const d = (await r.json()) as { keys?: KeyRecord[] } | null;
        setUnauthorized(false);
        return Array.isArray(d?.keys) ? d.keys : [];
      })
      .then((loaded) => {
        if (loaded) setKeys(loaded);
      })
      .catch(() => setError("Could not load keys."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setError(null);
    setNewKey(null);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) {
      setError(d?.error ?? "Could not create key.");
      return;
    }
    setNewKey(d.key);
    setName("");
    load();
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this key? Requests using it will stop working immediately.")) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
  }

  const activeKeys = keys.filter((k) => !k.revokedAt);

  if (unauthorized) {
    return (
      <div className="space-y-6">
        <Card className="mx-auto mt-10 max-w-md">
          <CardContent className="space-y-4 p-6 text-center">
            <p className="font-medium">Sign in to manage API keys</p>
            <p className="text-sm text-muted-foreground">
              Your developer keys live on your account. No auth configured yet? Use the test
              playground to enter sandbox mode first.
            </p>
            <div className="flex justify-center gap-2">
              <Button asChild>
                <a href="/signup">Sign up</a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/test">Sandbox mode</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create an API key</CardTitle>
          <CardDescription>
            Keys are shown once — copy it now. We only store a hash, so a lost key cannot be recovered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">
                Key name
              </Label>
              <Input
                id="key-name"
                placeholder="e.g. production"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && create()}
              />
            </div>
            <Button onClick={create} disabled={!name.trim()}>
              Create key
            </Button>
          </div>
          {newKey ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-medium text-primary">
                Your new key (shown once — copy it now):
              </p>
              <div className="mt-2 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all rounded bg-muted p-2 text-xs">
                  {newKey}
                </code>
                <CopyButton text={newKey} label="Copy" />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your keys</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${activeKeys.length} active`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="font-medium">No keys yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create one above to start calling the REST API. See the{" "}
                <a href="/developers" className="underline underline-offset-4">
                  developer docs
                </a>{" "}
                for how to authenticate.
              </p>
            </div>
          ) : (
            activeKeys.map((k) => (
              <div
                key={k.id}
                className={cn(
                  "flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                  k.revokedAt && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{k.name}</p>
                    <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</span>
                    {k.scopes.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px]">
                      {k.rateLimitRpm} rpm
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.revokedAt
                      ? "Revoked"
                      : k.lastUsedAt
                        ? `Last used ${relativeTime(k.lastUsedAt)}`
                        : "Never used"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!!k.revokedAt}
                  onClick={() => revoke(k.id)}
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}