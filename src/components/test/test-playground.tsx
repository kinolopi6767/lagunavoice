"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_VOICES, DEMO_STYLES } from "@/lib/tts/demo-voices";

/**
 * Local test playground — exercises the whole API surface without a DB:
 *  - sandbox session (enter/exit), unlocks session-gated endpoints
 *  - API keys saved to the BROWSER (localStorage) for testing /api/v1/*
 *  - TTS: studio, long-form, streaming, landing demo, v1 async
 *  - credits: balance + manual check-out order (confirmable in /admin)
 */

interface SavedKey {
  id: string;
  name: string;
  key: string;
  savedAt: number;
}

interface DevStatus {
  supabaseConfigured: boolean;
  sandbox: boolean;
  userId?: string;
}

interface VoiceOption {
  id: string;
  name: string;
  provider: string;
  tier: string;
  language?: string | null;
  gender?: string | null;
}

const STORE_KEY = "lv_saved_keys";
const MAX_TEST_CHARS = 4_000;

function loadSavedKeys(): SavedKey[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedKey[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedKeys(keys: SavedKey[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(keys));
}

export function TestPlayground() {
  const [status, setStatus] = useState<DevStatus | null>(null);
  const [sandboxName, setSandboxName] = useState("");
  const [sandboxMsg, setSandboxMsg] = useState<string | null>(null);
  const [sandboxErr, setSandboxErr] = useState<string | null>(null);
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);

  const [savedKeys, setSavedKeys] = useState<SavedKey[]>(() => loadSavedKeys());
  const [newKeyName, setNewKeyName] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [manualKeyName, setManualKeyName] = useState("");
  const [activeKeyId, setActiveKeyId] = useState<string>("");
  const [keysMsg, setKeysMsg] = useState<string | null>(null);
  const [keysErr, setKeysErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesErr, setVoicesErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"studio" | "longform" | "stream" | "demo" | "v1">("studio");
  const [text, setText] = useState("Welcome to LugunaVoice. Type a sentence here and hit generate to hear it spoken.");
  const [voiceId, setVoiceId] = useState("");
  const [style, setStyle] = useState("neutral");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: "audio" | "json" | "error";
    label?: string;
    audioSrc?: string;
    audioMime?: string;
    srt?: string;
    json?: string;
    text?: string;
  } | null>(null);

  // credits / payments
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceMsg, setBalanceMsg] = useState<string | null>(null);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [orderErr, setOrderErr] = useState<string | null>(null);

  const activeKey = useMemo(
    () => savedKeys.find((k) => k.id === activeKeyId) ?? savedKeys[0],
    [savedKeys, activeKeyId],
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/session")
      .then((res) => (res.ok ? (res.json() as Promise<DevStatus>) : null))
      .then((d) => {
        if (!cancelled && d) setStatus(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!voices.length && !voicesErr) {
      fetch("/api/voices?limit=100&tier=free")
        .then((res) => (res.ok ? (res.json() as Promise<{ voices: VoiceOption[] }>) : null))
        .then((d) => {
          if (d?.voices?.length) {
            setVoices(d.voices);
            setVoiceId((prev) => prev || d.voices[0]?.id || "");
          }
        })
        .catch(() => setVoicesErr("Could not load voices."));
    }
  }, [voices.length, voicesErr]);

  const selectableVoices = useMemo(() => {
    if (mode === "demo") return DEMO_VOICES.map((v) => ({ id: v.id, name: v.name, provider: v.provider, tier: v.tier, language: v.language, gender: v.gender }));
    return voices;
  }, [mode, voices]);

  const effectiveVoiceId = useMemo(() => {
    if (selectableVoices.some((v) => v.id === voiceId)) return voiceId;
    return selectableVoices[0]?.id ?? "";
  }, [selectableVoices, voiceId]);

  async function enterSandbox() {
    setSandboxErr(null);
    setSandboxMsg(null);
    setSandboxCode(null);
    const res = await fetch("/api/dev/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "enter", name: sandboxName || undefined }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setSandboxErr(data?.error ?? "Could not enter sandbox mode.");
      return;
    }
    setStatus({ supabaseConfigured: false, sandbox: true, userId: data.userId });
    setSandboxMsg(`Sandbox user ${data.userId} active — 2,000 test credits granted.`);
    setSandboxCode(data.referralCode ?? null);
  }

  async function exitSandbox() {
    await fetch("/api/dev/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "exit" }),
    });
    setStatus((s) => (s ? { ...s, sandbox: false, userId: undefined } : s));
    setSandboxMsg("Sandbox session ended (cookie cleared).");
    setSandboxCode(null);
  }

  // ---------- API keys (browser-local) ----------

  function saveKeyLocally(key: SavedKey) {
    const next = [key, ...savedKeys.filter((k) => k.id !== key.id)];
    setSavedKeys(next);
    persistSavedKeys(next);
    setActiveKeyId(key.id);
  }

  async function createKey() {
    setKeysErr(null);
    setKeysMsg(null);
    if (!status?.sandbox) {
      setKeysErr("Enter sandbox mode first — key creation needs a session (or sign in on the deployed app).");
      return;
    }
    const name = newKeyName.trim() || `test-${Date.now().toString(36)}`;
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.key) {
      setKeysErr(data?.error ?? "Could not create key.");
      return;
    }
    saveKeyLocally({ id: data.record?.id ?? `local-${Date.now()}`, name, key: data.key, savedAt: Date.now() });
    setKeysMsg(`Key "${name}" created and saved to this browser (localStorage). Full key shown once — tap to copy.`);
    setNewKeyName("");
  }

  function addManualKey() {
    setKeysErr(null);
    const key = manualKey.trim();
    if (!key.startsWith("lug_")) {
      setKeysErr("Key must start with lug_ (create one above, or paste from a previous run).");
      return;
    }
    const name = manualKeyName.trim() || "imported";
    saveKeyLocally({ id: `local-${Date.now()}`, name, key, savedAt: Date.now() });
    setKeysMsg(`Key "${name}" saved to this browser.`);
    setManualKey("");
    setManualKeyName("");
  }

  function removeKey(id: string) {
    const next = savedKeys.filter((k) => k.id !== id);
    setSavedKeys(next);
    persistSavedKeys(next);
  }

  async function copyKey(id: string, full: string) {
    setRevealed(revealed === id ? null : id);
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      // clipboard unavailable — key stays visible for manual copy
    }
  }

  // ---------- TTS ----------

  async function runTts() {
    setBusy(true);
    setResult(null);
    const trim = text.trim();
    if (!trim) {
      setResult({ kind: "error", text: "Enter some text first." });
      setBusy(false);
      return;
    }
    if (trim.length > MAX_TEST_CHARS) {
      setResult({ kind: "error", text: `Text too long (${trim.length} chars, max ${MAX_TEST_CHARS} for tests).` });
      setBusy(false);
      return;
    }

    try {
      if (mode === "studio") {
        const res = await fetch("/api/studio/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voiceId: effectiveVoiceId, style, rate, pitch }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.audioBase64) {
          setResult({ kind: "error", text: `Studio (${res.status}): ${data?.error ?? "no audio returned"} [${data?.code ?? ""}]` });
          return;
        }
        setResult({
          kind: "audio",
          label: `Studio · ${data.tier ?? ""} · ${data.charCount ?? ""} chars · ${data.creditsCharged ?? 0} credits`,
          audioSrc: `data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioBase64}`,
        });
      } else if (mode === "longform") {
        const res = await fetch("/api/studio/longform", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voiceId: effectiveVoiceId, style }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.jobId) {
          setResult({ kind: "error", text: `Long-form (${res.status}): ${data?.error ?? "no job returned"} [${data?.code ?? ""}]` });
          return;
        }
        // poll
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1_500));
          const poll = await fetch(`/api/studio/longform/${data.jobId}`);
          const job = await poll.json().catch(() => null);
          if (job?.status === "completed" && job?.audioBase64) {
            setResult({
              kind: "audio",
              label: `Long-form · ${job.chunks ?? "?"} chunks`,
              audioSrc: `data:audio/mpeg;base64,${job.audioBase64}`,
              srt: job.srt ?? undefined,
            });
            return;
          }
          if (job?.status === "failed") {
            setResult({ kind: "error", text: `Long-form failed: ${job.error ?? "unknown"}` });
            return;
          }
        }
        setResult({ kind: "error", text: "Long-form job timed out after ~90s (still processing server-side — check /admin or retry)." });
      } else if (mode === "stream") {
        const res = await fetch("/api/studio/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voiceId: effectiveVoiceId, rate: Math.min(1.5, Math.max(0.7, rate)), pronunciations: undefined }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setResult({ kind: "error", text: `Stream (${res.status}): ${data?.error ?? "stream failed"} [${data?.code ?? ""}]` });
          return;
        }
        const blob = await res.blob();
        const credits = res.headers.get("x-lv-credits") ?? "0";
        setResult({
          kind: "audio",
          label: `Stream · ${trim.length} chars · ${credits === "0" ? "free preview" : `${credits} credits`}`,
          audioSrc: URL.createObjectURL(blob),
          audioMime: res.headers.get("content-type") ?? "audio/mpeg",
        });
      } else if (mode === "demo") {
        const res = await fetch("/api/landing/demo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voice: effectiveVoiceId, style, turnstileToken: undefined }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.audioBase64) {
          setResult({ kind: "error", text: `Demo (${res.status}): ${data?.error ?? "no audio returned"} [${data?.code ?? ""}]` });
          return;
        }
        setResult({
          kind: "audio",
          label: `Landing demo · ${data.remaining ?? "?"} demo generations left today`,
          audioSrc: `data:${data.mimeType ?? "audio/mpeg"};base64,${data.audioBase64}`,
        });
      } else if (mode === "v1") {
        if (!activeKey) {
          setResult({ kind: "error", text: "Select a saved API key first (Keys card → create one, it saves automatically)." });
          return;
        }
        const res = await fetch("/api/v1/tts/generations", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${activeKey.key}` },
          body: JSON.stringify({ text: trim, voice: effectiveVoiceId, style, pitch, rate }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.id) {
          setResult({ kind: "error", text: `v1 (${res.status}): ${data?.error ?? "no generation returned"} [${data?.code ?? ""}]` });
          return;
        }
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 1_000));
          const poll = await fetch(`/api/v1/generations/${data.id}`, {
            headers: { authorization: `Bearer ${activeKey.key}` },
          });
          const gen = await poll.json().catch(() => null);
          if (gen?.status === "completed" && gen?.audioBase64) {
            setResult({
              kind: "audio",
              label: `v1 API · gen_${data.id.slice(0, 8)} · ${gen.creditsCharged ?? 0} credits`,
              audioSrc: `data:${gen.mimeType ?? "audio/mpeg"};base64,${gen.audioBase64}`,
              json: JSON.stringify(gen, null, 2),
            });
            return;
          }
          if (gen?.status === "failed") {
            setResult({ kind: "error", text: `v1 generation failed: ${gen.error ?? "unknown"}` });
            return;
          }
        }
        setResult({ kind: "error", text: "v1 generation timed out (still processing server-side)." });
      }
    } catch (err) {
      setResult({ kind: "error", text: `Request failed: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  // ---------- credits / payments ----------

  async function fetchBalance() {
    setBalanceMsg(null);
    if (!activeKey) {
      setBalanceMsg("Need a saved API key — create one in the Keys card.");
      return;
    }
    const res = await fetch("/api/v1/me", { headers: { authorization: `Bearer ${activeKey.key}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.creditsBalance === undefined) {
      setBalanceMsg(`Balance (${res.status}): ${data?.error ?? "failed"}`);
      return;
    }
    setBalance(data.creditsBalance);
    setBalanceMsg(`Balance via "${activeKey.name}": ${data.creditsBalance.toLocaleString()} credits.`);
  }

  async function createTestOrder() {
    setOrderErr(null);
    setOrderMsg(null);
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "pack", slug: "starter" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setOrderErr(`Checkout (${res.status}): ${data?.error ?? "failed"} [${data?.code ?? ""}]`);
      return;
    }
    setOrderMsg(
      data.status === "manual_pending" || !data.checkoutUrl
        ? `Order ${data.orderId} created (manual flow — Razorpay not configured). Confirm it in /admin to credit 15,000 credits.`
        : `Order ${data.orderId} created — checkout at ${data.checkoutUrl}`,
    );
  }

  // ---------- UI ----------

  return (
    <div className="space-y-6">
      {/* Sandbox session */}
      <Card>
        <CardHeader>
          <CardTitle>1 · Sandbox session</CardTitle>
          <CardDescription>
            Supabase not configured? Enter sandbox mode — a cookie acts as your signed-in user so
            premium voices, API keys, referrals and checkout all work (in-memory). Sign in on the
            real app instead when auth is configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status?.supabaseConfigured ? (
            <p className="text-sm">
              Real authentication is configured (Supabase env vars present) — sandbox cookie is inactive.
              Use the normal <a className="underline" href="/login">sign-in</a> or <a className="underline" href="/studio">studio</a>.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="sandbox-name">Name (optional — used for referral code)</Label>
                <Input id="sandbox-name" value={sandboxName} onChange={(e) => setSandboxName(e.target.value)} placeholder="e.g. tester" className="w-56" />
              </div>
              {!status?.sandbox ? (
                <Button onClick={enterSandbox}>Enter sandbox</Button>
              ) : (
                <Button variant="outline" onClick={exitSandbox}>Exit sandbox</Button>
              )}
              {status?.sandbox && (
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
                  active: {status.userId?.slice(0, 14)}…
                </span>
              )}
            </div>
          )}
          {sandboxCode && status?.sandbox && (
            <p className="text-sm">
              Your referral code: <code className="rounded bg-muted px-1.5 py-0.5">{sandboxCode}</code> — open a
              second browser (or exit + re-enter) to claim it in{" "}
              <a className="underline" href="/referrals">/referrals</a>.
            </p>
          )}
          {sandboxMsg && <p className="text-sm text-emerald-600">{sandboxMsg}</p>}
          {sandboxErr && <p className="text-sm text-destructive">{sandboxErr}</p>}
        </CardContent>
      </Card>

      {/* API keys — browser-local */}
      <Card>
        <CardHeader>
          <CardTitle>2 · API keys (saved in this browser)</CardTitle>
          <CardDescription>
            Create a key with the sandbox session (or sign-in session) — it is stored in
            localStorage only, for testing /api/v1/* locally. Never commit these keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="key-name">Key name</Label>
              <Input id="key-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="test-key" className="w-44" />
            </div>
            <Button onClick={createKey}>Create & save to browser</Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="space-y-1">
              <Label htmlFor="manual-key">Or paste an existing lug_ key</Label>
              <Input id="manual-key" value={manualKey} onChange={(e) => setManualKey(e.target.value)} placeholder="lug_…" className="w-64 font-mono text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="manual-key-name">Name</Label>
              <Input id="manual-key-name" value={manualKeyName} onChange={(e) => setManualKeyName(e.target.value)} placeholder="imported" className="w-32" />
            </div>
            <Button variant="outline" onClick={addManualKey}>Save key</Button>
          </div>

          {keysMsg && <p className="text-sm text-emerald-600">{keysMsg}</p>}
          {keysErr && <p className="text-sm text-destructive">{keysErr}</p>}

          {savedKeys.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Saved keys (localStorage)</p>
              {savedKeys.map((k) => (
                <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setActiveKeyId(k.id)}
                    className="flex items-center gap-2 text-left"
                    title="Use for v1 calls"
                  >
                    <span
                      className={`size-2 rounded-full ${activeKey?.id === k.id ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                    />
                    <span className="font-medium">{k.name}</span>
                  </button>
                  <code className="font-mono text-xs text-muted-foreground">
                    {revealed === k.id ? k.key : `${k.key.slice(0, 12)}…${k.key.slice(-4)}`}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {new Date(k.savedAt).toLocaleString()}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copyKey(k.id, k.key)}>
                      {revealed === k.id ? "copy" : "reveal"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeKey(k.id)}>
                      remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TTS playground */}
      <Card>
        <CardHeader>
          <CardTitle>3 · TTS playground</CardTitle>
          <CardDescription>
            All five endpoints: Studio quick, Long-form (SRT), Stream, Landing demo, and the v1
            developer API (uses the active key above).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["studio", "Studio"],
                ["longform", "Long-form"],
                ["stream", "Stream"],
                ["demo", "Demo"],
                ["v1", "v1 API"],
              ] as const
            ).map(([m, label]) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? "default" : "outline"}
                onClick={() => setMode(m)}
              >
                {label}
              </Button>
            ))}
          </div>
          {mode === "stream" && !voices.some((v) => v.provider === "deepgram") && (
            <p className="text-sm text-amber-600">
              Streaming needs a flagship (Deepgram Aura) voice — Aura voices appear here once{" "}
              <code className="rounded bg-muted px-1">DEEPGRAM_API_KEY</code> is set. Without it,
              stream requests fail gracefully (503/404) — that failure path is part of the test.
            </p>
          )}
          {mode === "v1" && !activeKey && (
            <p className="text-sm text-amber-600">v1 API mode needs a key — create one in card 2 (it saves to this browser automatically).</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tts-text">Text ({text.length}/{MAX_TEST_CHARS})</Label>
              <textarea
                id="tts-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Voice ({mode === "demo" ? "demo set" : "free voices"})</Label>
                {selectableVoices.length ? (
                  <select
                    value={effectiveVoiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {selectableVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.language ?? "?"} · {v.gender ?? "?"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">{voicesErr ?? "Loading voices…"}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Style</Label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {DEMO_STYLES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Rate: {rate.toFixed(2)}×</Label>
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label>Pitch: {pitch > 0 ? `+${pitch}` : pitch}</Label>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Button onClick={runTts} disabled={busy}>
            {busy ? "Working…" : `Generate via ${mode}`}
          </Button>

          {result && (
            <div className="space-y-2 rounded-md border p-4">
              {result.kind === "error" ? (
                <p className="text-sm text-destructive">{result.text}</p>
              ) : (
                <>
                  {result.label && <p className="text-sm font-medium">{result.label}</p>}
                  {result.audioSrc && (
                    <audio controls src={result.audioSrc} className="w-full" />
                  )}
                  {result.srt && (
                    <a
                      className="inline-block text-sm text-primary underline"
                      href={`data:text/plain;charset=utf-8,${encodeURIComponent(result.srt)}`}
                      download="subtitles.srt"
                    >
                      Download SRT subtitles
                    </a>
                  )}
                  {result.json && (
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">Raw response</summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{result.json}</pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credits & payments */}
      <Card>
        <CardHeader>
          <CardTitle>4 · Credits & payments (manual flow)</CardTitle>
          <CardDescription>
            Check your balance via the developer API, and create a test purchase. Without Razorpay
            the order lands as manual_pending — confirm it in /admin to see the ledger credit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fetchBalance}>Check balance (/api/v1/me)</Button>
            <Button variant="outline" onClick={createTestOrder}>Create test order (Starter pack)</Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin" target="_blank" rel="noreferrer">Open /admin → confirm order →</a>
            </Button>
          </div>
          {balance !== null && <p className="text-sm">Balance: <span className="font-medium">{balance.toLocaleString()}</span> credits.</p>}
          {balanceMsg && <p className="text-sm text-emerald-600">{balanceMsg}</p>}
          {orderMsg && <p className="text-sm text-emerald-600">{orderMsg}</p>}
          {orderErr && <p className="text-sm text-destructive">{orderErr}</p>}
        </CardContent>
      </Card>

      {/* quick links */}
      <Card>
        <CardHeader>
          <CardTitle>5 · Related pages</CardTitle>
          <CardDescription>Every flow is testable locally (guests or sandbox session).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            ["/studio", "Studio (free TTS)"],
            ["/voices", "Voice library + previews"],
            ["/voice-cloning", "Voice cloning"],
            ["/api-keys", "API keys dashboard"],
            ["/referrals", "Referrals"],
            ["/developers", "Developer docs"],
            ["/admin", "Admin dashboard"],
            ["/openapi.json", "OpenAPI spec"],
          ].map(([href, label]) => (
            <Button key={href} variant="outline" size="sm" asChild>
              <a href={href}>{label}</a>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}