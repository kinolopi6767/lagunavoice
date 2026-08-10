import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeApiKey } from "@/lib/keys/store";

/**
 * DELETE /api/keys/:id — revoke an API key (owner only).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let userId: string;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
    userId = data.user.id;
  } catch {
    return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });
  }

  const revoked = revokeApiKey(id, userId);
  if (!revoked) {
    return NextResponse.json({ error: "Key not found.", code: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
