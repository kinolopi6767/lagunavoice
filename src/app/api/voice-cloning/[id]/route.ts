import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/sandbox/session";
import { getProvider } from "@/lib/tts/registry";
import { getCustomVoice, deleteCustomVoice, slotsRemaining } from "@/lib/tts/custom-voices";

/**
 * DELETE /api/voice-cloning/[id] — delete a clone (frees the Typecast slot).
 * Owner-only; provider deletion failure still removes the local voice.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { userId } = await resolveSession();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
  }

  const voice = getCustomVoice(id, userId);
  if (!voice) {
    return NextResponse.json({ error: "Voice not found.", code: "not_found" }, { status: 404 });
  }

  try {
    const provider = getProvider("typecast");
    await provider.deleteClone!(voice.providerVoiceId);
  } catch (err) {
    console.error("[voice-cloning] provider delete failed (local delete continues)", err);
  }

  deleteCustomVoice(id, userId);
  return NextResponse.json({ ok: true, slotsRemaining: slotsRemaining(userId) });
}
