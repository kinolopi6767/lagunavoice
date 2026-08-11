/**
 * Abuse-detection rules engine (research/08 §D — R1–R24, in-memory).
 * Every rule: trigger → action. Rules run on the hot paths (generation,
 * signup, payments) and write to the flags queue for admin review.
 */

export type Severity = "low" | "medium" | "high";
export type FlagStatus = "open" | "reviewed" | "actioned" | "dismissed";

export interface AbuseFlag {
  id: string;
  userId?: string;
  ip?: string;
  rule: string;
  severity: Severity;
  status: FlagStatus;
  evidence: Record<string, unknown>;
  createdAt: number;
}

export interface Ban {
  userId: string;
  type: "temporary" | "permanent";
  reason: string;
  expiresAt?: number;
  createdAt: number;
}

interface VelocityCounter {
  windowStart: number;
  count: number;
}

const flags: AbuseFlag[] = [];
const bans = new Map<string, Ban>();
const moderationStrikes = new Map<string, number>();
const velocity = new Map<string, VelocityCounter>();

const VELOCITY_WINDOW_MS = 60_000;
const VELOCITY_LIMIT = 10; // generations per minute (R2)
const STRIKES_TO_BAN = 3;

function flag(f: Omit<AbuseFlag, "id" | "status" | "createdAt">): AbuseFlag {
  const record: AbuseFlag = {
    id: `flag_${flags.length + 1}_${Date.now().toString(36)}`,
    status: "open",
    createdAt: Date.now(),
    ...f,
  };
  flags.push(record);
  return record;
}

export function listFlags(status?: FlagStatus): AbuseFlag[] {
  return flags.filter((f) => !status || f.status === status).sort((a, b) => b.createdAt - a.createdAt);
}

export function setFlagStatus(id: string, status: FlagStatus): void {
  const f = flags.find((x) => x.id === id);
  if (f) f.status = status;
}

export function isBanned(userId: string): Ban | undefined {
  const ban = bans.get(userId);
  if (!ban) return undefined;
  if (ban.type === "temporary" && ban.expiresAt && ban.expiresAt < Date.now()) {
    bans.delete(userId);
    return undefined;
  }
  return ban;
}

export function banUser(userId: string, type: "temporary" | "permanent", reason: string, hours = 24): void {
  bans.set(userId, { userId, type, reason, expiresAt: type === "temporary" ? Date.now() + hours * 3_600_000 : undefined, createdAt: Date.now() });
}

export function unbanUser(userId: string): void {
  bans.delete(userId);
}

export function listBans(): Ban[] {
  return [...bans.values()];
}

/** R8 — moderation strikes: 3 flagged inputs → auto temporary ban */
export function recordModerationStrike(userId: string): void {
  const strikes = (moderationStrikes.get(userId) ?? 0) + 1;
  moderationStrikes.set(userId, strikes);
  if (strikes >= STRIKES_TO_BAN) {
    banUser(userId, "temporary", "Content policy: repeated policy violations", 24);
    flag({ userId, rule: "R8", severity: "high", evidence: { strikes } });
    moderationStrikes.delete(userId);
  } else {
    flag({ userId, rule: "R8", severity: "medium", evidence: { strikes } });
  }
}

/**
 * R2 — generation velocity: >10/min → flag + throttle (429).
 * Deliberately does NOT auto-ban: legitimate burst use is common, and bans
 * are for humans (admin) or hard signals (R7/R8). Guests are throttled on IP,
 * signed-in users on account — admin sees the flag either way.
 */
export function checkGenerationVelocity(key: string, userId?: string): boolean {
  const now = Date.now();
  const entry = velocity.get(key);
  if (!entry || now - entry.windowStart > VELOCITY_WINDOW_MS) {
    velocity.set(key, { windowStart: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > VELOCITY_LIMIT) {
    velocity.delete(key);
    flag({
      userId,
      ip: key.startsWith("ip:") ? key.slice(3) : undefined,
      rule: "R2",
      severity: userId ? "medium" : "high",
      evidence: { count: entry.count },
    });
    return true;
  }
  return false;
}

/** R7 — chargeback: suspend account + evidence pack */
export function recordChargeback(userId: string, orderRef: string): void {
  banUser(userId, "temporary", "Chargeback received — account suspended pending review", 72);
  flag({ userId, rule: "R7", severity: "high", evidence: { orderRef } });
}

export function flagListStats(): { open: number; medium: number; high: number } {
  const open = flags.filter((f) => f.status === "open");
  return {
    open: open.length,
    medium: open.filter((f) => f.severity === "medium").length,
    high: open.filter((f) => f.severity === "high").length,
  };
}
