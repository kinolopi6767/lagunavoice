"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { VoiceRecord } from "@/lib/tts/types";

const MAX_CHARS = 100_000;

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
  const [query, setQuery] = useState("");
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [style, setStyle] = useState("neutral");
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    fetch("/api/voices?limit=60&tier=free")
      .then((r) => r.json() as Promise<{ voices: VoiceRecord[] }>)
      .then((d) => {
        setVoices(d.voices);
        if (d.voices.length > 0) setVoiceId(d.voices[0].id);
      })
      .catch(() => setError("Could not load voices."));
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const filtered = voices.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));
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

      // poll every 1.5s until done
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Long-form</CardTitle>
        <CardDescription>
          Audiobook-length narration (up to 100k chars). Chunked, synthesized in
          parallel, stitched into one MP3 with SRT subtitles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <Label>Voice</Label>
            <Input placeholder="Search voices…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceId(v.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    voiceId === v.id ? "border-primary bg-primary/10" : "hover:bg-muted"
                  }`}
                >
                  <span className="block truncate font-medium">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">{v.language}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
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

            <div className="flex items-center gap-3">
              <Label className="shrink-0">Style</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {["neutral", "cheerful", "calm", "serious", "excited"].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
              <Button onClick={start} disabled={job?.status === "processing" || !voiceId || !text.trim()}>
                {job?.status === "processing" ? "Generating…" : "Generate long-form"}
              </Button>
            </div>
          </div>
        </div>

        {job?.status === "processing" ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Chunk {job.done} of {job.total || "…"}</span>
              <span>{job.total ? Math.round((job.done / job.total) * 100) : 0}%</span>
            </div>
            <Skeleton className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">Synthesizing chunks in parallel…</p>
          </div>
        ) : null}

        {job?.status === "failed" ? (
          <p className="text-sm text-destructive">{job.error ?? "Generation failed."}</p>
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
