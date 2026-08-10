# Deepgram Full Platform API — Research Report

> Complements doc 05 (TTS deep dive). This report covers Deepgram's ENTIRE platform: STT, TTS, Voice Agents, Text Intelligence, Audio Intelligence, Translation (or lack thereof), Management/Admin APIs, pricing, rate limits, regional endpoints, self-hosting, and GitHub ecosystem.
>
> **Data captured live on 2026-08-10** from developers.deepgram.com (llms.txt full index + feature pages + API references), deepgram.com/pricing (rendered tables + embedded JSON-LD structured pricing), deepgram.com/learn articles, and github.com/deepgram. Pricing is volatile — especially the **"limited-time promotional rates on streaming"** — verify at integration time.

---

## 1. Platform Overview Table

| Product | API surface | What it does | PAYG price (USD) | Notes |
|---|---|---|---|---|
| **Speech-to-Text — Pre-recorded (batch)** | `POST https://api.deepgram.com/v1/listen` (file bytes, `{"url":...}` or `{"bucket":...}` S3/GCS) | Transcribe/analyze stored audio, sync or async (callback) | Nova-3 mono **$0.0043/min** (Growth $0.0036); Nova-3 multi **$0.0052/min** (Growth $0.0043); Whisper large $0.0048/min | 2 GB max file; 10-min processing timeout; per-second billing granularity; add-ons extra (see §2) |
| **Speech-to-Text — Streaming (live)** | `wss://api.deepgram.com/v1/listen` | Real-time transcription with interim results, endpointing, VAD, utterance-end | **PROMO** (as of capture): Nova-3 mono **$0.0048/min** (struck-through list $0.0077), Nova-3 multi $0.0058 (list $0.0092) | "Limited-time promotional rates on streaming" — regular list prices struck through on the page |
| **Speech-to-Text — Flux (turn-based)** | `wss://api.deepgram.com/v2/listen` (turn-based) | Conversational ASR with model-native end-of-turn detection; built for voice agents | Flux English **$0.0065/min** streaming (list $0.0077, Growth $0.0057); Flux Multilingual **$0.0078/min** (Growth $0.0068) | Streaming-only; 10 languages on `flux-general-multi`; word-level timestamps; number-redaction only |
| **Text-to-Speech — Aura** | `POST /v1/speak` (REST) + `wss /v1/speak` (streaming) | Aura-1 / Aura-2 voice synthesis (covered exhaustively in doc 05) | Aura-2 **$0.030/1k chars** (Growth $0.027); Aura-1 $0.015/1k chars (Growth $0.0135) | REST concurrency 15; streaming 45 (PAYG) |
| **Text-to-Speech — Flux** | `POST /v2/speak` (batch) + `wss /v2/speak` (streaming, Early Access) | Streaming-first, voice-agent-first TTS; turn-based, interruptible, cross-turn prosody context | Not published on pricing page (Early Access) | Flux voices `flux-{voice}-en`; same voices on both transports |
| **Voice Agent API** | `wss://agent.deepgram.com/v1/agent/converse` (+ `api.eu/api.au` regional) | One WebSocket = STT + LLM + TTS + turn-taking + barge-in + function calling | Standard **$0.075/min** (Growth $0.068); BYO TTS $0.065 ($0.051); BYO LLM $0.065 ($0.059)*; BYO LLM+TTS **$0.050** ($0.041); Advanced $0.163 ($0.146); Advanced BYO TTS $0.122 ($0.110) | Billed on **websocket connection time**; max session 2 h; 45 concurrent (PAYG) |
| **Text Intelligence** | `POST https://api.deepgram.com/v1/read` | Sentiment, topics, intents, summarization on raw text (no audio) | Token-based: **$0.0003/1k input tokens** (+ $0.0006/1k output tokens for summarization); Growth $0.00024/$0.00048 | English only; 150k token/request cap; rates require Model Improvement Program opt-in |
| **Audio Intelligence** | `POST /v1/listen?...&summarize&sentiment&topics&intents&detect_entities` | Same intelligence features computed from audio | Same token pricing as Text Intelligence (summarize) + Entity Detection **$0.0017/min**, diarization $0.0020/min | English only (intelligence); entity detection available on streaming for Nova/Nova-2/Nova-3/Enhanced |
| **Management / Admin** | `GET/POST/PATCH/DELETE /v1/projects/...` (keys, members, invites, usage, billing, requests, models) | Programmatic account administration + spend tracking | Free | See §6 |
| **Auth** | `POST /v1/auth/tokens` | 30-second-TTL JWT for server-to-server client auth | Free | Alternative to long-lived keys; **250 temp keys/day** limit |
| **Self-hosted / on-prem** | Docker/Podman, Kubernetes, Amazon SageMaker, Modal | STT, TTS, Flux, Voice Agent behind your firewall | Licensing via sales (SageMaker: AWS Marketplace) | FIPS 140-3 images available |
| **Whisper Cloud** | `POST /v1/listen?model=whisper-{tiny,base,small,medium,large}` | Managed OpenAI Whisper | $0.0048/min (large) | NA only (no EU/AU); 3–5 concurrent; 20-min processing limit |

\* **Flag:** rendered page shows "Custom — BYO LLM $0.059/min (PAYG)" but the page's embedded JSON-LD says $0.065 PAYG / $0.059 Growth. Confirm via console/API before quoting.

**Plans:** Pay-As-You-Go (free $200 credit, no card, no minimums) vs Growth ($4K+/year pre-paid credits, ~15–20% discount, higher concurrency) vs Enterprise (contract, custom limits, HIPAA BAA, 99.9% SLA). Volume discounts are applied **automatically** as monthly usage crosses thresholds.

---

## 2. Speech-to-Text — Deep Section

### 2.1 Models

| Model | Streaming | Pre-recorded | Languages | Notes |
|---|---|---|---|---|
| **Flux** (`flux-general-en`, `flux-general-multi`) | ✔ (turn-based, `/v2/listen`) | ✖ | `en`; multi: en, es, fr, de, hi, ru, pt, ja, it, nl | Model-native end-of-turn detection; configurable `eot_threshold`, `eager_eot_threshold`, `eot_timeout_ms`; `Configure` message to change keyterms/thresholds mid-stream; Nova-3-level accuracy |
| **Nova-3** (`nova-3`, `nova-3-medical`) | ✔ | ✔ | **45+ languages** incl. dialects (70+ listed codes: ar ×17 dialects, zh-Hans/Hant/HK, en-US/GB/AU/IN/NZ, fr-CA, de-CH, es-419, pt-BR/PT, + Bengali, Gujarati, Kannada, Marathi, Punjabi, Tamil, Telugu, Thai, Vietnamese, Ukrainian, Hebrew, Persian…); `multi` = en, es, fr, de, hi, ru, pt, ja, it, nl | Highest-accuracy general model; -54.2% WER streaming / -47.4% batch vs competitors (Deepgram benchmark); multilingual codeswitching; self-serve vocabulary adaptation (keyterms, no retraining) |
| **Nova-2** (`nova-2`, + 11 domain variants: meeting, phonecall, finance, conversationalai, voicemail, video, medical, drivethru, automotive, atc) | ✔ | ✔ | ~40 languages; `multi` = es+en | Use for languages Nova-3 lacks + filler words |
| **Nova-1** (`nova`) | ✔ | ✔ | en (5), es, hi-Latn + domain variants | Legacy |
| **Enhanced / Base** | ✔ | ✔ | ~17 languages | Legacy tiers for cost/latency tradeoffs; Base = default if `model` omitted |
| **Whisper Cloud** | ✖ | ✔ | Whisper model coverage | Not on EU/AU endpoints |

### 2.2 All features — Pre-recorded (`POST /v1/listen`)

**Model & language:** `model`, `language`, `version`, `detect_language` (automatic language detection, all non-beta languages), `multilingual_code_switching` (`multi` languages only).

**Formatting (query params):**
- `smart_format` — punctuation, casing, dates, currency, phone numbers, emails (free, always recommended)
- `diarize` — per-word speaker labels (add-on $0.0020/min)
- `punctuate`, `paragraphs`, `numerals`, `filler_words`, `profanity_filter`, `dictation` (speak "comma" → ","), `measurements`
- `redact` — see §2.4
- `utterances=true` (+ `utt_split`) — semantic sentence/segment units **each with `start`/`end` timestamps** (this is the SRT building block)
- `find_and_replace` (token-level search/replace pairs), `search` (search terms in result), `keyterm` (Keyterm Prompting, up to 100 terms, +$0.0013/min), legacy `keywords`

**Media input:** `channels`, `multichannel` (per-channel transcription), `encoding`, `sample_rate`.

**Result processing:** `callback` + `callback_method` (async), `tag` (usage tagging), `extra` (arbitrary key/value metadata on the request).

**Intelligence (Audio Intelligence — English only, pre-recorded):** `summarize=v2|true` (needs >50 words to bill; one summary across channels), `sentiment`, `topics`, `intents`, `detect_entities` (+$0.0017/min).

**Output structure (verified example response):** `results.channels[].alternatives[]` containing:
- `transcript`, `confidence`
- `words[]` — **every word with `start`, `end` (float seconds), `confidence`, `punctuated_word`** → word-level timestamps are returned **by default, no extra cost**
- `paragraphs[].sentences[]` — each with `text`, `start`, `end` (when `paragraphs=true` or smart_format)
- `utterances[]` when enabled — semantic segments with `start`/`end`/`words[]`/`speaker`
- `summary` object when `summarize` enabled; `sentiment`/`topics`/`intents`/`entities` objects when enabled
- `metadata`: `request_id`, `duration`, `channels`, `models`, `model_info` (name/version/arch)

**Granularity note:** word-level timestamps are the documented standard; there is **no character-level `granularity` parameter in the current docs** (not present in the feature overview or API reference index). Sub-second float precision (e.g. `0.08`) is enough for SRT cue framing.

### 2.3 All features — Streaming (`wss://v1/listen`) and Flux (`/v2/listen`)

**Streaming (Nova models):** same formatting set as batch minus paragraphs/dictation/utterance-split; plus real-time controls:
- `interim_results=true` — partial hypotheses streamed as words are heard
- `endpointing` (ms of silence to finalize a segment), `utterance_end` message, `speech_started` message, `vad_turnoff`
- `no_delay` (tune latency vs redaction accuracy), `encoding`, `sample_rate`, `channels`, `multichannel`
- Control messages: `CloseStream`, `Finalize`, `KeepAlive`
- Callbacks: HTTP POST per streaming response, or **WebSocket callback** (`wss://` — a disconnect kills the stream)
- `detect_entities` supported streaming (Nova/Nova-2/Nova-3/Enhanced only)

**Flux (`/v2/listen`):** word-level timestamps, keyterm prompting, numerals, profanity filter, number-only redaction, language hints (`language_hint` on multi), turn events (StartOfTurn/EndOfTurn via `TurnInfo`), `Configure`/`CloseStream` messages, streaming-only.

### 2.4 Redaction / PII (payment-relevant for our B2B compliance story)

`redact=` accepts groups: `pci`, `pii`, `phi`, `numbers`/`true`, `aggressive_numbers`, **or 50+ specific entity types** (`credit_card`, `ssn`, `email_address`, `location_address`, `dob`, `phone_number`, medical entities, etc.). Replacements appear as `[CREDIT_CARD_1]`-style tags. Add-on: **$0.0020/min**.

Coverage: number redaction on all languages (batch) / 12 languages (Nova streaming); **entity redaction English-only**; Flux = numbers only (and rejects other values with HTTP 400 at connect). Streaming redaction is two-phase: interim `[REDACTED]` → final entity tag; set `no_delay=false` (default) for best accuracy.

### 2.5 Custom vocabulary / customization

- **Keyterm Prompting** (`keyterm=`) — self-serve, instant, no retraining; up to 100 terms; boosts KRR up to 90%; **$0.0013/min** (Growth $0.0012). This is Nova-3's "self-serve customization."
- Legacy `keywords` (boost/suppress) — retired in favor of keyterm.
- `find_and_replace`, `search` — token-level fixes.
- **Custom models** (`nova-2-<CUSTOM>`, custom intents `custom_intent_mode`, custom topics `custom_topic_mode`) — via sales; custom STT tier on pricing page says "Contact Sales."
- Deepgram has no self-serve model-training UI in the API (custom summarization models not exposed).

### 2.6 ⭐ SRT/WebVTT subtitles from Deepgram STT — feasibility & cost

**YES — this is a first-class, documented Deepgram pattern, and it is cheap.**

How (exact recipe):
1. Generate audio via our TTS (as today).
2. `POST /v1/listen?model=nova-3&smart_format=true&utterances=true` with the audio bytes/URL. (Or streaming `wss` + `finalize`.)
3. Response `results.channels[0].alternatives[0].utterances[]` (and `words[]`) carry float-second `start`/`end` per segment — exactly what SRT cues need.
4. Convert with Deepgram's **off-the-shelf caption SDKs**: `@deepgram/captions` (JS: `srt(result)`, `webvtt(result)`) or `deepgram-python-captions` (`DeepgramConverter(response)` → `srt(...)`). Official guide: "Automatically Generating WebVTT & SRT Captions" (see sources).

Cost to subtitle our own audio (the whole point):
- Nova-3 pre-recorded: **$0.0043/min** → a 10-min TTS audio = **$0.043**; a 1-hour file = **$0.26**. Utterances, word timestamps and smart_format are **included** (no add-on). Whisper large = $0.0048/min.
- Streaming (promo $0.0048/min) works too, e.g., piping TTS output straight into a live caption WebSocket.
- Round-trip ratio: TTS at Aura-2 $0.030/1k chars + STT at ~$0.0043/min → subtitle generation adds roughly **10–15% to our per-job TTS cost** — trivially absorbed and resellable as a premium feature.

Caveats: entity redaction/diarization would add cost but we don't need them; keep `smart_format=true` so cue text is punctuated/cased (SRT quality); batch 2 GB / 10-min processing limits are irrelevant for TTS-length audio.

### 2.7 STT pricing summary table

| Item | PAYG | Growth |
|---|---|---|
| Nova-3 mono — pre-recorded | $0.0043/min | $0.0036/min |
| Nova-3 multi — pre-recorded | $0.0052/min | $0.0043/min |
| Nova-3 mono — streaming (promo) | $0.0048/min | $0.0042/min |
| Nova-3 multi — streaming (promo) | $0.0058/min | $0.0050/min |
| Flux English — streaming | $0.0065/min | $0.0057/min |
| Flux Multilingual — streaming | $0.0078/min | $0.0068/min |
| Whisper large — pre-recorded | $0.0048/min | $0.0048/min |
| Redaction (add-on) | +$0.0020/min | +$0.0017/min |
| Keyterm Prompting (add-on) | +$0.0013/min | +$0.0012/min |
| Entity Detection (add-on) | +$0.0017/min | +$0.0017/min |
| Speaker Diarization (add-on) | +$0.0020/min | +$0.0017/min |
| Smart Formatting / utterances / timestamps / detect_language | **included** | included |

Billing mechanics: per-second metering (min billable block ~1 s); multichannel billed per channel-minute; silence is billed as audio time; no per-request minimums.

---

## 3. Translation — what actually exists

**Short answer: Deepgram does NOT sell a translation API. There is no `/translate` endpoint** (verified against the complete llms.txt index, the OpenAPI/AsyncAPI specs, the full docs sitemap — zero "translate" doc pages — and the API overview). What exists:

1. **Multilingual Code-Switching transcription** — `nova-3` with `language=multi` transcribes mixed-language audio (en, es, fr, de, hi, ru, pt, ja, it, nl) into a single transcript **in the original languages**. This is transcription, not translation.
2. **Translation is a DIY cascade**, which Deepgram's own learn articles document in detail ("Real-Time Speech-to-Speech Translation: Architecture Guide", "Deepgram Universal Transcriber Translator tutorial"):
   - Deepgram STT (Nova-3/Flux) → external machine-translation (Google Translate, AWS Translate, NLLB, MADLAD-400) → Deepgram Aura TTS.
   - Deepgram's own demo app "Universal Transcriber Translator" and iTranslate/Vonage integrations are all this pattern.
3. Pricing for translation = **STT + your MT bill + TTS** (nothing from Deepgram beyond the components). Latency guidance from the article: streaming ASR → MT → streaming TTS can hit sub-500 ms perceived; TTS is 62% of pipeline compute.

**For LugunaVoice:** no Deepgram translation API to resell. If we ever offer "translate this voiceover" it means (a) an MT provider (Google/AWS/DeepL) + Aura target-language voices, or (b) simply our existing text pipeline — don't build on Deepgram for this.

---

## 4. Voice Agent API (`/v1/agent/converse`) — our phase-2 resell candidate

### 4.1 Architecture

One WebSocket (STT + LLM + TTS behind it): open `wss://agent.deepgram.com/v1/agent/converse`, stream mic/telephony audio in, receive agent audio + transcript events out. Deepgram owns turn-taking (Flux end-of-turn), **barge-in/interruptions**, function calling, and latency. REST companion: agent configuration & variable management.

### 4.2 Capabilities (verified)

- **Media channels:** browser WebRTC-style capture via `@deepgram/agents` / `@deepgram/react` / `@deepgram/ui` / embeddable widget (Silero VAD built in); raw WebSocket audio; **telephony via Twilio, Genesys Cloud CX, Amazon Connect, AudioCodes (LiveHub)** — inbound and outbound calling are documented patterns.
- **LLM providers:** managed — OpenAI (`gpt-5.5`, `gpt-5.4`, `gpt-5`, `gpt-4.1`, `gpt-4o-mini`…), Anthropic (`claude-sonnet-5/4-6/4-5`, `claude-haiku-4-5`), Google Gemini (`gemini-3.5-flash`, `gemini-3-pro`, `gemini-2.5-flash`…), NVIDIA (`nemotron-3-nano-30B-A3B`); BYO — Groq, Amazon Bedrock (IAM/STS creds), and **any OpenAI-compatible endpoint** (`provider.type=open_ai` + `endpoint.url`/`headers` — works with gateways, Azure, custom). **Fallback chains**: pass an array of providers; per-turn automatic failover.
- **TTS:** Deepgram Aura-1/Aura-2 (managed) or third-party/BYO TTS. `UpdateSpeak` swaps the voice mid-session.
- **Function calling / tools:** server messages `FunctionCallRequest`/`FunctionCallResponse`; function call context in history; lets agents query our own APIs mid-call (this is the hook for "voice agents that can look up your account data").
- **Agent controls (client→server):** `Settings` (STT/LLM/TTS providers, audio formats, language, endpointing, keyterms), `UpdateThink`, `UpdateSpeak`, `UpdatePrompt` (live system-prompt swap), `InjectAgent` (push a statement), `InjectUser` (push user text), `KeepAlive` (survive long silences).
- **Server events:** `Welcome`, `SettingsApplied`, `ConversationText` (STT transcripts of user + agent turns), `UserStartedSpeaking`, `AgentThinking`, `AgentAudioDone`, `Acknowledgements`, `Error`/`Warning`, **`LatencyReport`** (per-turn STT/LLM/TTS latency breakdown), `FunctionCallRequest/Response`.
- **Context & memory:** `agent.context` (system prompt), conversation history replay on new session (2-h session cap), function call context.
- **Reusable configs:** Agent Configurations CRUD API (create/list/get/update/delete) + Agent Variables CRUD — one config, many sessions; these are the building blocks for **per-customer agent templates**.
- **Model discovery:** `GET https://agent.deepgram.com/v1/agent/settings/think/models` returns the live list of LLM providers/models (power a model picker in our UI).
- **Observability:** per-session, turn-by-turn message logging; session observability docs; latency reports.
- **Limits:** sessions auto-close at **2 hours** (warning 5 min before); PAYG concurrency **45 connections** (Growth 60, Enterprise 100+); billed on connection time.

### 4.3 Pricing → resell math

Billed **per minute of websocket connection time** (even silence/turnaround counts):

| Tier | What's included | PAYG | Growth |
|---|---|---|---|
| Standard | Deepgram STT + managed LLM + Aura TTS | **$0.075/min** ($4.50/hr) | $0.068/min |
| Standard – BYO TTS | LLM managed, you bring TTS | $0.065/min | $0.051/min |
| Custom – BYO LLM | Aura TTS, you bring LLM key | $0.065/min* | $0.059/min |
| Custom – BYO LLM + TTS | you bring both | **$0.050/min** ($3.00/hr) | $0.041/min |
| Advanced | Large models (gpt-5.5, gpt-5.4, claude-sonnet-5, gemini-3-pro) | $0.163/min | $0.146/min |
| Advanced – BYO TTS | | $0.122/min | $0.110/min |

*rendered page shows $0.059 PAYG; JSON-LD says $0.065 — verify.

**Feasibility for LugunaVoice (resell as "AI Phone/Voice Agent" add-on):**
- We can resell **Standard** at a ~2–3× markup: e.g. our price $0.15–0.25/min ($9–15/hr) vs $4.50/hr cost — agent economics work for B2B use cases (receptionist, booking, FAQ).
- Or **BYO LLM+TTS** at $0.050/min when the customer brings keys (thinnest margin but zero LLM risk for us).
- Platform lift is moderate: per-tenant agent configs (CRUD API), a browser widget (embed `@deepgram/ui` widget — drop-in), telephony via Twilio requires a Twilio account/phone number per tenant. Billing integration: our DB per-minute counter from `Usage` API or our own session timers.
- Watch-outs: 45-concurrent-connection ceiling per project (Growth 60) — fine for launch scale; 2-h session cap forces session chaining; Advanced tier prices are steep (only for large LLMs); Twilio media streams add their own per-minute cost outside Deepgram.

---

## 5. Text Intelligence (`POST /v1/read`)

Analyze raw text without any audio (great for post-processing our transcripts/scripts).

- **Features:** `summarize=true`, `sentiment`, `topics`, `intents` — any/all as query params on `/v1/read` with `{"text":"..."}` or `{"url":"..."}`.
- **Limits:** English only (400 on non-English); summarization requires >50 words (else input echoed back, unbilled); **150k tokens max per request**; callback + tagging supported; concurrency 10 (5 EU/AU).
- **Pricing:** token-based — **$0.0003 per 1k input tokens** + **$0.0006 per 1k output tokens** (summarization; Growth $0.00024/$0.00048); JSON-LD lists sentiment/topics/intents at $0.0003/1k input. Response includes `summary_info` with `model_uuid`, `input_tokens`, `output_tokens` for exact billing. Note on the pricing page: "Rates listed above opt in to the Model Improvement Program."
- The summarization model is not user-selectable via a public param (model chosen by Deepgram; v2 structure returns a single short summary).

---

## 6. Management / Admin APIs — for our cost dashboards

Base: `https://api.deepgram.com/v1` — auth `Authorization: Token <API_KEY>`.

| Endpoint | Purpose | Useful for us |
|---|---|---|
| `GET /projects`, `GET/PATCH/DELETE /projects/{id}` | List/manage projects | Multi-tenant separation per customer if we ever go that far |
| `GET /projects/{id}/keys` + `POST` (create w/ `scopes`, `comment`, `tags`, expiration), `DELETE` | API key lifecycle, **per-key tags** | Per-customer keys with tags → per-customer usage attribution |
| `GET/PUT /projects/{id}/members`, `scopes` | Team management | — |
| `GET/POST/DELETE /projects/{id}/invites` | Invitations | — |
| `GET /projects/{id}/usage` | Aggregate usage for a date range, **filterable by ~40 params** (`tag`, `accessor`, `method` sync/async/streaming, `endpoint` listen/read/speak/agent, `model`, `deployment` hosted/beta/self-hosted, and every feature flag: `diarize`, `redact`, `summarize`, `keyterm`, `smart_format`…) | The basis of our spend dashboard |
| `GET /projects/{id}/usage/fields` | List valid grouping/filter fields | Dynamic filter UI |
| `GET /projects/{id}/usage/breakdown` | Usage by grouping dimension | Cost per customer/tag/month |
| `GET /projects/{id}/requests` + `GET /requests/{id}` | **Per-request detail** (metadata incl. billing info, model, duration) | Job-level cost ledger — can be joined to our jobs table by `request_id` |
| `GET /projects/{id}/billing` + `/billing/{balance_id}` | Current credit balance(s) | Balance watchdog / low-credit alerts |
| `GET /projects/{id}/billing/breakdown` | **Billing by `line_item` (e.g. `streaming::nova-3`), `accessor`, `deployment`, `tags`, with `dollars`** | The single best endpoint: exact USD per product per customer per day |
| `GET /projects/{id}/billing/fields` | Fields list for billing breakdown | — |
| `GET /projects/{id}/billing/purchases` | Pre-purchase/credit purchases | Reconcile top-ups |
| `GET /projects/{id}/models`, `GET /models` | List available models + metadata (`GET /models/{id}`) | Model pickers, feature gating |
| `POST /v1/auth/tokens` | 30-s TTL JWT | Generate short-lived client keys instead of shipping our master key |
| Self-hosted distribution credentials CRUD | Licenses for self-hosted | Only if we self-host |

**Recommended cost-tracking pattern (batteries included by Deepgram):** tag every request we send with the LugunaVoice user/plan (`tag=lv:user123:plan:premium`), then nightly `GET /v1/projects/{id}/billing/breakdown?grouping=["tags","line_item"]` → insert into Supabase → per-user COGS dashboard. Per-key tags (`keys` API) automatically tag all requests made with that key — so creating one Deepgram API key per LugunaVoice customer gives attribution with zero request-side changes. Both patterns work; the billing breakdown `dollars` field is authoritative for true cost (vs usage minutes).

---

## 7. Integrations / patterns we should adopt

1. **Callbacks everywhere (async-first).** STT batch, TTS REST, and Text Intelligence all support `callback=URL` (+ `callback_method=POST|PUT`). Returns `request_id` immediately, then POSTs the result to our webhook. Retry: **up to 10 retries, 30 s apart** on non-2xx. Auth options: Basic Auth in URL (ports **only 80/443/8080/8443**) or **`dg-token` header** (auto-set to the API key id). Our Next.js API route must raise `bodyParser.sizeLimit` (Next.js default 100 kb → transcripts for long audio exceed it) — this is documented as the #1 "callback not received" cause.
2. **Tagging + billing/breakdown** — per-customer/per-plan cost attribution (see §6). Do this from day one; it's free and cannot be retrofitted cleanly.
3. **Regional endpoints for EU customers** — `api.eu.deepgram.com` (and `api.au.deepgram.com`). Same keys/SDKs, just swap base URL. All products (STT incl. Flux, TTS, Voice Agent, /v1/read) except Whisper. Managed OpenAI/Google LLM traffic in voice agents is routed to EU infrastructure on the EU endpoint. "Deepgram Dedicated" exists for fixed-country hosting.
4. **`mip_opt_out=true`** query param on STT **and** TTS requests — opt out of the Model Improvement Program per request (data retained only for processing). Needed if we ever process customer content we can't share. Note: some intelligence rates are priced as MIP-opt-in; opting out may affect terms — decide policy with our ToS.
5. **Word-level timestamps are free** — always request them (they're default) for SRT generation; never pay for character granularity (doesn't exist).
6. **Concurrency math:** our workers must treat Deepgram concurrency as a per-**project** pool (50 batch / 150 streaming STT, 15 TTS REST, 45 TTS WSS, 45 agent, 10 intelligence). Spread across projects is forbidden (secondary projects capped at 1 concurrent stream; ToS violation). For launches, one project + Growth/Enterprise for headroom; implement 429 exponential backoff (docs have a dedicated guide).
7. **Token-based auth** (`/v1/auth/tokens`, 30-s TTL JWT) for any client-side usage so the master key never ships to browsers.
8. **Model metadata endpoint** (`GET /v1/projects/{id}/models`) to build dynamic model lists (and the agent `think/models` endpoint for LLM pickers) instead of hardcoding.
9. **Free $200 credit** — burn on testing; Growth plan ~$4K+/yr prepaid for ~15–20% discount + higher concurrency; enterprise auto-tiers cut STT further at volume (e.g. ~$0.0036/min English at 5M min/mo per learn article).

---

## 8. Integration Blueprint for LugunaVoice

Mapping each Deepgram capability → LugunaVoice feature, with priority. (TTS items abbreviated — see doc 05.)

| Deepgram capability | LugunaVoice feature | Priority |
|---|---|---|
| STT batch `nova-3` + `utterances` + `smart_format` + **word timestamps** (free) | **SRT/WebVTT subtitle export** for generated voiceovers (via `@deepgram/captions`) | **Launch** (10–15% cost add-on; premium-plan upsell) |
| `tag` param + `billing/breakdown` + `requests` endpoints | **Per-user COGS / spend dashboard** in admin; margin alerting | **Launch** |
| `callback` + `callback_method` on TTS & STT | Async job pipeline (Next.js webhook receiver, raised body limit) | Launch (already in doc 05 for TTS) |
| `mip_opt_out=true` | Privacy-safe processing mode; ToS compliance for user content | Launch |
| EU endpoint | EU data-residency toggle for B2B customers | v2 |
| Keyterm Prompting (`keyterm=`) | User-defined pronunciation/vocabulary boosts for subtitles + transcripts | v2 |
| `redact=pii/pci/phi` | **PII scrubber** add-on for transcription users (compliance verticals) | v2 |
| `detect_language` + `multilingual_code_switching` | Multi-language subtitle support (transcribe generated multilingual audio) | v2 |
| Token-based auth (`/v1/auth/tokens`) | Server-side only; keep master keys in Supabase secrets; client-facing never | v2 |
| Audio Intelligence `summarize` | "AI summary" of generated narration (premium) | v3 |
| Text Intelligence `/v1/read` | Script/transcript summarization + sentiment in dashboard | v3 |
| **Voice Agent API** (Standard, BYO LLM+TTS) | **Phase-2 product: resell AI voice agents** (per-tenant agent configs via Agent Configurations CRUD, embeddable widget from `@deepgram/ui`, Twilio telephony per tenant) — margin math in §4.3 | **v3** |
| Flux STT `/v2/listen` | Real-time streaming transcript preview while TTS streams | v3 |
| Flux TTS `/v2/speak` (Early Access) | Multi-turn interactive voiceover (context-aware prosody) | v3, evaluate at GA |
| Diarization | Multi-speaker narration labeling (podcast-style) | v3 |
| Self-hosted / SageMaker | Do NOT build (we're a reseller; licensing + ops cost unjustified at our scale) | Don't build |
| Translation (doesn't exist as API) | Do NOT build on Deepgram; if ever needed, external MT (Google/DeepL/AWS) + Aura target voices | Don't build |
| Custom models (sales-gated) | Do NOT build — revisit only for enterprise customers | Don't build |
| Whisper Cloud | Do NOT build — slower, lower concurrency, no EU; Nova-3 superior | Don't build |

---

## 9. Source URLs

Docs (developers.deepgram.com — all append `.md` for clean markdown):
- Full index: https://developers.deepgram.com/llms.txt
- API overview: https://developers.deepgram.com/reference/deepgram-api-overview
- STT pre-recorded feature overview: https://developers.deepgram.com/docs/stt-pre-recorded-feature-overview
- STT streaming feature overview: https://developers.deepgram.com/docs/stt-streaming-feature-overview
- Flux feature overview: https://developers.deepgram.com/docs/flux/feature-overview
- Models & languages: https://developers.deepgram.com/docs/models-languages-overview
- Pre-recorded getting started (limits): https://developers.deepgram.com/docs/pre-recorded-audio
- WebVTT & SRT captions guide: https://developers.deepgram.com/docs/automatically-generating-webvtt-and-srt-captions
- Redaction: https://developers.deepgram.com/docs/redaction
- Summarization (audio): https://developers.deepgram.com/docs/summarization
- Text Intelligence overview + summarization: https://developers.deepgram.com/docs/text-intelligence / https://developers.deepgram.com/docs/text-summarization
- Audio Intelligence overview: https://developers.deepgram.com/docs/audio-intelligence
- Voice Agent: feature overview https://developers.deepgram.com/docs/voice-agent-feature-overview; LLM models https://developers.deepgram.com/docs/voice-agent-llm-models; architecture https://developers.deepgram.com/docs/voice-agent-architecture; media I/O https://developers.deepgram.com/docs/voice-agent-media-inputs-outputs
- Callbacks: STT https://developers.deepgram.com/docs/callback; TTS https://developers.deepgram.com/docs/tts-callback; payload-too-large https://developers.deepgram.com/docs/payload-too-large
- Rate limits: https://developers.deepgram.com/reference/api-rate-limits
- Regional endpoints: https://developers.deepgram.com/reference/regional-endpoints
- Model Improvement Program: https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program
- API keys: https://developers.deepgram.com/docs/create-additional-api-keys
- Management API refs: usage https://developers.deepgram.com/reference/manage/usage/get; billing breakdown https://developers.deepgram.com/reference/manage/billing/breakdown/get
- OpenAPI: https://developers.deepgram.com/openapi.json ; AsyncAPI: https://developers.deepgram.com/asyncapi.json

Pricing & marketing:
- https://deepgram.com/pricing (rendered tables + embedded JSON-LD offers extracted 2026-08-10)
- https://deepgram.com/learn/speech-to-text-api-pricing-breakdown-2025 (per-second billing, batch $0.0043/min, HIPAA uplift, auto volume tiers — July 2025 snapshot)
- https://deepgram.com/learn/real-time-speech-to-speech-translation (no native translation; cascade pattern)

GitHub (github.com/deepgram): deepgram-js-sdk · deepgram-python-sdk · deepgram-dotnet-sdk · deepgram-go-sdk · deepgram-java-sdk · deepgram-rust-sdk · cli (dg CLI + MCP server) · agent (@deepgram/agents, @deepgram/react, @deepgram/ui, widget) · browser-agent · react · ui · examples · recipes · deepgram-api-specs (OpenAPI/AsyncAPI) · self-hosted-resources · streaming-test-suite · voice-agent-nodejs-client · support-toolkit · deepgram-eos-heuristics · flux-tts-demo · starter-contracts · deepclaw · homebrew-tap (115 repos total, page 1 of 4 captured). Caption libs: `@deepgram/captions` (npm) and deepgram-python-captions (used in official SRT guide).

---

*End of report. Verify all prices and the "streaming promo" status in the Deepgram console before quoting them in our pricing UI.*
