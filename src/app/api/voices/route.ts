import { NextResponse } from "next/server";
import { searchVoices, listLanguages, catalogStats } from "@/lib/tts/catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/voices — public voice catalog (search + filters + pagination).
 * Query params: q, language, gender, tier, provider, limit, offset
 * Logged-in users also see their custom (cloned) voices.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(Number(searchParams.get("limit") ?? 60) || 60, 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  // resolve the caller's custom voices (guests see none)
  let ownerUserId: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) ownerUserId = data.user.id;
  } catch {
    // Supabase not configured — guests only
  }

  try {
    const [result, languages, stats] = await Promise.all([
      searchVoices({
        q: searchParams.get("q") ?? undefined,
        language: searchParams.get("language") ?? undefined,
        gender: searchParams.get("gender") ?? undefined,
        tier: searchParams.get("tier") ?? undefined,
        provider: searchParams.get("provider") ?? undefined,
        limit,
        offset,
        ownerUserId,
      }),
      listLanguages(),
      catalogStats(),
    ]);

    return NextResponse.json({
      voices: result.voices,
      total: result.total,
      limit,
      offset,
      languages,
      stats,
    });
  } catch (err) {
    console.error("[voices] catalog error", err);
    return NextResponse.json(
      { error: "Voice catalog unavailable.", code: "catalog_unavailable" },
      { status: 503 },
    );
  }
}
