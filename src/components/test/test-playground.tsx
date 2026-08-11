"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_VOICES } from "@/lib/tts/demo-voices";

/**
 * Local test playground — mirrors the Studio dashboard layout.
 *
 * 1  Environment & sandbox session (no Supabase → cookie user + test credits)
 * 2  Developer API keys — platform: the LugunaVoice v1 API (/api/v1/*), same
 *    key store as /api-keys; keys are sent as `Authorization: Bearer lug_...`.
 *    Keys created here are saved to THIS BROWSER (localStorage) for testing.
 * 3  TTS dashboard (Studio-style): voice picker + script panel, five engines
 * 4  Credits & payments (manual flow)
 * 5  Related pages
 */

interface SavedKey {
  id: string;
  name: string;
  key: string;
  savedAt: number;
}

interface ServerKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitRpm: number;
  revokedAt?: string;
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

type Mode = "studio" | "longform" | "stream" | "demo" | "v1";

interface TtsResult {
  kind: "audio" | "error";
  label?: string;
  audioUrl?: string;
  srt?: string;
  json?: string;
  text?: string;
  meta?: string;
}

const STORE_KEY = "lv_saved_keys";
const MAX_TEST_CHARS = 4_000;
const STYLES = ["neutral", "cheerful", "calm", "serious", "excited"];

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

/**
 * The stream endpoint returns raw linear16 PCM (24 kHz mono) — wrap it in a
 * WAV container so the <audio> element can play it (16-bit PCM, one channel).
 */
function linear16ToWavBlob(pcm: ArrayBuffer, sampleRate = 24_000): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm));
  return new Blob([buffer], { type: "audio/wav" });
}

export function TestPlayground() {
  // 1 ─ environment + sandbox
  const [env, setEnv] = useState<{ loading: boolean; status: DevStatus | null }>({
    loading: true,
    status: null,
  });
  const [sandboxName, setSandboxName] = useState("");
  const [sandboxMsg, setSandboxMsg] = useState<string | null>(null);
  const [sandboxErr, setSandboxErr] = useState<string | null>(null);
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);

  // 2 ─ keys
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>(() => loadSavedKeys());
  const [serverKeys, setServerKeys] = useState<ServerKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [manualKeyName, setManualKeyName] = useState("");
  const [activeKeyId, setActiveKeyId] = useState<string>("");
  const [keysMsg, setKeysMsg] = useState<string | null>(null);
  const [keysErr, setKeysErr] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [verifyOut, setVerifyOut] = useState<string | null>(null);

  // 3 ─ TTS
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("studio");
  const [text, setText] = useState(
    "Welcome to LugunaVoice. Type a sentence here and hit generate to hear it spoken.",
  );
  const [style, setStyle] = useState("neutral");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [ttsStatus, setTtsStatus] = useState<"idle" | "busy" | "ready" | "error">("idle");
  const [ttsResult, setTtsResult] = useState<TtsResult | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [origin] = useState<string>(() =>
    typeof window === "undefined" ? "https://api.lugunavoice.com" : window.location.origin,
  );

  function commitResult(next: TtsResult | null) {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (next?.kind === "audio") audioUrlRef.current = next.audioUrl ?? null;
    setTtsResult(next);
  }

  // 4 ─ credits / payments
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceMsg, setBalanceMsg] = useState<string | null>(null);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);
  const [orderErr, setOrderErr] = useState<string | null>(null);

  const activeKey = useMemo(
    () => savedKeys.find((k) => k.id === activeKeyId) ?? savedKeys[0],
    [savedKeys, activeKeyId],
  );

  // ── env + server keys + voices (all fetch-based; no sync setState) ──

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dev/session")
      .then((res) => (res.ok ? (res.json() as Promise<DevStatus>) : null))
      .then((d) => {
        if (cancelled) return;
        setEnv((prev) => {
          const stale = prev.status?.sandbox === true;
          return { loading: false, status: stale ? prev.status : d };
        });
      })
      .catch(() => {
        if (!cancelled) setEnv((prev) => (prev.status?.sandbox === true ? prev : { loading: false, status: null }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetch("/api/voices?limit=200&tier=all")
      .then((res) => (res.ok ? (res.json() as Promise<{ voices: VoiceOption[] }>) : null))
      .then((d) => {
        if (d?.voices?.length) {
          setVoices(d.voices);
          setVoiceId((prev) => prev ?? d.voices[0].id);
        } else {
          setVoicesError("The voice catalog is unavailable right now — free generation may still work if you pick a voice id manually.");
        }
      })
      .catch(() => setVoicesError("Could not reach the voice catalog."));
  }, []);

  useEffect(() => {
    fetch("/api/keys")
      .then((res) => (res.ok ? (res.json() as Promise<{ keys: ServerKey[] }>) : null))
      .then((d) => {
        if (d?.keys) setServerKeys(d.keys);
      })
      .catch(() => undefined);
  }, [env.status?.sandbox]);

  const selectableVoices = useMemo(() => {
    if (mode === "demo") {
      return DEMO_VOICES.map((v) => ({
        id: v.id,
        name: v.name,
        provider: v.provider,
        tier: v.tier,
        language: v.language,
        gender: v.gender,
      }));
    }
    return voices;
  }, [mode, voices]);

  const filteredVoices = useMemo(
    () => selectableVoices.filter((v) => v.name.toLowerCase().includes(query.toLowerCase())),
    [selectableVoices, query],
  );

  const effectiveVoiceId = useMemo(() => {
    if (selectableVoices.some((v) => v.id === voiceId)) return voiceId;
    return selectableVoices[0]?.id ?? null;
  }, [selectableVoices, voiceId]);

  const charsLeft = MAX_TEST_CHARS - Array.from(text).length;
  const noDeepgram = mode === "stream" && !voices.some((v) => v.provider === "deepgram");

  // ── 1 ────────────────────────────────────────────────────────────────

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
    setEnv({ loading: false, status: { supabaseConfigured: false, sandbox: true, userId: data.userId } });
    setSandboxMsg(`Sandbox user ${data.userId} active — 2,000 test credits granted.`);
    setSandboxCode((data.referralCode as string | null) ?? null);
  }

  async function exitSandbox() {
    await fetch("/api/dev/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "exit" }),
    });
    setEnv((e) => ({
      loading: false,
      status: e.status ? { ...e.status, sandbox: false, userId: undefined } : e.status,
    }));
    setSandboxMsg("Sandbox session ended (cookie cleared).");
    setSandboxCode(null);
    setServerKeys([]);
  }

  // ── 2 ────────────────────────────────────────────────────────────────

  function saveKeyLocally(key: SavedKey) {
    const next = [key, ...savedKeys.filter((k) => k.id !== key.id)];
    setSavedKeys(next);
    persistSavedKeys(next);
    setActiveKeyId(key.id);
  }

  async function createKey() {
    setKeysErr(null);
    setKeysMsg(null);
    setVerifyOut(null);
    if (!env.status?.sandbox) {
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
    const scopes = (data.record?.scopes as string[] | undefined) ?? ["tts:generate", "voices:read"];
    saveKeyLocally({ id: data.record?.id ?? `local-${Date.now()}`, name, key: data.key, savedAt: Date.now() });
    setKeysMsg(
      `Key "${name}" created, saved to this browser, and already selected below. Send it to /api/v1/* as "Authorization: Bearer ${data.key.slice(0, 10)}…". Scopes: ${scopes.join(", ")}.`,
    );
    setNewKeyName("");
  }

  function addManualKey() {
    setKeysErr(null);
    const key = manualKey.trim();
    if (!key.startsWith("lug_")) {
      setKeysErr("Keys start with lug_ — create one in this card, or paste one from a previous run.");
      return;
    }
    const name = manualKeyName.trim() || "imported";
    saveKeyLocally({ id: `local-${Date.now()}`, name, key, savedAt: Date.now() });
    setKeysMsg(`Key "${name}" saved to this browser (localStorage only — nothing leaves your machine).`);
    setManualKey("");
    setManualKeyName("");
  }

  function removeKey(id: string) {
    const next = savedKeys.filter((k) => k.id !== id);
    setSavedKeys(next);
    persistSavedKeys(next);
    if (activeKey?.id === id) setVerifyOut(null);
  }

  async function copyKey(id: string, full: string) {
    setRevealed(revealed === id ? null : id);
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      // key stays visible for manual copy
    }
  }

  async function verifyKey(key: SavedKey) {
    setVerifyOut(null);
    const res = await fetch("/api/v1/me", { headers: { authorization: `Bearer ${key.key}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.creditsBalance === undefined) {
      setVerifyOut(`Verification failed (${res.status}): ${data?.error ?? "bad response"} — check the key or the sandbox session.`);
      return;
    }
    const led = (data.recentLedger as Array<{ type: string; amount: number; description?: string; createdAt: number }> | undefined)?.slice(0, 3) ?? [];
    setVerifyOut(
      [
        `Platform: LugunaVoice Developer API (v1) — key "${key.name}"`,
        `Scopes: ${(data.key?.scopes ?? []).join(", ") || "—"} · Rate limit: ${data.key?.rateLimitRpm ?? "—"} rpm`,
        `Credits balance: ${data.creditsBalance.toLocaleString()}`,
        led.length
          ? `Recent ledger: ${led.map((e) => `${e.type} ${e.amount > 0 ? "+" : ""}${e.amount}`).join(" · ")}`
          : "Recent ledger: (empty)",
      ].join("\n"),
    );
  }

  // ── 3 ────────────────────────────────────────────────────────────────

  async function generate() {
    if (!effectiveVoiceId || !text.trim()) return;
    setTtsStatus("busy");
    commitResult(null);
    const trim = text.trim();
    if (trim.length > MAX_TEST_CHARS) {
      setTtsStatus("ready");
      commitResult({ kind: "error", text: `Text too long (${trim.length} chars, max ${MAX_TEST_CHARS} for tests).` });
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
          commitResult({ kind: "error", text: `Studio (${res.status}): ${data?.error ?? "no audio returned"} [${data?.code ?? ""}]` });
        } else {
          const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
          commitResult({
            kind: "audio",
            label: `Studio · ${data.tier ?? ""} · ${data.charCount ?? trim.length} chars`,
            meta: data.creditsCharged ? `${data.creditsCharged} credits charged` : "free (no credits)",
            audioUrl: URL.createObjectURL(new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" })),
          });
        }
      } else if (mode === "longform") {
        const res = await fetch("/api/studio/longform", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voiceId: effectiveVoiceId, style }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.jobId) {
          commitResult({ kind: "error", text: `Long-form (${res.status}): ${data?.error ?? "no job returned"} [${data?.code ?? ""}]` });
        } else {
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 1_500));
            const poll = await fetch(`/api/studio/longform/${data.jobId}`);
            const job = await poll.json().catch(() => null);
            if (job?.status === "completed" && job?.audioBase64) {
              const bytes = Uint8Array.from(atob(job.audioBase64), (c) => c.charCodeAt(0));
              commitResult({
                kind: "audio",
                label: `Long-form · ${trim.length} chars`,
                meta: "MP3 + SRT subtitles ready",
                audioUrl: URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" })),
                srt: job.srt ?? undefined,
              });
              setTtsStatus("ready");
              return;
            }
            if (job?.status === "failed") {
              commitResult({ kind: "error", text: `Long-form failed: ${job.error ?? "unknown"}` });
              setTtsStatus("ready");
              return;
            }
          }
          commitResult({ kind: "error", text: "Long-form job timed out after ~90s (still processing server-side — check /admin or retry)." });
        }
      } else if (mode === "stream") {
        const res = await fetch("/api/studio/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: trim,
            voiceId: effectiveVoiceId,
            rate: Math.min(1.5, Math.max(0.7, rate)),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          commitResult({ kind: "error", text: `Stream (${res.status}): ${data?.error ?? "stream failed"} [${data?.code ?? ""}]` });
        } else {
          const blob = await res.blob();
          const credits = res.headers.get("x-lv-credits") ?? "0";
          commitResult({
            kind: "audio",
            label: `Stream · ${trim.length} chars`,
            meta: credits === "0" ? "guest free preview" : `${credits} credits (2/char, refunded on failure)`,
            audioUrl: URL.createObjectURL(linear16ToWavBlob(await blob.arrayBuffer())),
          });
        }
      } else if (mode === "demo") {
        const res = await fetch("/api/landing/demo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trim, voice: effectiveVoiceId, style }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.audioBase64) {
          commitResult({ kind: "error", text: `Demo (${res.status}): ${data?.error ?? "no audio returned"} [${data?.code ?? ""}]` });
        } else {
          const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
          commitResult({
            kind: "audio",
            label: `Landing demo · ${trim.length} chars`,
            meta: data.remaining !== undefined ? `${data.remaining} demo generations left today` : undefined,
            audioUrl: URL.createObjectURL(new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" })),
          });
        }
      } else if (mode === "v1") {
        if (!activeKey) {
          commitResult({ kind: "error", text: "v1 API mode needs a key — create one in the API keys card (it saves to this browser automatically)." });
        } else {
          const res = await fetch("/api/v1/tts/generations", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${activeKey.key}` },
            body: JSON.stringify({ text: trim, voice: effectiveVoiceId, style, pitch, rate }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.id) {
            commitResult({ kind: "error", text: `v1 (${res.status}): ${data?.error ?? "no generation returned"} [${data?.code ?? ""}]` });
          } else {
            for (let i = 0; i < 40; i++) {
              await new Promise((r) => setTimeout(r, 1_000));
              const poll = await fetch(`/api/v1/generations/${data.id}`, {
                headers: { authorization: `Bearer ${activeKey.key}` },
              });
              const gen = await poll.json().catch(() => null);
              if (gen?.status === "completed" && gen?.audioBase64) {
                const bytes = Uint8Array.from(atob(gen.audioBase64), (c) => c.charCodeAt(0));
                commitResult({
                  kind: "audio",
                  label: `v1 API · ${data.id.slice(0, 14)}`,
                  meta: `${gen.creditsCharged ?? 0} credits · key "${activeKey.name}"`,
                  audioUrl: URL.createObjectURL(new Blob([bytes], { type: gen.mimeType ?? "audio/mpeg" })),
                  json: JSON.stringify(gen, null, 2),
                });
                setTtsStatus("ready");
                return;
              }
              if (gen?.status === "failed") {
                commitResult({ kind: "error", text: `v1 generation failed: ${gen.error ?? "unknown"} (refunded automatically)` });
                setTtsStatus("ready");
                return;
              }
            }
            commitResult({ kind: "error", text: "v1 generation timed out (still processing server-side)." });
          }
        }
      }
    } catch (err) {
      commitResult({ kind: "error", text: `Request failed: ${(err as Error).message}` });
    }
    setTtsStatus("ready");
  }

  // ── 4 ────────────────────────────────────────────────────────────────

  async function fetchBalance() {
    setBalanceMsg(null);
    if (!activeKey) {
      setBalanceMsg("Need a saved API key — create one in the API keys card.");
      return;
    }
    const res = await fetch("/api/v1/me", { headers: { authorization: `Bearer ${activeKey.key}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.creditsBalance === undefined) {
      setBalanceMsg(`Balance (${res.status}): ${data?.error ?? "failed"}`);
      return;
    }
    setBalance(data.creditsBalance);
    setBalanceMsg(`Balance via "Authorization: Bearer ${activeKey.key.slice(0, 8)}…": ${data.creditsBalance.toLocaleString()} credits.`);
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

  // ── render ──────────────────────────────────────────────────────────

  const sandboxActive = env.status?.sandbox;

  return (
    <>
      {/* 1 · Environment + sandbox session */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">1 · Environment &amp; sandbox session</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Environment</CardTitle>
            <CardDescription>
              No database or Supabase configured? Enter sandbox mode — a cookie acts as your
              signed-in user so premium voices, API keys, referrals and checkout all work on
              in-memory stores. Signs in normally once auth is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {env.loading ? (
                <>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                </>
              ) : (
                <>
                  <Badge variant={env.status?.supabaseConfigured ? "default" : "outline"}>
                    {env.status?.supabaseConfigured ? "Supabase: configured" : "Auth: not configured"}
                  </Badge>
                  <Badge variant={sandboxActive ? "default" : "outline"}>
                    {sandboxActive ? `Sandbox active · ${env.status?.userId?.slice(0, 12)}…` : "Sandbox: off"}
                  </Badge>
                  <Badge variant={env.status?.supabaseConfigured ? "secondary" : "outline"}>
                    {env.status?.supabaseConfigured ? "DB: real sessions" : "State: in-memory (no database)"}
                  </Badge>
                </>
              )}
              {!env.loading && !env.status?.supabaseConfigured && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Label htmlFor="sandbox-name" className="sr-only">Sandbox name</Label>
                  <Input
                    id="sandbox-name"
                    value={sandboxName}
                    onChange={(e) => setSandboxName(e.target.value)}
                    placeholder="sandbox name (referral code)"
                    className="h-8 w-56"
                  />
                  {!sandboxActive ? (
                    <Button size="sm" onClick={enterSandbox}>Enter sandbox</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={exitSandbox}>Exit sandbox</Button>
                  )}
                </span>
              )}
            </div>

            {sandboxCode && sandboxActive && (
              <p className="text-sm">
                Your referral code:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">{sandboxCode}</code> — exit, enter
                again (second code), then claim it in{" "}
                <a className="underline" href="/referrals">/referrals</a>.
              </p>
            )}
            {sandboxMsg && <p className="text-sm text-primary">{sandboxMsg}</p>}
            {sandboxErr && <p className="text-sm text-destructive">{sandboxErr}</p>}
          </CardContent>
        </Card>
      </section>

      {/* 2 · Developer API keys */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">2 · Developer API keys (platform: LugunaVoice v1 API)</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API keys</CardTitle>
            <CardDescription>
              These are the /api/v1/* developer keys — the same key store as the{" "}
              <a className="underline" href="/api-keys">/api-keys</a> dashboard. Send them as{" "}
              <code className="rounded bg-muted px-1">Authorization: Bearer lug_…</code> to{" "}
              <code className="rounded bg-muted px-1">/api/v1/tts/generations</code>,{" "}
              <code className="rounded bg-muted px-1">/api/v1/voices</code>,{" "}
              <code className="rounded bg-muted px-1">/api/v1/generations/:id</code>,{" "}
              <code className="rounded bg-muted px-1">/api/v1/me</code>. Keys created here are
              saved to this browser (localStorage) for testing — they are not written to any server
              store.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="key-name">New key name</Label>
                <Input id="key-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="test-key" className="w-44" />
              </div>
              <Button onClick={createKey}>Create v1 API key &amp; save to browser</Button>
              {serverKeys.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {serverKeys.length} key{serverKeys.length === 1 ? "" : "s"} live on the server
                  (in-memory) — same store as /api-keys.
                </span>
              )}
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
              <Button variant="outline" onClick={addManualKey}>Save key (browser only)</Button>
            </div>

            {keysMsg && <p className="text-sm text-primary">{keysMsg}</p>}
            {keysErr && <p className="text-sm text-destructive">{keysErr}</p>}

            {savedKeys.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Keys available in this browser</p>
                {savedKeys.map((k) => {
                  const serverMatch = serverKeys.find((s) => s.id === k.id);
                  return (
                    <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveKeyId(k.id);
                          setVerifyOut(null);
                        }}
                        className="flex items-center gap-2 text-left"
                        title="Use this key for v1 calls in card 3"
                      >
                        <span className={`size-2 rounded-full ${activeKey?.id === k.id ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        <span className="font-medium">{k.name}</span>
                      </button>
                      <Badge variant="secondary">browser (localStorage)</Badge>
                      {serverMatch && <Badge variant="outline">also on server</Badge>}
                      <code className="font-mono text-xs text-muted-foreground">
                        {revealed === k.id ? k.key : `${k.key.slice(0, 12)}…${k.key.slice(-4)}`}
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {serverMatch ? `scopes: ${serverMatch.scopes.join(", ")} · ${serverMatch.rateLimitRpm} rpm` : "stored locally only"}
                      </span>
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => copyKey(k.id, k.key)}>
                          {revealed === k.id ? "copy" : "reveal"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => verifyKey(k)}>
                          verify
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeKey(k.id)}>
                          remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {verifyOut && (
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{verifyOut}</pre>
                )}
                {activeKey && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <pre className="overflow-x-auto whitespace-pre font-mono text-xs">
                      <code>{`# sample request using the active key\ncurl -X POST ${origin}/api/v1/tts/generations \\\n  -H "Authorization: Bearer ${activeKey.key.slice(0, 10)}…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Hello","voice":"${effectiveVoiceId ?? "fs_voice_edge_en-US-AriaNeural"}"}'`}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 3 · TTS dashboard (Studio layout) */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">3 · TTS — quick generation &amp; long-form</h2>
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* voice column */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-lg">Voice</CardTitle>
              <CardDescription>
                {mode === "demo"
                  ? "Landing demo set (no account needed)"
                  : mode === "stream"
                    ? "Streaming works only with flagship (Deepgram Aura) voices"
                    : "Free voices — premium unlocks with credits"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search voices…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search voices" />
              {voicesError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {voicesError}
                </p>
              ) : voices.length === 0 && mode !== "demo" ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {filteredVoices.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoiceId(v.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        effectiveVoiceId === v.id ? "border-primary bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <span className="block truncate font-medium">{v.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.language ?? "—"} · {v.gender ?? "—"} · {v.provider}
                      </span>
                    </button>
                  ))}
                  {filteredVoices.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center">
                      <p className="text-sm font-medium">No voices match {`"${query}"`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try a different name or clear the search.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* script column */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Script &amp; engine</CardTitle>
              <CardDescription>Same dashboard as Studio — extended with all five engines:</CardDescription>
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

              {mode === "v1" && savedKeys.length > 0 && (
                <div className="space-y-1">
                  <Label>v1 API key (sent as Authorization header)</Label>
                  <select
                    value={activeKey?.id ?? ""}
                    onChange={(e) => {
                      setActiveKeyId(e.target.value);
                      setVerifyOut(null);
                    }}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {savedKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} · {k.key.slice(0, 12)}…
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {noDeepgram && mode === "stream" && (
                <p className="text-sm text-muted-foreground">
                  Aura voices appear here once <code className="rounded bg-muted px-1">DEEPGRAM_API_KEY</code> is set —
                  without it, stream requests fail gracefully (503/404). That failure path is part of the test.
                </p>
              )}

              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={MAX_TEST_CHARS}
                  rows={7}
                  placeholder="Write or paste your script here…"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <p className={`text-right text-xs ${charsLeft <= 100 ? "text-destructive" : "text-muted-foreground"}`}>
                  {charsLeft.toLocaleString()} characters left
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="test-style">Style</Label>
                  <select
                    id="test-style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-rate">Speed ({rate.toFixed(2)}×)</Label>
                  <input
                    id="test-rate"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-pitch">Pitch ({pitch > 0 ? "+" : ""}{pitch}st)</Label>
                  <input
                    id="test-pitch"
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    className="w-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  />
                </div>
              </div>

              {ttsStatus === "busy" ? (
                <div className="space-y-2">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-2/3" />
                  <p className="text-xs text-muted-foreground">Synthesizing…</p>
                </div>
              ) : null}

              {ttsResult?.kind === "audio" && ttsStatus === "ready" ? (
                <div className="rounded-md border bg-muted/40 p-3">
                  {ttsResult.label && <p className="text-sm font-medium">{ttsResult.label}</p>}
                  {ttsResult.meta && <p className="text-xs text-muted-foreground">{ttsResult.meta}</p>}
                  <audio controls src={ttsResult.audioUrl} className="mt-1 w-full" />
                  {ttsResult.srt && (
                    <a
                      className="mt-2 inline-block text-sm text-primary underline"
                      href={`data:text/plain;charset=utf-8,${encodeURIComponent(ttsResult.srt)}`}
                      download="subtitles.srt"
                    >
                      Download SRT subtitles
                    </a>
                  )}
                  {ttsResult.json && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Raw response</summary>
                      <pre className="mt-1 max-h-64 overflow-auto rounded bg-background p-2 text-xs">{ttsResult.json}</pre>
                    </details>
                  )}
                </div>
              ) : null}

              {ttsResult?.kind === "error" && ttsStatus === "ready" ? (
                <p className="text-sm text-destructive">{ttsResult.text}</p>
              ) : null}

              <Button
                onClick={generate}
                disabled={ttsStatus === "busy" || !effectiveVoiceId || !text.trim()}
                className="w-full"
              >
                {ttsStatus === "busy" ? "Generating…" : `Generate via ${mode}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4 · Credits & payments */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">4 · Credits &amp; payments (manual flow)</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Billing</CardTitle>
            <CardDescription>
              Check your balance through the v1 API, and create a test purchase. Without Razorpay
              the order lands as manual_pending — confirm it in /admin to see the ledger credit
              land (and card 3&apos;s premium billing to start charging).
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
            {balanceMsg && <p className="text-sm text-primary">{balanceMsg}</p>}
            {orderMsg && <p className="text-sm text-primary">{orderMsg}</p>}
            {orderErr && <p className="text-sm text-destructive">{orderErr}</p>}
          </CardContent>
        </Card>
      </section>

      {/* 5 · Related pages */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">5 · Related pages</h2>
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
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
      </section>
    </>
  );
}