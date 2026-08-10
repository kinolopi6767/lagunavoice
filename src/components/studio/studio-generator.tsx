"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { VoiceRecord } from "@/lib/tts/types";

const MAX_CHARS = 5_000;
const STYLES = ["neutral", "cheerful", "calm", "serious", "excited"];

type Status = "idle" | "generating" | "ready" | "error";

export function StudioGenerator() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [style, setStyle] = useState("neutral");
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [remainingChars, setRemainingChars] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // load first page of free voices
  useEffect(() => {
    fetch("/api/voices?limit=60&tier=free")
      .then((r) => r.json() as Promise<{ voices: VoiceRecord[] }>)
      .then((d) => {
        setVoices(d.voices);
        if (d.voices.length > 0) setVoiceId(d.voices[0].id);
      })
      .catch(() => setError("Could not load voices."));
  }, []);

  const filtered = voices.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));

  const charsLeft = MAX_CHARS - Array.from(text).length;

  async function generate() {
    if (!voiceId || !text.trim()) return;
    setStatus("generating");
    setError(null);
    setAudioUrl(null);

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voiceId, style, rate, pitch }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(data?.error ?? "Could not generate audio.");
        return;
      }

      const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" });
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
      const url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      setAudioUrl(url);
      setRemainingChars(data.remainingChars ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
      setError("Could not reach the voice engine.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voice</CardTitle>
          <CardDescription>Free voices — premium arrives with credits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Search voices…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {filtered.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoiceId(v.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  voiceId === v.id
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted"
                }`}
              >
                <span className="block truncate font-medium">{v.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {v.language} · {v.gender ?? "—"}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Script</CardTitle>
          <CardDescription>Paste, pick, generate. Up to 5,000 chars per request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHARS}
              rows={8}
              placeholder="Write or paste your script here…"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className={`text-right text-xs ${charsLeft <= 100 ? "text-destructive" : "text-muted-foreground"}`}>
              {charsLeft.toLocaleString()} characters left
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Style</Label>
              <select
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
              <Label htmlFor="rate">Speed ({rate.toFixed(2)}×)</Label>
              <input
                id="rate"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pitch">Pitch ({pitch > 0 ? "+" : ""}{pitch}st)</Label>
              <input
                id="pitch"
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

          {status === "generating" ? (
            <div className="space-y-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-2/3" />
              <p className="text-xs text-muted-foreground">Synthesizing…</p>
            </div>
          ) : null}

          {audioUrl && status === "ready" ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <audio controls src={audioUrl} className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">
                {remainingChars !== null
                  ? `${remainingChars.toLocaleString()} free characters left today`
                  : ""}
              </p>
            </div>
          ) : null}

          {status === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button onClick={generate} disabled={status === "generating" || !voiceId || !text.trim()} className="w-full">
            {status === "generating" ? "Generating…" : "Generate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
