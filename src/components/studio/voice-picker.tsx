"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VoiceRecord } from "@/lib/tts/types";

/**
 * Searchable voice picker used by the Studio (quick + long-form) and the
 * test playground. Loads the free tier by default; with `tier="all"` it adds
 * Free/Premium/Flagship filter tabs. Shows a skeleton while loading, an
 * empty state when nothing matches, and lets you audition a voice with the
 * play button before committing.
 */
export function VoicePicker({
  value,
  onSelect,
  limit = 60,
  tier = "free",
  label = "Voice",
  hint = "Free voices are ready to use — premium and flagship unlock with credits.",
  className,
}: {
  value: string | null;
  onSelect: (id: string) => void;
  limit?: number;
  tier?: "free" | "all";
  label?: string;
  hint?: string;
  className?: string;
}) {
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<"free" | "premium" | "flagship">("free");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const withTabs = tier === "all";

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/voices?limit=${withTabs ? 200 : limit}&tier=${withTabs ? "all" : tier}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ voices: VoiceRecord[] }>) : null))
      .then((d) => {
        if (cancelled) return;
        const loaded = Array.isArray(d?.voices) ? d.voices : [];
        setVoices(loaded);
        if (!d) setError("Could not load the voice list.");
        // never auto-select a paid voice for a guest
        const fallback = loaded.find((v) => v.tier === "free") ?? loaded[0];
        if (fallback && !value) onSelect(fallback.id);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the voice list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, tier]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const filtered = voices.filter(
    (v) =>
      (withTabs ? v.tier === activeTier : true) &&
      v.name.toLowerCase().includes(query.toLowerCase()),
  );

  function togglePreview(v: VoiceRecord) {
    if (playingId === v.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    audioRef.current = new Audio(`/api/voices/${v.id}/preview`);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.onerror = () => setPlayingId(null);
    audioRef.current.play();
    setPlayingId(v.id);
  }

  function tierBadge(v: VoiceRecord) {
    if (v.tier === "premium") return <Badge variant="secondary">Premium</Badge>;
    if (v.tier === "flagship") return <Badge>Flagship</Badge>;
    return <Badge variant="ghost" className="text-xs">Free</Badge>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>{label}</Label>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <Input
        placeholder="Search voices…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search ${label.toLowerCase()}s`}
      />

      {withTabs ? (
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(["free", "premium", "flagship"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setActiveTier(t);
                const current = voices.find((v) => v.id === value);
                if (current?.tier !== t) {
                  const first = voices.find((v) => v.tier === t);
                  if (first) onSelect(first.id);
                }
              }}
              className={cn(
                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                activeTier === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={activeTier === t}
            >
              {t}
              <span className="ml-1 text-[10px] text-muted-foreground">
                {t === "free" ? "0 cr/char" : t === "premium" ? "1 cr/char" : "2 cr/char"}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="size-7 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm font-medium">No voices match your search</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different name, or clear the search box.
            </p>
          </div>
        ) : (
          filtered.map((v) => {
            const selected = value === v.id;
            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 transition-colors",
                  selected
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-medium">{v.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {v.language}
                    {v.gender ? ` · ${v.gender}` : ""}
                  </span>
                </button>
                {tierBadge(v)}
                <button
                  type="button"
                  onClick={() => togglePreview(v)}
                  aria-label={`Preview ${v.name}`}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs transition-colors",
                    playingId === v.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-secondary",
                  )}
                >
                  {playingId === v.id ? (
                    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}