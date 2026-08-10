import { NextResponse } from "next/server";
import { searchVoices, listLanguages, catalogStats } from "@/lib/tts/catalog";

/**
 * GET /api/v1/voices — public catalog (developer API, no auth required).
 * Query: q, language, gender, tier, provider, limit, offset
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const limit = Math.min(Number(searchParams.get("limit") ?? 60) || 60, 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

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
      }),
      listLanguages(),
      catalogStats(),
    ]);

    return NextResponse.json({
      voices: result.voices.map((v) => ({
        id: v.id,
        provider: v.provider,
        modelVersion: v.modelVersion,
        name: v.name,
        language: v.language,
        gender: v.gender,
        tier: v.tier,
        useCases: v.useCases,
      })),
      total: result.total,
      limit,
      offset,
      languages,
      stats,
    });
  } catch {
    return NextResponse.json(
      { error: "Voice catalog unavailable.", code: "catalog_unavailable" },
      { status: 503 },
    );
  }
}
