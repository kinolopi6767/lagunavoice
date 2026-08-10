import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from "msedge-tts";
import { Readable } from "node:stream";
import type {
  SynthesizeRequest,
  SynthesizeResult,
  TtsProvider,
  VoiceRecord,
} from "@/lib/tts/types";

/**
 * EdgeProvider — free tier. Microsoft Edge "Read Aloud" endpoint via msedge-tts.
 *
 * ⚠️ Unofficial endpoint (speech.platform.bing.com). Best-effort only:
 * free tier, never revenue-critical, wrapped behind our own API so it can be
 * swapped for Azure Speech ($16/1M chars) if Microsoft changes anything.
 */

/** demo styles → prosody tweaks (rate + pitch), same spirit as FameSpeak's styles */
const STYLE_MAP: Record<string, { rate: number; pitch: string }> = {
  neutral: { rate: 1.0, pitch: "0%" },
  cheerful: { rate: 1.08, pitch: "+8%" },
  calm: { rate: 0.94, pitch: "-4%" },
  serious: { rate: 0.9, pitch: "-12%" },
  excited: { rate: 1.2, pitch: "+15%" },
};

function collectStream(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** read word/sentence boundary metadata to compute total duration in ms */
function durationFromMetadata(
  stream: Readable | null,
  resolveWhen: Promise<unknown>,
): Promise<number> {
  return new Promise((resolve) => {
    if (!stream) return resolve(0);
    let maxEndMs = 0;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Math.round(maxEndMs));
    };
    stream.on("data", (line: Buffer) => {
      try {
        // msedge-tts emits {"Metadata": [...]} chunks (Azure Speech SDK shape).
        // Keys are capitalized in practice ("Type", "Data", "Offset", "Duration");
        // accept both cases defensively.
        const chunk = JSON.parse(line.toString()) as {
          Metadata?: Array<{
            Type?: string;
            type?: string;
            Data?: { Offset?: number; Duration?: number };
            data?: { Offset?: number; Duration?: number };
          }>;
        };
        for (const item of chunk.Metadata ?? []) {
          const kind = item.Type ?? item.type;
          const data = item.Data ?? item.data;
          if (kind === "SentenceBoundary" || kind === "WordBoundary") {
            // offset/duration are in 100-nanosecond units
            maxEndMs = Math.max(
              maxEndMs,
              ((data?.Offset ?? 0) + (data?.Duration ?? 0)) / 10_000,
            );
          }
        }
      } catch {
        // non-JSON metadata line — ignore
      }
    });
    stream.on("end", finish);
    stream.on("error", finish);
    // msedge-tts keeps the metadata stream open until close(); resolve as soon
    // as the audio is done so synthesize() never hangs on the metadata socket.
    resolveWhen.then(finish);
  });
}

export class EdgeTtsProvider implements TtsProvider {
  readonly name = "edge" as const;
  readonly maxCharsPerRequest = 10_000;
  readonly maxConcurrent = 2;

  private async synth(
    voiceName: string,
    text: string,
    prosody: ProsodyOptions,
  ): Promise<{ audio: Buffer; durationMs: number }> {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        sentenceBoundaryEnabled: true,
        wordBoundaryEnabled: true,
      });
      const { audioStream, metadataStream } = tts.toStream(text, prosody);
      const audioDone = collectStream(audioStream);
      const durationMs = await durationFromMetadata(metadataStream, audioDone);
      const audio = await audioDone;
      return { audio, durationMs };
    } finally {
      tts.close();
    }
  }

  async listVoices(): Promise<VoiceRecord[]> {
    const tts = new MsEdgeTTS();
    try {
      const voices = await tts.getVoices();
      return voices
        .filter((v) => v.Status === "GA" && v.Gender !== "Unknown")
        .map((v) => {
          return {
            id: `fs_voice_edge_${v.ShortName}`,
            provider: "edge" as const,
            providerVoiceId: v.ShortName,
            name: v.FriendlyName.replace(/\(.*?\)/g, "").trim(),
            language: v.Locale,
            gender: (v.Gender.toLowerCase() as "male" | "female") ?? "other",
            tier: "free" as const,
            providerMeta: v as unknown as Record<string, unknown>,
          };
        });
    } finally {
      tts.close();
    }
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const style = STYLE_MAP[req.style ?? "neutral"] ?? STYLE_MAP.neutral;
    const rate = req.rate ?? style.rate;
    const pitch = req.pitch !== undefined ? `${req.pitch >= 0 ? "+" : ""}${req.pitch}st` : style.pitch;

    const { audio, durationMs } = await this.synth(req.voice.providerVoiceId, req.text, {
      rate,
      pitch,
    });

    return {
      audio,
      mimeType: "audio/mpeg",
      durationMs,
      charCount: Array.from(req.text).length,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.synth("en-US-AriaNeural", "Test.", { rate: 1, pitch: "0%" });
      return true;
    } catch {
      return false;
    }
  }
}
