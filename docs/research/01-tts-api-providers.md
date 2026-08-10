# TTS API Providers — Deep Research for a Voice-Generation SaaS

> **Project:** LugunaVoice — TTS voice-generation SaaS (reference model: famespeak.online, which resells Typecast)
> **Research date:** 2026-08-10
> **Method:** Direct fetch of official pricing/docs pages + archived snapshots where live pages were blocked (Play.ht, LOVO, Resemble AI). Prices change often — every figure below has a source URL; re-verify before launch.
> **Currency:** USD unless noted.

---

## 0. Executive summary (TL;DR)

| Provider | Entry price | Effective rate | Quality | Cloning | Reseller-friendly | Verdict |
|---|---|---|---|---|---|---|
| **ElevenLabs** | $0 free / $5-6 Starter | ~$0.18–0.30 / 1K chars | Top-tier | Instant (Starter+), Pro (Creator+) | Good (commercial license on $6 tier) | Quality benchmark, thin margin |
| **Cartesia** | $0 free / $5 Pro | ~$3.75 / 1M chars (~$0.04/min) | Top-tier, 90 ms | Instant (Pro+), Pro cloning (Startup+) | Good | Best quality-to-price + latency |
| **Fish Audio** | $0 free / $5.5 Plus | **$15 / M bytes (~$1.25/hr, 20× cheaper than ElevenLabs)** | Very good, emotional tags | 15-sec instant cloning | Paid plans only (free tier = personal) | Best cheap bulk TTS |
| **Speechify** | $0 / $10 Starter | $6–10 / 1M chars | #1 on some leaderboards (Simba 3.2) | Zero-shot cloning | Good | Strong all-rounder |
| **Typecast** | $0 / $15 Lite | $0.07–0.09 / 1K credits | Good (ssfm-v30) | Instant cloning API | **Excellent (FameSpeak precedent)** | Chosen for resale |
| **Rime** | $0 (3K free min) / usage | $0.03–0.05 / 1K chars | Very good | Enterprise only | OK | Latency king (37 ms) |
| **MiniMax** | $0 / $5 packs | ~$0.05–0.09/min via points | Very good multilingual | Instant cloning | OK | Cheap, Asia-strong |
| **Azure Speech** | 0.5M chars free/mo | $16 / 1M chars (neural), HD $30 | Good, robotic-ish | Pro voice (limited access), Personal (gated) | OK, heavy ops | Safe enterprise choice |
| **Google Cloud TTS** | 1–4M chars free/mo | $4–$30 / 1M chars (Studio $160) | Good, Chirp3 HD strong | Instant custom voice $60/1M | OK | Flexible, boring voices |
| **AWS Polly** | 1–5M chars free (12 mo) | $4–$100 / 1M chars | Mediocre | Brand voice (custom) | OK | Cheap, dated quality |
| **Play.ht** | 12.5K chars free | ~$0.30/1K premium voices | Good | Instant cloning | Enterprise = re-sell rights | Solid, mid |
| **Deepgram Aura** | $200 credit | $0.015–0.03 / 1K chars | Good | Limited | Good | Cheap, STT-famous |
| **Resemble AI** | $0 / $29 Creator | $0.006/sec (~$0.36/min) | Good (Chatterbox) | Rapid + pro clones | Partner program | Pivoted to deepfake detection |
| **Murf** | 10 min free | Hour-billed plans ($19+/mo) | Good | Custom voice clones (ent.) | Weak API story | Studio-first, not API-first |
| **LOVO** | 1-hr trial | Hour-billed plans ($24+/mo) | Good | Unlimited cloning (Pro) | Weak API story | Studio-first |
| **WellSaid** | 3 min/mo free | $10–49/mo per-seat | Good | No self-serve cloning | Weak | Studio-first, no API cloning |
| **Speechify (above)** | — | — | — | — | — | — |
| **IBM Watson** | 10K chars free | $20 / 1M chars | OK | Premium custom (ent.) | OK | Legacy enterprise |
| **Unreal Speech** | (site unreachable) | ~$0.15/1K chars (historical) | Good | No | — | **Down / legal dispute — avoid** |
| **edge-tts** | **Free (unauthorized)** | $0 | Good (Edge voices) | No | **No — ToS violation** | Dev tool only, not for SaaS |

---

## 1. ElevenLabs

**URLs:** Pricing https://elevenlabs.io/pricing · API pricing tab https://elevenlabs.io/pricing/pricing/api · Docs https://elevenlabs.io/docs · Startup grant https://elevenlabs.io/pricing/startup-grants

### Pricing (verified 2026-08)
All products share one monthly credit pool; **1 text character ≈ 1 credit** (V2 multilingual models), flash/turbo models cost 0.5–1 credit/char.

| Plan | $/mo | Credits/mo | ≈ TTS minutes | Extra rate (≈/min) |
|---|---|---|---|---|
| Free | $0 | 10,000 | ~10 | $0.36 |
| Starter | $6 | 30,000 | ~30 | $0.20 |
| Creator | $22 ($11 first mo) | 121,000 | ~121 | $0.18 |
| Pro | $99 | 600,000 | ~600 | $0.17 |
| Scale | $299 (3 seats) | 1.8M | ~1,800 | $0.17 |
| Business | $990 (10 seats) | 6M | ~6,000 | $0.17 |
| Enterprise | Custom (volume discounts, DPA/SLA/SSO/BAA) | — | — | — |

- Annual billing = 10 months' price. Credits roll over up to 2 months (max 3× quota).
- **Startup Grants:** 33M characters (~1 year) free for qualifying startups — very relevant for LugunaVoice.

### Voice quality & coverage
- Reference-quality voices; 200+ pre-made voices, huge community Voice Library (thousands), 30+ languages, multilingual models.
- Pro plan adds 44.1 kHz PCM + 192 kbps.

### Features
Instant voice cloning (Starter+), professional cloning (Creator+), 3 pro clones on Scale / 10 on Business, voice design, SSML, streaming, low-latency Flash v2.5 (~75 ms), dubbing, sound effects, music, voice changer, isolated TTS/STT.

### API format & latency
REST `POST /v1/text-to-speech/{voice_id}` with `xi-api-key` header; official SDKs (Python, JS, etc.). Flash models ~75 ms TTFB; multilingual v3 ~250–350 ms.

### Licensing
Commercial license included from Starter ($6). Reselling voice output inside your product is allowed under paid plans; Enterprise gets custom terms. Voices cannot be used to impersonate without consent (their verification policy).

### Pros / Cons for a reselling startup
- **Pros:** best-known brand, best quality, cheap entry, rollover credits, startup grant.
- **Cons:** API per-char cost ($0.17–0.30/1K) leaves little margin if you resell cheaply; heavy competition on every TTS SaaS.

---

## 2. Cartesia

**URLs:** Pricing https://cartesia.ai/pricing · Docs https://docs.cartesia.ai · Languages https://cartesia.ai/languages

### Pricing (verified 2026-08)
Credits shared across TTS/STT/agents. Sonic-3.5 ≈ 750 credits/min → 100K credits ≈ 133 min.

| Plan | $/mo | Credits/mo | ≈ Sonic-3.5 min | Notes |
|---|---|---|---|---|
| Free | $0 | 20K | ~27 | 2 concurrent requests |
| Pro | $5 | 100K | ~133 | + commercial license, instant cloning, 3 concurrent |
| Startup | $49 | 1.25M | ~1,667 | + pro cloning, orgs, 5 concurrent |
| Scale | $299 | 8M | ~10,667 | 15 concurrent, priority support |
| Enterprise | Custom | Custom | — | concurrency, DPA/BAA, SSO |

- Overage/credits: pay-as-you-go top-up. Voice changer 15 credits/sec; localizing a voice 225 credits one-time.

### Voice quality & coverage
Sonic-3.5 = "fastest, most emotive, ultra-realistic" — ~90 ms to first byte. Curated voice library (hundreds), 30+ languages, emotion control, accent control, fine-tunable cloned voices.

### Features
Instant cloning (Pro+), professional cloning (Startup+), voice changer, localize voice, break tags, emotion/pitch/speed control, WebSocket + REST streaming, STT (Ink 2), agents (Line).

### API format & latency
REST `POST /v1/tts` + WebSocket `wss://api.cartesia.ai/tts/websocket` with `X-API-Key`. ~90 ms TTFB. Python/JS/Go SDKs.

### Licensing
Commercial use on Pro ($5/mo). Acceptable-use policy; cloned voices need consent.

### Pros / Cons
- **Pros:** near-ElevenLabs quality at ~1/5 the price, 90 ms latency, cheap Pro tier, SOC 2.
- **Cons:** smaller brand, voice library smaller than ElevenLabs, cloning slots tied to plan.

---

## 3. Play.ht

**URLs:** Pricing https://play.ht/pricing (live page bot-blocked during research; figures below from Wayback snapshot 2024-09-01 https://web.archive.org/web/20240901094556/https://play.ht/pricing/) · Docs https://docs.play.ht

### Pricing (2024 snapshot — re-verify live)
Studio plans (per year):
| Plan | Price | Characters |
|---|---|---|
| Free | $0 | 12,500 chars (1 instant clone, no API, no attribution-free) |
| Creator | $31.20/mo (annual $374.40) | 3M chars/yr, 10 instant clones |
| Unlimited | $29/mo (annual $348) | "Unlimited" chars, unlimited instant clones, 1 high-fidelity clone, commercial use |
| Enterprise | Custom | Commercial + **re-sell rights**, unlimited high-fidelity clones, SSO |

API is billed separately per-character; historically ~$0.30/1K chars for ultra-realistic (Play 3.0 / PlayDialog) voices and ~$0.06/1K for turbo models — verify on live page.

### Voice quality & coverage
900+ voices, 140+ languages; Play 3.0 (multilingual SOTA-quality) and Play 3.0 mini (ultra-low-latency ~200 ms); PlayDialog (conversational); PlayHT 2.5 turbo.

### Features
Instant + high-fidelity cloning, voice styles (Newscaster, Conversational, Customer Support…), SSML, streaming, emphasis, pronunciation library, multi-speaker dialog, WordPress plugin, API + SDKs (Python, JS, etc.).

### Licensing
Creator+ = commercial use; **Enterprise = explicit "Commercial and re-sell rights"** — important for a reselling startup.

### Pros / Cons
- **Pros:** good quality, re-sell rights on Enterprise, established platform.
- **Cons:** pricing less transparent now (bot-blocked), API extra cost, some premium voices expensive.

---

## 4. Resemble AI

**URLs:** Pricing https://www.resemble.ai/pricing (now pivoted to deepfake detection; snapshot of TTS plans from 2025-01: https://web.archive.org/web/20250115173900/https://www.resemble.ai/pricing/) · Docs https://docs.resemble.ai

### Pricing (2025-01 snapshot — company now sells deepfake detection)
| Plan | $/mo | Included | Overage |
|---|---|---|---|
| Creator | $29 (1st mo $1) | 10,000 sec TTS free | $0.006/sec (~$0.36/min) |
| Professional | $99 | 80,000 sec free | $0.002/sec (~$0.12/min) |
| Business | $499 | 320,000 sec free | API access, 500 rapid + 10 pro clones |
| Enterprise | Custom | up to 90% discount, on-prem | — |

**Note:** As of 2026 their pricing page sells Resemble Detect (deepfake detection) — Flex $0 / Team $350 / Business $1,000. TTS ("Voice AI Research") still exists via Chatterbox models but is de-emphasized.

### Voice quality & coverage
Good quality (Chatterbox family, Turbo/Multilingual/Nano/Flash); cloning-focused; 60+ languages claimed.

### Features
Rapid clone (10 sec sample) + Professional clone (10 min), real-time speech-to-speech, streaming, watermarking, localize/dubbing.

### Licensing
All tiers: commercial use allowed. Authorized partner program existed for resellers.

### Pros / Cons
- **Pros:** strong cloning, on-prem options.
- **Cons:** strategic pivot away from TTS = roadmap risk for a startup depending on it; pricing re-verify.

---

## 5. Speechify AI (SpeechifyAI)

**URLs:** Pricing https://speechify.ai/pricing · Docs https://docs.speechify.ai · Models https://speechify.ai/models

### Pricing (verified 2026-08)
One prepaid balance across TTS + voice agents; TTS billed per character (whitespace/SSML not counted).

| Plan | $/mo | TTS included | Overage rate |
|---|---|---|---|
| Free | $0 | 50K chars (hard cap) + 60 agent min | — |
| Starter | $10 | 1M chars | $10 / 1M chars |
| Pro | $99 | 3M chars | $8 / 1M chars |
| Scale | $499 | 10M chars | $6 / 1M chars |
| Enterprise | Custom | volume discounts | — |

### Voice quality & coverage
**Simba 3.2** — #1 on Artificial Analysis TTS leaderboard (as claimed); streaming-native, sub-300 ms TTFB. 1,500+ voices, 30+ languages (Simba 3.0: 6 validated locales). Finer emotion control + SSML prosody.

### Features
Zero-shot voice cloning (consent-first, reusable voice IDs), emotion control (neutral/calm/cheerful/energetic/sad), SSML, streaming, agents (voice bots), LiveKit/Pipecat integrations.

### API format & latency
REST `POST https://api.speechify.ai/v1/audio/speech` with `Authorization: Bearer`. <300 ms TTFB (claimed).

### Licensing
Commercial use on paid plans; free tier included for building. Clone consent required.

### Pros / Cons
- **Pros:** leaderboard quality, low price at scale ($6/1M), simple billing.
- **Cons:** newer platform, fewer battle-tested enterprise contracts, voice set curated (fewer "character" voices).

---

## 6. Murf AI

**URLs:** Pricing https://murf.ai/pricing (JS-rendered; captured via reader proxy) · API https://murf.ai/text-to-speech-api

### Pricing (verified 2026-08)
Studio plans, voice-generation hours billed (not characters):

| Plan | $/mo | Voice gen | Notes |
|---|---|---|---|
| Free | $0 | 10 min | 10 projects, no downloads/commercial rights |
| Creator | $19 (annual $228) | 24 hrs/yr | 200+ voices, 100 projects, unlimited downloads, commercial rights |
| Business | $66 (annual $792) | 96 hrs/yr | 500 projects, business license, emphasis, "Say It My Way" |
| Enterprise | Custom | Unlimited | SSO, custom models, custom voice clones (add-on), MSA |

### Voice quality & coverage
200+ voices, 30+ languages/accents, multi-native voices, voice styles & tonalities. Good for e-learning/corporate.

### Features
Voice cloning (enterprise add-on), pronunciation control, emphasis, variability, AI translation, dub studio, voice changer, transcription.

### Licensing
Commercial rights on Creator+; full broadcasting rights = enterprise add-on; business license on Business+.

### Pros / Cons
- **Pros:** polished studio, good variety, HIPAA/ISO/SOC2.
- **Cons:** **API is a bolt-on** (main product is the studio), hour-billed plans are bad for API-style resale, per-seat limits.

---

## 7. LOVO AI

**URLs:** Pricing https://lovo.ai/pricing (live page 402/deployment paused during research; snapshot from 2024-12: https://web.archive.org/web/20241206073226/https://lovo.ai/pricing) · API docs https://docs.genny.lovo.ai

### Pricing (2024-12 snapshot — re-verify)
| Plan | $/mo | Voice gen | Notes |
|---|---|---|---|
| Basic | $24 (annual $288) | 2 hrs/mo | 500+ voices, 5 clones, 1080p, commercial rights |
| Pro | $24 first yr ($48 after; annual $288) | 5 hrs/mo | unlimited cloning, multilingual, priority queue |
| Pro+ | $75 (annual $900) | 20 hrs/mo | 400GB storage, priority support |
| Enterprise | Custom | — | API support, custom voice gen, SLA |

### Voice quality & coverage
500+ AI voices, 100+ languages, hyper-realistic pro voices, emotion/expressiveness controls.

### Features
Voice cloning (5 → unlimited), voice enhancer, subtitle generator, AI writer/art/sfx, video editor, API (enterprise).

### Licensing
Commercial rights on all paid plans.

### Pros / Cons
- **Pros:** good language coverage, cheap entry.
- **Cons:** studio-first; API is enterprise-only; deployment instability observed (site 402'd during research) is a red flag.

---

## 8. WellSaid Labs

**URLs:** Pricing https://wellsaidlabs.com/pricing/ · API docs https://docs.wellsaidlabs.com

### Pricing (verified 2026-08)
Studio plans — "download minutes" model (generation unlimited on paid plans):

| Plan | $/mo | Download minutes | Notes |
|---|---|---|---|
| Trial | Free | 3 min/mo | no commercial rights |
| Starter | $10/yr-billed ($19 monthly) | 240 min/yr (20/mo) | 24 kHz, commercial rights |
| Pro | $33/yr-billed ($49 monthly) | 2,160 min/yr (180/mo) | 48 kHz |
| Business | $160/mo/user (annual) | 2,880 min/yr/user | teams, 1–5 seats |
| Enterprise | Custom | custom | all languages, SSO, 96 kHz |

### Voice quality & coverage
100+ English voices + styles; global languages (Spanish, French, Japanese, Mandarin, etc.) gated to Enterprise. Good professional/narration quality; **Caruso** flagship model free on all tiers.

### Features
Tone/pitch/emotion controls, pronunciation library + Oxford dictionary, captions (SRT/VTT), Adobe integrations, API (trial keys available), no voice cloning self-serve.

### Licensing
Full commercial rights on all paid plans; data never used to train models.

### Pros / Cons
- **Pros:** enterprise trust (Microsoft case study), SOC 2.
- **Cons:** **no self-serve voice cloning**, per-seat pricing, languages locked to Enterprise — bad fit for a reseller.

---

## 9. Unreal Speech

**URLs:** Pricing https://www.unreal-speech.com/pricing · Docs https://www.unreal-speech.com/docs

### ⚠️ Status warning (2026-08)
Both live site and Wayback snapshots were **unreachable during research** (transport errors; zero CDX captures returned). Treat as **unavailable / high-risk**.

### Historical pricing (from prior public knowledge — verify before any use)
- Free tier: ~10K chars/mo (no commercial use).
- Pay-as-you-go: ~$0.00015/character (~$0.15/1K chars) — marketed as ~50× cheaper than ElevenLabs.
- Monthly plans existed at ~$59–$249 for 0.5M–2.5M+ chars.

### Known risks
- **Trademark lawsuit:** Epic Games sued Unreal Speech (2024) over the "Unreal" name — reported widely; may explain the site's instability.
- Small company, no cloning, limited languages vs. majors.

### Pros / Cons for startup
- **Cons (dominant):** unreachable site, legal exposure, single point of failure. **Do not build on this provider.**

---

## 10. Rime AI

**URLs:** Pricing https://rime.ai/pricing · Docs https://docs.rime.ai

### Pricing (verified 2026-08)
Usage-based; **~800 min free trial (~800K chars)**.

| Model | Rate | Latency (TTFA P50 @1 conc) |
|---|---|---|
| Mist v3 (lowest latency) | $0.03 / 1K chars (~$0.03/min) | 37 ms |
| Coda (most expressive) | $0.05 / 1K chars (~$0.05/min) | 96 ms |
| Enterprise | Custom volume, on-prem/VPC, BAA, SOC2 | sub-100 ms self-hosted |

### Voice quality & coverage
600+ voices, 50+ languages (production-ready: EN, AR, FR, DE, HI, JA, PT, ES for Coda; 4 for Mist). Conversational-first quality.

### Features
Streaming HTTP + WebSockets, word-level timestamps (Coda), spelling, speed/pitch control, pronunciation control, custom pauses, LiveKit/Pipecat/Twilio integrations, self-host via Docker/K8s (Enterprise).

### Licensing
20 concurrent on Starter; unlimited clones + unlimited concurrency on Enterprise. Commercial use standard.

### Pros / Cons
- **Pros:** fastest TTFA in class (37 ms), cheap, strong agent ecosystem.
- **Cons:** cloning gated to Enterprise, smaller brand/voice library.

---

## 11. Fish Audio

**URLs:** Plans https://fish.audio/plan/ · API pricing https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits · API ref https://docs.fish.audio/api-reference/introduction

### Pricing (verified 2026-08)

**App plans:**
| Plan | $/mo | Credits/mo | ≈ minutes | Notes |
|---|---|---|---|---|
| Free | $0 | 8,000 | ~7 | **personal use only**, 3 public voice slots, 500 chars/gen |
| Plus | $5.5 (annual $66) | 250K | ~200 | commercial use, 15K chars/gen, 1 pro voice slot, Voice Design |
| Pro | $37.5 (annual $450) | 2M | ~1,620 | 3 seats, unlimited slots, 5 pro voice slots |
| Max | $749 (annual $8,988) | 25M | ~6,250 | 10 seats, 15 pro slots |
| Enterprise | Custom | — | — | zero data retention, on-prem, SOC2 |

**API (pay-as-you-go, no subscription):**
| Model | Price |
|---|---|
| `s2.1-pro` / `s2-pro` / `s1` | **$15.00 / M UTF-8 bytes** (~180K English words ≈ 12 hrs speech → ~$1.25/audio-hour) |
| `s2.1-pro-free` | **$0.00** |

Concurrency: 5 (<$100 paid) → 15 (≥$100) → 50 (≥$1,000).

### Voice quality & coverage
S2.1 Pro: "most expressive, emotionally controllable real-time voice model". **2,000,000+ community voices** in the voice library; 30+ languages; emotion/special tags (`[angry] [whispering] [laughing] …`); 15-sec instant cloning. $52M seed, 8M+ builders.

### Features
Streaming (WebSocket), instant cloning, voice design, voice changer, STT, voice agents, audiobook/sfx tools, open-source models (Fish Speech/S2 on GitHub), SDKs.

### Licensing
**Commercial use only on paid plans** (free = personal). Cloned voices must be yours/consented.

### Pros / Cons
- **Pros:** by far the cheapest quality TTS API; free API tier; huge voice library; cloning cheap.
- **Cons:** China-based company (data-residency questions), younger infra, output quality slightly behind ElevenLabs/Cartesia for neutral narration.

---

## 12. MiniMax Audio

**URLs:** Pricing hub https://platform.minimax.io/docs/guides/pricing-speech · Docs https://platform.minimax.io/docs

### Pricing (verified 2026-08)
Audio Subscription plans (audio-points based):

| Plan | $/mo | Points/mo | Voice slots | RPM |
|---|---|---|---|---|
| Starter | $5 | 100K | 10 | 10 |
| Standard | $30 | 300K | 100 | 50 |
| Pro | $99 | 1.1M | 250 | 200 |
| Scale | $249 | 3.3M | 500 | 500 |
| Business | $999 | 20M | 800 | 800 |
| Enterprise | Custom | unlimited | — | unlimited |

(≈600–1,200 points per minute of audio depending on model → effective ~$0.05–0.09/min at Starter.) Pay-as-you-go token pricing also available.

### Voice quality & coverage
Speech-02/T2A v2 series — very good multilingual (esp. Chinese/Asian), natural prosody. Curated voices + instant cloning (10+ voice slots, cloning on demand).

### Features
TTS (T2A v2, T2A large v2), voice cloning, voice changing, streaming, 30+ languages.

### Licensing
Commercial use OK on paid plans.

### Pros / Cons
- **Pros:** cheap, strong Asian-language quality, generous free points for testing.
- **Cons:** docs/platform friction, less common in Western SaaS stacks, account/top-up quirks.

---

## 13. OpenAI TTS

**URLs:** Pricing https://developers.openai.com/api/docs/pricing (verified 2026-08) · TTS guide https://platform.openai.com/api/docs/guides/text-to-speech

### Pricing (verified 2026-08)
| Model | Rate |
|---|---|
| `tts-1` | $15.00 / 1M characters (~$0.015/min) |
| `tts-1-hd` | $30.00 / 1M characters (~$0.03/min) |
| `gpt-4o-mini-tts` | $0.60/1M text tokens input + $12.00/1M audio tokens output (~$0.015/min) |
| Realtime audio (gpt-realtime-2.1-mini) | $10/1M audio input, $20/1M audio output |

No free tier for API (pay-as-you-go, prepay credits).

### Voice quality & coverage
6 built-in voices (alloy, echo, fable, onyx, shimmer, nova) + `gpt-4o-mini-tts` supports custom "instructions" for style. Good but limited voice count; no real voice cloning; multilingual support. Newer gpt-audio-1.5 models for realtime.

### Features
Streaming, SSML subset, word timestamps, instruction-based style control. Simple `POST /v1/audio/speech`.

### Licensing
Outputs can be commercialized; cannot impersonate people without consent. API terms forbid building a competitor service on their API? (Check current terms — historically "no replicating OpenAI's service", TTS APIs generally fine.)

### Pros / Cons
- **Pros:** dead-simple API, cheap-ish, OpenAI brand.
- **Cons:** only 6 voices, no cloning, limited emotion control — weak for a voice *library* SaaS.

---

## 14. Microsoft Azure Speech

**URLs:** Pricing https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/ (live page shows $-placeholders in JS; rates below are the published standard values) · Docs https://learn.microsoft.com/azure/ai-services/speech-service/

### Pricing (standard published rates)
| SKU | Rate | Free tier |
|---|---|---|
| Neural (standard) voices | **$16 / 1M chars** (real-time & batch) | 0.5M chars/mo free |
| Neural HD (Coral etc.) | $30 / 1M chars | — |
| Custom Neural Voice (pro) | synthesis $16/1M + training $/compute-hr + endpoint hosting | — |
| Personal Voice | synthesis + per-profile storage (limited-access, gated) | — |
| Standard (legacy) | $4 / 1M chars | 5M chars/mo free (legacy) |
| Commitment tiers | $80M chars tier etc. — big volume discounts | — |

### Voice quality & coverage
500+ neural voices, 140+ languages/locales. Good but generally considered behind ElevenLabs/Cartesia for expressiveness; **Coral HD** voices are close to SOTA.

### Features
SSML (richest in industry), streaming, custom neural voice (limited access program), Personal Voice (gated), batch synthesis, avatar/video TTS, containers/on-prem, extensive SDKs.

### Licensing
Commercial use fine; embedding in apps fine; custom voice requires speaker consent + limited-access approval.

### Pros / Cons
- **Pros:** enterprise-grade SLAs, huge language set, best SSML, on-prem options, volume discounts.
- **Cons:** ops-heavy (Azure account, regions, quotas), per-character price mid-high, less "personality" in stock voices.

---

## 15. Google Cloud TTS

**URLs:** Pricing https://cloud.google.com/text-to-speech/pricing (verified 2026-08) · Docs https://cloud.google.com/text-to-speech/docs

### Pricing (verified)
| Model | Free/mo | Rate |
|---|---|---|
| Standard | 4M chars | $4 / 1M chars |
| WaveNet | 4M chars | $16 / 1M chars |
| Neural2 | 1M chars | $16 / 1M chars |
| Polyglot (preview) | 1M chars | $16 / 1M chars |
| Studio | 1M chars | $160 / 1M chars |
| **Chirp 3: HD** | 1M chars | $30 / 1M chars |
| Instant custom voice (Chirp 3) | — | $60 / 1M chars |
| Gemini-TTS (2.5 Flash / 3.1 Flash / 2.5 Pro) | — | token-based: $0.50–1/1M text tokens in, $10–20/1M audio tokens out |

### Voice quality & coverage
220+ voices, 40+ languages; Chirp 3 HD is the competitive flagship (very natural); Studio voices for emotional performance; Gemini-TTS allows prompt-driven style control.

### Features
SSML, streaming, neural2/wavenet/studio/chirp families, instant custom voice (few sentences), custom voices (enterprise, gated), timestamps, Google Workspace integrations.

### Licensing
Standard commercial use; custom voice needs consent.

### Pros / Cons
- **Pros:** cheap Standard tier, generous free tiers, reliable.
- **Cons:** stock voices sound corporate; Studio tier pricey; no community voice library.

---

## 16. Amazon Polly

**URLs:** Pricing https://aws.amazon.com/polly/pricing/ (verified 2026-08) · Docs https://docs.aws.amazon.com/polly

### Pricing (verified)
| Voice type | $/1M chars | Free tier (first 12 mo) |
|---|---|---|
| Standard | $4 | 5M chars/mo |
| Neural | $16 | 1M chars/mo |
| Generative | $30 | 100K chars/mo |
| Long-form | $100 | 500K chars/mo |

Speech Marks billed as characters too; caching/replay free.

### Voice quality & coverage
~100+ voices, 30+ languages. Neural is decent but dated vs. modern leaders; Generative & Long-form better. Multi-region.

### Features
SSML, streaming, Speech Marks (word/viseme timing), lexicons, brand voice (custom, enterprise), SDKs across AWS stack.

### Licensing
Standard commercial use; custom brand voice via enterprise.

### Pros / Cons
- **Pros:** cheapest neural at $16/1M with mature infra; free tier generous; AWS ecosystem.
- **Cons:** quality not competitive at the top end; AWS billing/console friction; no cloning self-serve.

---

## 17. Deepgram (Aura)

**URLs:** Pricing https://deepgram.com/pricing (verified 2026-08) · Docs https://developers.deepgram.com

### Pricing (verified)
| Model | Pay-as-you-go | Growth (annual) |
|---|---|---|
| **Aura-1** | $0.015 / 1K chars | $0.0135 |
| **Aura-2** | $0.030 / 1K chars | $0.027 |

$200 free credit on signup; TTS concurrency up to 45 (PAYG) / 60 (Growth). Prepaid credits, no expiry.

### Voice quality & coverage
Aura-2: emotional, low-latency conversational voices; ~200 voices across 30+ languages (per docs). Aimed at voice agents.

### Features
Streaming via WebSocket (<200–300 ms TTFB), SSML, timestamps, voice agents API, self-hosted options, SOC2/HIPAA/EU residency.

### Licensing
Commercial use fine; self-hosted on enterprise.

### Pros / Cons
- **Pros:** cheap, agent-native, free credit.
- **Cons:** fewer "character/narration" voices; Aura-2 premium price point; no instant cloning.

---

## 18. IBM Watson Text to Speech

**URLs:** Pricing https://www.ibm.com/cloud/watson-text-to-speech/pricing (verified 2026-08) · API https://cloud.ibm.com/apidocs/text-to-speech

### Pricing (verified)
| Tier | Price | Notes |
|---|---|---|
| Lite | Free | 10K chars/mo |
| Standard | **$0.02 / 1K chars ($20/1M)** | unlimited chars |
| Premium | Custom | custom-branded neural voice, 99.9% SLA |
| Deploy Anywhere | Custom | on-prem/any cloud, 35 neural voices, 16 languages |

### Voice quality & coverage
~100+ voices, 50+ languages; expressiveness styles (GoodNews, Apology, Uncertainty), voice transformation sliders.

### Features
SSML, IPA pronunciation, custom voice (premium), streaming, SDKs (Watson).

### Licensing
Standard commercial use.

### Pros / Cons
- **Pros:** simple pricing, IBM compliance story.
- **Cons:** dated quality/features, low ceiling for a consumer voice product.

---

## 19. Typecast — **deep dive (chosen for resale)**

**URLs:** Studio pricing https://typecast.ai/pricing · API pricing https://typecast.ai/pricing/api · Docs https://typecast.ai/docs · Models https://typecast.ai/docs/models · Instant cloning https://typecast.ai/docs/api-reference/voices/instant-cloning · Company (Neosapience) https://neosapience.com

### API pricing (verified 2026-08) — **1 credit = 1 character**
| Plan | $/mo | Credits/mo | Effective | Overage | Concurrency | Instant-clone slots |
|---|---|---|---|---|---|---|
| Free | $0 | 30K | — | — | 2 | — |
| **Lite** | **$15** | 200K | $0.075/1K | $0.09/1K (in $9 blocks) | 5 | 50 |
| Plus | $280 | 4M | $0.07/1K | $0.08/1K (in $100 blocks) | 15 | 800 |
| Enterprise | Custom | custom | custom | — | custom | unlimited |

- **This is resale gold:** $0.07–0.09 per 1K characters wholesale → even at $0.30/1K consumer pricing you keep a 70%+ margin. At FameSpeak-style retail (credits), margin is very wide.
- Studio plans are separate (Free $0 / Basic $5 / Plus $19 / Pro $29 / Business $69 — unlimited generation, credits only on download; commercial license on paid).

### Models (verified via docs)
| Model | Released | Languages | Emotions | Notes |
|---|---|---|---|---|
| **ssfm-v30** | 2026-01 | **37** (incl. Hindi, Thai, Vietnamese, Arabic, Punjabi, Tamil…) | 7 presets (normal, happy, sad, angry, whisper, toneup, tonedown) | **Smart Emotion** auto-detect; smoother prosody/pacing |
| **ssfm-v21** | 2025-07 | 27 | 4 presets (normal, happy, sad, angry) | lower latency |

- 500+ voices, searchable by model/gender/age/use-case (Studio voice explorer).

### Instant cloning API (verified)
`POST https://api.typecast.ai/v1/voices/clone` — multipart upload, **WAV/MP3, 5–150 sec, max 25 MB**, returns `uc_…` voice_id bound to `ssfm-v21` or `ssfm-v30`. Use the clone id in any TTS call. Delete via `DELETE /v1/voices/{voice_id}` to free slots. Auth: `X-API-KEY` header.

### Other API surface
- `POST /v1/text-to-speech` (WAV/MP3), streaming TTS, timestamp TTS (word/char alignment for captions), compose TTS (multi-speaker), recommend/list voices, subscription endpoint.
- SDKs for **15+ languages** (Python, JS/TS, Go, Rust, C#, Java, Kotlin, C, Swift, Zig, PHP, Dart, Ruby), MCP server, Zapier/Make/n8n/Google Sheets integrations, Cast CLI.
- Latency: low-latency claims for v21; ssfm-v30 trades a bit of speed for quality.

### Licensing / reseller-friendliness
- Paid plans include a **commercial license**; attribution optional on paid (required on Free plan only).
- 50/800/unlimited clone slots — designed for apps that clone user voices at scale.
- Typecast is Korean (Neosapience, Inc., San Mateo CA office); established, funded; **FameSpeak already resells Typecast** — proven viability.

### Pros / Cons for LugunaVoice
- **Pros:** cheapest credible wholesale rate with good quality, real cloning API, 37 languages, clean REST + SDKs, explicit commercial terms, proven reseller precedent.
- **Cons:** smaller brand than ElevenLabs; quality below Cartesia/ElevenLabs on expressive narration; support is ticket-based until Enterprise; Korean company — some data flows through KR/US endpoints (check DPA for EU users).

---

## 20. edge-tts (Microsoft Edge speech endpoint) — **deep dive**

**URLs:** Repo https://github.com/rany2/edge-tts · PyPI https://pypi.org/project/edge-tts/ · Endpoint `speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`

### What it is
A Python module (11.7K ⭐, GPL-3.0) that calls **Microsoft Edge's online read-aloud endpoint** — the same free service powering Edge "Read Aloud". No API key; it negotiates a WebSocket with a `trustedclienttoken` / `sec-ms-gec` anti-bot token to Microsoft's servers, then streams MP3.

### Official? No.
- It is **NOT a Microsoft product**. It is a community reverse-engineering of an undocumented internal endpoint.
- The service is free for *personal browser use* in Edge; there is **no license granting API/commercial use**.
- Microsoft's ToS and the service terms do not authorize programmatic/third-party commercial usage. Microsoft has broken the protocol multiple times (token changes, voice removal), and each time the library needs hotfixes.

### Capabilities
- ~**450 neural voices across 100+ locales** (same as Azure neural stock voices: en-US-JennyNeural, etc.) — genuinely good quality for $0.
- Controls: rate, volume, pitch; subtitles (word boundary); only single voice + single `<prosody>` — custom SSML is blocked by Microsoft.
- **No** voice cloning, **no** emotion control, **no** timestamps, **no** SLA, **no** streaming API contract beyond the websocket itself.

### Risks (for a commercial SaaS — read carefully)
1. **Legal:** unauthorized use of Microsoft's endpoint; commercial resale is a ToS violation. Microsoft can (and has) shut things down / send C&Ds. FameSpeak-style commercial apps using edge-tts exist but operate in a gray zone.
2. **GPL-3.0:** if you embed the *library code* in a distributed product you inherit copyleft obligations (your integration code that links it may need to be GPL). Calling it as a subprocess/CLI from a server is commonly argued to avoid this, but it's a legal judgment call.
3. **Stability:** undocumented tokens expire; Microsoft changes the protocol; rate-limiting and IP blocks happen under sustained load; no uptime guarantee.
4. **Quality control:** no per-voice pricing but also no guarantee voices stay; new voices/regions appear/vanísh.
5. **Data:** your text passes through Microsoft's consumer service — no DPA.

### Verdict for LugunaVoice
- **Use as:** a *development/demo* tool and as a **free-tier cost driver** *only if* you accept legal/operational risk; many smaller TTS sites do exactly this to make "free plan" viable.
- **Recommendation:** do NOT put edge-tts in the paid production path. Use Typecast (or Cartesia/Fish) for paid tiers; keep an edge-tts adapter behind a feature flag for free-tier experiments, with a fallback and clear risk acceptance. If you want legal + free-ish, Microsoft Azure neural at $16/1M or the 0.5M free chars is the legitimate equivalent.

---

## 21. Comparison master table

| Provider | Free tier | Rate (1K chars or 1M chars) | Voices / Langs | Cloning | Streaming | SSML | Latency | Commercial/Resell |
|---|---|---|---|---|---|---|---|---|
| ElevenLabs | 10K credits/mo | ~$170–300/1M (credits) | 200+ / 30+ | Instant+Pro | ✅ | ✅ | ~75 ms flash | ✅ from $6 |
| Cartesia | 20K credits/mo | ~$3.75/1M (Sonic) | hundreds / 30+ | Instant+Pro | ✅ (WS) | partial | **90 ms** | ✅ from $5 |
| Play.ht | 12.5K chars | ~$300/1M premium | 900+ / 140+ | Instant+HF | ✅ | ✅ | ~200 ms (mini) | ✅ (ent. = resell) |
| Resemble | 10K sec/mo | $2,000–6,000/1M (sec-based) | clones / 60+ | Rapid+Pro | ✅ | partial | ~300 ms | ✅ (partner pgm) |
| Speechify | 50K chars/mo | **$6–10/1M** | 1,500+ / 30+ | Zero-shot | ✅ | ✅ | <300 ms | ✅ |
| Murf | 10 min | plans only | 200+ / 30+ | ent. only | ❌ (weak) | ✅ | — | ✅ |
| LOVO | trial | plans only | 500+ / 100+ | ✅ unlimited (Pro) | API=ent. | ✅ | — | ✅ |
| WellSaid | 3 min/mo | plans only | 100+ / EN+ | ❌ | ✅ (API) | ✅ | — | ✅ |
| Unreal Speech | (down) | ~$150/1M (hist.) | — / ~10 | ❌ | ✅ | — | — | ⚠️ down |
| Rime | ~800K chars | $30–50/1M | 600+ / 50+ | ent. only | ✅ (HTTP+WS) | partial | **37 ms** | ✅ |
| Fish Audio | 8K credits/mo + **free API model** | **$15/1M UTF-8 bytes** | 2M+ / 30+ | ✅ 15-sec | ✅ (WS) | ❌ (tags) | very low | ✅ paid only |
| MiniMax | points trial | ~$50–90/1M (points) | curated / 30+ | ✅ | ✅ | partial | low | ✅ |
| OpenAI | none | $15–30/1M | 6 / ~30 | ❌ | ✅ | partial | ~300 ms | ✅ |
| Azure | 0.5M chars/mo | $16/1M (HD $30) | 500+ / 140+ | ✅ gated | ✅ | ✅ best | ~300 ms | ✅ |
| Google | 1–4M chars/mo | $4–30/1M | 220+ / 40+ | ✅ instant (Chirp) | ✅ | ✅ | ~250 ms | ✅ |
| Polly | 1–5M chars (12 mo) | $4–30/1M | 100+ / 30+ | custom only | ✅ | ✅ | ~300 ms | ✅ |
| Deepgram | $200 credit | $15–30/1M | ~200 / 30+ | ❌ | ✅ (WS) | ✅ | <300 ms | ✅ |
| IBM | 10K chars/mo | $20/1M | 100+ / 50+ | premium only | ✅ | ✅ | — | ✅ |
| Typecast | 30K credits/mo | **$70–90/1M wholesale** | 500+ / 37 | ✅ instant | ✅ | partial | low | ✅ **proven** |
| edge-tts | **$0 (unauthorized)** | $0 | ~450 / 100+ | ❌ | websocket | ❌ (blocked) | fast | ❌ **no** |

---

## 22. Top 8 recommendations for a startup voice SaaS (ranked)

Ranking criteria: wholesale price/margin, voice quality, cloning + features needed for a consumer TTS site, reseller-friendliness (licensing/API/attribution), reliability, and fit with the FameSpeak model.

| # | Provider | Why | Best role | Wholesale ballpark |
|---|---|---|---|---|
| 1 | **Typecast** | Resale-proof: cheap credits, instant-cloning API, 500+ voices, 37 langs, commercial license on paid, FameSpeak precedent | **Primary production engine** | $0.07–0.09/1K chars |
| 2 | **Cartesia** | SOTA quality at 90 ms for ~$3.75/1M; Pro tier $5 unlocks commercial + cloning | Premium/real-time tier | ~$3.75/1M |
| 3 | **Fish Audio** | Cheapest quality TTS ($15/M bytes ≈ $1.25/hr), free API model, 2M+ voices, 15-sec cloning | Bulk / budget tier, free-plan engine | ~$1.25/audio-hr |
| 4 | **ElevenLabs** | Brand trust + best expressive quality; startup grant (33M chars free) | Premium tier / voice-design upsell | $0.17–0.30/1K |
| 5 | **Speechify** | #1 leaderboard quality at $6/1M at scale, cloning + emotion + SSML | Alternative premium engine | $6–10/1M |
| 6 | **Rime** | 37 ms latency + self-hosting for enterprise voice-agent upsells | Agent/latency niche | $0.03–0.05/1K |
| 7 | **MiniMax** | Very cheap multilingual (esp. Asian languages) with cloning | Regional/language expansion | ~$0.05–0.09/min |
| 8 | **Azure Speech** | Enterprise/SLA/SSML/on-prem story, 0.5M free chars/mo, volume commitment tiers | B2B/enterprise deals, SSML-heavy clients | $16/1M (tiered) |

**Recommended stack for LugunaVoice:** Typecast (primary, like FameSpeak) + Cartesia or Fish Audio as a second quality/cost lever, ElevenLabs for premium upsells, Azure as the enterprise/SSML fallback — and **edge-tts only behind an explicit free-tier/experimental feature flag with documented legal risk.**

---

## 23. Sources (URL index)

- ElevenLabs pricing: https://elevenlabs.io/pricing ; startup grants: https://elevenlabs.io/pricing/startup-grants
- Cartesia pricing: https://cartesia.ai/pricing ; docs: https://docs.cartesia.ai
- Play.ht pricing (archived 2024): https://web.archive.org/web/20240901094556/https://play.ht/pricing/ ; live: https://play.ht/pricing
- Resemble pricing (archived 2025): https://web.archive.org/web/20250115173900/https://www.resemble.ai/pricing/ ; live: https://www.resemble.ai/pricing
- Speechify API pricing: https://speechify.ai/pricing ; docs: https://docs.speechify.ai
- Murf pricing: https://murf.ai/pricing
- LOVO pricing (archived 2024): https://web.archive.org/web/20241206073226/https://lovo.ai/pricing ; live: https://lovo.ai/pricing
- WellSaid pricing: https://wellsaidlabs.com/pricing/
- Unreal Speech: https://www.unreal-speech.com/pricing (unreachable at research time)
- Rime pricing: https://rime.ai/pricing/
- Fish Audio plans: https://fish.audio/plan/ ; API pricing: https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits
- MiniMax speech pricing: https://platform.minimax.io/docs/guides/pricing-speech
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- Azure Speech pricing: https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/
- Google Cloud TTS pricing: https://cloud.google.com/text-to-speech/pricing
- AWS Polly pricing: https://aws.amazon.com/polly/pricing/
- Deepgram pricing: https://deepgram.com/pricing
- IBM Watson TTS pricing: https://www.ibm.com/cloud/watson-text-to-speech/pricing
- Typecast API pricing: https://typecast.ai/pricing/api/ ; models: https://typecast.ai/docs/models ; instant cloning: https://typecast.ai/docs/api-reference/voices/instant-cloning
- edge-tts: https://github.com/rany2/edge-tts
