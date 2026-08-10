# LugunaVoice — Master Build Plan (v2, reconstructed)

> **Project:** LugunaVoice — AI voice studio & developer platform (TTS SaaS)
> **Date:** 2026-08-10 · **Version:** v2 (rebuilt after 2nd research round)
> **Research:** `docs/research/01–08` (providers, open-source, tools, competitors, Deepgram deep-dive, feature parity, long-form/cloning/streaming, security)
> **Model:** famespeak.online-style reseller, upgraded to match top-tier platform features.

---

## 1. Product Vision (updated)

LugunaVoice is a **3-provider AI voice studio**: creators and developers get free, premium, and flagship voices in one place — with long-form generation, voice cloning with consent, streaming, SRT, and a real developer API. We undercut ElevenLabs-class pricing while being more honest about what powers the voices.

### The three engines (chosen by you)
| # | Provider | Role in product | Wholesale cost | Retail | Notes |
|---|---|---|---|---|---|
| 1 | **Microsoft Edge TTS** (via `msedge-tts` npm, `speech.platform.bing.com`) | **FREE tier** — 75+ languages, ~540 voices | $0 | Free (daily caps) | Unofficial endpoint: **best-effort, never revenue-critical**; wrapped behind our API |
| 2 | **Typecast API** (ssfm-v30/v21, `api.typecast.ai`) | **PREMIUM tier** — 500+ voices, 37 languages, emotion control, **instant voice cloning** (only provider of the three that clones) | $0.07–0.09 / 1K chars | 1 credit/char | Reseller-proven (FameSpeak precedent); Lite $15/mo = 200K chars |
| 3 | **Deepgram TTS** (Aura-2 / Aura-1, `api.deepgram.com`) | **FLAGSHIP tier** — best latency (<300ms TTFB), streaming WebSocket, IPA pronunciation overrides, 91 Aura-2 voices (7 languages) | Aura-2 $0.030 / 1K chars · Aura-1 $0.015 / 1K | 2 credits/char | No cloning, no SSML, EN-heavy — that's fine, Typecast covers those gaps |

### Deepgram platform features we build on (beyond TTS — full details: research/09)
Deepgram's API is much bigger than TTS. We integrate **every capability that fits our product**:

| Deepgram API | What we build with it | Priority |
|---|---|---|
| **STT Nova-3 word timestamps** | **SRT export for flagship audio** — Deepgram TTS has no timestamps, so we run the generated audio back through STT (word timestamps are free, official `@deepgram/captions` SRT converter). Cost ~$0.0043/min → a 10-min voiceover = $0.043 (≈10-15% on top of TTS cost). No more "Deepgram can't do subtitles" gap. | **Launch** |
| **STT transcription tool** | Studio feature: "upload audio → transcript + SRT + speaker labels" (audio-to-text for creators), billed in credits at cost+margin | **v2** (cheap to add once SRT pipeline exists) |
| **Usage tags + billing/breakdown API** | Per-user COGS tracking — `tag=lv:userX:planY` on every Deepgram request + `GET /v1/projects/{id}/billing/breakdown?grouping=["tags","line_item"]` → our admin cost dashboards know exactly who costs what | **Launch** |
| **TTS async callbacks** | `callback` + `callback_method` so Deepgram pushes completion to our job pipeline (10 retries/30s) instead of us polling | **Launch** |
| **Voice Agent API** | **Phase-2 "custom agents" product** — realtime voice assistants resold to users (STT+LLM+TTS+barge-in+function calling in one WS; managed GPT/Claude/Gemini; Twilio/WebRTC). Wholesale $0.075/min ($4.50/hr) → resell $9–15/hr. Requires 45-connection/project cap management. | **Phase 2** |
| **Text Intelligence** (`/v1/read`) | v2 Studio assistant: summarize scripts, sentiment/topics on transcripts | **v2** |
| **Translation** | **Not an API** (verified — no `/translate` endpoint). Our v2 dubbing must use DIY cascade (STT → external MT → Aura TTS) — don't build on a Deepgram translation product | **Don't build on it** |
| **EU endpoint + `mip_opt_out`** | EU data-residency + model-training opt-out for B2B/privacy — `api.eu.deepgram.com` + per-request flag (pricing impact — decide at launch, research/05 §1.1) | **v2** |

> **"Custom agents" clarified (important):** In this industry, *voice agents* = realtime AI voice assistants (STT + LLM + TTS streaming + telephony). *Cloned voices* = your own voice copy. We launch **cloned voices (custom voices)** in v1 and treat **realtime agents** as a phase-2 product (they bill per-minute, need STT — a different business). The plan below reflects this.

### Credit model (one currency, provider-weighted)
- **1 credit = 1 character** of Typecast premium voice
- **2 credits = 1 character** of Deepgram flagship voice (Aura-2 costs 2× wholesale — mirror ElevenLabs' "HD costs more" pattern)
- **0 credits** = Edge TTS free voices (daily caps instead)
- Credits are **non-expiring** (our #1 differentiator vs FameSpeak's 30-day expiry)

---

## 2. Feature Scope (from parity research — research/06)

### v1 (launch) — 20 must-have features
| # | Feature | Engine(s) | Notes |
|---|---|---|---|
| 1 | 3 quality tiers (free/premium/flagship) | all 3 | model dropdown in Studio + API |
| 2 | **1,100+ voices** (540 Edge + 500+ Typecast + 91 Deepgram) with previews | all | previews generated once, cached |
| 3 | 30+ languages | Edge/Typecast (Deepgram = 7) | Deepgram marked "flagship EN-centric" |
| 4 | Speed / pitch / volume controls | Edge (prosody) + Typecast (pitch/tempo) + Deepgram (speed) | |
| 5 | **Pronunciation**: inline IPA overrides (Deepgram) + custom words (Typecast) | Deepgram/Typecast | per-request |
| 6 | **SSML-lite**: emotion presets & style tags inline (`[happy]` etc.) | Typecast emotions; Edge styles; Deepgram prompting | full SSML = v2 (providers vary) |
| 7 | Emotion presets: happy/sad/angry/whisper/toneup/tonedown + intensity | Typecast ssfm-v30 | |
| 8 | **Instant voice cloning** with consent capture + sample upload (5–150s) | Typecast `uc_` voices | grant-based launch |
| 9 | **Long-form generation** (50k+ chars, audiobook-length), automatic chunking, stable voice | all 3 | see research/07 blueprint |
| 10 | **Word timestamps + SRT export** | edge-tts WordBoundary + Typecast `/with-timestamps` + **Deepgram: STT round-trip** (Nova-3, research/09) | all tiers covered |
| 11 | REST API (`/v1/tts/generations` async+poll) + **streaming API** (WebSocket) | Deepgram streaming relay | |
| 12 | API keys (multi, hashed, scoped, revocable) + rate limits + usage meters | ours | |
| 13 | JS + Python SDKs | ours | |
| 14 | Free tier + signup bonus + dev trial credits | ours | |
| 15 | Usage dashboard + credit balance + purchase history + **per-user COGS (Deepgram tags/billing API)** | ours + Deepgram | |
| 16 | Multi-voice / dialogue scripts (speaker A/B in one generation) | all (chunk-concat) | v1.2 |
| 17 | Visual editor: waveform + sentence-level regenerate | ours (wavesurfer.js) | |
| 18 | Commercial licensing clarity ("you own the audio" page) | ours | |
| 19 | Referral program (2,500 credits/invite) | ours | |
| 20 | Webhooks for generation completion (v1.5) | ours + **Deepgram async `callback` passthrough** | |

### v2 (+1 quarter) — should-have
- **Audio transcription tool** (upload → transcript + SRT + speaker labels, Deepgram STT, billed in credits)
- Professional cloning tier (Typecast; 30+ min samples)
- Batch synthesis API (job + status polling)
- **Text Intelligence assistant** (summarize scripts, sentiment on transcripts — Deepgram `/v1/read`)
- Video dubbing (file-in → dubbed-out via STT→MT→Aura cascade; no lip-sync)
- Realtime voice changer / conversational streaming preview in Studio
- Workspaces + roles
- Background music + SFX in editor (open-source assets)
- Two-host AI podcast mode
- Zapier + Google Slides/Canva integrations

### Phase 2+ — could-have
- **Hosted voice agents** (Deepgram Voice Agent API $0.075/min wholesale → resell $9–15/hr; realtime STT+LLM+TTS, telephony, function calling)
- Self-hosted open-model tier (Kokoro-82M on CPU, Apache-2.0) → near-zero marginal cost
- EU data residency + MIP opt-out as B2B feature
- Lip-sync dubbing, mobile apps, Chrome extension

---

## 3. Plans & Pricing (rebuilt with Deepgram)

> Wholesale: Typecast ~$0.08/1K · Deepgram Aura-2 $0.030/1K (≈2.7 credits of cost at 2-credit pricing) · Edge $0. Margins ≥60% everywhere.

### Consumer plans (Studio)
| Plan | $/mo | Premium credits (Typecast 1cr/char) | Flagship credits (Deepgram 2cr/char) | Edge free voices | Long-form (chars/req) | Cloning |
|---|---|---|---|---|---|---|
| **Free** | $0 | 2,000 signup bonus (one-time) | — | unlimited (100K chars/day cap) | 10K | — |
| **Starter** | $5 | 15,000/mo | — | unlimited | 50K | — |
| **Creator** | $10 | 25,000/mo | 5,000/mo | unlimited | 100K | — |
| **Pro** | $20 | 50,000/mo | 15,000/mo | unlimited | 500K | grant |
| **Studio** | $49 | 150,000/mo | 40,000/mo | unlimited | 2M | ✓ |
| Custom/Enterprise | WhatsApp | custom | custom | — | — | ✓ + pro clones |

> Monthly credits roll over 90 days (not forever — but far better than FameSpeak's 30-day pack expiry). One-time **credit packs** (non-expiring) also sold for API users: $5→15K, $10→35K, $20→80K, $49→220K.

### Cost-of-goods sanity check (Creator plan, all consumed)
- 25,000 Typecast chars ≈ $2.00 cost (wholesale $0.08/1K) vs $10 price → 80% margin
- 5,000 Deepgram Aura-2 chars = 10,000 credits = $0.15 cost → 98% margin
- Real constraint isn't TTS cost — it's **fraud/abuse** (why security is a first-class workstream)

---

## 4. Architecture summary (details in 02)

```
Browser ─▶ Next.js 16 (Vercel) ──▶ Supabase (Postgres · Auth · Storage · RLS)
                │  ▲
                ▼  │ provider abstraction (lib/tts/registry)
   EdgeProvider ─── TypecastProvider ─── DeepgramProvider ─── (future: Kokoro self-host)
   msedge-tts      api.typecast.ai       api.deepgram.com      CPU/GPU worker
       │                │                     │
   MP3 24kHz        WAV/MP3 44.1kHz      MP3/WAV + WS streaming (linear16)
   (no cloning)     (ssfm-v30, cloning)  (Aura-2, IPA, low latency)
   └──────────┴──────────── all behind: credits · rate limits · moderation · auth
Payments: Razorpay (automated) + WhatsApp/UPI (manual fallback)
Security: Cloudflare WAF/Bot · Turnstile · hashed keys · RLS · webhook HMAC
```

**Key architectural rules (carried from v1):**
1. Provider abstraction — a voice record knows its `provider`, one registry dispatches synthesis. Swap/disable any engine with config (admin kill-switch).
2. Generation flow is async + pollable; long-form adds a chunk worker (progress per chunk).
3. Streaming = server-side WebSocket relay to Deepgram (client never holds Deepgram credentials); browser plays via Web Audio.
4. Cloning pipeline: upload sample → consent attestation → Typecast clone → clone stored in catalog marked `custom`, owner-only (Typecast `uc_` voices are owner-scoped — research/07 pitfall #3).
5. All TTS input passes content moderation before any provider call.

---

## 5. Security & Abuse (new first-class workstream — full design in research/08)

### MVP security baseline (non-negotiable)
1. **API keys:** SHA-256 hashed at rest, prefix display, scopes, instant revoke/rotate
2. **Razorpay webhooks:** HMAC-SHA256 on raw body + `x-razorpay-event-id` dedupe; credit only on `payment.captured`
3. **Supabase RLS** on every table (`to authenticated using (auth.uid() = user_id)`); service_role key server-only
4. **Cloudflare:** free Managed Ruleset + unmetered DDoS + Bot Fight Mode + 1 rate-limit rule on auth/demo paths
5. **Turnstile CAPTCHA** (free) on signup + guest demo, verified server-side
6. **Email verification** + disposable-domain blocklist
7. **OpenAI Moderation API** (free) on every TTS input → block flagged, 3-strikes auto-ban
8. **Per-user daily caps** + per-key token-bucket rate limits with `X-RateLimit-*` headers
9. **3DS kept ON** for international cards (liability); Razorpay Risk Analytics monitored
10. **Clone consent:** consent checkbox + attestation stored (who/voice/sample hash/date); public-figure refusal; provider watermarking (Resemble-style C2PA provenance in v2)

### Abuse-detection rules (24 rules in research/08 §D.3 — highlights)
| Rule | Trigger | Action |
|---|---|---|
| R1 | Turnstile fails | reject + log |
| R2 | >10 generations/min/user | flag + 24h temp ban |
| R3 | same device fingerprint on >2 accounts | flag → block |
| R4 | disposable email domain | block signup |
| R5 | >100K chars/day/user on free tier | 429 until reset |
| R6 | forged/replayed webhook | 400 + alert |
| R7 | chargeback | suspend + evidence pack |
| R8 | moderation flagged (3×) | auto-ban |

Escalation: Tier 1 auto-reject (zero effort) → Tier 2 weekly admin review queue → Tier 3 real-time alerts (payments/webhooks/ledger only).

---

## 6. Milestones (M0 → M8, ~14 weeks)

| # | Milestone | Key deliverables | Exit criteria |
|---|---|---|---|
| **M0** | Foundation (wk 1) | Next.js 16 + TS + Tailwind v4 + shadcn scaffold; Supabase project + Drizzle schema v1; Vercel deploy; CI (lint+typecheck); Cloudflare DNS + email | app deploys; CI green |
| **M1** | Auth + Landing + Guest Demo (wk 2–3) | Supabase Auth (email+Google), Turnstile on signup, landing (SEO), `/api/landing/demo` → Edge TTS (12/day/IP), moderation on demo input | visitor generates audio without account |
| **M2** | Voice Library + Edge engine (wk 3–4) | catalog seed (540 Edge voices + preview cache), library page (search/filter/favs/compare), Studio v1 (free voices), daily caps, pronunciation quick-fix | full Edge experience; caps enforced |
| **M3** | Typecast premium (wk 4–5) | TypecastProvider, 500+ voices imported, emotion presets + pitch/tempo, credit debit on premium (ledger), refund-on-failure | premium generation E2E; atomic debit tested |
| **M4** | Deepgram flagship + streaming (wk 6) | DeepgramProvider (Aura-2/1), 91 voices, IPA overrides, 2-credit pricing, WebSocket streaming relay + Web Audio player (sub-500ms), **usage tags on every request** | flagship + streaming E2E |
| **M5** | Long-form + SRT (wk 7–8) | chunk worker (~1,900-char sentence packs), parallel synthesis (respecting per-provider concurrency), ffmpeg concat + loudnorm, progress UI, SRT from timestamps: **Edge/Typecast native + Deepgram STT round-trip** (`@deepgram/captions`), **Deepgram async `callback` in job pipeline** | 100K-char script → one MP3 + SRT (all 3 engines), stable voice |
| **M6** | Cloning (wk 9) | sample upload (5–150s), consent attestation + mic-verify (v1 checkbox), Typecast clone, owner-only custom voices in library, clone usage in Studio/API | clone → generate → download; consent stored |
| **M7** | Payments + Abuse system (wk 10–11) | Razorpay links+webhooks (HMAC), credit packs + monthly plans (90-day rollover), admin dashboard (manual UPI confirm, flags queue, temp bans, kill-switches), **per-user COGS dashboard via Deepgram billing/breakdown + tags** (also add Typecast/Edge cost tables), daily cost monitor | buy → credits; fraud rules live |
| **M8** | Developer API + SDKs + Referrals + Launch (wk 12–14) | REST API (async+poll, idempotency), streaming endpoint, **`/v1/transcriptions` (audio→text→SRT)**, /developers docs + curl examples, JS+Python SDK packages, referral program, OpenAPI spec, launch checklist | a stranger can ship audio in <30 min |

### v2 backlog (post-launch, queued)
- Transcription tool full UX (v2)
- Text Intelligence assistant (Deepgram `/v1/read`)
- Dubbing cascade (STT → MT → Aura TTS)
- **Voice Agent resell product** (Deepgram Agent API, $0.075/min wholesale → $9–15/hr retail)
- EU endpoint + MIP opt-out toggle

> Security is woven in from M1 (never bolted on at the end): Turnstile+M1, moderation+M1, RLS+M0, rate limits+M2, webhook HMAC+M7, clone consent+M6.

---

## 7. Success Metrics (90 days post-launch)
| Metric | Target |
|---|---|
| Signups | 750 |
| Paid conversion | 6% |
| MRR | $2,500 |
| Gross margin | >60% (blended incl. Deepgram) |
| Demo→signup | >10% |
| Cloned-voice users | 5% of paid |
| API users | 15% of paid |
| Premium generation latency | <5s / 1K chars (Typecast), <2s (Deepgram) |
| Fraud write-off | <1% of revenue |

---

## 8. Risks (updated)
| Risk | Sev | Mitigation |
|---|---|---|
| Edge TTS breaks/banned (unofficial, ToS-grey) | High | free tier only; provider abstraction; Azure Speech $16/1M as legal replacement for free tier |
| Deepgram pricing/limits change | Med | Aura-1 fallback; Cartesia ($3.75/1M) researched as drop-in flagship |
| Typecast deprecates ssfm-v20/cats voices | Med | version-pin catalog; re-sync job; keep old voices on legacy model flag |
| Deepgram has no cloning/SSML (research correction) | Med | scope already fixed: cloning=Typecast, SSML-lite=emotion tags; no rework needed |
| Cloning abuse (celebrities, consent) | High | consent attestation + moderation + public-figure refusal + watermarking (v2); EU AI Act Art.50 disclosure from Aug 2026 (research/08 §C) |
| Payment KYC (Indian entity) | High | register entity + GST in M0–M2; Razorpay sandbox tests; WhatsApp fallback until live |
| Credit fraud / multi-accounting | High | Turnstile, fingerprinting, caps, referral limits, risk rules R1–R24 |
| Long-form provider concurrency caps (Typecast 5, Deepgram 15/45) | Med | chunk worker throttles; queue behind caps (research/07) |

---

## 9. Beginner's glossary (short — full in planning/06)
- **TTS** — text-to-speech: converting text into spoken audio.
- **API key** — a secret string your code sends to identify/authorize itself; we store it hashed.
- **Credits** — prepaid units; 1 credit = 1 char on Typecast, 2 credits = 1 char on Deepgram, 0 on Edge.
- **SSML** — a markup language for pronunciation/emphasis control (we ship "SSML-lite" emotion tags).
- **SRT** — subtitle file format (text + timestamps).
- **Webhook** — our server's phone number: payment providers call it to tell us "payment succeeded".
- **RLS** (Row-Level Security) — database rules so a user can only read/write their own rows.
- **Idempotency** — sending the same request twice only charges you once.
- **Latency/TTFB** — time until the first audio byte arrives.
- **Cloning** — training a copy of a voice from a sample (requires consent; we store proof).
- **Streaming TTS** — audio arrives in chunks as it's generated (for realtime/typing preview).

---

## 10. Immediate next actions
1. Open: Vercel, Supabase, Cloudflare, GitHub, domain, `msedge-tts` test, Typecast Lite ($15), Deepgram PayGo ($200 free credit)
2. Deepgram: confirm Aura-2 quality on our sample texts; set `mip_opt_out` decision (pricing impact — research/05 §1.1)
3. Start entity + GST paperwork (Razorpay prerequisite) — parallel with M0
4. Scaffold M0 per plan
