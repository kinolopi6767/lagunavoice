"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { VoiceRecord } from "@/lib/tts/types";

type Status = "idle" | "uploading" | "cloning" | "done" | "error";

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function CloneStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clonedVoice, setClonedVoice] = useState<VoiceRecord | null>(null);

  const busy = status === "uploading" || status === "cloning";
  const blocked = !file || !name.trim() || !consent || busy;

  function reasonBlocked(): string | null {
    if (busy) return null;
    if (!file) return "Upload a sample recording to continue.";
    if (!name.trim()) return "Give your clone a name.";
    if (!consent) return "Confirm the rights consent to continue.";
    return null;
  }

  async function submit() {
    if (blocked) return;
    setStatus("uploading");
    setError(null);
    setClonedVoice(null);

    try {
      const buffer = await file!.arrayBuffer();
      if (buffer.byteLength > 3_200_000) {
        setStatus("error");
        setError("Sample must be under 3 MB (base64 JSON body limit).");
        return;
      }
      // chunked base64 — spreading a large Uint8Array into String.fromCharCode
      // throws "Maximum call stack size exceeded" past ~64k bytes
      const bytes = new Uint8Array(buffer);
      const CHUNK = 0x8000;
      const parts: string[] = [];
      for (let i = 0; i < bytes.length; i += CHUNK) {
        parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
      }
      const sampleBase64 = btoa(parts.join(""));
      setStatus("cloning");

      const res = await fetch("/api/voice-cloning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sampleBase64,
          sampleMime: file!.type || "audio/mpeg",
          name: name.trim(),
          consent: true,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(data?.error ?? "Cloning failed. Please try again.");
        return;
      }

      setClonedVoice(data.voice);
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Could not upload the sample.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-gradient-to-br from-grad-a to-grad-b p-px shadow-sm shadow-grad-b/20">
        <Card className="min-w-0 rounded-[calc(1rem-1px)]">
          <CardHeader>
            <CardTitle className="text-lg">Create your voice clone</CardTitle>
            <CardDescription>
              Upload a 5–150 second recording of a voice you have the rights to. The
              clone is private to your account and speaks 37 languages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">Voice name</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="My narration voice"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-file">Sample audio (WAV or MP3, 5–150s, ≤3 MB)</Label>
            <label
              htmlFor="clone-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" className="size-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M12 15V3m0 0l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium">
                {file ? file.name : "Choose a recording"}
              </span>
              <span className="text-xs text-muted-foreground">
                {file
                  ? `${formatBytes(file.size)} — click to replace`
                  : "WAV or MP3 · 5–150 seconds · up to 3 MB"}
              </span>
            </label>
            <input
              id="clone-file"
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            {file ? (
              <p className="text-xs text-primary">
                Sample ready — name it, confirm consent, and clone.
              </p>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="leading-5 text-foreground">
              <span className="font-medium">Rights consent (required)</span> — I confirm I own
              the rights to this voice sample and consent to it being used to create a synthetic
              voice. It must not be the voice of a public figure or anyone who has not given
              permission.
            </span>
          </label>

          {status === "error" && error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Button onClick={submit} disabled={blocked} className="w-full">
              {status === "uploading"
                ? "Uploading…"
                : status === "cloning"
                  ? "Cloning… (up to a minute)"
                  : "Clone voice"}
            </Button>
            {!busy && blocked ? (
              <p className="text-center text-xs text-muted-foreground">{reasonBlocked()}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-lg">Your cloned voices</CardTitle>
          <CardDescription>
            Clones appear in the voice library and the Studio automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "cloning" ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-2 w-2/3" />
              <p className="text-xs text-muted-foreground">Training your clone…</p>
            </div>
          ) : status === "done" && clonedVoice ? (
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="font-medium">{clonedVoice.name}</p>
              <p className="text-xs text-muted-foreground">
                {clonedVoice.id} · Typecast ssfm-v30 · 2,500 credits charged
              </p>
              <audio
                controls
                src={`/api/voices/${clonedVoice.id}/preview`}
                className="mt-2 w-full"
              />
              <p className="mt-2 text-xs text-primary">
                Clone created. Find it in the voice library and Studio — it speaks like the
                sample, and generated speech bills at premium rates.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-8 text-center">
              <p className="font-medium">No clones yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first one on the left. Each clone costs 2,500 credits — refunded
                automatically if cloning fails.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}