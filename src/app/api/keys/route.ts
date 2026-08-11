import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/sandbox/session";
import { createApiKey, listApiKeys } from "@/lib/keys/store";

/**
 * App-level API key management (session auth — dashboard page).
 * GET  /api/keys — list my keys
 * POST /api/keys — create (returns the full key ONCE)
 * DELETE /api/keys/:id — revoke
 */

const CreateSchema = z.object({
  name: z.string().min(1).max(40),
});

export async function GET() {
  const { userId } = await resolveSession();
  if (!userId) return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });

  return NextResponse.json(
    {
      keys: listApiKeys(userId).map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        rateLimitRpm: k.rateLimitRpm,
        lastUsedAt: k.lastUsedAt ?? undefined,
        revokedAt: k.revokedAt ?? undefined,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const { userId } = await resolveSession();
  if (!userId) return NextResponse.json({ error: "Sign in required.", code: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const { key, record } = createApiKey({ userId, name: parsed.data.name });
  return NextResponse.json({ key, record: { id: record.id, name: record.name, keyPrefix: record.keyPrefix, scopes: record.scopes } }, { status: 201 });
}
