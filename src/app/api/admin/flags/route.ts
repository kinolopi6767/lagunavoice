import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/ops/admin";
import { setFlagStatus } from "@/lib/abuse/rules";

/**
 * POST /api/admin/flags — resolve/dismiss an abuse flag (admin only).
 */
const FlagSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "reviewed", "actioned", "dismissed"]),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin only.", code: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = FlagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  setFlagStatus(parsed.data.id, parsed.data.status);
  return NextResponse.json({ ok: true });
}
