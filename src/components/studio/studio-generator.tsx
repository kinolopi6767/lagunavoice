"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { VoicePicker } from "@/components/studio/voice-picker";

const MAX_CHARS = 5_000;
const STYLES = [
  { id: "neutral", label: "Neutral" },
  { id: "cheerful", label: "Cheerful" },
  { id: "calm", label: "Calm" },
  { id: "serious", label: "Serious" },
  { id: "excited", label: "Excited" },
];

type Status = "idle" | "generating" | "ready" | "error";

export function StudioGenerator() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [style, setStyle] = useState("neutral");
  const [rate, setRate] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [remainingChars, setRemainingChars] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  function downloadAudio() {
    if (!audioRef.current) return;
    const a = document.createElement("a");
    a.href = audioRef.current.src;
    a.download = "lugunavoice.mp3";
    a.click();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card className="min-w-0">
        <CardContent>
          <VoicePicker
            value={voiceId}
            onSelect={setVoiceId}
            tier="all"
            hint="Free voices use no credits. Premium (1 cr/char) and flagship (2 cr/char) debit your balance — refunded automatically if generation fails."
          />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-lg">Script</CardTitle>
          <CardDescription>Paste your script, adjust the delivery, generate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="studio-text">Script</Label>
            <textarea
              id="studio-text"
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
              <Label htmlFor="studio-style">Style</Label>
              <select
                id="studio-style"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate">
                Speed <span className="text-muted-foreground">({rate.toFixed(2)}×)</span>
              </Label>
              <input
                id="rate"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-2.5 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pitch">
                Pitch <span className="text-muted-foreground">({pitch > 0 ? "+" : ""}{pitch} st)</span>
              </Label>
              <input
                id="pitch"
                type="range"
                min={-12}
                max={12}
                step={1}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="mt-2.5 w-full"
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={downloadAudio}>
                  Download MP3
                </Button>
                {remainingChars !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {remainingChars.toLocaleString()} free characters left today
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {status === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            onClick={generate}
            disabled={status === "generating" || !voiceId || !text.trim()}
            className="w-full"
          >
            {status === "generating" ? "Generating…" : "Generate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}