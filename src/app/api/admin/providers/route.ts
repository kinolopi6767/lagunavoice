import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/ops/admin";
import { setProviderEnabled } from "@/lib/ops/flags";

/**
 * POST /api/admin/providers — toggle a provider kill-switch (admin only).
 */
const ToggleSchema = z.object({
  provider: z.enum(["edge", "typecast", "deepgram"]),
  enabled: z.boolean(),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin only.", code: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  setProviderEnabled(parsed.data.provider, parsed.data.enabled, parsed.data.enabled ? undefined : "disabled by admin");
  return NextResponse.json({ ok: true });
}
