# LugunaVoice — API & Payments Design (v2)

> v2 additions: streaming endpoint, cloning endpoint with consent, long-form jobs, webhooks, per-provider voice params, error codes for moderation/abuse.

---

## 1. API Overview

- Base URL: `https://api.lugunavoice.com/v1`
- Auth: `Authorization: Bearer lug_...` (per-user, scoped, hashed at rest)
- Content: JSON; errors `{ "error": string, "code": string }`
- Idempotency: `Idempotency-Key` on mutating calls (unique constraint → never double-billed)
- Rate limits: token bucket per key; headers `X-RateLimit-Limit / Remaining / Reset`; free 10 rpm / paid 60 rpm; concurrency free 1 / paid 3 (+ long-form queue)

## 2. Endpoints

### `POST /v1/tts/generations` — create (async + poll)
```jsonc
{ "text": "…",                       // ≤2000 flagship/premium · ≤10000 free
  "voice": "fs_voice_…",
  "style": "happy",                  // typecast emotion | edge style | deepgram speed+IPA
  "pitch": 0, "rate": 1.0,           // optional
  "ipaOverrides": [{"word":"read","pronounce":"/riːd/"}],   // deepgram only (flagship)
  "longForm": false,                 // true → chunk worker, returns job
  "subtitles": true }                // returns subtitlesUrl when provider supports
// 202 → { "id": "gen_…", "status": "processing", "estimatedCredits": N }
```
- free tier: 0 credits, daily cap → `429 daily_limit_exceeded`
- premium: 1 cr/char; flagship: 2 cr/char → `402 insufficient_credits`
- moderation block → `400 content_policy` (3 strikes → ban via abuse system)
- `subtitles:true` on flagship → **SRT via Deepgram STT round-trip** (~$0.0043/min, no extra user charge at launch; surfaced in COGS)

### `POST /v1/transcriptions` — audio → transcript + SRT (v2)
```jsonc
{ "audioBase64": "…", "diarize": false, "language": null }   // ≤10 min at launch
// 201 → { "id":"tr_…", "status":"processing" } → poll GET /v1/transcriptions/:id
// completed → { transcript, subtitlesUrl (srt), durationMs, creditsCharged }
```
- Powered by Deepgram Nova-3 STT (word timestamps free, `@deepgram/captions`). Billing: 1 credit ≈ 1 min of audio (COGS $0.0043/min → huge margin, nice upsell).
- Also serves as the engine behind the Studio "upload audio → script" tool.

### `GET /v1/generations/:id` — poll
```jsonc
{ "id":"gen_…", "status":"completed",
  "audioUrl":"https://…/audio.mp3", "audioMime":"audio/mpeg",
  "durationMs": 6750, "creditsCharged": 1200,
  "subtitlesUrl":"https://…/gen_….srt",
  "chunks": {"total": 12, "done": 12, "failed": 0} }   // long-form progress
```
`status`: queued → processing → completed | failed | refunded | cancelled. Refunded = provider failed, credits returned.

### `POST /v1/tts/stream` — WebSocket streaming (flagship)
- Upgrade `wss://api.lugunavoice.com/v1/tts/stream?voice=fs_…&authorization=Bearer lug_…`
- Client sends `{ text, style?, rate? }` → relay opens Deepgram `/v1/speak` WS → binary audio chunks (linear16 16kHz) streamed back.
- Billing: 2 cr/char debited on first chunk; partial-chars refunded on `{type:"cancel"}`.
- Limits: max 1 active stream/user; 45 total relays (Deepgram cap) → `429 streaming_busy`.

### Deepgram async callbacks (internal, M5)
- Deepgram `callback_method=POST` → `POST /api/deepgram/callback` (webhook verified, dedup by generation_id, 10 retries/30s built into Deepgram) → finalize generation. Polling stays as fallback.

### `POST /v1/voices/clone` — custom voice (grant-based)
```jsonc
{ "sampleBase64": "…",          // 5–150s WAV/MP3
  "name": "My Narration Voice", "language": "eng",
  "consent": true,              // REQUIRED attestation
  "sampleHash": "sha256:…" }    // client digest for rights proof
// 201 → { "voice": "fs_voice_…", "provider": "typecast", "status": "ready" }
```
- Requires `cloning_enabled` + slot available (50 Lite) → `403 cloning_not_enabled` / `409 slots_exhausted`
- Consent row stored immutably (who/voice/hash/ip/date) before provider call
- Clone is **owner-only** in catalog & API (RLS)
- `DELETE /v1/voices/:id` (custom) → removes clone everywhere

### `GET /v1/voices` — catalog
`?provider=&tier=free|premium|flagship&language=&gender=&q=&limit=&offset=` → cached 5 min. Custom voices included only for owner.

### `GET /v1/me` — account
`{ email, plan, creditsBalance, monthlyUsage: {edgeChars, premiumCredits, flagshipCredits}, limits: {maxChars, concurrency, maxStreams} }`

### Errors (stable)
| HTTP | code |
|---|---|
| 400 | invalid_request · content_policy · unsupported_for_voice (e.g. ipaOverrides on typecast) |
| 401 | invalid_api_key |
| 402 | insufficient_credits |
| 403 | cloning_not_enabled · forbidden |
| 404 | not_found |
| 409 | idempotency_conflict · slots_exhausted |
| 429 | rate_limited · daily_limit_exceeded · concurrent_limit · streaming_busy |
| 503 | voice_engine_unavailable (provider kill-switch/down) |

### `GET /v1/me` — account & usage (extended)
`{ email, plan, creditsBalance, monthlyUsage: {edgeChars, premiumCredits, flagshipCredits, transcriptMinutes}, limits: {maxChars, concurrency, maxStreams} }`

---

## 3. Payments (Razorpay + manual)

```
buy pack/plan ─▶ POST /api/payments/checkout {packSlug|planSlug}
   → credit_order/ subscription row (pending) + Razorpay Payment Link → user pays (UPI/intl card, 3DS on)
   → webhook POST /api/payments/webhook  (HMAC-SHA256 raw body; dedupe x-razorpay-event-id)
   → verified payment.captured:
       order→paid · ledger credit · balance += · referral bonus (if ref) · subscription allowance (if plan)
   → email receipt (Resend) · UI poll on order
manual: WhatsApp order → admin creates manual_pending → UPI paid → admin confirm → same txn
```
- **Never** credit on unverified/`authorized`-only events. Chargeback → suspend + evidence pack (abuse R7).

---

## 4. Long-form job flow (API-facing)

```
POST /v1/tts/generations {longForm:true, text:120K}
  → generations row (kind=longform) + chunk rows (≤1900 chars, prev/next context)
  → worker loop (respects per-provider concurrency: edge 2 · typecast 5 · deepgram 15)
  → per-chunk: same voice/model/seed + target_lufs -16 → ffmpeg concat + loudnorm
  → completed: single MP3 + SRT (provider timestamps; Deepgram chunks skip SRT)
GET poll → chunks.progress. Cancel: DELETE /v1/generations/:id → refunds unused chunk credits.
```

---

## 5. Caching & Dedup (cost saver — unchanged, extended)
| Key | Cache |
|---|---|
| (voice_id, sha256(text+style)) | reuse stored audio forever (dedup table) — applies to all 3 providers |
| (audio_path, srt) | SRT from STT round-trip cached with generation (never re-transcribed) |
| voice previews | permanent per voice |
| /v1/voices | 5 min |
| Edge/Typecast/Deepgram voice lists | nightly sync |

---

## 6. Security checklist (v2 — full design research/08)
- [ ] API keys SHA-256 at rest, prefix-only display, scopes, instant revoke/rotate
- [ ] Idempotency-Key unique constraint; replay test in CI
- [ ] Razorpay HMAC on raw body; dedupe on event id; credit only on `payment.captured`
- [ ] Turnstile server-side verify on signup + guest demo + clone consent
- [ ] OpenAI Moderation on ALL TTS input before any provider call; 3-strikes ban
- [ ] RLS on every table; service_role server-only; CI grep for leaked keys
- [ ] Presigned storage URLs ≤1h; generation audio private; custom voices owner-only
- [ ] Per-key + per-user + per-IP rate limits with headers; daily caps
- [ ] Streaming relay: auth via query token (1-use, 60s), no raw API key on WS path
- [ ] SSRF guard: provider URLs from registry config only
- [ ] Code-point char counting for billing (`Array.from(text).length`)
- [ ] Audit: every generation + clone consent + abuse flag logged
- [ ] Deepgram: `tag=lv:{userId}:{plan}:{genId}` on every request → COGS dashboards; internal callback webhook verified + deduped

---

## 7. SDKs (M8)
| SDK | Contents |
|---|---|
| `@lugunavoice/sdk` (JS/TS) | `client.tts.generate()`, `poll()`, `stream()` (WS), `voices.list()`, `clone()`, types from OpenAPI |
| `lugunavoice` (Python) | same surface via `httpx` |
| OpenAPI spec | generated from zod schemas → /developers + Postman collection |

---

## 8. Launch checklist (API readiness)
- [ ] OpenAPI + /developers docs + curl examples + Postman collection
- [ ] Idempotency replay test (same key twice → 1 charge)
- [ ] Concurrency ceiling test → clean 429s
- [ ] Provider outage drill: kill-switch → 503 + retry-after; refund path verified
- [ ] Long-form: 120K-char audiobook chapter → 1 MP3 + SRT < 3 min (Typecast) ; partial-failure → chunk retry → final success or full refund
- [ ] Streaming: first byte < 1s; abort mid-stream → prorated refund
- [ ] Moderation: block + strike test; ban after 3
- [ ] Webhook replay/forgery test → 400 + alert
