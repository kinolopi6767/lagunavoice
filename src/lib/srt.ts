import type { WordTimestamp } from "@/lib/tts/types";

/**
 * SRT subtitle builder.
 * Rules (research/07 A.7): group 2–4 words per line, ≤42 chars/line,
 * min cue duration 1s, end = next line start − 0.1s.
 */

function fmtTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms) / 1_000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const milli = Math.floor((totalSec - Math.floor(totalSec)) * 1_000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
}

export function buildSrt(words: WordTimestamp[], offsetMs = 0): string {
  if (words.length === 0) return "";

  // group into lines of 2–4 words, ≤42 chars
  const lines: Array<{ words: WordTimestamp[]; start: number; end: number }> = [];
  let current: WordTimestamp[] = [];
  let lineStart = words[0].startMs + offsetMs;
  let lineEnd = words[0].endMs + offsetMs;
  let lineChars = 0;

  const flush = () => {
    if (current.length === 0) return;
    lines.push({ words: current, start: lineStart, end: Math.max(lineEnd, lineStart + 1_000) });
    current = [];
  };

  for (const w of words) {
    const start = w.startMs + offsetMs;
    const end = w.endMs + offsetMs;
    const willChars = lineChars + w.word.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && (current.length >= 4 || willChars > 42)) {
      flush();
    }
    if (current.length === 0) lineStart = start;
    current.push(w);
    lineChars = willChars;
    lineEnd = end;
  }
  flush();

  return lines
    .map((line, i) => {
      const end = i < lines.length - 1 ? Math.max(lines[i + 1].start - 100, line.start + 1_000) : line.end;
      return `${i + 1}\n${fmtTime(line.start)} --> ${fmtTime(end)}\n${line.words.map((w) => w.word).join(" ")}\n`;
    })
    .join("\n");
}

/** sentence-level fallback SRT when no word timestamps are available */
export function sentenceFallbackSrt(
  sentences: Array<{ text: string; startMs: number; endMs: number }>,
): string {
  return sentences
    .map((s, i) => `${i + 1}\n${fmtTime(s.startMs)} --> ${fmtTime(Math.max(s.endMs, s.startMs + 1_000))}\n${s.text}\n`)
    .join("\n");
}
