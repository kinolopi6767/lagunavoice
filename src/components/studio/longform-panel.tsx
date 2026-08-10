"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { VoicePicker } from "@/components/studio/voice-picker";

const MAX_CHARS = 100_000;
const STYLES = ["neutral", "cheerful", "calm", "serious", "excited"];

interface JobState {
  status: "processing" | "completed" | "failed";
  total: number;
  done: number;
  audioBase64?: string;
  mimeType?: string;
  srt?: string;
  durationMs?: number;
  error?: string;
}

export function LongFormPanel() {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [style, setStyle] = useState("neutral");
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const charsLeft = MAX_CHARS - Array.from(text).length;

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function start() {
    if (!voiceId || !text.trim()) return;
    setError(null);
    setJob({ status: "processing", total: 0, done: 0 });
    setAudioUrl(null);
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.src);
    audioBlobRef.current = null;

    try {
      const res = await fetch("/api/studio/longform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, voiceId, style }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        stopPolling();
        setJob(null);
        setError(data?.error ?? "Could not start generation.");
        return;
      }

      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/studio/longform/${data.jobId}`);
        const j = (await r.json()) as JobState;
        setJob(j);

        if (j.status === "completed") {
          stopPolling();
          if (j.audioBase64) {
            const bytes = Uint8Array.from(atob(j.audioBase64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: j.mimeType ?? "audio/mpeg" });
            audioBlobRef.current = blob;
            audioRef.current = new Audio(URL.createObjectURL(blob));
            setAudioUrl(audioRef.current.src);
          }
        } else if (j.status === "failed") {
          stopPolling();
        }
      }, 1_500);
    } catch {
      stopPolling();
      setJob(null);
      setError("Could not reach the server.");
    }
  }

  function downloadSrt() {
    if (!job?.srt) return;
    const blob = new Blob([job.srt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lugunavoice-subtitles.srt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadAudio() {
    if (!audioBlobRef.current) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(audioBlobRef.current);
    a.download = "lugunavoice-longform.mp3";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const progress = job?.total ? Math.round((job.done / job.total) * 100) : 0;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-lg">Long-form narration</CardTitle>
        <CardDescription>
          Audiobook-length scripts (up to 100,000 characters). We chunk, synthesize in
          parallel and stitch everything into one MP3 — with word-timed SRT subtitles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="min-w-0">
            <VoicePicker
              value={voiceId}
              onSelect={setVoiceId}
              limit={60}
              label="Voice"
              hint="Same library as quick generation."
            />
          </div>

          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="lf-text">Script</Label>
              <textarea
                id="lf-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Paste your full script — an entire chapter or audiobook section…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <p className={`text-right text-xs ${charsLeft <= 1_000 ? "text-destructive" : "text-muted-foreground"}`}>
                {charsLeft.toLocaleString()} characters left
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Label className="shrink-0">Style</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <Button
                onClick={start}
                disabled={job?.status === "processing" || !voiceId || !text.trim()}
              >
                {job?.status === "processing" ? "Generating…" : "Generate long-form"}
              </Button>
            </div>
          </div>
        </div>

        {job?.status === "processing" ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {job.total
                  ? `Chunk ${job.done} of ${job.total}`
                  : "Chunking script…"}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Synthesizing chunks in parallel…</p>
          </div>
        ) : null}

        {job?.status === "failed" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{job.error ?? "Generation failed."}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No credits were charged for failed generations.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {audioUrl && job?.status === "completed" ? (
          <div className="rounded-md border bg-muted/40 p-3">
            <audio controls src={audioUrl} className="w-full" />
            <p className="mt-1 text-xs text-muted-foreground">
              {job.durationMs ? `${Math.round(job.durationMs / 1_000)}s audio · ` : ""}
              {job.total} chunks stitched
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadAudio}>
                Download MP3
              </Button>
              <Button size="sm" variant="outline" onClick={downloadSrt} disabled={!job.srt}>
                {job.srt ? "Download SRT" : "SRT unavailable"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}