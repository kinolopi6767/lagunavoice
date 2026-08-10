import {
  bigint,
  boolean,
  date,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * LugunaVoice database schema — v2 (see docs/planning/04-database-schema.md)
 * Core invariant: append-only credit ledger, idempotent generations.
 */

/* ------------------------------------------------------------------ */
/* Enums                                                                */
/* ------------------------------------------------------------------ */

export const profilePlanEnum = pgEnum("profile_plan", [
  "free",
  "starter",
  "creator",
  "pro",
  "studio",
  "custom",
]);

export const profileStatusEnum = pgEnum("profile_status", [
  "active",
  "suspended",
  "banned",
]);

export const providerEnum = pgEnum("provider", [
  "edge",
  "typecast",
  "deepgram",
  "kokoro",
]);

export const voiceTierEnum = pgEnum("voice_tier", [
  "free",
  "premium",
  "flagship",
]);

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const ageGroupEnum = pgEnum("age_group", [
  "child",
  "teenager",
  "young_adult",
  "middle_age",
  "elder",
]);

export const generationKindEnum = pgEnum("generation_kind", [
  "single",
  "longform",
  "dialogue",
  "stream",
]);

export const generationStatusEnum = pgEnum("generation_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "refunded",
  "cancelled",
]);

export const chunkStatusEnum = pgEnum("chunk_status", [
  "pending",
  "ok",
  "failed",
]);

export const ledgerTypeEnum = pgEnum("ledger_type", [
  "purchase",
  "signup_bonus",
  "referral_bonus",
  "monthly_allowance",
  "generation_debit",
  "stream_debit",
  "refund",
  "manual_adjust",
  "rollover_expiry",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "manual_pending",
  "manual_confirmed",
]);

export const orderProviderEnum = pgEnum("order_provider", [
  "razorpay",
  "whatsapp_manual",
  "admin",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "cancelled",
]);

export const transcriptionStatusEnum = pgEnum("transcription_status", [
  "processing",
  "completed",
  "failed",
]);

export const abuseSeverityEnum = pgEnum("abuse_severity", [
  "low",
  "medium",
  "high",
]);

export const abuseStatusEnum = pgEnum("abuse_status", [
  "open",
  "reviewed",
  "actioned",
  "dismissed",
]);

export const banTypeEnum = pgEnum("ban_type", ["temporary", "permanent"]);

export const moderationVerdictEnum = pgEnum("moderation_verdict", [
  "allow",
  "block",
]);

/* ------------------------------------------------------------------ */
/* 1. Accounts & Auth                                                  */
/* ------------------------------------------------------------------ */

export const profiles = pgTable(
  "profiles",
  {
    // id = auth.users.id — the FK to the Supabase-managed auth schema is
    // enforced by Supabase, not by our migrations (drizzle must not touch auth.*)
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    plan: profilePlanEnum("plan").notNull().default("free"),
    creditsBalance: bigint("credits_balance", { mode: "number" })
      .notNull()
      .default(0),
    cloneSlotsUsed: integer("clone_slots_used").notNull().default(0),
    cloningEnabled: boolean("cloning_enabled").notNull().default(false),
    referralCode: text("referral_code").unique(),
    referredBy: uuid("referred_by"),
    status: profileStatusEnum("status").notNull().default("active"),
    banReason: text("ban_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("profiles_plan_idx").on(t.plan)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
    keyHash: text("key_hash").notNull().unique(),
    scopes: text("scopes").array().notNull().default(["tts:generate"]),
    rateLimitRpm: integer("rate_limit_rpm").notNull().default(10),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

export const userLimits = pgTable(
  "user_limits",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    edgeCharsUsed: bigint("edge_chars_used", { mode: "number" }).notNull().default(0),
    premiumCreditsUsed: bigint("premium_credits_used", { mode: "number" }).notNull().default(0),
    flagshipCreditsUsed: bigint("flagship_credits_used", { mode: "number" }).notNull().default(0),
    generationsCount: integer("generations_count").notNull().default(0),
    streamingMinutes: integer("streaming_minutes").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/* ------------------------------------------------------------------ */
/* 2. Voice catalog                                                    */
/* ------------------------------------------------------------------ */

export const voices = pgTable(
  "voices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(),
    provider: providerEnum("provider").notNull(),
    providerVoiceId: text("provider_voice_id").notNull(),
    modelVersion: text("model_version"),
    name: text("name").notNull(),
    language: text("language").notNull(),
    country: text("country"),
    gender: genderEnum("gender"),
    ageGroup: ageGroupEnum("age_group"),
    useCases: text("use_cases").array(),
    tags: text("tags").array(),
    tier: voiceTierEnum("tier").notNull().default("free"),
    isCustom: boolean("is_custom").notNull().default(false),
    ownerUserId: uuid("owner_user_id").references(() => profiles.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    previewUrl: text("preview_url"),
    previewDurationMs: integer("preview_duration_ms"),
    providerMeta: jsonb("provider_meta"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("voices_provider_active_idx").on(t.provider, t.isActive),
    index("voices_tier_idx").on(t.tier),
    index("voices_language_idx").on(t.language),
    index("voices_owner_idx").on(t.ownerUserId),
  ],
);

export const voiceFavorites = pgTable(
  "voice_favorites",
  {
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    voiceId: uuid("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.voiceId] })],
);

/* ------------------------------------------------------------------ */
/* 3. Generations & long-form                                          */
/* ------------------------------------------------------------------ */

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    voiceId: uuid("voice_id").notNull().references(() => voices.id),
    provider: providerEnum("provider").notNull(),
    modelVersion: text("model_version"),
    tier: voiceTierEnum("tier").notNull(),
    text: text("text").notNull(),
    textLength: integer("text_length").notNull(),
    kind: generationKindEnum("kind").notNull().default("single"),
    status: generationStatusEnum("status").notNull().default("queued"),
    style: text("style"),
    pitch: real("pitch"),
    rate: real("rate"),
    creditsCharged: integer("credits_charged").notNull().default(0),
    audioPath: text("audio_path"),
    audioMime: text("audio_mime"),
    durationMs: integer("duration_ms"),
    subtitlesPath: text("subtitles_path"),
    idempotencyKey: text("idempotency_key").unique(),
    providerRef: text("provider_ref"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("generations_user_created_idx").on(t.userId, t.createdAt),
    index("generations_status_idx").on(t.status),
    uniqueIndex("generations_idempotency_key_unique").on(t.idempotencyKey),
  ],
);

export const generationsChunks = pgTable(
  "generations_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    prevText: text("prev_text"),
    nextText: text("next_text"),
    seed: integer("seed"),
    providerStatus: chunkStatusEnum("provider_status").notNull().default("pending"),
    audioPath: text("audio_path"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.generationId, t.chunkIndex] })],
);

export const generationDedup = pgTable(
  "generation_dedup",
  {
    voiceId: uuid("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
    textHash: text("text_hash").notNull(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.voiceId, t.textHash] })],
);

/* ------------------------------------------------------------------ */
/* 4. Credits & payments                                               */
/* ------------------------------------------------------------------ */

export const creditOrders = pgTable(
  "credit_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    packSlug: text("pack_slug").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    credits: bigint("credits", { mode: "number" }).notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    provider: orderProviderEnum("provider").notNull(),
    providerRef: text("provider_ref").unique(),
    webhookId: text("webhook_id").unique(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_orders_user_idx").on(t.userId)],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    type: ledgerTypeEnum("type").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
    generationId: uuid("generation_id").references(() => generations.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => creditOrders.id, { onDelete: "set null" }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("credit_ledger_user_created_idx").on(t.userId, t.createdAt),
    index("credit_ledger_generation_idx").on(t.generationId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    planSlug: profilePlanEnum("plan_slug").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodEnd: date("current_period_end"),
    allowanceCredits: bigint("allowance_credits", { mode: "number" }).notNull().default(0),
    allowanceFlagship: bigint("allowance_flagship", { mode: "number" }).notNull().default(0),
    carryoverUntil: date("carryover_until"),
    razorpaySubId: text("razorpay_sub_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* 5. Cloning & consent                                                */
/* ------------------------------------------------------------------ */

export const clonedVoiceConsents = pgTable(
  "cloned_voice_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    voiceId: uuid("voice_id").notNull().references(() => voices.id, { onDelete: "cascade" }),
    sampleHash: text("sample_hash").notNull(),
    sampleFileHash: text("sample_file_hash"),
    attestation: text("attestation").notNull(),
    language: text("language"),
    ip: inet("ip"),
    userAgent: text("ua"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("clone_consent_voice_unique").on(t.voiceId)],
);

export const cloneSlotTracking = pgTable(
  "clone_slot_tracking",
  {
    userId: uuid("user_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
    slotUsed: integer("slot_used").notNull().default(0),
    typecastCapacity: integer("typecast_capacity").notNull().default(50),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/* ------------------------------------------------------------------ */
/* 6. Abuse & security                                                 */
/* ------------------------------------------------------------------ */

export const fingerprints = pgTable(
  "fingerprints",
  {
    visitorId: text("visitor_id").primaryKey(),
    accountIds: uuid("account_ids").array(),
    flags: jsonb("flags"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const abuseFlags = pgTable(
  "abuse_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    rule: text("rule").notNull(),
    severity: abuseSeverityEnum("severity").notNull().default("medium"),
    status: abuseStatusEnum("status").notNull().default("open"),
    evidence: jsonb("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("abuse_flags_status_idx").on(t.status)],
);

export const bans = pgTable(
  "bans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    type: banTypeEnum("type").notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bans_user_idx").on(t.userId)],
);

export const moderationLog = pgTable(
  "moderation_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    inputHash: text("input_hash"),
    flags: jsonb("flags"),
    verdict: moderationVerdictEnum("verdict").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const ipSessions = pgTable(
  "ip_sessions",
  {
    ip: inet("ip").notNull(),
    date: date("date").notNull(),
    demoCount: integer("demo_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ip, t.date] })],
);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    tokens: real("tokens").notNull(),
    lastRefill: timestamp("last_refill", { withTimezone: true }).notNull().defaultNow(),
    capacity: real("capacity").notNull(),
    refillRate: real("refill_rate").notNull(),
  },
);

export const providerUsageDaily = pgTable(
  "provider_usage_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date").notNull(),
    provider: providerEnum("provider").notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    planSlug: text("plan_slug"),
    chars: bigint("chars", { mode: "number" }).notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
    sttSeconds: integer("stt_seconds").notNull().default(0),
    requests: integer("requests").notNull().default(0),
    erroredRequests: integer("errored_requests").notNull().default(0),
  },
  (t) => [uniqueIndex("usage_daily_unique").on(t.date, t.provider, t.userId)],
);

/* ------------------------------------------------------------------ */
/* 7. Transcriptions (v2) & events                                     */
/* ------------------------------------------------------------------ */

export const transcriptions = pgTable(
  "transcriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    sourcePath: text("source_path").notNull(),
    status: transcriptionStatusEnum("status").notNull().default("processing"),
    transcript: text("transcript"),
    srtPath: text("srt_path"),
    diarization: boolean("diarization").notNull().default(false),
    language: text("language"),
    creditsCharged: integer("credits_charged").notNull().default(0),
    providerRef: text("provider_ref"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("transcriptions_user_created_idx").on(t.userId, t.createdAt)],
);

export const appEvents = pgTable(
  "app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: text("event").notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    sessionId: text("session_id"),
    visitorId: text("visitor_id"),
    detail: jsonb("detail"),
    pathname: text("pathname"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("app_events_event_created_idx").on(t.event, t.createdAt)],
);
