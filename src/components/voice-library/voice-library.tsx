"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { VoiceRecord } from "@/lib/tts/types";

interface VoicesResponse {
  voices: VoiceRecord[];
  total: number;
  languages: string[];
}

const FAVORITES_KEY = "luguna_favorite_voices";
const PAGE = 48;
const TIERS = [
  { id: "", label: "All" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "flagship", label: "Flagship" },
] as const;

function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13a1 1 0 0 0 1.53.85l10.2-6.5a1 1 0 0 0 0-1.7L9.53 4.65A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3 1.1-6.5L2.6 9.4l6.5-.9L12 2.6z" />
    </svg>
  );
}

function VoiceCard({
  voice,
  isFavorite,
  onToggleFavorite,
}: {
  voice: VoiceRecord;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const togglePreview = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(`/api/voices/${voice.id}/preview`);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onerror = () => setPlaying(false);
      audioRef.current.play();
      setPlaying(true);
    } else if (playing) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  }, [voice.id, playing]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const tierLabel =
    voice.tier === "premium" ? "Premium" : voice.tier === "flagship" ? "Flagship" : "Free";

  return (
    <Card className={cn("p-4", isFavorite && "ring-1 ring-primary/40")}>
      <CardContent className="flex items-center justify-between gap-3 p-0">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={voice.name}>{voice.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {voice.language}
            {voice.gender ? ` · ${voice.gender}` : ""}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge
              variant={voice.tier === "free" ? "secondary" : voice.tier === "flagship" ? "default" : "outline"}
              className="text-[10px]"
            >
              {tierLabel}
            </Badge>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {voice.provider}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={togglePreview}
            aria-label={`Preview ${voice.name}`}
          >
            <PlayIcon playing={playing} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-8", isFavorite && "text-primary")}
            onClick={() => onToggleFavorite(voice.id)}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            <StarIcon filled={isFavorite} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function VoiceLibrary() {
  const [voices, setVoices] = useState<VoiceRecord[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("");
  const [gender, setGender] = useState("");
  const [tier, setTier] = useState<string>("");
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (q) params.set("q", q);
    if (language) params.set("language", language);
    if (gender) params.set("gender", gender);
    if (tier) params.set("tier", tier);

    fetch(`/api/voices?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("catalog_unavailable");
        return r.json() as Promise<VoicesResponse>;
      })
      .then((data) => {
        if (seq !== requestSeq.current) return;
        setVoices(data.voices);
        setTotal(data.total);
        setLanguages((prev) => (prev.length > 0 ? prev : data.languages));
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setError("The voice library is unavailable right now. Please try again.");
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, [q, language, gender, tier, offset]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  function applyFilters(updater: () => void) {
    setLoading(true);
    setError(null);
    updater();
    setOffset(0);
  }

  const shown = showFavorites ? voices.filter((v) => favorites.includes(v.id)) : voices;
  const hasFilters = Boolean(q || language || gender || tier || showFavorites);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            onClick={() => applyFilters(() => setTier(t.id))}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              tier === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => applyFilters(() => setShowFavorites((v) => !v))}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
            showFavorites
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted",
          )}
        >
          <StarIcon filled={showFavorites} />
          Favorites{favorites.length > 0 ? ` (${favorites.length})` : ""}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search voices…"
          value={q}
          onChange={(e) => applyFilters(() => setQ(e.target.value))}
        />
        <select
          value={language}
          onChange={(e) => applyFilters(() => setLanguage(e.target.value))}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All languages</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={gender}
          onChange={(e) => applyFilters(() => setGender(e.target.value))}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        {showFavorites
          ? `${favorites.length} favorite${favorites.length === 1 ? "" : "s"}`
          : `${total.toLocaleString()} voices`}
        <span className="mx-1.5 text-border">|</span>
        press play on any voice to audition it
      </p>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <p className="font-medium">No voices match your filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try clearing the search or choosing a different tier.
              </p>
              {hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() =>
                    applyFilters(() => {
                      setQ("");
                      setLanguage("");
                      setGender("");
                      setTier("");
                      setShowFavorites(false);
                    })
                  }
                >
                  Clear all filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((v) => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  isFavorite={favorites.includes(v.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}

          {!showFavorites && shown.length > 0 ? (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => applyFilters(() => setOffset((o) => Math.max(0, o - PAGE)))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE >= total}
                onClick={() => applyFilters(() => setOffset((o) => o + PAGE))}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}