import { NextResponse } from "next/server";
import { getLongFormJob } from "@/lib/tts/longform";
import { resolveSession } from "@/lib/sandbox/session";

/**
 * GET /api/studio/longform/[id] — poll long-form job progress.
 * status: processing → completed | failed.
 * completed includes audioBase64 + srt.
 *
 * Jobs created by a signed-in user are only readable by that user (404
 * otherwise); guest jobs are public by design (no session to bind to).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await resolveSession();
  const job = getLongFormJob(id);

  if (!job || (job.userId && job.userId !== session.userId)) {
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
