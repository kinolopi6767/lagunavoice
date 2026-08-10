# LugunaVoice — Security & Abuse-Detection Engineering Report

**Date:** Aug 10, 2026 (facts verified against live official docs on this date)
**Scope:** Complete security & abuse-detection design for a TTS SaaS: Next.js 16 + Supabase/Postgres + Vercel + Cloudflare, paid via Razorpay (Indian entity), 3 TTS providers behind one API (edge-tts free tier → Typecast → Deepgram), free tier + credits model.
**Sources:** Stripe webhook docs, Razorpay docs (webhooks/validate-test, security/whitelists, risk-visibility-dashboard, support-non-3ds, security), Supabase docs (RLS, Storage access control), Cloudflare docs (Turnstile, WAF Managed Rules, Rate limiting rules, Plans), OWASP API Security Top 10 2023, OpenAI (Moderation API, Voice Engine safety), ElevenLabs (No-Go Voices, PVC verification API, watermarking/Audio Detector, ToS), EU AI Act Art. 50 (artificialintelligenceact.eu), C2PA, GDPR Art. 5/28, FingerprintJS, github.com/disposable-email-domains, Vercel docs (env vars, TLS).

---

## 0. TL;DR — the ten things that matter most

1. **Hash API keys (SHA-256) at rest, show prefix + last 4 only, support scopes + instant revocation + rotation.** The schema in `docs/planning/04-database-schema.md` already has `key_hash`/`key_prefix`/`scopes`/`revoked_at` — enforce it and add `last_used_at`-based rotation.
2. **Verify Razorpay webhooks with HMAC-SHA256 on the RAW body** (`X-Razorpay-Signature`), dedupe on `x-razorpay-event-id` (unique constraint), and never credit an order without a verified `payment.captured`/`order.paid` event.
3. **Never let the Supabase `service_role` key touch the browser.** Server-only env var in Vercel; keep `anon` key + RLS for all client access; RLS enabled on every public-schema table.
4. **Cloudflare (free) in front: Free Managed Ruleset + unmetered DDoS + 1 rate-limiting rule (10s, per-IP) on auth endpoints + Bot Fight Mode.** App-level rate limits (per-user, per-key, token bucket) inside Next.js.
5. **Cloudflare Turnstile (free, managed mode) on signup + demo/guest generation, verified server-side.**
6. **Email verification mandatory + disposable-domain blocklist** (`disposable-email-domains` repo, CC0) before free credits are granted.
7. **Content moderation of every TTS input** via the free OpenAI Moderation API (`omni-moderation-latest`) — block/reject on `flagged`, queue high scores for review.
8. **Per-user daily caps (already in `user_limits`) + per-minute burst detection on `generation_events`; auto temp-ban (>N generations/min) and an admin flag queue.**
9. **Payment: keep 3DS enabled (never enable non-3DS international cards — liability is 100% on you), watch Razorpay Risk Analytics (fraud-to-sales < 1%, dispute-to-sales < 1%), hold first payout-level usage behind manual review.**
10. **Voice cloning: consent checkbox + verification (ElevenLabs PVC verification flow), refuse public figures (No-Go voices policy), rely on provider watermarking + add C2PA labels; AI Act Art. 50 disclosure applies to EU users from 2 Aug 2026.**

---

## PART A — API & PLATFORM SECURITY

### A.1 API key management (Stripe/Supabase/Anthropic model)

**Design goals:** an API key is a capability token (machine-to-machine). It must be (a) unguessable, (b) unreadable at rest, (c) identifiable in logs, (d) revocable, (e) scope-limited, (f) rate-limited, (g) rotatable with zero downtime.

**Generation (Node 20+):**
```ts
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const raw = `lug_${randomBytes(24).toString("base64url")}`; // 192 bits entropy
const hash = createHash("sha256").update(raw).digest("hex");
const prefix = `lug_${raw.slice(4, 12)}`;                    // display prefix
// store: prefix, hash. return raw ONCE to the user.
```

| Practice | Why | Source/Reference |
|---|---|---|
| 24–32 CSPRNG bytes (`crypto.randomBytes`), base64url | ≥192-bit entropy — brute force is impossible; high entropy means plain SHA-256 (fast hash) is safe **unlike passwords** (no bcrypt/argon2 needed) | Stripe keys, Zuplo "9 rules", sixteenpillars |
| Store **SHA-256 hash only**, never plaintext | DB leak ≠ key leak; Stripe/Supabase/GitHub all hash | docs.stripe.com/keys; zuplo.com/blog/api-key-best-practices |
| Prefix `lug_` + short public segment | Logs/errors can name the key without exposing it; lets you distinguish env (`lug_test_`) | Stripe `sk_live_`/`sk_test_` model |
| Show full key **exactly once** at creation | Key never travels again; dashboard shows `lug_abc123…wxyz` | Stripe best practice |
| Constant-time compare (`timingSafeEqual`) | Prevents timing side-channel on validation | OWASP |
| **Scopes** `['tts','voices','clone']`, per-key rate limits + expiry | Least privilege; a leaked "read-only" key does less damage | Supabase API keys, GitHub fine-grained PATs |
| **Revocation** — `revoked_at` checked on every request; HTTP 401 | Instant kill switch | — |
| **Rotation** — endpoint `POST /keys/:id/rotate`: create new key (new hash), keep old valid for a grace period (24h), revoke old after | Zero-downtime rotation; same pattern as Stripe webhook-secret roll (old secret stays valid ≤24h) | docs.stripe.com/webhooks#roll-endpoint-secrets |
| `last_used_at` + auto-expire keys unused > 90 days | Hygiene: forgotten keys are a leak vector | — |
| Transmit only via `Authorization: Bearer` header; reject keys in URLs/query | URL logging/HTTPS-referrer leaks | OWASP API2 |
| Audit log every key event (created/rotated/revoked/used) | Forensics for abuse | — |

**DB shape** (already in schema, extend):
```sql
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  key_prefix text not null,          -- lug_xxxxxxxx
  key_hash text not null unique,     -- sha256 hex, never plaintext
  scopes text[] not null default '{tts}',
  rate_limit_rpm int not null default 60,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
-- fast lookup: index on key_prefix + compare hash per candidate (usually 1 row)
```

### A.2 Rate limiting — strategies & multi-tenant design

**Algorithm choice at our scale:**

| Algorithm | Burst behavior | Edge behavior | Implementation cost | Verdict for us |
|---|---|---|---|---|
| **Fixed window** | Bursts at window boundary (100 req at 59s + 100 at 60s) | None | Trivial (1 counter row per window) | Good for **daily caps** (already in `user_limits`) |
| **Token bucket** | Smooths bursts (refill rate + capacity) | Small overshoot | Small (counter + timestamps) | **Best default for per-user/per-key API limits** |
| Sliding window log | Exact | None | O(n) memory per key | Overkill at MVP |
| Sliding window counter (Redis) | Good | Tiny | Redis | v2+ |

**Where to enforce (defense in depth, cheap → precise):**

1. **Cloudflare (edge)** — 1 free rate-limiting rule, 10s periods, per-IP. Use it ONLY for brute-force-prone unauthenticated paths: `/auth/*`, `/api/demo/*`. (Free plan limits: 1 rule, 10s counting period — see A.7.)
2. **Next.js middleware/route layer** — per-IP limiter for guest/demo endpoints (in-memory map or Postgres).
3. **App-level (authoritative, billing-relevant)** — per-user and per-API-key limits using a **token bucket backed by Postgres** (atomic `UPDATE … SET tokens = tokens - 1 WHERE … AND tokens > 0`) — correct for a solo dev at MVP scale; Redis/Upstash is the v2 swap when you leave one Postgres instance. Postgres is honestly fine well past 10k RPM since keys are few and rows are hot.

```sql
-- token bucket, one row per (user_id, route_group)
update rate_limiters
set tokens = least(capacity, tokens + (extract(epoch from now() - updated_at) * refill_per_sec)),
    updated_at = now()
where user_id = :uid and bucket = :bucket
returning tokens;   -- if returned <= 0 → 429
```
> Rule of thumb (solo dev, low traffic): **write the algorithm correctly, don't build a Redis fleet.** A single `rate_limiters` table with unique index `(user_id, bucket)` and `ON CONFLICT` upsert handles it. Redis only when you see Postgres contention.

**Which dimension:** per-user (auth'd), per-key (API), per-IP (guest/demo), per-account for clone endpoints (expensive ops).

**Headers (required for a developer-facing API):**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 12
X-RateLimit-Reset: 1754298000     (epoch seconds)
Retry-After: 47                   (on 429 only)
```
Return `429 Too Many Requests` with `Retry-After`; never 500.

**Why this is an abuse surface first:** TTS is metered spend (Deepgram $0.015–0.03/1k chars, Typecast API credits). A single script can burn your provider budget in minutes. OWASP **API4: Unrestricted Resource Consumption** is the #1 API threat for a TTS business, and **API6: Unrestricted Access to Sensitive Business Flows** is literally the "free tier farmed by bots" scenario.

### A.3 Webhook security (Razorpay)

**Razorpay webhook flow (verified from docs):**

1. Set a webhook **secret** in Dashboard → Razorpay signs every payload: `X-Razorpay-Signature` header = `HMAC-SHA256(secret, raw_body)`.
2. **Verify before parsing.** Do not stringify/re-parse the body — the raw request body is the signed message. Use the SDK: `Utils.verifyWebhookSignature(body, signature, secret)` (Node SDK: `razorpay.webhooks.validateWebhookSignature` or `Utils.verifyWebhookSignature`).
3. **Idempotency / replay protection:** every event carries `x-razorpay-event-id` (unique per event). Store processed event IDs with a **unique constraint**; `INSERT … ON CONFLICT DO NOTHING` — if no row inserted, it's a replay → return 200 without acting.
4. **Replay-attack hardening:** reject if signature invalid → 400 (no processing, log + alert). Add a small tolerance on event timestamp if you want belt-and-braces.
5. **IP allowlisting (second layer):** Razorpay webhook egress IPs (live): `52.66.75.174, 52.66.76.63, 52.66.151.218, 35.154.217.40, 35.154.22.73, 35.154.143.15, 13.126.199.247, 13.126.238.192, 13.232.194.134, 18.96.225.0/26, 18.99.161.0/26`. Verify in Cloudflare WAF custom rule (allow only these IPs to `/api/webhooks/razorpay`). Signature verification remains mandatory even with IP allowlisting (Razorpay's own recommendation).
6. **Event order is NOT guaranteed** (`payment.authorized` can arrive after `payment.captured`). State machine must be idempotent regardless of order. Treat `payment.captured` (or `order.paid`) as the credit-granting event.
7. **Only subscribe to the events you need** (e.g. `payment.captured`, `payment.failed`, `refund.created`, `dispute.created`, `dispute.won/lost`). Handle asynchronously, return 200 fast.
8. **Roll the webhook secret periodically** or on suspected compromise (Stripe pattern: old secret stays valid up to 24h for retries — Razorpay: "use the old secret for signature validation while retrying older requests").
9. **Never trust client-side confirmation.** The Checkout `callback_url`/`payment.response` is client-visible — server-side webhook (or API fetch of payment status) is the only truth. Also re-verify amount matches the order amount (`payment.amount == order.amount`, currency match) to prevent amount-manipulation.

```sql
create table webhook_events (
  event_id text primary key,        -- = x-razorpay-event-id
  type text not null,
  payload jsonb not null,
  status text not null default 'pending',  -- pending|applied|failed
  created_at timestamptz not null default now()
);
```
**Stripe parallel (if you ever add Stripe for international):** `Stripe-Signature` header, `t=` timestamp + `v1=` sig, HMAC-SHA256 over `timestamp + "." + raw_body`, 5-min default tolerance, constant-time compare, dedupe on `event.id`.

### A.4 Supabase security

**RLS — the non-negotiables (all verified against Supabase docs):**

1. **RLS enabled on every table in `public` schema.** Table Editor auto-enables; raw SQL doesn't. Add the auto-enable event trigger (Supabase docs) so a forgotten `create table` can't leak.
2. **Explicit grants, least privilege:** `anon` gets only what a logged-out visitor needs (`SELECT` on public voice catalog); `authenticated` gets row-scoped CRUD; `service_role` only ever from your server.
3. **Policy pitfalls to avoid:**
   - `auth.uid()` is `NULL` for unauthenticated requests → `using (auth.uid() = user_id)` silently denies. Write `using ((select auth.uid()) is not null and (select auth.uid()) = user_id)` and **add `to authenticated`** so anon doesn't execute policies at all.
   - **Index every column used in a policy** (user_id) — a policy without an index can turn one query into a 100ms+ full scan (Supabase benchmark: 171ms → <0.1ms).
   - Wrap `auth.uid()`/`auth.jwt()` in `(select …)` for the initPlan optimization.
   - **Views bypass RLS by default** (security definer) → use `security_invoker = true` on views, or revoke anon/authenticated access.
   - **Never authorize from `user_metadata`/`raw_user_meta_data`** (user-editable). Use `app_metadata` (e.g. `plan`, `is_banned`, `role`) which only server can write.
   - Don't use `auth.jwt()` freshness for bans — ban checks read the DB (or short-TTL cache), not the JWT.
4. **Storage buckets:** default buckets are public — set buckets `private` unless deliberately public. Enforce access with RLS on `storage.objects` (bucket_id + owner checks, folder-per-user). Generated audio should live in a **private** bucket; serve via **short-lived signed URLs** (60–300s) or stream through server. Never store raw API keys / consent documents in a public bucket.
5. **`service_role` key:** bypasses RLS entirely (storage + DB). It must exist **only in Vercel server env** (see A.5) and be rotated on leak. Note: the JS client initialized with a service key still honors the *signed-in user's* RLS — do not rely on that; just don't ship it client-side. **Never** use it in browser code, middleware that runs on the edge with client input, or `NEXT_PUBLIC_`.
6. **Auth session best practices:** use Supabase Auth with cookies (SSR mode) for the web app; enforce **email confirmation**; disable public signup endpoints you don't need; enable MFA for your admin account (and any admin user); `auth.users` is protected — extend via `profiles`; prefer short-lived access tokens (default 1h) with refresh rotation; kill sessions on password change / ban.

### A.5 Secrets management (Vercel)

1. **All secrets as Vercel environment variables** — they are encrypted at rest and per-environment (Production/Preview/Development); 64KB total/deployment (5KB per var on edge runtime).
2. **`NEXT_PUBLIC_*` = public.** Anything prefixed `NEXT_PUBLIC_` is inlined into the client bundle and visible to every user. Rule: only the Supabase `anon` key + `NEXT_PUBLIC_SUPABASE_URL` + Turnstile site key + Razorpay key ID may be public.
3. **Private env vars to keep server-only:** `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ELEVENLABS_API_KEY`, `TYPECAST_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY` (transactional email), `TURNSTILE_SECRET_KEY`, `FINGERPRINT_API_KEY` (if used).
4. **Local dev:** `.env.local` gitignored; `vercel env pull` populates it; never commit `.env*`.
5. **Rotation:** Vercel has a native secret manager — use "Secret references" (`@secret-name`) so values can rotate without redeploying; rotate Razorpay key secret + webhook secret quarterly and after any suspected leak; GitHub secret scanning + `gitleaks`/`trufflehog` in CI to catch accidental commits.
6. **Audit who can see env vars** — project access control on Vercel (limit to you + any contributors); secrets visible to anyone with project access.

### A.6 OWASP API Top 10 2023 — our mapping

| # | Risk | LugunaVoice exposure | Mitigation |
|---|---|---|---|
| API1 | Broken Object Level Authorization | `GET /voices/:id`, `GET /generations/:id` — IDOR | Every ID-scoped route checks `user_id` ownership (RLS + server check); UUIDs (unguessable) are a second layer, not a substitute |
| API2 | Broken Authentication | key/session theft | Hashed keys, HTTP-only cookies, MFA on admin, account lockout (with Cloudflare rule) |
| API3 | Broken Object Property Level Authorization | mass assignment on `profiles`/`voices` | **Whitelist-only input schemas** (zod); never `spread(req.body)`; RLS `with check` |
| API4 | Unrestricted Resource Consumption | TTS spend farming | Rate limits (A.2), char caps per request (e.g. 5k), daily caps, queue, timeouts on provider calls |
| API5 | Broken Function Level Authorization | admin endpoints | Role gate server-side (`app_metadata.role`), never client-hidden-only |
| API6 | Unrestricted Sensitive Business Flows | free tier farmed by bots/multi-accounters | Part D system (Turnstile, fingerprint, caps, referral limits) |
| API7 | SSRF | no URL-fetch feature today; TTS providers only | Never accept URLs to fetch server-side; if added later: allowlist, no private IPs (169.254/10/172.16/192.168, `localhost`), DNS rebinding guard |
| API8 | Security Misconfiguration | CORS, headers, debug endpoints | `CORS: allowlist origins`, security headers (CSP, HSTS — Vercel sends HSTS by default), no `/debug`/`/_next` exposure, staging isolated from prod data |
| API9 | Improper Inventory | old API versions live | Version the API (`/v1/`); deprecate with sunset dates; shut down test routes |
| API10 | Unsafe Consumption of APIs | trusting TTS provider responses | Validate/verify provider responses (status, content-type, size), idempotent retries, don't log provider payloads blindly |

**Injection:** all queries via Drizzle ORM (parameterized) — never string-built SQL; input validation with zod at every boundary (prevents SQLi, XSS in stored text, weird chars to TTS engines).

### A.7 Cloudflare free tier — what you actually get

| Feature | Free plan | Use it for |
|---|---|---|
| **Unmetered DDoS protection** | ✅ L3/L4 + L7 HTTP DDoS | Baseline; nothing to configure |
| **Free Managed Ruleset** (WAF) | ✅ (1 of the 5 managed rulesets; other 4 need Pro) | High-impact/widely exploited vulns — just enable it. Inspects bodies up to **1MB** on free plan |
| **WAF custom rules** | ✅ limited count (free allowance; check dashboard) | Block webhook-endpoint access except Razorpay IPs; block obvious scanners (path patterns, UA) |
| **Rate limiting rules** | ⚠️ **1 rule**, 10s counting periods, per-IP only, action = block for 10s | **One rule: `/api/auth/*` + `/api/demo/*` > 20 req/10s per IP → Managed Challenge/Block** |
| **Bot Fight Mode** | ✅ (free; Super Bot Fight Mode is Pro+) | Verify traffic is human; blocks known bots; combine with Turnstile |
| **Turnstile** | ✅ free, unlimited | CAPTCHA on signup/demo (Part D) |
| **SSL/TLS, CDN, HSTS** | ✅ | Free SSL; origin: "Full (strict)" with Vercel |
| **Workers** | ✅ 100k req/day | Edge utilities later (e.g. cheap IP-reputation checks) |

**Free-plan limitations to design around:** rate limiting is 1 rule + 10s windows + per-IP only ⇒ the **authoritative, per-user/per-key limiting must live in app code (A.2)**. The Cloudflare layer is only the "cheap first wall". Upgrading to Pro ($20/mo) adds: Cloudflare Managed Ruleset, 2 rate-limiting rules, longer windows, Super Bot Fight Mode — a sensible v2 purchase once abuse shows up.

---

## PART B — PAYMENT & FRAUD

### B.1 Payment fraud (cards, chargebacks, Razorpay risk)

**What Razorpay does for you (verified):**
- **Hotlist checking** on every card payment (blocked/stolen cards rejected).
- **Geographical + pattern-based transaction monitoring**.
- Flags fraudulent chargebacks for review; Risk Analytics Dashboard with **fraud-to-sales ratio, dispute-to-sales ratio, risk-decline rate** and the ability to create **block rules** (available on international-payments accounts).
- **PCI-DSS Level 1, ISO 27001, SOC 2 Type 2**; you never touch raw card data (Razorpay-hosted checkout/tokenization).

**What you must do (merchant-side):**
1. **Keep 3DS2 on.** Razorpay handles Indian OTP/3DS flows. For international cards, **non-3DS is opt-in by approval and explicitly states: "these payments are prone to a higher risk of fraud and chargebacks; liability lies with the seller."** Default answer: never enable non-3DS. (3DS2 shifted card-not-present liability to issuers — this is your single biggest fraud-control lever.)
2. **Risk scoring before granting credits (manual review queue):** auto-flag an order for manual review when heuristics fire — new account + first purchase is high value; card country ≠ IP country; billing email is fresh; >X failed attempts; repeated purchase+refund pattern. Rule of thumb: delay credit grant by a few minutes for flagged orders until reviewed (credits are instantly consumable — the fraud window is "pay → instantly synthesize content → chargeback").
3. **Watch your ratios:** dispute-to-sales ratio should stay < 1% (card networks penalize above ~1%; >0.75% from some acquirers). Razorpay dashboards report both.
4. **Chargeback handling:** subscribe to dispute webhooks (`dispute.created`, `dispute.accepted`, etc.); maintain evidence (order, invoice, IP/fingerprint record, usage logs, consent records for cloned voices); contest via Razorpay representment with that evidence. Never refund-and-ignore beyond cost threshold — each uncontested dispute hurts your ratio.
5. **AVS for international cards:** Razorpay offers Address Verification System for international payments — use it as a signal (not a hard gate) on higher-value orders.
6. **Refund abuse:** credits are consumable digital goods — policy = **credits non-refundable once used** (ElevenLabs ToS pattern); refunds only before meaningful usage and only via manual review; refund once per account for first-time buyers.

### B.2 Free-credit & referral abuse

Threat: attacker creates N accounts → collects N free tiers → farms TTS (cost: your provider spend + marketing budget), or refers themselves in a loop.

**Layered controls (cheap → expensive):**

1. **Turnstile on signup + demo (free).** Server-side `siteverify` with the secret key; treat failure as hard reject. Invisible/managed mode keeps UX clean.
2. **Email verification mandatory** (Supabase Auth `email confirm required`). Free credits granted only after verification + first real generation.
3. **Disposable-domain blocklist** — `github.com/disposable-email-domains/disposable-email-domains` (CC0, 5.4k★, used by PyPI). ~3,500 domains; bundle the `.conf` in the build (update weekly via CI) and match registrable domain (handle public-suffix wildcards per repo README — match `yyy.zzz` when `zzz` is a public suffix).
4. **Device fingerprinting — FingerprintJS.** Open-source `fingerprintjs` (MIT, 28k★) is free but client-side only (spoofable, lower accuracy). **Fingerprint Pro** (cloud, 99.5% identification accuracy, "Smart Signals": bots, VPN/incognito, browser tampering; GDPR/ISO/SOC2 compliant; free tier ~500 monthly identifications, paid from ~$99/mo) gives a **server-verified visitorId**. Use the free open-source version at MVP → upgrade to Pro when multi-accounting appears. Policy: **flag >2 accounts sharing one `visitorId`** for manual review; hard-block >3.
5. **Referral limits (hard caps):**
   - ≤ 1 referral credit per **referrer per 30 days** (per IP AND per account).
   - Referral credit granted only when the referee **verifies email AND completes first paid-quality generation** (not just signup).
   - Referral credit capped (e.g. 1,000 credits = a few cents' real cost) and expires in 30 days.
   - Track referrer IP hashes; deny self-referral loops (same IP/device/email domain).
6. **Free-tier guardrails:** free credits expire (30 days), not refundable, not transferable (ElevenLabs pattern). Cap free-tier TTS quality (edge-tts only) so farming costs *you* nothing but CPU.
7. **Demo/guest mode:** Turnstile + per-IP daily cap + no audio download link without account (or watermarked/limited-length).

### B.3 Razorpay from an Indian entity — specifics

- **Entity/KYC:** Razorpay requires Indian business KYC (PAN/GST, bank account). Your **legal entity is the merchant** — fine for a Pvt Ltd / LLP / proprietorship.
- **Domestic:** UPI, cards, netbanking, wallets; settlement T+2 days typically; instant settlements available.
- **International cards (foreign-issued):** enable under "International Payments" (Dashboard → Settings → Payment Methods). Needs purpose code (FIRS — "Foreign Inward Remittance Certificate" — for import of services; Razorpay auto-generates FIRS certificates for cross-border), currency conversion, and **settlement in INR** to your Indian account. International card fees are higher; keep 3DS on (B.1).
- **PA-CB licence:** Razorpay holds RBI Payment Aggregator – Cross Border licence — cross-border is fully regulated, so you don't need separate approvals; you just follow their enablement flow.
- **API auth:** Basic auth with `key_id:key_secret`; keep key secret server-side; use test mode + test cards for dev; never log credentials.
- **Refunds:** Razorpay refund API; instant refunds for eligible methods; log refunds to the credit ledger (append-only `credit_ledger`).
- **GST/TCS:** charge GST on digital services per Indian rules; Razorpay invoices help with reconciliation.

---

## PART C — CONTENT SAFETY & CLONING ABUSE

### C.1 Content moderation before TTS

Since your API takes **text → speech**, the moderation point is the **input text** (and voice metadata). Options:

| Option | Cost | Coverage | Verdict |
|---|---|---|---|
| **OpenAI Moderation API** (`omni-moderation-latest`) | **Free** | Text (+image); categories: `harassment`, `hate`, `illicit`, `self-harm`, `sexual` (incl. minors), `violence`; per-category scores + `flagged` | **Primary.** Block on `flagged`; queue on category-score thresholds |
| Perspective API (Jigsaw) | Free tier | Toxicity/identity-attack scores, multi-language, no cost | Secondary signal for multilingual toxicity; can run in parallel at MVP |
| Blocklist/regex (bad-words libs) | $0 | Curse words only; trivial to evade | Only as a cheap pre-filter, never as the gate |
| Provider-side policy | — | ElevenLabs/Deepgram/Typecast each ban harmful content and impersonation in ToS; they may reject/flag usage | Legal backstop, not a control |

**Recommended pipeline (per generation request):**
```
input text → [length cap 5k chars] → [regex pre-filter (cheap)] → [OpenAI moderation]
   ├─ flagged            → reject 400 (or 451-style policy rejection), log, count toward user flags
   ├─ score > review_t   → allow, but enqueue moderation_flags(severity=medium)
   └─ clean              → forward to TTS provider
```
Also moderate **voice names/descriptions** on clone creation (a cloned voice named "Narendra Modi Clone" is a policy tripwire, even with a consent checkbox).

Note: OpenAI moderation doesn't classify audio — but since we moderate the *input text*, that's sufficient for TTS. (If you later add STT, moderate the transcript.)

### C.2 Voice cloning abuse

**Provider-side controls (what the ecosystem already does — mirror it):**
- **ElevenLabs "No-Go Voices":** automatic blocking of clones approximating prominent public figures' voices; blocked voices are removed; violations → warnings, voice removal, account bans, law-enforcement cooperation.
- **ElevenLabs PVC verification:** Professional Voice Cloning requires **manual verification** — `POST /voices/pvc/{voice_id}/verification` accepts proof documents (consent records) for the speaker.
- **ElevenLabs watermarking:** every generation carries an imperceptible digital watermark; an **Audio Detector** tool verifies whether audio came from ElevenLabs. Watermarking does not affect quality/latency and helps you trace leaked audio back.
- **OpenAI's stated approach (Voice Engine):** explicit + informed consent from the original speaker required; partners must disclose AI voices to audiences; watermarking to trace origin; recommended "voice authentication experiences" (speaker verification, i.e. **voiceprint**) and a **no-go voice list** for prominent figures; usage policies prohibit impersonation without consent.
- **Deepgram/Typecast:** no cloning product (Deepgram) — cloning abuse surface is mainly ElevenLabs-backed for us.

**LugunaVoice cloning controls (design):**
1. **Consent capture at clone creation:** checkbox + typed consent statement + timestamp + hash of the voice sample stored in `consent_records` (user_id, voice_id, consent_at, method, sha256 of sample). Hard-required before the clone is usable.
2. **Verification for high-fidelity clones:** route through a provider with verification (ElevenLabs PVC verification endpoint) — upload proof documents when requested.
3. **Public-figure refusal:** blocklist of public-figure names (Indian + global: politicians, actors, celebrities) on voice *names* and *descriptions*; rely on ElevenLabs No-Go on the audio side; document refusal reason to the user.
4. **Voiceprint check (v2):** when a clone is first used, compare against provider voiceprint/similarity signals where exposed; flag suspicious matches.
5. **Watermarking (free with provider):** rely on ElevenLabs watermarking + Audio Detector for traceability; add **C2PA Content Credentials** metadata (provenance: "created with LugunaVoice, AI-generated, cloned voice X, consent on file") when the provider exposes C2PA (ElevenLabs has been building this; OpenAI is C2PA steering member). C2PA = the emerging interoperable standard (Adobe/Google/Meta/Microsoft/OpenAI/TikTok).
6. **Audit trail:** every clone generation logs voice_id, input hash, user, timestamp → supports abuse takedowns and disputes.

### C.3 Deepfake regulation — practical obligations for a small platform

**EU AI Act (Regulation 2024/1689) — the binding one:**
- **Art. 50(2) (providers of synthetic audio systems):** outputs must be **marked machine-readable and detectable as AI-generated** — i.e. watermarks/metadata, as technically feasible. Applies to us as the platform providing TTS. **In force from 2 August 2026.**
- **Art. 50(4) (deployers):** when users generate audio that could be presented as real ("deepfake"), they must disclose it's AI-generated (subject to the artistic/satirical carve-out).
- Practical compliance for LugunaVoice: (a) watermark/metadata every output (provider watermarking + C2PA labels), (b) UI disclosure ("This audio was AI-generated"), (c) ToS requiring end-users to disclose when publishing deepfakes, (d) keep the consent/verification records above.
- No high-risk classification applies to standard TTS; no EU rep needed (SME threshold for Art. 27 EU-representative doesn't apply to Art. 50). Fines up to €35M/7% for prohibited-practice breaches — but Art. 50 transparency is far lighter (max €7.5M/1% band, enforced by national authorities).
- **EU AI Act timeline (recap):** prohibited practices (Art. 5) applied 2 Feb 2025; GPAI obligations Aug 2025; **Art. 50 transparency from 2 Aug 2026**.

**US — state-level (no federal law yet):**
- ~20+ states now regulate deepfakes (e.g. **Tennessee ELVIS Act 2024** — first law protecting a person's *voice* as property, criminalizes AI voice clones without consent; California/Illinois/NY/WA have digital-replica/impersonation laws; **FTC impersonation rule** (2024) bans AI impersonation of government/businesses).
- Practical stance: honor the most protective baseline — **consent before cloning a real person's voice + takedown/abuse process** — since "the person whose voice is cloned" may be protected in any US state.
- Federal "No Fakes Act" is pending (not law as of this writing).

**For a solo-dev Indian company:** the risk is reputational/legal-in-jurisdiction-of-users, not regulatory audits. Doing consent-verification, no-go refusal, watermarking, and a takedown path covers the overwhelming majority of the practical exposure in both EU and US markets.

### C.4 GDPR basics for a small operator

(Applicable only insofar as you process data of EU/EEA persons — with an Indian entity, that's when you market to/serve EU users. Same principles apply under India's **DPDP Act 2023**.)

1. **Lawful basis (Art. 6):** contract (account, delivery of service) + legitimate interest (fraud/abuse prevention) + consent (marketing, optional retention of voice samples). Record basis per purpose.
2. **Data minimization (Art. 5(1)(c)):** collect only what's needed — email, name, payment references (no card data — Razorpay holds it), voice samples only with consent.
3. **Storage limitation (Art. 5(1)(e)):** voice samples: delete after cloning completes unless user opts into retention; generation text: retain for abuse/audit (anonymize/hash after 90 days); logs: capped retention (e.g. 90 days); audit table for abuse flags kept longer only where justified.
4. **DPA (Art. 28):** sign DPAs with every processor: **Supabase (has DPA)**, **Vercel (DPA)**, **Razorpay**, **ElevenLabs (DPA exists)** , Typecast, Deepgram, OpenAI (moderation — they are a processor of the text you send), Resend. Use the provider templates; you are controller, they are processors.
5. **Rights (Art. 12–23):** access, rectification, erasure (delete account → cascade delete samples/recordings; keep billing records per legal retention), export (portability).
6. **Security (Art. 32):** TLS everywhere, hashed keys (A.1), RLS (A.4), audit logs, breach response plan (notify authority ≤72h under Art. 33 where EU persons affected).
7. **Breach notification:** your processors must notify you (they do contractually); you notify users/authority where required.
8. **Small-operator carve-outs:** no DPO required (unless special-category data at scale); Article 30 processing records — required for 250+ employees only, but keep a one-page record anyway (cheap accountability).
9. **Consent for cloning = separately collected, granular, withdrawable** (Art. 7) — do not bury it in ToS.

---

## PART D — ABUSE-DETECTION ARCHITECTURE (MVP, solo dev)

### D.1 Architecture diagram

```
Browser ──► Cloudflare (Free): DDoS · Free Managed Ruleset · 1× rate-limit rule (auth/demo per-IP 10s) · Bot Fight Mode · Turnstile widget
                │
                ▼
          Next.js (Vercel)
          ├─ /auth/*        → Turnstile verify → email+disposable check → Supabase Auth
          ├─ /api/tts/*     → [auth or key] → rate limit (token bucket) → user_limits daily cap
          │                   → moderation (OpenAI, free) → provider router (edge/Typecast/Deepgram)
          │                   → watermark/metadata → credit ledger debit (atomic) → response
          ├─ /api/webhooks/razorpay → CF allowlist (Razorpay IPs) → HMAC verify → dedupe(event_id) → apply
          └─ /api/admin/*   → role-gated (app_metadata.role) → flag queue UI
                │
                ▼
        Supabase (Postgres + Storage + Auth)
        ├─ RLS everywhere · hashed keys · ledger append-only
        ├─ events: generation_events · auth_events · webhook_events
        ├─ flags: moderation_flags · abuse_flags · user_risk
        └─ storage: private buckets (audio) + signed URLs
```

### D.2 Components

1. **Turnstile on signup/demo** (free, managed mode, server-side `siteverify`). Also serve as a "challenge" on repeated demo abuse.
2. **Email verification + disposable-domain blocklist** (A/B): Supabase email confirmation + `disposable_email_blocklist.conf` bundled (weekly CI refresh).
3. **Per-user daily caps** (`user_limits` exists in schema): edge-tts 100k chars/day free; premium credits = prepaid; demo: per-IP cap (e.g. 2k chars/day).
4. **API rate limits** (A.2): token bucket per user + per key; per-IP on guest endpoints; `X-RateLimit-*` headers.
5. **Anomaly detection via event tables:** every generation inserts a row into `generation_events(user_id, api_key_id, ip_hash, provider, chars, text_hash, moderation_score, created_at)`. Cheap aggregate queries run on a schedule (pg_cron / Supabase Cron) or on-the-fly with indexes:
   - `> N generations/min` (e.g. 10/min sustained) → flag.
   - `> M chars/hour` (e.g. 50k/hour on free) → flag/limit.
   - new-account burst: `signup → first generation < 60s` + `> 3 keys created in a day` → flag.
6. **Admin flag queue:** `moderation_flags` + `abuse_flags` tables; a single `/api/admin/flags` endpoint + minimal admin page. Solo dev = the queue is a weekly-review list + email alert (Resend) for `severity=critical`.
7. **Auto temp bans:** on threshold breaches → set `profiles.banned_until` (or `is_banned`) via server (RLS checks DB, not JWT). Ban lengths escalate (24h → 7d → permanent). Reversed by admin after review.
8. **Cloudflare bot fighting:** Bot Fight Mode on; free rate-limit rule on `/api/auth/*` + `/api/demo/*`; WAF custom rule to protect webhook path.

**Event table (keep it lean — one insert per generation is fine):**
```sql
create table generation_events (
  id bigint generated always as identity primary key,
  user_id uuid,                    -- null for guest demo
  api_key_id uuid,                 -- null for web app
  ip_hash text,                    -- sha256(ip + pepper), NOT raw IP
  provider text not null,
  chars int not null,
  text_hash text not null,         -- sha256 of input (for duplicate detection)
  moderation_score numeric,
  status text not null,            -- ok|rejected|flagged
  created_at timestamptz not null default now()
);
create index on generation_events (user_id, created_at desc);
create index on generation_events (ip_hash, created_at desc);
```
> **Privacy note (GDPR/DPDP):** store `ip_hash` with a server-side pepper, never raw IPs long-term; cap retention (90 days) with a cleanup job; `text_hash` lets you detect repeated abuse without storing PII content.

### D.3 Rules table (rule → trigger → action)

| # | Rule | Trigger | Action (automatic unless noted) |
|---|---|---|---|
| R1 | Human check | Turnstile `siteverify` fails on signup/demo | Reject request; log `auth_events(ip_hash, reason=turnstile)`; rate-limit IP |
| R2 | Disposable email | Signup email domain in blocklist | Reject signup (generic message); no credit; log |
| R3 | Unverified email | TTS request from email not confirmed | 403 + verify prompt |
| R4 | Auth brute force | >20 req/10s per IP on `/api/auth/*` | **Cloudflare rule** → block 10s (free plan) |
| R5 | Demo abuse | >2k chars/day or >5 gens/day per IP | 429; require account |
| R6 | Per-key burst | >60 rpm or token bucket empty | 429 + `Retry-After`; `X-RateLimit-*` |
| R7 | Per-user daily cap | `user_limits` quota exhausted | 429/402 "upgrade" prompt; no provider call |
| R8 | Generation burst | >10 gens/min or >50k chars/hour (free) | Flag `abuse_flags(user_id, severity=high)`; temp-ban 24h if repeat |
| R9 | New-account burst | signup→>5 gens in first 5 min | Flag medium; cap free tier; temp-ban 24h |
| R10 | Moderation hit | OpenAI moderation `flagged` | Reject 400; increment user flags; flag queue (auto-ban after 3 strikes) |
| R11 | Suspicious score | category score > threshold but not flagged | Allow; enqueue `moderation_flags(medium)` for weekly review |
| R12 | Multi-account | same Fingerprint `visitorId` on >2 accounts | Flag cluster (manual review); block >3 |
| R13 | Referral loop | same IP/device refers >1 account/30d or self-referral | Deny credit; flag referrer |
| R14 | Refund abuse | 2nd refund request, or refund>usage, or chargeback | Manual review only; no auto-refund of used credits |
| R15 | Chargeback | `dispute.created` webhook | Suspend affected account's instant-credit top-ups; review queue; evidence pack |
| R16 | Stolen/compromised key | key used from new geolocation + scope mismatch | Require re-auth (dashboard challenge); alert; auto-rotate |
| R17 | Cloned-voice policy | clone name/desc matches public-figure blocklist | Reject clone creation; log; (provider No-Go is backstop) |
| R18 | Missing consent | clone used but `consent_records` absent | Block generation with that voice; flag |
| R19 | Webhook replay | `x-razorpay-event-id` duplicate | 200, no-op (idempotency) |
| R20 | Webhook forgery | HMAC invalid / non-Razorpay IP | 400, alert |
| R21 | Bot traffic | Cloudflare Bot Fight Mode triggers | Managed challenge (CF) |
| R22 | Scanner/abuse path | Path/UA match WAF custom rule | Block (CF) |
| R23 | Banned user | `is_banned` / `banned_until > now()` | 403 on all API; block new keys; login blocked |
| R24 | Ledger anomaly | credit_ledger delta ≠ generation_events sum (reconcile daily) | Alert; pause affected account |

### D.4 Escalation policy (solo dev, sane defaults)

- **Tier 1 — auto-reject (no human):** R1–R8, R10, R18–R22, R23, R24. Zero effort required.
- **Tier 2 — auto-flag + batch review (weekly 30 min):** R9, R11, R12, R13, R16.
- **Tier 3 — real-time alert (email/phone push):** R15 (chargeback), R20 (forged webhook), R24 (ledger), any payment anomaly. These are the only things that wake you up.
- **Ban ladder:** first offense 24h → second 7 days → third permanent. Every ban writes an `abuse_flags` row so decisions are reversible/auditable.

### D.5 CAPTCHA + fingerprinting recommendation (final)

- **CAPTCHA: Cloudflare Turnstile (managed mode)** — free, invisible-by-default UX, server-side verification, no reCAPTCHA enterprise cost, and it's the same vendor as your WAF (one dashboard). Use on: signup, guest demo, and as a challenge when R5/R8 trip (progressive challenge).
- **Fingerprinting: FingerprintJS.** Start with the **free open-source `fingerprintjs`** (client-only visitorId stored per browser; good enough to catch casual multi-accounters). Upgrade to **Fingerprint Pro** (server-verified IDs + Smart Signals for bots/VPN) only when your abuse report shows multi-accounting is costing more than the subscription (~$99+/mo) — the free-tier credit cap (R7) already caps the damage from a single fake account, so Pro is a *cost-driven* decision, not a launch blocker. Rationale: at MVP the marginal value of Pro-grade IDs is small because free-tier payout per account is tiny; you protect the *platform* with caps and the *identity* layer later.
- **Privacy note:** fingerprint data is personal data under GDPR — disclose in privacy policy, offer opt-out (degrade to email+IP heuristic), and follow Fingerprint's GDPR guidance.

---

## SECURITY CHECKLIST (actionable items)

**Auth & API keys**
- [ ] API keys: CSPRNG (≥192-bit), SHA-256 at rest, prefix display, shown once
- [ ] Constant-time key comparison; keys only in `Authorization` header
- [ ] Scopes (`tts/voices/clone`) + per-key rate limits + expiry
- [ ] Rotation endpoint with 24h grace overlap; auto-expire unused keys (90d)
- [ ] Revocation checked per request; 401 on revoked
- [ ] No API keys in URLs, logs, or client bundles (scan CI: gitleaks/trufflehog)
- [ ] Supabase email confirmation ON; MFA on admin account
- [ ] zod whitelist validation on every input; no mass assignment (OWASP API3)

**Rate limiting**
- [ ] Token bucket per-user + per-key (Postgres now, Redis later)
- [ ] Per-IP limiter on unauthenticated endpoints
- [ ] `X-RateLimit-*` + `Retry-After` on 429
- [ ] Cloudflare free rate-limit rule (1 rule): `/api/auth/*` + `/api/demo/*` per-IP 10s
- [ ] Daily caps in `user_limits` enforced before provider calls

**Webhooks**
- [ ] Razorpay HMAC-SHA256 verify on RAW body (`Utils.verifyWebhookSignature`)
- [ ] Dedupe on `x-razorpay-event-id` with unique constraint
- [ ] IP allowlist (Razorpay egress IPs) at Cloudflare for `/api/webhooks/*`
- [ ] Order-independent state machine; `payment.captured` grants credits only
- [ ] Amount/currency re-verify against order; respond 200 fast, process async
- [ ] Roll webhook secret quarterly + on suspicion; log all webhook events

**Supabase/DB**
- [ ] RLS enabled on ALL public-schema tables (+ auto-enable trigger for new ones)
- [ ] Policies scoped `to authenticated` with `(select auth.uid())` + `is not null`
- [ ] Index all policy columns; `security_invoker=true` on views
- [ ] No auth from `user_metadata`; roles/plan/bans in `app_metadata`
- [ ] service_role key server-only, never `NEXT_PUBLIC_`
- [ ] Storage buckets private; audio via short-lived signed URLs; RLS on `storage.objects`
- [ ] Append-only `credit_ledger`; unique idempotency keys; reconcile daily
- [ ] Stored data encrypted (Supabase at-rest encryption default)

**Secrets (Vercel)**
- [ ] All secrets as Vercel env vars (encrypted at rest), per-environment
- [ ] Vercel native secret manager + secret references for rotatable values
- [ ] `.env.local` gitignored; `vercel env pull` workflow; never commit `.env*`
- [ ] Vercel project access limited; team secrets only where shared
- [ ] Quarterly rotation: Razorpay key secret, webhook secret, provider keys

**Edge & transport**
- [ ] Cloudflare: Free Managed Ruleset enabled; Bot Fight Mode on; SSL Full (strict)
- [ ] HSTS (Vercel default), CSP + security headers via `next.config.ts`/headers
- [ ] CORS allowlist for the public API; no wildcard origins
- [ ] No SSRF surface: no server-side URL fetching; validate all third-party URLs (OWASP API7)

**Payments & fraud**
- [ ] 3DS2 ON for all cards; never enable non-3DS international (liability)
- [ ] Risk heuristics → manual review queue for first-time/high-value orders
- [ ] Dispute webhooks + evidence pack (order, IP hash, usage, consent record)
- [ ] Watch fraud-to-sales & dispute-to-sales (<1%) in Razorpay Risk dashboard
- [ ] Refunds: manual-only after usage; once-per-account auto-allow
- [ ] Ledger reconciliation against Razorpay settlement reports (daily)

**Signup & free tier**
- [ ] Turnstile on signup + demo, server-side verify
- [ ] Disposable-domain blocklist (weekly CI refresh)
- [ ] Free credits after email verification only; expire 30d; non-refundable
- [ ] Referral: 1/30d per IP+account; credit only after referee's first generation
- [ ] FingerprintJS visitorId stored; >2 accounts/device flagged, >3 blocked

**Content safety**
- [ ] OpenAI Moderation on every TTS input; block on `flagged`
- [ ] Review queue for medium-severity scores; 3-strikes auto-ban
- [ ] Clone consent: checkbox + timestamp + sample hash in `consent_records`
- [ ] Public-figure blocklist on clone names/descriptions
- [ ] Provider verification flow (ElevenLabs PVC verification) for high-fidelity clones
- [ ] Watermark/metadata on outputs (provider watermarking + C2PA labels)
- [ ] ToS: AI-disclosure requirement for end users (EU AI Act Art. 50)

**Privacy/compliance**
- [ ] DPA signed with Supabase, Vercel, Razorpay, ElevenLabs, Typecast, Deepgram, OpenAI, Resend
- [ ] Privacy policy: what's collected, fingerprinting disclosed, retention periods
- [ ] Voice samples deleted after cloning unless opted-in; generation text hashed after 90d
- [ ] Account deletion → cascade delete samples/recordings (keep billing records)
- [ ] Breach response runbook (72h notification path for EU users)
- [ ] 1-page record of processing activities (even though not mandatory <250 staff)

**Ops**
- [ ] Sentry + error alerts; alert ONLY on critical (R15/R20/R24)
- [ ] Backups + point-in-time recovery enabled on Supabase; test restore
- [ ] Weekly 30-min abuse review using the flag queue
- [ ] Dependency updates (Dependabot) + lockfile discipline
- [ ] Staging isolated from production data/keys

---

## SECURITY ROADMAP

### MVP (launch — must have, mostly zero/low cost)
- Hashed/scoped/revocable API keys; rotation endpoint
- Token-bucket rate limiting (Postgres) + `X-RateLimit-*` + daily caps
- Razorpay webhook HMAC verify + event-id dedupe + IP allowlist
- RLS everywhere + service_role server-only + private storage buckets + signed URLs
- Vercel env secrets (no `NEXT_PUBLIC_` secrets), Dependabot, gitleaks in CI
- Cloudflare free: Managed Ruleset, Bot Fight Mode, 1 rate-limit rule on auth/demo, Turnstile on signup+demo
- Email verification + disposable-domain blocklist
- OpenAI Moderation on all inputs + 3-strikes auto-ban
- `generation_events` + burst rules (R8/R9) + auto temp bans (24h) + admin flag queue
- Referral limits (R13), free-credit expiry, refund policy
- Consent capture on cloning + public-figure name blocklist + provider watermarking
- Security headers (CSP/HSTS), CORS allowlist, zod everywhere
- Privacy policy + DPAs with all processors

### v2 (weeks 2–8 post-launch / first abuse signals)
- Redis/Upstash rate limiting (per-key burst accuracy), sliding windows on auth
- FingerprintJS Pro if multi-accounting costs > subscription; device cluster bans
- Manual review queue UI + evidence pack generation for disputes
- Progressive Turnstile challenges (interactive mode) on flagged flows
- Provider failover + provider API budget alarms (spend kill-switch per provider)
- PII minimization job: hash IPs, cap event retention (90d), auto-delete stale voice samples
- Email alerting on critical rules (R15/R20/R24) via Resend
- Pen-test pass (self + optionally a friend) against API1–API7 mapping
- C2PA Content Credentials integration where provider supports it; watermark on all tiers

### Scale (post-PMF / multi-region / team)
- Cloudflare Pro/Business ($20+/mo): Cloudflare Managed Ruleset + OWASP Core Ruleset, >1 rate-limit rules with longer windows, Super Bot Fight Mode
- Centralized abuse platform: risk-scoring per user (weighted signals → 0–100 score), full auto-ban orchestration, appeals flow
- Dedicated rate-limiting service (Upstash/Tinybird) + request-level tracing
- Bot Management (paid) if API abuse at scale; JA3 fingerprinting
- Fraud team workflows: dispute representment tooling, chargeback analytics, KYC gating for bulk usage
- AI Act compliance pack: watermark verification API, provenance endpoints, disclosure badges for EU users (post-2-Aug-2026)
- SOC 2 Type I/II readiness (needed when enterprise customers ask); Vanta/Drata if pursued
- Security budget line items: bug bounty (HackerOne-style, tiny), pen-test retainer

---

## Key sources
- Razorpay: docs — webhooks (validate-test, best-practices, whitelists/egress IPs), security (PCI-DSS L1 / ISO 27001 / SOC 2), non-3DS (liability), Risk Analytics Dashboard, international cards/AVS, llms.txt index
- Stripe: docs — webhook signatures (HMAC, t/v1 schemes, 5-min tolerance, constant-time compare, secret rolling, event-id dedup)
- Supabase: docs — Row Level Security (policies, grants, views/security_invoker, security definer, performance), Storage Access Control (private buckets, policies, service key bypass)
- Cloudflare: docs — Turnstile (managed/non-interactive/invisible, siteverify), WAF Managed Rules (Free Managed Ruleset availability; 1MB body limit free), Rate limiting rules (free = 1 rule, 10s, per-IP), plans page (unmetered DDoS free)
- OWASP API Security Top 10 (2023 edition), API4/API6/API7 as primary TTS-relevant items
- OpenAI: Moderation API guide (`omni-moderation-latest`, free, categories/scores, flagged), Voice Engine safety post (consent, voice auth, no-go list, watermarking, disclosure)
- ElevenLabs: No-Go Voices, PVC verification API (`POST /voices/pvc/{voice_id}/verification`), Audio Detector/watermarking FAQ, ToS (consent, credits final-sale, Prohibited Use Policy)
- EU AI Act Art. 50 (artificialintelligenceact.eu — applies 2 Aug 2026; provider machine-readable marking + deployer deepfake disclosure), AI Act timeline
- C2PA (c2pa.org — Content Credentials provenance standard; Adobe/Google/Meta/Microsoft/OpenAI/TikTok)
- GDPR Art. 5 & 28 (gdpr-info.eu); DPDP Act 2023 (India) as parallel framework
- github.com/disposable-email-domains (CC0 blocklist, PyPI usage), FingerprintJS (open-source + Pro, Smart Signals, GDPR/SOC2), Vercel docs (env vars encrypted at rest, 64KB limit, HSTS/TLS)
