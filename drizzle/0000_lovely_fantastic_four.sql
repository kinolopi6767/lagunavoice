CREATE TYPE "public"."abuse_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."abuse_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."age_group" AS ENUM('child', 'teenager', 'young_adult', 'middle_age', 'elder');--> statement-breakpoint
CREATE TYPE "public"."ban_type" AS ENUM('temporary', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."chunk_status" AS ENUM('pending', 'ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."generation_kind" AS ENUM('single', 'longform', 'dialogue', 'stream');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('queued', 'processing', 'completed', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('purchase', 'signup_bonus', 'referral_bonus', 'monthly_allowance', 'generation_debit', 'stream_debit', 'refund', 'manual_adjust', 'rollover_expiry');--> statement-breakpoint
CREATE TYPE "public"."moderation_verdict" AS ENUM('allow', 'block');--> statement-breakpoint
CREATE TYPE "public"."order_provider" AS ENUM('razorpay', 'whatsapp_manual', 'admin');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'manual_pending', 'manual_confirmed');--> statement-breakpoint
CREATE TYPE "public"."profile_plan" AS ENUM('free', 'starter', 'creator', 'pro', 'studio', 'custom');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('edge', 'typecast', 'deepgram', 'kokoro');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transcription_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."voice_tier" AS ENUM('free', 'premium', 'flagship');--> statement-breakpoint
CREATE TABLE "abuse_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"rule" text NOT NULL,
	"severity" "abuse_severity" DEFAULT 'medium' NOT NULL,
	"status" "abuse_status" DEFAULT 'open' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{"tts:generate"}' NOT NULL,
	"rate_limit_rpm" integer DEFAULT 10 NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"user_id" uuid,
	"session_id" text,
	"visitor_id" text,
	"detail" jsonb,
	"pathname" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "ban_type" NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clone_slot_tracking" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slot_used" integer DEFAULT 0 NOT NULL,
	"typecast_capacity" integer DEFAULT 50 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloned_voice_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"voice_id" uuid NOT NULL,
	"sample_hash" text NOT NULL,
	"sample_file_hash" text,
	"attestation" text NOT NULL,
	"language" text,
	"ip" "inet",
	"ua" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "ledger_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"generation_id" uuid,
	"order_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_slug" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"credits" bigint NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"provider" "order_provider" NOT NULL,
	"provider_ref" text,
	"webhook_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_orders_provider_ref_unique" UNIQUE("provider_ref"),
	CONSTRAINT "credit_orders_webhook_id_unique" UNIQUE("webhook_id")
);
--> statement-breakpoint
CREATE TABLE "fingerprints" (
	"visitor_id" text PRIMARY KEY NOT NULL,
	"account_ids" uuid[],
	"flags" jsonb,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_dedup" (
	"voice_id" uuid NOT NULL,
	"text_hash" text NOT NULL,
	"generation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_dedup_voice_id_text_hash_pk" PRIMARY KEY("voice_id","text_hash")
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"voice_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"model_version" text,
	"tier" "voice_tier" NOT NULL,
	"text" text NOT NULL,
	"text_length" integer NOT NULL,
	"kind" "generation_kind" DEFAULT 'single' NOT NULL,
	"status" "generation_status" DEFAULT 'queued' NOT NULL,
	"style" text,
	"pitch" real,
	"rate" real,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"audio_path" text,
	"audio_mime" text,
	"duration_ms" integer,
	"subtitles_path" text,
	"idempotency_key" text,
	"provider_ref" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generations_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "generations_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"prev_text" text,
	"next_text" text,
	"seed" integer,
	"provider_status" "chunk_status" DEFAULT 'pending' NOT NULL,
	"audio_path" text,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generations_chunks_generation_id_chunk_index_pk" PRIMARY KEY("generation_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE "ip_sessions" (
	"ip" "inet" NOT NULL,
	"date" date NOT NULL,
	"demo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ip_sessions_ip_date_pk" PRIMARY KEY("ip","date")
);
--> statement-breakpoint
CREATE TABLE "moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"input_hash" text,
	"flags" jsonb,
	"verdict" "moderation_verdict" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"plan" "profile_plan" DEFAULT 'free' NOT NULL,
	"credits_balance" bigint DEFAULT 0 NOT NULL,
	"clone_slots_used" integer DEFAULT 0 NOT NULL,
	"cloning_enabled" boolean DEFAULT false NOT NULL,
	"referral_code" text,
	"referred_by" uuid,
	"status" "profile_status" DEFAULT 'active' NOT NULL,
	"ban_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "provider_usage_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"provider" "provider" NOT NULL,
	"user_id" uuid,
	"plan_slug" text,
	"chars" bigint DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"stt_seconds" integer DEFAULT 0 NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"errored_requests" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" real NOT NULL,
	"last_refill" timestamp with time zone DEFAULT now() NOT NULL,
	"capacity" real NOT NULL,
	"refill_rate" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_slug" "profile_plan" NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_end" date,
	"allowance_credits" bigint DEFAULT 0 NOT NULL,
	"allowance_flagship" bigint DEFAULT 0 NOT NULL,
	"carryover_until" date,
	"razorpay_sub_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_path" text NOT NULL,
	"status" "transcription_status" DEFAULT 'processing' NOT NULL,
	"transcript" text,
	"srt_path" text,
	"diarization" boolean DEFAULT false NOT NULL,
	"language" text,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"provider_ref" text,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_limits" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"edge_chars_used" bigint DEFAULT 0 NOT NULL,
	"premium_credits_used" bigint DEFAULT 0 NOT NULL,
	"flagship_credits_used" bigint DEFAULT 0 NOT NULL,
	"generations_count" integer DEFAULT 0 NOT NULL,
	"streaming_minutes" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_limits_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "voice_favorites" (
	"user_id" uuid NOT NULL,
	"voice_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voice_favorites_user_id_voice_id_pk" PRIMARY KEY("user_id","voice_id")
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"provider" "provider" NOT NULL,
	"provider_voice_id" text NOT NULL,
	"model_version" text,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"country" text,
	"gender" "gender",
	"age_group" "age_group",
	"use_cases" text[],
	"tags" text[],
	"tier" "voice_tier" DEFAULT 'free' NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"owner_user_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"preview_url" text,
	"preview_duration_ms" integer,
	"provider_meta" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voices_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "abuse_flags" ADD CONSTRAINT "abuse_flags_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_events" ADD CONSTRAINT "app_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clone_slot_tracking" ADD CONSTRAINT "clone_slot_tracking_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloned_voice_consents" ADD CONSTRAINT "cloned_voice_consents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloned_voice_consents" ADD CONSTRAINT "cloned_voice_consents_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_credit_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."credit_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_orders" ADD CONSTRAINT "credit_orders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_dedup" ADD CONSTRAINT "generation_dedup_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_dedup" ADD CONSTRAINT "generation_dedup_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations_chunks" ADD CONSTRAINT "generations_chunks_generation_id_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_log" ADD CONSTRAINT "moderation_log_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_usage_daily" ADD CONSTRAINT "provider_usage_daily_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_limits" ADD CONSTRAINT "user_limits_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_favorites" ADD CONSTRAINT "voice_favorites_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_favorites" ADD CONSTRAINT "voice_favorites_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voices" ADD CONSTRAINT "voices_owner_user_id_profiles_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abuse_flags_status_idx" ON "abuse_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "api_keys_user_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "app_events_event_created_idx" ON "app_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "bans_user_idx" ON "bans" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clone_consent_voice_unique" ON "cloned_voice_consents" USING btree ("voice_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_generation_idx" ON "credit_ledger" USING btree ("generation_id");--> statement-breakpoint
CREATE INDEX "credit_orders_user_idx" ON "credit_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generations_user_created_idx" ON "generations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "generations_status_idx" ON "generations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "generations_idempotency_key_unique" ON "generations" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "profiles_plan_idx" ON "profiles" USING btree ("plan");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_daily_unique" ON "provider_usage_daily" USING btree ("date","provider","user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transcriptions_user_created_idx" ON "transcriptions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "voices_provider_active_idx" ON "voices" USING btree ("provider","is_active");--> statement-breakpoint
CREATE INDEX "voices_tier_idx" ON "voices" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "voices_language_idx" ON "voices" USING btree ("language");--> statement-breakpoint
CREATE INDEX "voices_owner_idx" ON "voices" USING btree ("owner_user_id");