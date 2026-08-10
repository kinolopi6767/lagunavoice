import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DeepgramClient } from "@deepgram/sdk";
import ffmpegStatic from "ffmpeg-static";
import { getProvider } from "@/lib/tts/registry";
import { buildSrt, sentenceFallbackSrt } from "@/lib/srt";
import type { VoiceRecord, WordTimestamp } from "@/lib/tts/types";

const execFileAsync = promisify(execFile);
const FFMPEG = ffmpegStatic ?? "ffmpeg";

/**
 * Long-form generation (M5).
 *
 * Pipeline (research/07 blueprint):
 *   text → sentence-aware chunks (≤1,900 chars; prev/next context preserved)
 *   → bounded-concurrency synthesis per provider → per-chunk MP3s
 *   → ffmpeg concat + single loudnorm pass (kills boundary clicks)
 *   → SRT: word timestamps with per-chunk offsets (edge/typecast native) OR
 *     Deepgram STT round-trip on the stitched audio (@deepgram/captions)
 *
 * Jobs live in an in-memory registry (DB persistence + queue = M7/v1.5).
 */

export interface LongFormChunk {
  text: string;
  prevText?: string;
  nextText?: string;
}

export interface LongFormJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  total: number;
  done: number;
  error?: string;
  audioBase64?: string;
  mimeType?: string;
  srt?: string;
  durationMs?: number;
  creditsCharged?: number;
  createdAt: number;
}

const jobs = new Map<string, LongFormJob>();
const JOB_TTL_MS = 30 * 60 * 1_000;

/** chunk text at sentence boundaries, packing up to maxChars */
export function chunkText(text: string, maxChars = 1_900): LongFormChunk[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const boundaryRe = /(?<=[.!?;:])\s+|\s+(?=[,])|,\s+(?=and\s|but\s|or\s)/g;
  const pieces: string[] = [];
  let last = 0;
  for (const match of normalized.matchAll(boundaryRe)) {
    pieces.push(normalized.slice(last, match.index! + match[0].length));
    last = match.index! + match[0].length;
  }
  pieces.push(normalized.slice(last));

  const chunks: LongFormChunk[] = [];
  let buffer = "";
  for (const piece of pieces) {
    if (buffer.length > 0 && buffer.length + piece.length > maxChars) {
      chunks.push({ text: buffer.trim() });
      buffer = piece;
    } else {
      buffer += piece;
    }
  }
  if (buffer.trim()) chunks.push({ text: buffer.trim() });

  // attach prev/next context for prosody continuity (Typecast SmartPrompt)
  return chunks.map((c, i) => ({
    ...c,
    prevText: i > 0 ? chunks[i - 1].text.slice(-500) : undefined,
    nextText: i < chunks.length - 1 ? chunks[i + 1].text.slice(0, 500) : undefined,
  }));
}

/** bounded-concurrency worker pool */
async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function runFfmpeg(args: string[]): Promise<void> {
  try {
    await execFileAsync(FFMPEG, args, { maxBuffer: 256 * 1_024 * 1_024 });
  } catch (err) {
    console.error("[longform] ffmpeg failed", (err as Error).message);
    throw new Error("Audio stitching failed");
  }
}

/** STT round-trip for Deepgram audio → global word timestamps */
async function deepgramWords(audio: Buffer): Promise<WordTimestamp[]> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return [];
  const client = new DeepgramClient({ apiKey });
  const data = await client.listen.v1.media.transcribeFile(audio, {
    model: "nova-3",
    smart_format: true,
    punctuate: true,
    tag: "lv:longform-srt",
  });
  // 202 Accepted responses (async callbacks) have no results — treat as empty
  if (!("results" in data) || !data.results) return [];
  const words = data.results.channels?.[0]?.alternatives?.[0]?.words ?? [];
  return words
    .filter((w) => typeof w.start === "number" && typeof w.end === "number")
    .map((w) => ({
      // smart_format folds punctuation into `word`
      word: w.word ?? "",
      startMs: Math.round((w.start ?? 0) * 1_000),
      endMs: Math.round((w.end ?? 0) * 1_000),
    }))
    .filter((w) => w.word.length > 0);
}

export function getLongFormJob(id: string): LongFormJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    jobs.delete(id);
    return undefined;
  }
  return job;
}

/** start a long-form job (fire and forget; poll via getLongFormJob) */
export function startLongFormJob(opts: {
  id: string;
  text: string;
  voice: VoiceRecord;
  style?: string;
  pitch?: number;
  rate?: number;
  tag?: string;
  onDone?: (failed: boolean) => void | Promise<void>;
}): LongFormJob {
  const { id, text, voice, style, pitch, rate, tag, onDone } = opts;
  const provider = getProvider(voice.provider);
  const chunks = chunkText(text, Math.min(provider.maxCharsPerRequest - 100, 1_900));

  const job: LongFormJob = {
    id,
    status: "processing",
    total: chunks.length,
    done: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  if (chunks.length === 0) {
    job.status = "failed";
    job.error = "Empty script.";
    return job;
  }

  const seed = Math.floor(Math.random() * 1_000_000);

  // run async — do not block the request
  void (async () => {
    const workDir = await mkdtemp(join(tmpdir(), "luguna-lf-"));
    const paths: string[] = [];
    const durationsMs: number[] = [];
    // words per chunk, keyed by chunk index (concurrency-safe merge later)
    const wordsByChunk = new Map<number, WordTimestamp[]>();

    try {
      const concurrency =
        voice.provider === "edge" ? 1 : Math.max(1, provider.maxConcurrent - 1);

      await mapConcurrent(chunks, concurrency, async (chunk, i) => {
        const path = join(workDir, `chunk_${String(i).padStart(3, "0")}.mp3`);
        try {
          const result = await provider.synthesize({
            text: chunk.text,
            voice,
            style,
            pitch,
            rate,
            tag,
            seed,
          });
          await writeFile(path, result.audio);
          paths[i] = path;
          durationsMs[i] = result.durationMs;
          if (result.words?.length) {
            wordsByChunk.set(i, result.words);
          }
        } catch (err) {
          console.error(`[longform] chunk ${i} failed`, err);
          throw err;
        } finally {
          job.done += 1;
        }
      });

      // stitch: concat demuxer → single loudnorm pass → uniform MP3
      const listFile = join(workDir, "list.txt");
      await writeFile(
        listFile,
        paths.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n"),
      );
      const output = join(workDir, "final.mp3");
      await runFfmpeg([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listFile,
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-ar", "44100",
        "-ac", "1",
        "-b:a", "192k",
        output,
      ]);

      const audio = await readFile(output);
      job.audioBase64 = audio.toString("base64");
      job.mimeType = "audio/mpeg";
      job.durationMs = durationsMs.reduce((a, b) => a + b, 0);

      // SRT
      if (voice.provider === "deepgram") {
        const words = await deepgramWords(audio);
        job.srt = words.length > 0 ? buildSrt(words) : undefined;
      } else if (wordsByChunk.size > 0) {
        // rebase each chunk's local timestamps by cumulative duration
        const merged: WordTimestamp[] = [];
        let acc = 0;
        for (let i = 0; i < chunks.length; i++) {
          const words = wordsByChunk.get(i);
          if (words) {
            for (const w of words) {
              merged.push({ word: w.word, startMs: w.startMs + acc, endMs: w.endMs + acc });
            }
          }
          acc += durationsMs[i] ?? 0;
        }
        job.srt = buildSrt(merged);
      } else {
        // no word data — sentence-level fallback per chunk (rough timings)
        let acc = 0;
        const sentences = chunks.map((c, i) => {
          const start = acc;
          acc += durationsMs[i] ?? 0;
          return { text: c.text, startMs: start, endMs: acc };
        });
        job.srt = sentenceFallbackSrt(sentences);
      }

      job.status = "completed";
    } catch (err) {
      job.status = "failed";
      job.error = (err as Error).message;
    } finally {
      await rm(workDir, { recursive: true, force: true });
      if (onDone) {
        try {
          await onDone(job.status === "failed");
        } catch (err) {
          console.error("[longform] onDone hook failed", err);
        }
      }
      setTimeout(() => jobs.delete(id), JOB_TTL_MS);
    }
  })();

  return job;
}
