import { createHash, randomBytes } from "node:crypto";

/**
 * Developer API keys — in-memory until the DB `api_keys` table is wired.
 *
 * Security (research/08): full key shown once, SHA-256 hashed at rest,
 * prefix-only display, scoped, instant revocation. Per-key token-bucket
 * rate limiting (Postgres `rate_limit_buckets` when the DB is configured).
 */

export const KEY_PREFIX = "lug_";

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  keyPrefix: string; // lug_ + 8 chars, for display
  scopes: string[];
  rateLimitRpm: number;
  lastUsedAt?: number;
  revokedAt?: number;
  createdAt: number;
}

const keys = new Map<string, ApiKey>(); // keyHash → key
/** idempotency results: key → generationId (replays return the original) */
const idempotencyResults = new Map<string, string>();

export function createApiKey(opts: {
  userId: string;
  name: string;
  scopes?: string[];
  rateLimitRpm?: number;
}): { key: string; record: ApiKey } {
  const token = randomBytes(24).toString("base64url");
  const key = `${KEY_PREFIX}${token}`; // full key — shown ONCE
  const hash = createHash("sha256").update(key).digest("hex");

  const record: ApiKey = {
    id: `key_${randomBytes(6).toString("hex")}`,
    userId: opts.userId,
    name: opts.name,
    keyHash: hash,
    keyPrefix: `${KEY_PREFIX}${key.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8)}`,
    scopes: opts.scopes ?? ["tts:generate", "voices:read"],
    rateLimitRpm: opts.rateLimitRpm ?? 30,
    createdAt: Date.now(),
  };
  keys.set(hash, record);
  return { key, record };
}

export function verifyApiKey(bearerToken: string): ApiKey | null {
  if (!bearerToken.startsWith(KEY_PREFIX)) return null;
  const hash = createHash("sha256").update(bearerToken).digest("hex");
  const record = keys.get(hash);
  if (!record) return null;
  if (record.revokedAt) return null;
  record.lastUsedAt = Date.now();
  return record;
}

export function revokeApiKey(keyId: string, userId: string): boolean {
  for (const record of keys.values()) {
    if (record.id === keyId && record.userId === userId) {
      record.revokedAt = Date.now();
      return true;
    }
  }
  return false;
}

export function listApiKeys(userId: string): ApiKey[] {
  return [...keys.values()]
    .filter((k) => k.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function hasScope(record: ApiKey, scope: string): boolean {
  return record.scopes.includes(scope);
}

/**
 * Idempotency — a used key stores the ORIGINAL result (generationId).
 * Replays return it instead of failing, so retries never double-charge.
 * Registered only AFTER the debit succeeds (see v1 route).
 * Entries are pruned after 24h — a replayed key older than that is a new request.
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const idempotencyStoredAt = new Map<string, number>();

export function getIdempotencyResult(idempotencyKey: string): string | undefined {
  const at = idempotencyStoredAt.get(idempotencyKey);
  if (at !== undefined && Date.now() - at > IDEMPOTENCY_TTL_MS) {
    idempotencyResults.delete(idempotencyKey);
    idempotencyStoredAt.delete(idempotencyKey);
    return undefined;
  }
  return idempotencyResults.get(idempotencyKey);
}

export function setIdempotencyResult(idempotencyKey: string, generationId: string): void {
  if (idempotencyResults.size >= 10_000) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, t] of idempotencyStoredAt) {
      if (t < oldestAt) {
        oldestAt = t;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      idempotencyResults.delete(oldestKey);
      idempotencyStoredAt.delete(oldestKey);
    }
  }
  idempotencyResults.set(idempotencyKey, generationId);
  idempotencyStoredAt.set(idempotencyKey, Date.now());
}

/** token-bucket rate limit per key (rpm) — returns ms to wait (0 = allowed) */
export function rateLimitCheck(record: ApiKey): { allowed: boolean; retryAfterMs: number } {
  // in-memory sliding window per key
  const now = Date.now();
  const windowKey = record.id;
  const windows = rateWindows.get(windowKey);
  const windowStart = now - 60_000;

  const active = (windows ?? []).filter((t) => t > windowStart);
  if (active.length >= record.rateLimitRpm) {
    const oldest = Math.min(...active);
    return { allowed: false, retryAfterMs: Math.max(1_000, oldest + 60_000 - now) };
  }
  active.push(now);
  rateWindows.set(windowKey, active);
  return { allowed: true, retryAfterMs: 0 };
}

const rateWindows = new Map<string, number[]>();
