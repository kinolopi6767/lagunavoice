"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { VoiceRecord } from "@/lib/tts/types";

interface VoicesResponse {
  voices: VoiceRecord[];
  total: number;
  languages: string[];
}

const FAVORITES_KEY = "luguna_favorite_voices";

function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
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

  return (
    <Card className="p-4">
      <CardContent className="flex items-center justify-between gap-3 p-0">
        <div className="min-w-0">
          <p className="truncate font-medium">{voice.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {voice.language}
            {voice.gender ? ` · ${voice.gender}` : ""}
          </p>
          <div className="mt-1.5">
            <Badge variant={voice.tier === "free" ? "secondary" : "default"} className="text-[10px]">
              {voice.tier === "free" ? "Free" : voice.tier === "premium" ? "Premium" : "Flagship"}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={togglePreview}
            aria-label={`Preview ${voice.name}`}
          >
            {playing ? "⏸" : "▶"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onToggleFavorite(voice.id)}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          >
            {isFavorite ? "★" : "☆"}
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
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const PAGE = 48;
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (q) params.set("q", q);
    if (language) params.set("language", language);
    if (gender) params.set("gender", gender);

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
  }, [q, language, gender, offset]);

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

  const shown = favorites.length > 0 ? voices : voices;

  return (
    <div className="space-y-6">
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
        {total.toLocaleString()} voices
        {favorites.length > 0 ? ` · ${favorites.length} favorites` : ""} · press play on any voice to audition
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
