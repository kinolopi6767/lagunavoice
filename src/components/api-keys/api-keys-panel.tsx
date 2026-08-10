"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  lastUsedAt?: number;
  revokedAt?: number;
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/keys")
      .then((r) => r.json() as Promise<{ keys: KeyRecord[] }>)
      .then((d) => setKeys(d.keys))
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
    setNewKey(d.key); // shown once
    setName("");
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create an API key</CardTitle>
          <CardDescription>Keys are shown once — copy it now. We only store a hash.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">Key name</Label>
              <Input id="key-name" placeholder="production" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button onClick={create} disabled={!name.trim()}>Create key</Button>
          </div>
          {newKey ? (
            <div className="rounded-md border border-emerald-600/40 bg-emerald-600/5 p-3">
              <p className="text-sm font-medium">Your new key (shown once):</p>
              <code className="mt-1 block break-all rounded bg-muted p-2 text-xs">{newKey}</code>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your keys</CardTitle>
          <CardDescription>{loading ? "Loading…" : `${keys.filter((k) => !k.revokedAt).length} active`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.keyPrefix}… · {k.scopes.join(", ")} · {k.rateLimitRpm} rpm
                    {k.revokedAt ? " · REVOKED" : k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={!!k.revokedAt} onClick={() => revoke(k.id)}>
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
