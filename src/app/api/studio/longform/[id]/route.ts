import { NextResponse } from "next/server";
import { getLongFormJob } from "@/lib/tts/longform";

/**
 * GET /api/studio/longform/[id] — poll long-form job progress.
 * status: processing → completed | failed.
 * completed includes audioBase64 + srt.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getLongFormJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found or expired.", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: id,
    status: job.status,
    total: job.total,
    done: job.done,
    error: job.error,
    audioBase64: job.audioBase64,
    mimeType: job.mimeType,
    srt: job.srt,
    durationMs: job.durationMs,
  });
}
