import { NextResponse } from "next/server";
import { verifyApiKey, listApiKeys } from "@/lib/keys/store";
import { getBalance, ledgerHistory } from "@/lib/credits/ledger";

/**
 * GET /api/v1/me — account + key info (developer API).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const record = auth?.startsWith("Bearer ") ? verifyApiKey(auth.slice(7).trim()) : null;
  if (!record) {
    return NextResponse.json({ error: "Missing or invalid API key.", code: "invalid_api_key" }, { status: 401 });
  }

  const [balance, history, keys] = await Promise.all([
    getBalance(record.userId),
    ledgerHistory(record.userId, 10),
    listApiKeys(record.userId),
  ]);

  return NextResponse.json({
    userId: record.userId,
    key: { id: record.id, name: record.name, keyPrefix: record.keyPrefix, scopes: record.scopes, rateLimitRpm: record.rateLimitRpm },
    creditsBalance: balance,
    keys: keys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes, revokedAt: k.revokedAt ?? undefined })),
    recentLedger: history.slice(0, 10).map((e) => ({ type: e.type, amount: e.amount, balanceAfter: e.balanceAfter, description: e.description, createdAt: e.createdAt })),
  });
}
