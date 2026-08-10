import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/keys/store";
import { getGeneration } from "@/lib/generations/store";

/**
 * GET /api/v1/generations/:id — poll a generation (developer API).
 * status: processing → completed | failed. Requires the owning API key.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = request.headers.get("authorization");
  const record = auth?.startsWith("Bearer ") ? verifyApiKey(auth.slice(7).trim()) : null;
  if (!record) {
    return NextResponse.json({ error: "Missing or invalid API key.", code: "invalid_api_key" }, { status: 401 });
  }

  const generation = getGeneration(id);
  if (!generation || generation.userId !== record.userId) {
    return NextResponse.json({ error: "Generation not found.", code: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: generation.id,
    status: generation.status,
    voice: generation.voiceId,
    provider: generation.provider,
    tier: generation.tier,
    textLength: generation.textLength,
    creditsCharged: generation.creditsCharged,
    audioBase64: generation.audioBase64,
    mimeType: generation.mimeType,
    durationMs: generation.durationMs,
    error: generation.error,
  });
}
