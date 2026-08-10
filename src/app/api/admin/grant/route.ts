import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/ops/admin";
import { credit } from "@/lib/credits/ledger";
import { memoryAllUsers } from "@/lib/credits/memory-store";

/**
 * POST /api/admin/grant — admin manual credit grant (admin route).
 * Body: { userId, amount } — userId may be a known memory user or an email.
 */
const GrantSchema = z.object({
  userId: z.string().min(3),
  amount: z.number().int().min(1).max(10_000_000),
});

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin only.", code: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = GrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid_request" }, { status: 400 });
  }

  const { userId, amount } = parsed.data;

  // resolve email → known in-memory user id (DB mode resolves profiles later)
  let target = userId;
  const byEmail = memoryAllUsers().find((u) => u.userId.includes(userId));
  if (byEmail) target = byEmail.userId;

  const balance = await credit(target, amount, `admin grant (${amount.toLocaleString()} credits)`);

  return NextResponse.json({ ok: true, balance });
}
