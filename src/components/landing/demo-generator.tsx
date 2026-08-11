"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_MAX_CHARS, DEMO_STYLES, DEMO_VOICES } from "@/lib/tts/demo-voices";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

type Status = "idle" | "generating" | "ready" | "error";

export function DemoGenerator() {
  const [text, setText] = useState("Some words are meant to be read. Others are waiting to be heard.");
  const [voiceId, setVoiceId] = useState(DEMO_VOICES[0].id);
  const [style, setStyle] = useState("neutral");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    return () => {
      if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    };
  }, []);

  useEffect(() => {
    if (!siteKey || !captchaRef.current) return;
    const el = captchaRef.current;
    window.turnstile?.render(el, {
      sitekey: siteKey,
      callback: (token) => {
        tokenRef.current = token;
      },
      "expired-callback": () => {
        tokenRef.current = null;
      },
    });
  }, [siteKey]);

  const charsLeft = DEMO_MAX_CHARS - Array.from(text).length;

  async function generate() {
    setStatus("generating");
    setError(null);
    setAudioUrl(null);

    try {
      const res = await fetch("/api/landing/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          voice: voiceId,
          style,
          turnstileToken: tokenRef.current ?? undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(data?.error ?? "Could not generate audio. Please try again.");
        if (data?.code === "captcha_failed") {
          window.turnstile?.reset();
          tokenRef.current = null;
        }
        return;
      }

      const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.mimeType ?? "audio/mpeg" });
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      const url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      setAudioUrl(url);
      setRemaining(data.remaining ?? null);
      setStatus("ready");
    } catch {
      setStatus("error");
      setError("Could not reach the voice engine. Please try again.");
    }
  }

  const selectedVoice = DEMO_VOICES.find((v) => v.id === voiceId);

  return (
    <Card className="w-full rounded-[calc(var(--radius)+1px)] border-0 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-grad-a to-grad-b">
            <svg viewBox="0 0 24 24" className="size-3 text-white" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
          Try it now — no account needed
        </CardTitle>
        <CardDescription>
          The real generator, running a free voice. Press generate and listen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="demo-text">Text</Label>
          <textarea
            id="demo-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={DEMO_MAX_CHARS}
            rows={4}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className={`text-right text-xs ${charsLeft <= 20 ? "text-destructive" : "text-muted-foreground"}`}>
            {charsLeft} characters left
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="demo-voice">Voice</Label>
            <select
              id="demo-voice"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {DEMO_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.language}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-style">Style</Label>
            <select
              id="demo-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {DEMO_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div ref={captchaRef} />

        {status === "generating" ? (
          <div className="space-y-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-2/3" />
            <p className="text-xs text-muted-foreground">Synthesizing…</p>
          </div>
        ) : null}

        {audioUrl && status === "ready" ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <audio controls src={audioUrl} className="w-full" />
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedVoice?.name} · {style} ·{" "}
              {remaining !== null ? `${remaining} demo generations left today` : ""}
            </p>
          </div>
        ) : null}

        {status === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          onClick={generate}
          disabled={status === "generating" || text.trim().length === 0}
          className="w-full"
        >
          {status === "generating" ? "Generating…" : "Generate"}
        </Button>
      </CardContent>
    </Card>
  );
}
