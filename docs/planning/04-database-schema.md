# LugunaVoice — Database Schema (v2)

> PostgreSQL via Supabase + Drizzle ORM. v2 additions: custom voices + consent, long-form chunks, streaming sessions, abuse detection tables, moderation log, rate-limit buckets. Core invariant unchanged: **append-only credit ledger, idempotent generations**.

---

## 1. Accounts & Auth

### profiles
| column | type | notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| email | text unique | |
| display_name | text | |
| avatar_url | text | |
| plan | enum('free','starter','creator','pro','studio','custom') | |
| credits_balance | bigint | denormalized; truth = SUM(ledger); `CHECK (credits_balance >= 0)` |
| clone_slots_used | int default 0 | Typecast Lite = 50 max |
| cloning_enabled | boolean | grant-based |
| referral_code | text unique | |
| referred_by | uuid FK null | |
| status | enum('active','suspended','banned') | abuse system writes here |
| ban_reason | text null | |
| stripe_… (n/a) | — | Razorpay not stored here |
| created_at / updated_at | timestamptz | |

### api_keys (v2: scopes extended)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| name | text | |
| key_prefix | text(8) | `lug_…` |
| key_hash | text | SHA-256, unique |
| scopes | text[] | ['tts:generate','tts:stream','voices:read','voices:clone','usage:read'] |
| rate_limit_rpm | int | per-key |
| last_used_at | timestamptz | |
| revoked_at | timestamptz null | |
| created_at | timestamptz | |

### user_limits (daily caps)
| column | type |
|---|---|
| user_id | uuid PK/FK |
| date | date PK (composite) |
| edge_chars_used | bigint |
| premium_credits_used | bigint |
| flagship_credits_used | bigint |
| generations_count | int |
| streaming_minutes | int |

---

## 2. Voice Catalog

### voices
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| public_id | text unique | `fs_voice_<16hex>` |
| provider | enum('edge','typecast','deepgram','kokoro') | |
| provider_voice_id | text | `en-US-AriaNeural` / `tc_…` / `uc_…` / `aura-2-thalia-en` |
| model_version | text null | ssfm-v30/v21/v20, aura-2, aura-1 |
| name | text | |
| language | text | BCP-47 |
| country | text null | |
| gender | enum('male','female','other') null | |
| age_group | enum('child','teenager','young_adult','middle_age','elder') null | |
| use_cases | text[] | |
| tags | text[] | clean, spa, storyteller… |
| tier | enum('free','premium','flagship') | drives credit pricing: free=0, premium=1cr, flagship=2cr |
| is_custom | boolean default false | cloned voice |
| owner_user_id | uuid FK null | non-null ⇔ is_custom |
| is_active | boolean | kill-switch |
| preview_url / preview_duration_ms | text / int | cached |
| provider_meta | jsonb | raw provider payload (emotions, IPA-capable, etc.) |
| last_synced_at | timestamptz | |
| created_at | timestamptz | |

Indexes: `(provider,is_active)`, `(tier)`, `(language)`, `(owner_user_id)`, trigram on `name`.

### voice_favorites
PK(user_id, voice_id) + created_at.

---

## 3. Generations & Long-form

### generations
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK null | null = guest |
| voice_id | uuid FK | |
| provider | enum | snapshot |
| model_version | text null | |
| tier | enum('free','premium','flagship') | snapshot |
| text | text | |
| text_length | int | code points (`Array.from().length`) |
| kind | enum('single','longform','dialogue','stream') | |
| status | enum('queued','processing','completed','failed','refunded','cancelled') | |
| style | text null | emotion preset / style |
| pitch / rate | real null | |
| credits_charged | int | 0 for free tier |
| audio_path / audio_mime / duration_ms | text/text/int | |
| subtitles_path | text null | SRT |
| idempotency_key | text unique null | double-bill guard |
| provider_ref | text null | typecast/deepgram request id (audit) |
| error | text null | |
| created_at / completed_at / updated_at | timestamptz | |

### generations_chunks (long-form)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| generation_id | uuid FK | |
| chunk_index | int | |
| text | text | ≤1,900 chars |
| prev_text / next_text | text null | prosody context (Typecast smart prompts) |
| seed | int null | voice consistency |
| provider_status | enum('pending','ok','failed') | |
| audio_path | text null | partial |
| duration_ms | int null | |
| error | text null | |
| created_at | timestamptz | |
PK(generation_id, chunk_index)

### generation_dedup
| column | type | notes |
|---|---|---|
| voice_id | uuid PK | |
| text_hash | text PK | sha256(text+style) |
| generation_id | uuid FK | reuse stored audio |
| created_at | timestamptz | |

---

## 4. Credits & Payments (unchanged core)

### credit_ledger (append-only)
id, user_id, type enum('purchase','signup_bonus','referral_bonus','monthly_allowance','generation_debit','stream_debit','refund','manual_adjust','rollover_expiry'), amount (±), balance_after, generation_id FK null, order_id FK null, description, created_at.

### credit_orders
id, user_id, pack_slug, amount (minor units), currency char(3), credits, status enum('pending','paid','failed','refunded','manual_pending','manual_confirmed'), provider enum('razorpay','whatsapp_manual','admin'), provider_ref unique, webhook_id unique null, paid_at, created_at.

### subscriptions (monthly plans w/ 90-day rollover)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| plan_slug | enum('starter','creator','pro','studio') | |
| status | enum('active','past_due','cancelled') | |
| current_period_end | date | allowance grant date |
| allowance_credits | bigint | monthly premium credits |
| allowance_flagship | bigint | |
| carryover_until | date | +90 days |
| razorpay_sub_id | text null | |
| created_at | timestamptz | |

---

## 5. Cloning & Consent (v2)

### cloned_voice_consents (immutable evidence)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| voice_id | uuid FK (the uc_ voice) | |
| sample_hash | text | sha256 of uploaded sample |
| sample_sha256_of_file | text | file digest for rights proof |
| attestation | text | "I own the rights…" |
| language | text | |
| ip | inet | |
| ua | text | |
| created_at | timestamptz | |
(unique voice_id; never updated — audit trail)

### clone_slot_tracking
user_id PK, slot_used int, typecast_capacity int (50), updated_at.

---

## 6. Abuse & Security (v2)

### fingerprints
| column | type |
|---|---|
| visitor_id | text PK | FingerprintJS |
| account_ids | uuid[] | accounts seen on this device |
| flags | jsonb | risk signals |
| first_seen / last_seen | timestamptz |

### abuse_flags
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK null | |
| rule | text | R1–R24 code |
| severity | enum('low','medium','high') | |
| status | enum('open','reviewed','actioned','dismissed') | |
| evidence | jsonb | |
| created_at | timestamptz | |

### bans
id, user_id, type enum('temporary','permanent'), reason, expires_at null, created_by enum('system','admin'), created_at.

### moderation_log
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK null | |
| input_hash | text | |
| flags | jsonb | categories + scores |
| verdict | enum('allow','block') | |
| created_at | timestamptz | |

### ip_sessions (guest demo caps)
ip inet PK, date date PK, demo_count int, created_at. + composite unique.

### rate_limit_buckets (Postgres token bucket, MVP)
key text PK (e.g. `rl:user:42`), tokens int, last_refill timestamptz, capacity int, refill_rate real.

### provider_usage_daily (cost control — per-user via Deepgram tags)
date, provider enum('edge','typecast','deepgram'), user_id FK null, plan_slug null, chars, cost_cents, stt_seconds null, requests, errored_requests — unique(date, provider, user_id). Fed nightly by Deepgram `billing/breakdown?grouping=["tags","line_item"]` + our own Typecast/Edge char math.

### transcriptions (v2 tool — audio → text/SRT via Deepgram STT)
id, user_id FK, source_path, status enum('processing','completed','failed'), transcript null, srt_path null, diarization bool, language null, credits_charged, provider_ref null, duration_ms null, error null, created_at.

### app_events
id, event, user_id null, session_id, visitor_id, detail jsonb, pathname, created_at.

---

## 7. Critical SQL patterns (unchanged from v1 — verify before use)

### Atomic credit debit (premium/flagship)
```sql
BEGIN;
UPDATE profiles SET credits_balance = credits_balance - :chars
 WHERE id = :uid AND credits_balance >= :chars RETURNING credits_balance;  -- empty = 402
INSERT INTO credit_ledger (user_id, type, amount, balance_after, generation_id, description)
VALUES (:uid, 'generation_debit', -:chars, :bal, :gen_id, :desc);
INSERT INTO generations (id, user_id, ..., idempotency_key) VALUES (...);
COMMIT;
```
### Refund
```sql
BEGIN;
UPDATE profiles SET credits_balance = credits_balance + :chars WHERE id = :uid;
INSERT INTO credit_ledger (user_id, type, amount, balance_after, generation_id)
VALUES (:uid, 'refund', :chars, :bal, :gen_id);
UPDATE generations SET status='refunded' WHERE id = :gen_id;
COMMIT;
```
### Daily cap (edge free tier)
```sql
INSERT INTO user_limits (user_id, date, edge_chars_used) VALUES (:uid, CURRENT_DATE, :chars)
ON CONFLICT (user_id, date)
DO UPDATE SET edge_chars_used = user_limits.edge_chars_used + :chars
WHERE user_limits.edge_chars_used + :chars <= 100000
RETURNING edge_chars_used;   -- empty = 429
```
### Dedup hit (free money saver)
```sql
SELECT generation_id FROM generation_dedup WHERE voice_id=:v AND text_hash=:h
  -- hit → serve stored audio, 0 provider cost, 0 credits
```

---

## 8. RLS Policy Summary
| table | policy |
|---|---|
| profiles | owner read/write |
| api_keys | owner read/delete |
| generations / generations_chunks | owner read; insert own |
| transcriptions | owner read; insert own |
| credit_ledger / credit_orders / subscriptions | owner read |
| cloned_voice_consents | owner read (immutable) |
| voices | **public read**; custom voices filtered to owner by RLS (`owner_user_id is null or owner_user_id = auth.uid()`) |
| voice_favorites | owner |
| fingerprints / abuse_flags / bans / moderation_log / ip_sessions / rate_limit_buckets / provider_usage_daily | **no client access** (service role only) |
| app_events | insert-only anonymous (no PII) |
