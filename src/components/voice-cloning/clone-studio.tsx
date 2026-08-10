"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VoiceRecord } from "@/lib/tts/types";

type Status = "idle" | "uploading" | "cloning" | "done" | "error";

export function CloneStudio() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clonedVoice, setClonedVoice] = useState<VoiceRecord | null>(null);

  async function submit() {
    if (!file || !name.trim() || !consent) return;
    setStatus("cloning");
    setError(null);
    setClonedVoice(null);

    try {
      const buffer = await file.arrayBuffer();
      const sampleBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      // client-side size guard (25MB server cap)
      if (buffer.byteLength > 25 * 1024 * 1024) {
        setStatus("error");
        setError("Sample must be under 25 MB.");
        return;
      }

      const res = await fetch("/api/voice-cloning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sampleBase64,
          sampleMime: file.type,
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create your voice clone</CardTitle>
          <CardDescription>
            Upload a 5–150 second recording of any voice you have the rights to.
            The clone is private to your account and speaks 37 languages.
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
            <Label htmlFor="clone-file">Sample audio (WAV or MP3, 5–150s, ≤25 MB)</Label>
            <Input
              id="clone-file"
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm I own the rights to this voice sample and consent to it
              being used to create a synthetic voice. It must not be the voice of
              a public figure or anyone who has not given permission.
            </span>
          </label>

          {status === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            onClick={submit}
            disabled={!file || !name.trim() || !consent || status === "cloning"}
            className="w-full"
          >
            {status === "cloning" ? "Cloning… (up to a minute)" : "Clone voice"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your cloned voices</CardTitle>
          <CardDescription>
            Clones appear in the voice library and the Studio automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "done" && clonedVoice ? (
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="font-medium">{clonedVoice.name}</p>
              <p className="text-xs text-muted-foreground">
                {clonedVoice.id} · Typecast ssfm-v30 · premium credits
              </p>
              <audio
                controls
                src={`/api/voices/${clonedVoice.id}/preview`}
                className="mt-2 w-full"
              />
              <p className="mt-2 text-xs text-emerald-600">
                Clone created. Find it in the voice library and Studio.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No clones yet. Create your first one on the left.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
