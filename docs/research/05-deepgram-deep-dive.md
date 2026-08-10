# Deepgram Text-to-Speech Deep Dive — LugunaVoice

**Date:** Aug 10, 2026 (all facts verified against live pages on this date unless marked "historical/approx.")
**Scope:** Exhaustive research on Deepgram's TTS offering for a 3-tier TTS SaaS (edge-tts free tier → Typecast premium → Deepgram high-quality tier). Complements `01-tts-api-providers.md`, `04-competitor-analysis.md`, and **`09-deepgram-full-platform-api.md`** (the complete platform: STT, Voice Agents, Text Intelligence, Management APIs — everything beyond TTS that we integrate).
**Sources:** deepgram.com/pricing, deepgram.com/product/text-to-speech, developers.deepgram.com (TTS REST, TTS WebSocket, voices & languages, media output settings, voice controls, latency, chunking, rate limits, voice-agent TTS models, Flux TTS docs), deepgram.com/terms, deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech, github.com/deepgram, registry.npmjs.org, speech.dev.

> **Naming clarification (important):** Deepgram does **not** have models named "TTS-1" or "TTS-2" — that naming belongs to **OpenAI** (`tts-1`, `tts-1-hd`, and Realtime "TTS-2" research previews; Artificial Analysis' leaderboard lists OpenAI's TTS-1/HD, not Deepgram). Deepgram's TTS model families are **Aura-1** (`aura-*`), **Aura-2** (`aura-2-*`), and the new Early-Access **Flux TTS** (`flux-*-en` on `/v2/speak`). Everything below uses Deepgram's real names.

---

## 0. Executive Summary (TL;DR)

| Dimension | Verdict |
|---|---|
| **Pricing** | **Aura-2: $0.030 / 1k chars** ($0.027 on Growth). **Aura-1: $0.015 / 1k chars** ($0.0135 Growth). Billed per character (spaces included); no per-minute billing. $200 free trial credit (≈6.7M chars of Aura-2 / 13M+ chars of Aura-1). Growth plan $4k+/yr prepaid (~20% off). Enterprise = negotiated. |
| **Quality** | Good-to-very-good for *conversational/enterprise* speech; Deepgram claims it beats ElevenLabs/Cartesia/OpenAI in a blinded preference study (customer-service tasks ~60% win rate) and in pronunciation of structured data (dates, $ amounts, emails, passwords). No third-party arena rating (absent from Artificial Analysis / no speech.dev operational score yet) — quality claims are self-reported. |
| **Voices** | **91 Aura-2 voices** (41 English + 17 Spanish + 9 Dutch + 7 German + 10 Italian + 5 Japanese + 2 French) + **12 Aura-1 English voices** + 12 Flux TTS voices (Early Access). 40+ English voices incl. US/GB/AU/IE/PH accents. |
| **Languages** | **7 languages** (en, es, de, fr, nl, it, ja) for Aura-2; 5 Spanish voices do en↔es code-switching. Aura-1 = English-only in today's catalog. Flux TTS = English-only (EA). **Notably weaker than edge-tts (75+ langs) and Typecast.** |
| **Latency** | Marketing: **sub-200 ms TTFB** for Aura-2, RTF 0.111x (≈100 ms compute per 1 s audio). Measured (docs): ~600 ms baseline + ~40 ms per 100 chars total; ≈277 ms TTFB after SSL. Streaming WebSocket for real-time audio. Aura-1 is the older, slower/cheaper model. |
| **Voice cloning** | **Not offered today.** No self-serve cloning, no docs page, no pricing line, no API endpoint. (Historical: a sales-led custom-voice program existed ~2021–22 and was discontinued.) Custom **STT** models exist, but custom **TTS** voices do not. If cloning is a must-have, use Typecast's or ElevenLabs' cloning — Deepgram cannot fill this slot. |
| **SSML** | **Not supported** (by design). Instead: Aura-2 `speed` (0.7–1.5x) + inline **IPA pronunciation overrides** (\{"word": "...", "pronounce": "..."/}) up to 500/request, plus "prompting"/text-formatting guidance for naturalness. |
| **Pronunciation dictionary** | No managed dictionary API. Per-request inline IPA overrides are the equivalent. |
| **Word timestamps** | **Not available** from TTS (no such parameter; TTS returns audio only). The Voice Agent API returns per-turn latency reports but not TTS word timestamps. |
| **Output formats** | REST: linear16/wav, mp3 (22.05 kHz, 32/48 kbps), opus/ogg (48 kHz), flac, aac, mulaw, alaw. **Streaming (WebSocket): raw linear16 / mulaw / alaw only** (8/16/24 kHz) — no mp3/opus over WS. |
| **Max text/request** | 2,000 chars per REST request or per WS flush; WS throughput 2,400 chars/min; 60-min connection cap; 20 flushes/60 s. |
| **Concurrency (rate limits)** | TTS REST **15** concurrent (PayGo, all regions); TTS streaming **45** (PayGo), **60** (Growth, NA), Enterprise 25/100–150. Per-*project*; workarounds forbidden. |
| **SDKs** | `@deepgram/sdk` (npm, v5.7.0, MIT, Node ≥18, single dep `ws`) — covers REST + WebSocket + Voice Agent + Flux TTS. Python `deepgram-sdk` (456★), Go (89★), .NET (53★), Java (8★), Rust community (66★). |
| **Reseller-friendly** | **Yes with conditions.** ToS permits embedding Deepgram in your own app ("material independent functionality"), but **bans reselling bare API access**, benchmarking/competing use of output, and model-weight extraction. A full TTS SaaS (UI + credits + content pipeline) is clearly compliant; a pure "raw API proxy" is not. |
| **Recommended tier role** | **Premium tier #3 of LugunaVoice** — ideal for: real-time/streaming voice features, IVR-style outputs, enterprise-grade pronunciation (finance/health/legal text), English-heavy premium content, and as the latency-king. **Do not** rely on it for cloning, non-EN languages, or SSML control. |

---

## 1. Pricing Details

### 1.1 TTS per-character rates (live pricing page, Aug 2026)

| Model | Pay As You Go | Growth (prepaid ≥$4k/yr) | Billing basis |
|---|---|---|---|
| **Aura-2** | **$0.030 / 1k chars** | $0.027 / 1k chars | Per character (incl. spaces + newlines) |
| **Aura-1** | **$0.015 / 1k chars** | $0.0135 / 1k chars | Per character |

- **Billed per character, not per minute or per second.** Characters counted include spaces and newlines (docs: "The total number of characters in the input string are counted for billing purposes, including spaces and newline characters").
- **Pronunciation overrides are not billed as text** — the *underlying word* is billed; the IPA string is free (response headers `dg-char-count`, `dg-pronunciations-applied`, `dg-speed-used` confirm accounting). Speed control doesn't change billing.
- **Implied cost math for LugunaVoice:** 1 million Aura-2 chars = **$30**; 1M Aura-1 chars = **$15**. An average spoken word ≈ 5–6 chars → ~$0.15–0.18 per 1,000 words on Aura-2.
- **Context on the price:** Deepgram positions $0.030 against Cartesia Sonic ($0.038) and ElevenLabs Flash ($0.050) per 1k chars (their comparison blog). Aura-2 is ~2x the price of Aura-1 — the tradeoff is quality + pronunciation + latency.
- **`mip_opt_out`:** requests with `mip_opt_out=true` opt out of Deepgram's Model Improvement Program (their ML-training use of your content); docs note a **pricing impact** if enabled (per-model prices differ when opted out — verify current surcharge in console before enabling globally).
- **Tags:** optional `tag` query param for usage reporting; TTS callback (`callback`, `callback_method`) for async delivery.

### 1.2 Plans, free credit & credit mechanics

| Plan | Price | Concurrency (TTS) | Notes |
|---|---|---|---|
| **Pay As You Go** | $0 upfront + **$200 free credit** | REST 15 / WS 45 | No credit card required; credit expires ~90 days after signup (standard policy; confirmed free credit exists, expiry period is 90 days per Deepgram FAQ); then prepaid credits via auto-load |
| **Growth** | **$4,000+/year prepaid** | REST 15 / WS 60 (NA) | Up to 20% off usage rates; credits redeemed against actual usage; 10% overage fee applies on Growth overages (per pricing FAQ) |
| **Enterprise** | Custom (sales) | REST 25+ / WS 100–150 starting | SLAs, BAA for HIPAA, EU data residency, self-hosting, volume discounts |

- The $200 credit ≈ **6.66M chars** of Aura-2 (or 13.3M chars of Aura-1) — Deepgram's own blog says "$200 … enough for over 13 million characters of synthesis" (calculated at Aura-1 pricing).
- Credits auto-load on depletion; unused prepaid credits are refundable per policy (subject to their refund process); credits are not transferable/currency.
- Volume discounts and committed-use deals exist at the Enterprise tier ("volume discounts for committed usage" per Aura-2 announcement).

### 1.3 How that compares for our 3-tier SaaS

| Engine | Cost per 1k chars (typical) | Cost per 1M chars |
|---|---|---|
| Microsoft Edge TTS (via msedge-tts) | **$0.000 (free)** | $0 |
| Typecast API | ~$0.02–0.04 (their SDK/plan dependent) | ~$20–40 |
| **Deepgram Aura-1** | **$0.0150** | **$15** |
| **Deepgram Aura-2** | **$0.0300** | **$30** |

⇒ Deepgram slots in *between* Typecast's raw API and ElevenLabs as a mid-priced, high-latency-performance tier. At LugunaVoice's FameSpeak-style credit pricing (1 credit = 1 char), a 1:1 pass-through would be ~3 credits/char for Aura-2 — too rich; recommend margin strategy: either price Aura-2 at 1 credit/char and eat margin (still profitable at scale via $200 credit + Growth discounts), or reserve Deepgram for a "Studio"/"Pro" voice tier charged 2–3 credits/char.

---

## 2. TTS Models (Aura-1, Aura-2, Flux TTS)

### 2.1 Naming & availability

| Family | Model string pattern | Status | Endpoint | Price/1k chars |
|---|---|---|---|---|
| **Aura-1** | `aura-{voice}-en` (e.g. `aura-asteria-en`) | Generally available | `POST /v1/speak`, `wss://api.deepgram.com/v1/speak` | $0.0150 |
| **Aura-2** | `aura-2-{voice}-{lang}` (e.g. `aura-2-thalia-en`) | Generally available | same `/v1/speak` | $0.0300 |
| **Flux TTS** | `flux-{voice}-en` (e.g. `flux-haley-en`) | **Early Access** | `POST /v2/speak`, `wss://api.deepgram.com/v2/speak` | EA pricing; check console |

### 2.2 Aura-1 vs Aura-2 (the "TTS-1 vs TTS-2" question)

| | Aura-1 | Aura-2 |
|---|---|---|
| Positioning | Older GA model, cheapest | Flagship GA model — "enterprise-grade", purpose-built for voice agents/IVR/contact centers |
| Voice count (current catalog) | 12 (all English) | 91 across 7 languages |
| Latency | Slower; docs' measured latency guide targets Aura-2 | **sub-200 ms TTFB** claim; RTF 0.111x; consistent under load |
| Pronunciation | Standard | Trained on structured inputs: dates, times, currency, numerals, email/password/URL strings, drug names, alphanumerics; **IPA pronunciation override** support (en + es) |
| Speed control | Not documented | `speed` 0.7–1.5 (en + es) |
| Cost | $0.015/1k | $0.030/1k |
| Recommended use | Cost-sensitive bulk EN narration | Anything customer-facing or real-time |

### 2.3 Flux TTS — the new streaming-first family (Early Access, watch it)

- Served on **`/v2/speak`** over both WebSocket (real-time) and REST (batch); same 12-voice English catalog on both transports.
- Built for voice-agent pipelines: **turn-based lifecycle** (Idle → Generating → Finalizing → Closing), **cross-turn voice consistency** (conversational state persists between turns), and server-side flush boundaries so you can stream LLM tokens straight into the socket.
- Planned at GA: interruption feedback (barge-in reporting) and mid-stream speed `Configure`.
- **Migration path exists** from `/v1/speak` (docs: "Migrating from /v1/speak to Flux TTS").
- Verdict for us: interesting for a future real-time "voice agent" feature, but **Early Access = do not build the core product on it**. Ship on Aura-2; keep Flux TTS as a candidate for v2 live-chat TTS.

---

## 3. Voices & Languages

### 3.1 Voice catalog (from the live "Voices and Languages" docs page, Aug 2026)

Model string format: `[modelname]-[voicename]-[language]`, e.g. `model=aura-2-thalia-en`.

**Aura-2 — 91 voices / 7 languages:**

| Language | Accents | # voices |
|---|---|---|
| English (en) | en-us, en-gb, en-au, en-ie, en-ph | **41** (incl. Thalia, Andromeda, Helena, Apollo, Arcas, Aries — featured; Athena, Atlas, Draco, Hyperion, Pandora, Zeus, etc.) |
| Spanish (es) | es-mx, es-es, es-co, es-ar, es-419 | **17** |
| Dutch (nl) | nl-nl | 9 |
| German (de) | de-de | 7 |
| Italian (it) | it-it | 10 |
| Japanese (ja) | ja-jp | 5 |
| French (fr) | fr-fr | 2 |
| **Total** | | **91** |

- **Code-switching voices:** 5 Spanish voices (Aquila, Carina, Diana, Javier, Selena) seamlessly switch en↔es mid-sentence.
- Each voice ships with metadata: expressed gender, age band, accent, "characteristics" (e.g. Thalia = "Clear, Confident, Energetic"), and suggested use cases (casual chat, customer service, IVR, storytelling, advertising, interview, informative).

**Aura-1 — 12 English voices** (asteria, luna, stella, athena [en-gb], hera, orion, arcas, perseus, angus [en-ie], orpheus, helios [en-gb], zeus). The API `model` enum currently exposes only English Aura-1 voices. (Historically Aura-1 also shipped Korean/Portuguese/Mandarin voices; those are no longer in the current model enum — verify at launch if you plan to offer them.)

**Flux TTS — 12 English voices** (EA): Haley, Heather, Cole, Alexis, Priya (en-IN accent), Jack (en-GB), Bruce, Rufus (en-GB), Drew, Renee (55+), Marcus, Sharon (en-AU). Multilingual `flux-{voice}-multi` voices are "planned for a later release."

### 3.2 Language-support summary vs our other engines

| | Deepgram | Typecast | edge-tts (free) |
|---|---|---|---|
| Languages | **7** (en/es/de/fr/nl/it/ja) | 40+ (their catalog) | **75+** |
| English accents | 5 (US/GB/AU/IE/PH) | ~30 | ~40 |
| Code-switching | 5 ES voices | some | no |
| Non-Latin scripts (zh/ko/hi/ar) | **✗ none** | ✓ | ✓ |

**Strategic takeaway:** Deepgram is **English-first and Western-European-only** for TTS today. It cannot be the engine behind LugunaVoice's multilingual surface (Hindi, Bengali, Arabic, Chinese, Korean…) — edge-tts (free) and Typecast must cover those. Deepgram is the **English-premium tier**.

---

## 4. Streaming TTS (WebSocket) — how it works

### 4.1 Connection

```
wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=24000
```
Auth: `Authorization: Token <key>` (or Bearer JWT). Optional params on connect: `model`, `encoding`, `sample_rate`, `speed`. **Voice and media settings are fixed per connection** — one WebSocket per conversation; you cannot change the voice mid-connection.

### 4.2 Message protocol

| Message | Purpose |
|---|---|
| `{"type": "Speak", "text": "..."}` | Send text to synthesize (text buffers server-side) |
| `{"type": "Flush"}` | Force audio generation of the buffered text → server streams binary audio frames + emits `Flushed` |
| `{"type": "Clear"}` | Clear the internal text buffer without generating |
| `{"type": "Close"}` | Close the connection immediately |

Server → client: a `Metadata` JSON message (request_id, char counts) then **binary audio frames** (base64 in SDKs) in the negotiated encoding, then `Flushed` event. Errors/warnings arrive as JSON (`err_code`/`err_msg`).

### 4.3 Streaming limits (hard numbers)

| Limit | Value |
|---|---|
| Max text per request / flush | **2,000 chars** (413 error beyond) |
| Character throughput | **2,400 chars/min** per connection |
| Connection timeout | **60 minutes** from connect (active connections); reconnect after |
| Flush messages | max **20 / 60 seconds** (warnings beyond) |
| Concurrency | PayGo **45** WS, Growth **60** (NA), Enterprise 100–150 |
| Encoding | **linear16, mulaw, alaw only** (no mp3/opus over WS) |

### 4.4 Audio output streaming (REST)

Even on REST, audio streams back from the first byte (docs: "Streaming of results begins once the first byte of audio is synthesized"), so you can `fetch`/`request` with `stream: true` and pipe chunks to the browser/Speaker without waiting for the full file. Combined with text chunking this gives near-realtime playback without the WS.

---

## 5. SSML

**Deepgram TTS does not support SSML — and says so deliberately.** From the Aura-2 announcement: Aura-2 "is optimized for consistency: controlling loudness, reducing jitter, and pacing structured content naturally, **all without needing SSML**."

Deepgram's position: prosody/pacing/emphasis are handled contextually by the model from well-punctuated plain text (see §9 formatting guidance), plus explicit controls:

- **`speed`** query param (REST + WS, en + es): float 0.7–1.5, default 1.0; for Spanish keep ≥0.9 ("values below 0.9 may introduce disfluencies").
- **Pronunciation overrides** (REST + WS, en + es): inline escaped-JSON IPA objects.

**Implications for LugunaVoice:** if a "SSML editor" is on your roadmap, Deepgram cannot serve that feature (Typecast supports SSML; edge-tts does not). Our abstraction layer should treat SSML as a Typecast-only capability and degrade gracefully for Deepgram (e.g. translate common SSML intents — `<break>`, `<prosody rate>` → punctuation + `speed` param).

---

## 6. Pronunciation Dictionary

There is **no managed pronunciation-dictionary API** (no persistent lexicon CRUD endpoint). The equivalent is the **inline IPA override** in Aura-2:

```
Take \{"word": "dupilumab", "pronounce": "duːˈpɪljuːmæb"\} twice daily.
```

Rules & limits (docs "TTS Voice Controls"):

| Rule | Limit |
|---|---|
| Max pronunciations per request | **500** |
| Max IPA string length | **128 chars** |
| IPA length ratio | ≤10x source word length (floor 15) |
| Max input text | **2,000 chars** |
| Escaping | Curly braces must be backslash-escaped (`\{` / `\}`) in JSON |
| Billing | Only the underlying word counts; IPA is free |

Response headers confirm application: `dg-pronunciations-applied`, `dg-speed-used`, `dg-pronunciation-warnings`; error codes `speed_out_of_range`, `pronunciation_invalid`.

**Product implication:** for LugunaVoice, implement pronunciation overrides as a **per-user/per-project word list** stored in our DB and injected as inline IPA blocks at synthesis time (this gives us the "pronunciation dictionary" UX without any Deepgram-side dictionary feature). IPA sourcing guidance from Deepgram: LLM for <20 words, Cambridge/Collins/OED for larger lists; validate by ear; match dialect (UK vs US IPA differ).

---

## 7. Voice Cloning / Custom Voice — the full picture

**Short answer: Deepgram does not offer TTS voice cloning today.**

Evidence (all primary, Aug 2026):
1. **No docs page** — the entire developer documentation index (llms.txt, ~300 pages) contains zero custom-voice/cloning pages for TTS.
2. **No pricing line** — pricing page lists only Aura-1/Aura-2 per-char rates; no one-time or monthly cloning fees.
3. **No API surface** — the `model` enum for `/v1/speak` contains only stock voices; there is no voice-create/train endpoint in the API reference.
4. **No marketing** — the TTS product page and Aura-2 announcement emphasize stock voices ("40+ voices") and explicitly position against platforms that gate "features like voice cloning" behind tiers.
5. **History:** Deepgram ran a sales-led custom TTS voice program ~2021–22 (Aura Custom Voice) that was discontinued; since then custom voice work has not been a documented public product. Custom **STT** model training (sales-led) still exists — that is speech-recognition customization, not TTS cloning.
6. **speech.dev** (fact-checked directory) lists no cloning capability for Aura-2.

**If we want cloning in the premium tier, Deepgram cannot supply it** — Typecast (instant cloning, self-serve) and ElevenLabs remain the cloning options; that's a real argument for keeping Typecast as our cloning-capable tier (or adding ElevenLabs later). Verify with Deepgram sales before finalizing this assumption (enterprise deals occasionally include bespoke voices), but treat "no cloning" as the baseline.

---

## 8. Audio Output Formats & Container/Codec Options

### 8.1 Supported combinations (docs "Media Output Settings")

| Encoding | Container | Sample rates (Hz) | Bitrate (bps) | Transport |
|---|---|---|---|---|
| `linear16` | `wav` (default) or `none` (raw) | 8k, 16k, **24k (default)**, 32k, 48k | n/a | REST + WS |
| `mulaw` | `wav` or `none` | **8k (default)**, 16k | n/a | REST + WS |
| `alaw` | `wav` or `none` | **8k (default)**, 16k | n/a | REST + WS |
| `mp3` | n/a | fixed 22.05k | **48k (default)**, 32k | REST only |
| `opus` | `ogg` (default) | fixed 48k | **12k (default)**, 4k–650k | REST only |
| `flac` | n/a | 8k, 16k, 22.05k, 32k, 48k | n/a | REST only |
| `aac` | n/a | fixed 22.05k | **48k (default)**, 4k–192k | REST only |

- **Defaults if unspecified:** REST → `linear16` + `wav` + 24k; WebSocket → `linear16` raw + 24k.
- **Telephony gotcha (relevant if we ever do phone/IVR):** for real-time transport use `container=none` (raw) or the embedded WAV header causes clicks/static on telephony stacks.
- **Sample rate does not affect latency or price** (docs: "you can generate audio with any of these sample rates at the same speed") — deliver 48k linear16 WAV as the high-fidelity default, mp3 for downloads, opus for web playback.

### 8.2 What we can't get from Deepgram
- **No MP3/Opus/FLAC over the streaming WebSocket** — streaming is raw linear16/mulaw/alaw only (fine: we can transcode; linear16 24k is the canonical input for browser `AudioContext` and Twilio/Pipecat pipelines).
- **No word timestamps / subtitle sync** from TTS (no timing data in responses). Edge-tts can't either; Typecast's API similarly returns audio only. If a future feature needs word-level alignment (karaoke-style highlights), estimate timings from char counts or use forced-alignment at post-processing.

---

## 9. Text Chunking & Formatting Guidance (for long text)

### 9.1 Chunking rules (docs "Text Chunking for TTS Optimization" + "TTS Latency")
- **2,000-char hard cap** per REST request / WS flush.
- Latency is linear: **~600 ms baseline + ~40 ms per 100 chars** (measured 300-char ≈ 756 ms, 900-char ≈ 879 ms total).
- **For long content:** chunk *close to the 2,000-char maximum* per request to minimize cumulative latency (3x chars ≈ 1.33x time), **split only at sentence/clause boundaries** (`. ? ! ;` and `, and/but/or/...`), never mid-sentence (breaks prosody → choppy audio).
- **For streaming playback:** send the first sentence, stream from first byte, then queue subsequent chunks; consider parallelizing independent chunks.
- Docs provide reference implementations (Python/Java): max-chars chunking, clause-boundary regex chunking, dynamic chunking, chunk+stream playback.
- **Aura-2 text formatting guide:** always end sentences with punctuation; use question marks/exclamation points for prosody; commas for pauses; hyphens for extra pauses ("Your total is $45.82 - please pull forward."); quote command words/acronyms; avoid ALL CAPS, run-ons, and missing spaces after URLs/emails. Prompt LLM outputs to "respond in a natural, conversational tone with appropriate punctuation for text-to-speech."

### 9.2 Recommended LugunaVoice pipeline
```
long text → sentence/clause tokenizer → chunks ≤ ~1800 chars (safety margin)
→ parallel REST synth (linear16/wav/24k) OR sequential WS → concat/transcode → store
```

---

## 10. SDKs & Developer Resources

### 10.1 Official repos (github.com/deepgram, stars/license verified Aug 2026)

| Repo | Package | Lang | Stars | License | Notes |
|---|---|---|---|---|---|
| `deepgram/deepgram-python-sdk` | `deepgram-sdk` (PyPI) | Python | **456** | MIT | Most popular; docs include TTS REST + WS + Voice Agent |
| `deepgram/deepgram-js-sdk` | **`@deepgram/sdk`** (npm) | TS | **270** | MIT | Our target SDK (Node); v5.7.0, Node ≥18, only runtime dep `ws` |
| `deepgram/deepgram-go-sdk` | `github.com/deepgram/deepgram-go-sdk` | Go | **89** | MIT | WS + REST TTS supported |
| `deepgram/deepgram-rust-sdk` | community | Rust | **66** | MIT | Community-maintained |
| `deepgram/deepgram-dotnet-sdk` | `Deepgram` (NuGet) | C# | **53** | MIT | |
| `deepgram/recipes` | — | multi | 27 | — | DX example recipes incl. TTS |
| `deepgram/cli` | `dg` CLI (incl. TTS) | Python | 8 | MIT | Terminal synth (`dg speak`) + MCP server |
| `deepgram/deepgram-java-sdk` | `com.deepgram:deepgram-java-sdk` | Java | 8 | MIT | |
| `deepgram/deepgram-api-specs` | OpenAPI/AsyncAPI | spec | 7 | CC-BY-4.0 | For codegen / typed clients |
| `deepgram/kur` | research | Python | 824 | Apache-2.0 | Legacy DL framework (not TTS; listed for completeness) |

### 10.2 @deepgram/sdk (npm) — what matters for us
- **v5.7.0**, MIT, `engines.node >= 18`, **single production dependency** (`ws` ^8.20), ESM+CJS, browser-safe builds (`fs:false, os:false...`).
- Exports: `speak.v1.audio.generate` (REST, returns streamable iterator), `speak.v1.connect` (WebSocket: `sendText`, `sendFlush`, events `open/close/message/error`, `Metadata`/`Flushed`), `speak.v2` (Flux TTS), `listen` (STT), `agent` (Voice Agent API), `manage` (usage/billing), plus `@deepgram/agents`, `@deepgram/react`, `@deepgram/ui` for browser voice agents.
- SDK feature matrix documented at developers.deepgram.com/sdks/sdk-features.

### 10.3 Node.js example — REST (file)
```js
import { DeepgramClient } from "@deepgram/sdk";
import { writeFile } from "node:fs/promises";

const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

// REST synth -> mp3 (or linear16/wav, flac, opus...)
const response = client.speak.v1.audio.generate({
  text: "Hello! Welcome to LugunaVoice premium audio.",
  model: "aura-2-thalia-en",
  encoding: "mp3",
});
const audioBuffer = Buffer.concat([...response]);  // response is an async iterable (streams from first byte)
await writeFile("output.mp3", audioBuffer);
```
(Equivalent one-liner: `POST https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=mp3` with `Authorization: Token <key>`.)

### 10.4 Node.js example — streaming (WebSocket)
```js
import { DeepgramClient } from "@deepgram/sdk";
import { appendFile } from "node:fs/promises";

const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

const connection = await deepgram.speak.v1.connect({
  model: "aura-2-thalia-en",
  encoding: "linear16",
  sample_rate: 24000,
});

connection.on("open", () => {
  // Feed text (chunked; buffer flushes on sendFlush)
  connection.sendText({ type: "Speak", text: "The quick brown fox jumps over the lazy dog." });
  connection.sendFlush();
});
connection.on("message", (data) => {
  if (typeof data === "string") {
    appendFile("stream.raw", Buffer.from(data, "base64"));  // raw PCM16 24k mono
  } else if (data.type === "Flushed") {
    connection.sendClose();
  }
});
connection.on("error", (err) => console.error(err));
await connection.connect();
```
(To play raw linear16 in the browser, feed the PCM into `AudioContext.decodeAudioData`/`ScriptProcessor`, or prepend a 44-byte WAV header as their docs demonstrate.)

---

## 11. Reselling / White-Label Commercial Terms (ToS analysis)

From **deepgram.com/terms** (§2.3, §2.4, §3):

- **What's allowed:** "you may integrate our Services into your own platform, website, application, or other product or service (your 'Application'), **provided that your Application contributes material independent functionality beyond our Services**."
- **What's banned:**
  - "Resell, redistribute, or make available any portion of our Services **on a stand-alone basis**"
  - Copy/lease/sell/sublicense/distribute/modify/create derivative works of the Services "other than as expressly permitted"
  - Using services or **Output for competitive purposes, including model training, benchmarking and other competitive analysis, or developing competing models, products or services**
  - Reverse-engineering model weights, removing watermarks, scraping at scale
  - "attempt to interfere with" rate limits; distributing traffic across multiple projects to bypass per-project concurrency limits **"violates our Terms of Service"** (secondary projects on self-serve are capped at 1 concurrent stream)
- **Content ownership:** Deepgram does not claim ownership of your content; you grant them a broad license to use your content to improve/train models **unless you opt out** (`mip_opt_out` per-request, or console setting). This applies to Input *and* Output.
- **Publicity:** they may identify you as a customer in marketing until you opt out (ask marketing@deepgram.com).

**Verdict for LugunaVoice — reseller-friendly with guardrails: ✅ compliant as designed, ⚠️ not as a raw API proxy.**
LugunaVoice (UI + credit economy + voice library + content storage + audio tools) is exactly the "Application with material independent functionality" the ToS contemplates — same model as every TTS reseller (and FameSpeak itself). Cautions to encode in our ops:
1. Do **not** sell "bare Deepgram API access" as a product (e.g., no "bring-your-own-key passthrough proxy" as a headline feature).
2. Do **not** offer Deepgram benchmarking/quality-comparison tooling to end users, and don't publish Deepgram-vs-X scorecards using their output.
3. Keep all traffic under **one project** on our Deepgram account (per-project concurrency is the limit; multiple projects = ToS violation) — or negotiate an Enterprise agreement before we need >15 concurrent REST / >45–60 WS.
4. Decide the MIP opt-out policy: defaulting `mip_opt_out=true` may change pricing (docs flag a pricing impact) — it also protects our users' texts from training. For a consumer-facing SaaS, opt out unless cost is prohibitive.

---

## 12. Quality: third-party & self-reported data

| Source | Finding |
|---|---|
| **Deepgram's own blinded study** (Aura-2 launch, 2,794 three-way comparisons / 8,382 samples, hidden vendors: Azure, Google, ElevenLabs, PlayHT, Cartesia, OpenAI) | Aura-2 preferred **~60% of the time in customer-service scenarios**; 4 of the top 5 voices for enterprise tasks were Aura-2 voices |
| **Deepgram pronunciation benchmark** (280+ utterances: currency, dates, emails, passwords, addresses) | Aura-2 highest share of "Good" ratings vs the same 6 vendors (chart in launch post; exact % not published in text) |
| **Deepgram latency benchmark** | Best TTFB + **RTF 0.111x** (1 s of audio in ~100 ms) of the 7 vendors; least variance under load |
| **speech.dev (fact-checked directory)** | Lists Aura-2 ($0.03/1k, per-char, streaming, WSS+HTTPS, languages en/es/fr/de/it/pt/nl); **no operational quality assessment published yet**; LiveKit Inference lists Aura-2 at $30/1M chars |
| **Artificial Analysis TTS leaderboard** | **Deepgram not indexed** (90 models listed — OpenAI TTS-1/HD, Eleven, Cartesia, Rime, etc.; no Aura/Aura-2) — so there is **no neutral arena Elo** for Deepgram TTS; treat quality claims as vendor-reported |
| **Third-party commentary** | SiliconAngle covered Aura-2 as "high-performance TTS engine built for business interactions"; AIM wrote "Deepgram's new TTS AI model outperforms ElevenLabs and OpenAI" (vendor-fed coverage; treat with salt) |

**Honest synthesis:** Deepgram Aura-2 is widely regarded as *very good for conversational/customer-service speech* — clear, fast, consistent — but it is not the expressive "Hollywood" narrator ElevenLabs/Murf-style voices are. For LugunaVoice's premium tier, position it as **"studio-clear, real-time, professional English voices"** (call centers, IVR, e-learning, notifications, assistants), not as cinematic narration. Its best-in-class strengths are pronunciation of structured data (dollars, dates, codes, drug names), latency, and price-per-quality for real-time use.

---

## 13. Rate Limits / Concurrency (detailed)

Per-project, per-region (NA `api.deepgram.com`, EU `api.eu.deepgram.com`, AU `api.au.deepgram.com`):

| Service | Pay As You Go | Growth | Enterprise (starting) |
|---|---|---|---|
| **TTS REST** (Aura-1 & Aura-2) | **15** concurrent | **15** | **25** |
| **TTS Streaming (WS)** | **45** concurrent | **60** (NA; 45 EU/AU) | **100–150** (Aura-1 150 / Aura-2 100) |
| STT (reference) | 50 REST / 150 WS | 50 / 225 | 200 / 300 |
| Voice Agent API | 45 WS | 60 | 100+ |

Notes:
- Limits apply **per project** (not per key/account); all keys in a project share the pool; extra projects don't raise the ceiling (secondary self-serve projects: 1 concurrent stream). Beyond limit → **HTTP 429 Too Many Requests**.
- Pricing page's overview says "TTS up to 45 REST+WSS" (PayGo) / 60 (Growth) — the authoritative API rate-limits reference splits it as REST 15 / WS 45; **plan capacity on REST 15, WS 45**.
- No hard monthly request cap on PayGo (credits throttle spend); 2,400 chars/min per WS connection; 2,000 chars/request.
- REST management endpoints (usage/billing/projects) have separate, higher limits.

**Capacity math for us:** 15 concurrent REST = up to 15 ~2k-char requests in flight ≈ 30k chars/request-burst; a single-user bulk job is fine, but **flooding 1,000 parallel jobs would 429**. Design: an internal worker queue with concurrency cap 12 (safety margin), exponential backoff on 429, and WS pooling for real-time features. Upgrade path: Growth ($4k/yr) for 60 WS, or Enterprise for REST 25+/WS 100+.

---

## 14. Compliance & Security (relevant to a B2B-adjacent SaaS)

- SOC 2 Type I & II certified; HIPAA with signed BAA (Enterprise); **GDPR-ready with EU data residency endpoint** (`api.eu.deepgram.com`); CCPA; PCI DSS.
- Servers currently US-only for the default endpoint (docs note "Deepgram's servers are exclusively in the United States" for latency modeling) — EU endpoint exists for residency.
- Self-hosting available (Docker/K8s/SageMaker, AWS/GCP/Azure/Oracle) — Enterprise-level; not relevant to our launch but a nice "on-prem for enterprise clients" future line.

---

## 15. Pros / Cons vs Typecast & edge-tts (for our 3-tier architecture)

| Dimension | Deepgram (tier 3) | Typecast (tier 2) | edge-tts (tier 1, free) |
|---|---|---|---|
| Cost/1k chars | $0.015–0.030 | ~$0.02–0.04 (SDK-dependent) | **$0.000** |
| Voice quality (EN, premium) | **Very good (conversational/professional)** | Good (incl. celebrity-style/character voices) | Mediocre (neural but dated) |
| Voice count | 103 (91 Aura-2 + 12 Aura-1) | 1,000+ (their catalog) | 400+ (their catalog) |
| Languages | **7** | 40+ | **75+** |
| Latency | **Best-in-class (sub-200 ms claim)** | Good | Low (free server pool) |
| Streaming (real-time) | **✓ first-class (WS, raw PCM)** | ✓ (their realtime) | ✗ (no official API) |
| Voice cloning | **✗ not offered** | **✓ instant cloning** | ✗ |
| SSML | ✗ (IPA + speed instead) | ✓ | ✗ |
| Pronunciation overrides | **✓ IPA (en/es), excellent structured-data handling** | ✓ | ✗ |
| Commercial license | ✓ (ToS allows embedding w/ independent functionality) | ✓ (paid tiers) | ⚠️ gray — MS terms don't permit reselling edge-tts; ToS only says "material independent functionality" — this is why Deepgram is our legitimate premium tier |
| Reliability/SLA | **Enterprise-grade, SOC2/HIPAA/EU residency** | Good | **No SLA; undocumented endpoints; breakage risk (our free tier's known hazard)** |
| Concurrency | 15 REST / 45 WS self-serve (scalable via contract) | plan-limited | ~unlimited in practice (free) |
| Docs/SDK quality | **Excellent (typed SDKs, OpenAPI, CLI, MCP)** | Good | Community (msedge-tts npm) only |

**Key architectural conclusions:**
1. **Deepgram = the reliability/legitimacy anchor.** edge-tts gives us a free tier but is a legal (Microsoft ToS) and stability liability; Deepgram gives us a *commercially clean, SLA'd, SOC-2 premium tier* — essential if LugunaVoice wants real customers and possible B2B/enterprise accounts. It also lets us honestly market "premium licensed voices."
2. **Typecast remains the variety/cloning tier** (huge multilingual + character voice library + instant cloning). Deepgram cannot replace Typecast's breadth or cloning.
3. **edge-tts stays the free tier** for cost arbitrage but must be deprecated-in-design: our voice router should pick Deepgram whenever a "premium" flag, real-time requirement, or commercial-sensitive use case applies.

---

## 16. Recommended Role for Deepgram in LugunaVoice

**Tier:** the **high-quality/real-time tier (#3)** — "Studio" voices in the UI, priced above Typecast's mid tier (e.g. 2–3 credits/char vs 1).

**Ship these Deepgram features:**
- Aura-2 as the flagship premium voice set (pick ~8–12 EN voices; keep 1–2 ES for the Spanish codeswitching story).
- **Real-time playback** — REST chunked streaming from first byte; upgrade path to WS for live voice-agent features (or Flux TTS when GA).
- **Pronounced-correctly marketing angle** — money/dates/IDs/medical terms is Deepgram's differentiator vs Typecast/edge-tts.
- **Speed + IPA override** UI (per-user word list → injected inline IPA; `speed` slider 0.7–1.5).
- Output profiles: mp3 (downloads), 48k linear16 WAV (premium fidelity), opus (web playback).

**Do NOT ship on Deepgram:**
- ❌ Voice cloning (not available — route cloning requests to Typecast).
- ❌ Non-Western languages (zh/ko/hi/ar/... → edge-tts/Typecast).
- ❌ SSML editor (Typecast-only; translate simple intents for Deepgram).
- ❌ Word-timestamp/subtitle-sync features (unavailable).
- ❌ Core product on Flux TTS (Early Access — evaluate for v2).

**Launch/ops checklist:**
- Single Deepgram project (concurrency pool); internal queue capped at ~12 concurrent REST.
- Default `mip_opt_out=true` unless pricing delta is material (protects users' content).
- `$200` credit covers ~6.6M Aura-2 chars of beta; put $50–100 preload before GA; model Growth ($4k/yr, −10%) once usage confirms.
- Store audio in our own bucket (S3/local) so generated files aren't hostage to credits; cache identical text→audio requests to cut spend.
- EU endpoint option for EU customers (api.eu.deepgram.com) as a future compliance feature.

---

## Appendix: key source URLs

- Pricing: https://deepgram.com/pricing · Docs getting started: https://developers.deepgram.com/docs/text-to-speech · REST: https://developers.deepgram.com/docs/tts-rest · WS: https://developers.deepgram.com/docs/streaming-text-to-speech
- Voices/languages: https://developers.deepgram.com/docs/tts-models · Voice controls (speed/IPA): https://developers.deepgram.com/docs/tts-voice-controls
- Media output settings: https://developers.deepgram.com/docs/tts-media-output-settings · Latency: https://developers.deepgram.com/docs/text-to-speech-latency
- Chunking: https://developers.deepgram.com/docs/text-chunking-for-tts-optimization · Aura-2 formatting: https://developers.deepgram.com/docs/improving-aura-2-formatting
- Rate limits: https://developers.deepgram.com/reference/api-rate-limits · Speak API ref: https://developers.deepgram.com/reference/text-to-speech/speak-request
- Flux TTS: https://developers.deepgram.com/docs/flux-tts/overview · Voices: https://developers.deepgram.com/docs/flux-tts/voices
- Aura-2 announcement: https://deepgram.com/learn/introducing-aura-2-enterprise-text-to-speech · TTS product page: https://deepgram.com/product/text-to-speech
- ToS: https://deepgram.com/terms · SDKs: https://github.com/deepgram · npm: https://registry.npmjs.org/@deepgram/sdk/latest · speech.dev: https://speech.dev/models/deepgram-aura-2/

> **Follow-up (v2):** Deepgram's **full platform API** (STT/timestamps→SRT, Voice Agents, Text Intelligence, Management APIs, translation status) is documented in **`09-deepgram-full-platform-api.md`**. Key corrections/expansions that now shape LugunaVoice:
> - **SRT for flagship audio is possible** via an STT round-trip (Nova-3 word timestamps, free timestamps param, official `@deepgram/captions` SRT converter, $0.0043/min) — §8.2's "no word timestamps" limitation is now resolved at the platform level.
> - **Translation: does not exist as an API** (no `/translate` endpoint) — only multilingual code-switching. Our dubbing/translation features must use the DIY cascade (STT → external MT → Aura TTS) or another vendor.
> - **Usage/cost tracking is programmatic** (`GET /v1/projects/{id}/billing/breakdown?grouping=["tags","line_item"]` + per-request `tag` params) → powers our per-user COGS dashboards.
> - **TTS async callbacks** (`callback`, `callback_method`) exist for our job pipeline.
> - **Voice Agent API** ($0.075/min standard) is our phase-2 "custom agents" engine.
