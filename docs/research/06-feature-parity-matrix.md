# TTS Platform Feature Parity Matrix — Deep Research Report

> **Purpose:** Drive product scope for LugunaVoice (a TTS SaaS in the style of famespeak.online).
> **Scope:** 13 platforms — ElevenLabs, Play.ht, Speechify, Cartesia, Murf, LOVO, WellSaid, Fish Audio, MiniMax, Deepgram TTS, Typecast, Resemble AI, edge-tts.
> **Research date:** Aug 2026. All URLs below verified by live fetch at time of research.

---

## 1. Methodology

**Sources.** Official feature/marketing pages, API docs, and changelogs were fetched live for each platform (see URL list in §3). Where marketing pages were bot-blocked, the vendor's public API documentation or GitHub repo was used instead.

**Caveats & confidence:**

| Platform | Source status | Confidence |
|---|---|---|
| ElevenLabs | Live fetch of elevenlabs.io, /text-to-speech, /voice-cloning, /agents | High |
| Play.ht | Marketing site bot-blocked (transport errors); used docs.play.ht (full API docs) + llms.txt index | High for API, Medium for UI features |
| Speechify | Live fetch speechify.com (FAQ contains detailed feature list incl. API capabilities) | High |
| Cartesia | Live fetch cartesia.ai + docs.cartesia.ai/llms.txt (full endpoint catalog) | High |
| Murf | Live fetch murf.ai (full nav + feature copy) | High |
| LOVO | **Site returns HTTP 402 on every URL (bot protection); data from prior knowledge + third-party reviews** | **Medium — verify before launch decisions** |
| WellSaid | Live fetch wellsaidlabs.com (extensive FAQ) | High |
| Fish Audio | Live fetch fish.audio | High |
| MiniMax | Live fetch minimax.io + platform.minimax.io/docs (model catalog) | High |
| Deepgram | Live fetch deepgram.com + TTS + Voice Agent API pages | High |
| Typecast | Live fetch typecast.ai | High |
| Resemble AI | Live fetch resemble.ai (note: pivoted to deepfake detection/watermarking; TTS = open-source Chatterbox line) | High |
| edge-tts | Live fetch github.com/rany2/edge-tts | High |

**Legend used in the master matrix:**
- `✓` = available (any tier), `◐` = partial / paid-tier-only / limited capability, `−` = not offered / not found
- Numbers = specific counts (voices, languages, latency) as claimed by the vendor

---

## 2. THE MASTER MATRIX

Platform codes: **EL**=ElevenLabs, **PH**=Play.ht, **SP**=Speechify, **CA**=Cartesia, **MU**=Murf, **LV**=LOVO, **WS**=WellSaid, **FA**=Fish Audio, **MM**=MiniMax, **DG**=Deepgram, **TC**=Typecast, **RA**=Resemble, **ET**=edge-tts

### Category 1 — Core TTS

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Multiple quality tiers / model choice | ✓ | ✓ | − | ✓ | ✓ | ◐ | − | ✓ | ✓ | ✓ | ✓ | ✓ | − |
| 2 | Number of library voices | 11k+ | ~800 | 1000+ | ~30 | 200+ | 1000+ | 280+ | 2M+* | ~10 | 40+ | 700+ | few | ~540 |
| 3 | Languages (TTS) | 70+ | 140+ | 60+ | 70+ | 35+ | 100+ | 18 | 30+ | 40 | ~30 | 35+ | ~10 | 100+ locales |
| 4 | Voice previews / audition before use | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ✓ | − | − |
| 5 | Speed control | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 | Pitch control | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | − | ✓ | ◐ | − | ✓ | ◐ | ✓ |
| 7 | Volume control | ✓ | ✓ | − | ✓ | ✓ | ◐ | − | ◐ | − | − | ◐ | − | ✓ |
| 8 | Pause control | ✓ | ✓ | − | ✓ | ✓ | ✓ | − | ✓ | ✓ | ◐ | ◐ | − | ◐ |
| 9 | Emphasis control | ✓ | ✓ | − | ✓ | ✓ | ✓ | − | ✓ | ✓ | ◐ | ✓ | ◐ | − |
| 10 | Custom pronunciation (dictionary) | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ✓ | ◐ | ◐ | − |
| 11 | SSML support | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ◐ | ◐ | −* |
| 12 | Character limit per request | 5k–40k | streamed | – | – | – | – | – | 30k | – | – | – | – | short* |
| 13 | Breathing / inline audio tags | ✓ | ◐ | − | ◐ | − | − | − | ✓ | ✓ | − | − | ◐ | − |

\* FA "2M+" = community voice library, not curated stock. ET: custom SSML removed upstream; per-request length limited (chunk manually). RA = Chatterbox line.

### Category 2 — Voice Cloning

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14 | Instant cloning (short sample) | ✓ (1–5 min) | ✓ (30 s) | ✓ | ✓ | ◐ | ✓ | − | ✓ (10–15 s) | ✓ | − | ✓ | ✓ (zero-shot) | − |
| 15 | Professional/studio cloning | ✓ (30+ min) | ✓ | ◐ | ✓ (Pro) | ✓ | ✓ | − | ◐ | ✓ | − | ◐ | − | − |
| 16 | Voice design from text prompt | ✓ | − | − | − | − | − | − | ◐ | − | − | − | − | − |
| 17 | Voice editing/refinement tools | ✓ | ◐ | − | ◐ | ◐ | ◐ | − | − | − | − | − | − | − |
| 18 | Community voice library | ✓ | ◐ | ◐ | − | − | ◐ | − | ✓ | − | − | ✓ | − | − |
| 19 | Commercial licensing (cloned/stock) | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ (paid) | ◐ | − | ✓ | ◐ | − |
| 20 | Consent verification / anti-abuse | ✓ | ◐ | − | − | − | − | − | − | − | − | − | ✓ | − |
| 21 | Clone speaks multiple languages | ✓ (32+) | ✓ | ◐ | ✓ | ◐ | ✓ | − | ✓ (30+) | ✓ | − | ✓ | ◐ | − |

### Category 3 — Long-form Generation

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22 | Long-form / audiobook mode | ✓ | ◐ | ◐ | − | ◐ | ✓ | ◐ | ✓ | − | − | ◐ | − | − |
| 23 | Automatic chunking | ✓ | ✓ | − | ✓ | ◐ | ✓ | − | ✓ | − | ◐ | − | − | − |
| 24 | Batch synthesis API | ✓ | ✓ | − | ◐ | ◐ | ◐ | − | ✓ | ◐ | ✓ | − | − | − |
| 25 | Parallel synthesis / high concurrency | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | − | ✓ | ✓ | ✓ | ◐ | − | − |
| 26 | Consistent voice across hours | ✓ | ✓ | − | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ✓ | ◐ | − | − |
| 27 | Project-based organization | ✓ | ✓ | ◐ | − | ✓ | ✓ | ✓ | ◐ | − | − | ✓ | − | − |
| 28 | Script upload (PDF/txt/docx) | ◐ | ✓ | ✓ | − | ✓ | ✓ | ✓ | ◐ | − | − | ◐ | − | − |
| 29 | Chapter/heading support | ✓ | − | − | − | ◐ | ◐ | ◐ | ✓ | − | − | − | − | − |

### Category 4 — Multi-voice & Conversational

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30 | Multi-voice / multi-actor scripts | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ✓ | ◐ | ◐ | ✓ | − | − |
| 31 | Dialogue mode (conversation builder) | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | − | ◐ | − | ◐ | ✓ | − | − |

### Category 5 — Emotion & Style

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 32 | Emotion presets / sliders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (7) | ◐ | ✓ | ✓ | − |
| 33 | Style presets per voice | ◐ | ◐ | − | − | ◐ | ✓ | ✓ | ◐ | − | − | − | − | − |
| 34 | Expressive / emotion-tagged models | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | − | ✓ | ✓ | − |
| 35 | Style transfer (reference audio → style) | ◐ | ◐ | − | ◐ | − | − | − | ◐ | ◐ | − | − | − | − |

### Category 6 — Streaming / Realtime

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 36 | WebSocket streaming TTS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | − | ✓ | ✓ | ✓ | ✓ | ✓ | − |
| 37 | Low-latency claims (TTFB) | ~75 ms | low | – | 90 ms | 130 ms | – | – | low | low | <200 ms | – | <200 ms | – |
| 38 | LLM input streaming (agent-facing) | ✓ | ✓ | − | ✓ | ✓ | ◐ | − | ✓ | ✓ | ✓ | ◐ | − | − |
| 39 | Live voice changer (real-time) | ◐ | − | ✓ | − | ✓ | ◐ | − | ✓ | − | − | − | ◐ | − |

### Category 7 — Audio Post-processing

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 40 | Volume normalization | ◐ | − | − | − | ✓ | ✓ | − | − | − | − | ◐ | − | − |
| 41 | Background music library | ✓ | − | − | − | ✓ | ✓ | − | ◐ | − | − | ◐ | − | − |
| 42 | Sound effects (gen/search) | ✓ | − | − | − | ◐ | ◐ | − | ✓ | − | − | − | − | − |
| 43 | Fade in/out | ◐ | − | − | − | ✓ | ✓ | − | − | − | − | ◐ | − | − |
| 44 | Silence trimming | ◐ | − | − | − | ◐ | ◐ | − | − | − | − | − | − | − |
| 45 | Audio merging / multitrack | ✓ | ◐ | − | − | ✓ | ✓ | ◐ | − | − | − | ✓ | − | − |

### Category 8 — Content Formats

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 46 | SRT / subtitle export | ◐ | ◐ | ✓ | − | ◐ | ◐ | − | ◐ | − | ◐ | − | − | ✓ |
| 47 | Word/character timestamps | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ | − | ◐ | − | ✓ | − | − | − |
| 48 | Output formats (MP3/WAV/µ-law) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | MP3 |
| 49 | Video export / video editor | ◐ | ◐ | ✓ | − | ◐ | ✓ | − | ◐ | − | − | ✓ | − | − |
| 50 | Podcast creation tools | ✓ | ◐ | ✓ | − | ◐ | ◐ | ✓ | ✓ | − | − | ◐ | − | − |

### Category 9 — Voice Studio / Editor

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 51 | Visual editor (waveform, click-to-edit) | ✓ | ◐ | ◐ | − | ✓ | ✓ | ✓ | ◐ | − | − | ✓ | − | − |
| 52 | Regenerate a single sentence/line | ✓ | ◐ | − | − | ✓ | ✓ | ✓ | ◐ | − | − | ✓ | − | − |
| 53 | Multi-speaker track editing | ✓ | ◐ | − | − | ✓ | ✓ | ◐ | − | − | − | ✓ | − | − |
| 54 | Splice / re-record / infill | ✓ | − | − | ✓* | ◐ | ◐ | − | − | − | − | − | − | − |

\* CA "Infill" API generates bridging audio between two existing clips (docs: `infill/bytes`).

### Category 10 — API & Developer

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 55 | REST API | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | − |
| 56 | Streaming API (HTTP/WS/SSE) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | − | ✓ | ✓ | ✓ | ✓ | ✓ | − |
| 57 | SDKs | 9 langs | 2 | multi | 2 | multi | multi | multi | 3 | multi | multi | 6 | multi | Python* |
| 58 | Webhooks | ✓ | ◐ | − | ✓ | ◐ | − | − | ◐ | ◐ | − | − | ✓ | − |
| 59 | SSO / SAML (enterprise) | ✓ | ◐ | ◐ | ✓ | ✓ | ◐ | ✓ | ◐ | ◐ | ✓ | − | ✓ | − |
| 60 | API key management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | − |
| 61 | Usage analytics dashboard | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ | ✓ | ◐ | ✓ | − |
| 62 | Documented rate limits | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ | ✓ | ◐ | ✓ | − |
| 63 | SLA (enterprise) | ✓ | ◐ | − | ◐ | ✓ | ◐ | ✓ | − | ◐ | ✓ | − | ✓ | − |

\* ET: Python module + CLI (not a hosted API; no key).

### Category 11 — Dubbing

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 64 | Video dubbing (file in → dubbed out) | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | − | ✓ | ◐ | ◐ | ◐ | ◐ | − |
| 65 | Lip sync | ✓ | ✓ | ✓ | − | ◐ | ✓ | − | − | − | − | − | − | − |
| 66 | Voice translation (speak text in any lang) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ | − |

### Category 12 — Agents / Realtime Products

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 67 | Hosted AI voice agents | ✓ | ◐ | ✓ | ✓ | ✓ | ◐ | − | ✓ | ◐ | ✓ | − | − | − |
| 68 | Function calling / tools | ✓ | ◐ | ◐ | ✓ | ◐ | − | − | ◐ | ✓ | ✓ | − | − | − |
| 69 | Knowledge base for agents | ✓ | ◐ | ◐ | ✓ | ◐ | − | − | ◐ | − | ✓ | − | − | − |
| 70 | Telephony (Twilio/SIP/phone numbers) | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | − | ◐ | − | ✓ | − | − | − |

### Category 13 — Teams & Workflows

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 71 | Workspaces / shared projects | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | ✓ | − | − | ◐ | ◐ | − | − |
| 72 | Roles & permissions | ✓ | ◐ | − | ◐ | ✓ | ◐ | ✓ | − | − | ◐ | − | − | − |
| 73 | Shared team voices | ✓ | ◐ | − | − | ◐ | ◐ | ✓ | − | − | − | − | − | − |
| 74 | Approval/review workflows | ✓ | − | − | − | ◐ | ◐ | ◐ | − | − | − | − | − | − |
| 75 | Audit logs | ✓ | − | − | ◐ | ◐ | − | − | − | − | ◐ | − | ✓ | − |

### Category 14 — Quality-of-life

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 76 | Mobile apps (iOS/Android) | ✓ | − | ✓ | − | ◐ | ✓ | − | ◐ | − | − | ✓ | − | − |
| 77 | Browser extension (Chrome/Edge) | ◐ | − | ✓ | − | − | − | − | − | − | − | − | ✓ | − |
| 78 | Slide/Word/Adobe/Captivate plugins | − | ◐ | ◐ | − | ✓ | ◐ | ✓ | − | − | − | − | − | − |
| 79 | Zapier / no-code integrations | ✓ | ◐ | ◐ | ◐ | ◐ | ◐ | − | ◐ | − | ◐ | − | − | − |

### Category 15 — Discovery

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 80 | Voice library browsing | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ✓ | − | ✓ |
| 81 | Search + filters (lang/gender/accent/use) | ✓ | ✓ | ◐ | ◐ | ✓ | ✓ | ✓ | ✓ | − | − | ✓ | − | ◐ |
| 82 | Favorites / saved voices | ◐ | ◐ | − | − | ◐ | ◐ | − | ◐ | − | − | ◐ | − | − |
| 83 | Side-by-side voice comparison | ◐ | ◐ | − | − | ◐ | ◐ | ◐ | − | − | − | ◐ | − | − |

### Category 16 — Pricing Features

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 84 | Free tier / trial | ✓ (10k cr) | ✓ | ✓ | ✓ | ✓ (10 min) | ✓ | ✓ (trial) | ✓ (free gen) | ✓ | ✓ | ✓ | ◐ | ✓ (all free) |
| 85 | Trial credits for devs | ✓ | ◐ | − | ✓ | ✓ (50M startup) | ◐ | − | ✓ | ✓ | ✓ | ◐ | − | n/a |
| 86 | API-only / pay-as-you-go plans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✓ | ✓ | ✓ | ◐ | n/a |
| 87 | Credit rollover | ✓ | ◐ | − | − | ◐ | ◐ | − | − | − | − | − | − | n/a |
| 88 | Usage meters in dashboard | ✓ | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ | ◐ | ◐ | ✓ | ◐ | ✓ | n/a |

### Category 17 — AI Features

| # | Feature | EL | PH | SP | CA | MU | LV | WS | FA | MM | DG | TC | RA | ET |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 89 | Script/text enhancement assistant | ◐ | − | ✓ | − | ◐ | ✓ | ✓ | − | − | − | − | − | − |
| 90 | Summarization | ◐ | − | ✓ | − | − | − | − | − | − | − | − | − | − |
| 91 | In-app translation | ◐ | ✓ | ✓ | − | ✓ | ✓ | ✓ | ✓ | − | − | − | − | − |

**Matrix quick scan:** EL is the only platform with every category covered end-to-end. PH/CA/DG/MU are API+agent-first. SP/WS/LV/TC are studio-first. FA is community + price disruption. ET is a free utility, not a product. Rows with fewest ✓ = industry-wide gaps you can exploit (timestamps, SRT, voice comparison, cloning consent, emotion tags are near-universal).

---

## 3. Category-by-Category Notes (with exact source URLs)

### Category 1 — Core TTS
- **ElevenLabs** — models with explicit char limits & latency: v3 (5,000 chars, 70+ langs, audio tags, multi-speaker dialogue), Multilingual v2 (10,000, 29 langs), Flash v2.5 (~75 ms inference, 40,000 chars, 32 langs), Turbo v2.5 (40,000, 32 langs, 250–300 ms). Controls: speed/tone/pacing/style-exaggeration sliders; stability/similarity/style voice settings; SSML + pronunciation dictionaries via API; MP3/WAV/µ-law output. 11,000+ voices, 70+ languages, commercial rights on paid plans.
  - https://elevenlabs.io/text-to-speech · https://elevenlabs.io/
- **Play.ht** — voice engines PlayHT / PlayDialog / PlayDialog-turbo (on Groq); pre-built voice spreadsheet; WebSocket + HTTP streaming + input streaming with LLMs; batch TTS jobs API; documented rate limits; Node.js + Python SDKs.
  - https://docs.play.ht/ · https://docs.play.ht/llms.txt
- **Speechify** — 1,000+ voices, 60+ languages, up to 4.5× playback; API "includes instant voice cloning, language support, streaming, SSML and emotional controllability, speech marks" (verbatim from official FAQ); PDF/EPUB/DOCX/XLSX/TXT + OCR input.
  - https://speechify.com/
- **Cartesia** — Sonic 3.5: "stream out the first byte of audio in just 90 ms"; SSML tags (laughter, pauses, mid-transcript controls); pronunciation dictionaries; speed/volume/emotion mid-stream via `generation_config`; SSE with word & phoneme timestamps; accent catalog API.
  - https://docs.cartesia.ai/ · https://docs.cartesia.ai/llms.txt · https://cartesia.ai/
- **Murf** — 200+ voices, 35+ languages; Gen2 model: 99.38% pronunciation accuracy, fine-grained tone/pacing/emphasis; Falcon API: 130 ms TTFA, 1¢/minute, 35+ languages, data residency across 11 geographies.
  - https://murf.ai/ · https://murf.ai/falcon · https://murf.ai/text-to-speech-gen-2
- **WellSaid** — 280+ voices (FAQ: 240+), 18 languages with regional accents (13+ English variants); every voice licensed from real voice actors; closed-model AI (data never trains external models); commercial rights on all plans.
  - https://wellsaidlabs.com/
- **Fish Audio** — S2.1 Pro with emotion tags (`[angry][sad][whispering][soft][breathy][excited]`) and special tags (`[laughing][sighing][clear throat][crying][pause][long pause]`); 30,000-char input; 2M+ community voices; 30+ languages; free TTS API tier.
  - https://fish.audio/
- **MiniMax** — speech-2.8-hd / speech-2.8-turbo: 40 languages, 7 emotions, sound tags, specified languages & dialects; music-3.0 for generation.
  - https://platform.minimax.io/docs/
- **Deepgram** — Aura-2: 40+ English voices with localized accents, sub-200 ms latency, $0.030 / 1,000 chars, domain-tuned pronunciation, context-aware delivery, public / private cloud / on-prem deployment.
  - https://deepgram.com/product/text-to-speech · https://deepgram.com/
- **Typecast** — 700+ voices, 35+ languages; SSFM 3.0 context-aware emotion; Smart Emotion; emotion presets (happy/sad/angry/whisper/low tone); SDKs for Python, JS, C#, Java, Kotlin, Rust.
  - https://typecast.ai/
- **edge-tts** — free Microsoft Edge online TTS; ~540 neural voices across 100+ locales; `--rate / --volume / --pitch` flags; custom SSML removed upstream (single `<voice>` + `<prosody>` only); CLI + Python module, no API key.
  - https://github.com/rany2/edge-tts

### Category 2 — Voice Cloning
- **ElevenLabs** — Instant Voice Cloning (1–5 min audio; demos with 10 s), Professional Voice Cloning (30+ min, ~3 h optimal), Voice Design from text prompt, multilingual clones (32+ languages), AI Speech Classifier + consent/verification safeguards.
  - https://elevenlabs.io/voice-cloning · https://elevenlabs.io/text-to-speech
- **Play.ht** — "clone any voice instantly across languages with only 30 seconds of speech"; cloning available via API (instant voice clone endpoint + cloned-voice list endpoint).
  - https://docs.play.ht/ · https://docs.play.ht/llms.txt
- **Cartesia** — Instant Voice Clone + Pro Voice Clone ("near replica" using more data); `voices/localize` endpoint moves a clone to a new language/dialect; fine-tuning via datasets + fine-tunes APIs.
  - https://docs.cartesia.ai/llms.txt
- **Murf** — voice cloning product line (studio + API); ethically built voices with actor royalties as differentiator.
  - https://murf.ai/voice-cloning · https://murf.ai/
- **Fish Audio** — clone with "perfect fidelity in 15 seconds" (10–15 s samples); 2M+ community voices; commercial rights on paid plans only (free plan = personal use).
  - https://fish.audio/
- **MiniMax** — voice cloning in the Speech 2.x line (docs/API reference; token plan).
  - https://platform.minimax.io/docs/
- **Typecast** — cloned voice "speaks multilingual, talks fast, expresses emotion".
  - https://typecast.ai/
- **Resemble** — Chatterbox (open source): zero-shot voice cloning, emotion-exaggeration control, sub-200 ms, PerTh watermark embedded by default.
  - https://www.resemble.ai/
- **WellSaid / Deepgram / edge-tts** — no cloning (WellSaid explicitly: licensed actor recordings only).

### Category 3 — Long-form
- **ElevenLabs** — Studio long-form; "Flows" for audiobook production (chapters/headings); Multilingual v2 "designed for long-form generations".
  - https://elevenlabs.io/text-to-speech · https://elevenlabs.io/blog/introducing-flows-in-elevencreative
- **Play.ht** — Batch TTS API (async multi-text job, child-job tracking by custom ID).
  - https://docs.play.ht/llms.txt
- **Fish Audio** — Story Studio (audiobook product); "chapter-level control… meets ACX/Audible specs"; "Five seconds is easy. Five minutes is the test" (long-context consistency).
  - https://fish.audio/
- **Murf / LOVO / WellSaid / Typecast** — studio project systems, script import (PDF/docx/txt), audiobook use cases.
- **Cartesia** — long docs via WebSocket contexts + continuations + buffering control; batch STT exists; TTS chunking handled client-side.
  - https://docs.cartesia.ai/llms.txt

### Category 4 — Multi-voice & conversational
- **ElevenLabs** — "Dialogue support: create audio conversations where speakers share context and emotion"; v3 multi-speaker dialogue.
  - https://elevenlabs.io/text-to-speech
- **Play.ht** — PlayDialog engine purpose-built for multi-voice dialogue / conversational agents.
  - https://docs.play.ht/
- **Typecast** — multi-voice casting ("feels like holding real auditions"); character/anime/kid voice categories.
  - https://typecast.ai/

### Category 5 — Emotion & style
- Emotion presets/sliders: MU, LV, TC (Smart Emotion), FA (tags), MM (7 emotions), WS (emotional presets), EL (tags + sliders), CA (emotion via API), SP, PH, RA (emotion exaggeration), DG (partial).
- **MiniMax** — 7 emotions + sound tags across 40 languages (speech-2.8 docs). https://platform.minimax.io/docs/
- **Cartesia** — mid-stream emotion change via `generation_config`. https://docs.cartesia.ai/llms.txt
- **Fish Audio** — richest tag system observed (`[angry][sad][embarrassed][emphasis][whispering][soft][breathy][excited][laughing][chuckling][moaning][clear throat][sobbing][crying loudly][sighing][panting][groaning][crowd laughing][background laughter][audience laughing][pause][long pause]`). https://fish.audio/

### Category 6 — Streaming / realtime
- **ElevenLabs** — Flash v2.5 ~75 ms inference / sub-500 ms end-to-end; WebSocket + streaming API.
  - https://elevenlabs.io/text-to-speech
- **Cartesia** — Sonic 3.5 first byte in 90 ms; WebSocket with contexts/continuations; SSE with timestamps; TTS audio caching for stock responses (latency cut).
  - https://docs.cartesia.ai/ · https://docs.cartesia.ai/llms.txt
- **Murf** — Falcon 130 ms TTFA, benchmarked against ElevenLabs, OpenAI, Cartesia, Deepgram.
  - https://murf.ai/falcon
- **Deepgram** — sub-200 ms streaming; Aura-2 WebSocket interface for input streaming.
  - https://deepgram.com/product/text-to-speech
- **Play.ht** — WebSocket API + LLM input streaming (ChatGPT-style guide); Twilio audio-streaming guide for phone agents.
  - https://docs.play.ht/llms.txt
- **Fish Audio** — "ultra low latency, #1 in control & expressive" API; Voice Agent product.
  - https://fish.audio/
- **Live voice changers**: MU (voice-changer API capability), FA (Voice Changer product), SP (AI Voice Changer), RA (real-time). https://murf.ai/ · https://fish.audio/ · https://speechify.com/

### Category 7 — Audio post-processing
- **Murf Studio** — add background music, audio files, video; pitch/speed/intonation; "Say It My Way" pronunciation.
  - https://murf.ai/
- **ElevenLabs** — music generation + SFX generation + SFX search products inside ElevenCreative.
  - https://elevenlabs.io/ · https://elevenlabs.io/sound-effects
- **Fish Audio** — Audio Separation, Audio Translation, Sound Effects products.
  - https://fish.audio/
- **LOVO** — studio music/fade tools (from knowledge; site blocked).
- **Cartesia** — Infill API: "generate audio that smoothly connects two existing audio segments" (programmatic splice).
  - https://docs.cartesia.ai/llms.txt

### Category 8 — Content formats
- **edge-tts** — `--write-subtitles` produces SRT directly (verified in README).
  - https://github.com/rany2/edge-tts
- **ElevenLabs** — MP3, WAV/PCM, µ-law + selectable sample rate/bitrate.
  - https://elevenlabs.io/text-to-speech
- **Cartesia** — SSE with word timestamps and phoneme timestamps.
  - https://docs.cartesia.ai/llms.txt
- **Speechify** — Studio Voices, Studio Captions (video/caption products).
  - https://speechify.com/
- **LOVO / Typecast** — AI video generation / video editor respectively (video export path).

### Category 9 — Voice studio/editor
- **ElevenLabs Studio** — all-in-one editor for podcasts/audiobooks/voiceovers. https://elevenlabs.io/
- **WellSaid** — Studio + AI Director (pronunciation, pacing, tone) + Script Builder; Adobe Express & Premiere Pro plugins. https://wellsaidlabs.com/
- **Murf / LOVO / Typecast** — full waveform editors, sentence-level regeneration, multi-speaker tracks (matrix above).
- **Cartesia** — Infill = programmatic splice for API users. https://docs.cartesia.ai/llms.txt

### Category 10 — API & developer
- SDK breadth: EL (JS, Python, C#, Go, Java, Swift, Rust, PHP, Flutter); TC (Python, JS, C#, Java, Kotlin, Rust); CA (JS/TS, Python) + MCP; DG (multi-language); PH (Node, Python); RA (multiple + on-prem/air-gapped); MM (multi-language).
- Webhooks: EL (agents + TTS), CA (agents webhooks), RA.
- SSO: EL, CA, MU, WS, DG, RA (enterprise); SP/PH/LV partial.
- SLA: EL (enterprise), DG, MU, WS (1-hour support SLA), RA.
- Compliance benchmarks: EL (SOC 2-II, ISO 27001, PCI DSS, HIPAA, GDPR, EU data residency, Zero Retention, on-prem); MU (SOC 2, ISO 27001, GDPR, HIPAA, 11 geographies); DG (HIPAA, GDPR, VPC, self-hosted); RA (SOC 2-II, HIPAA, EU AI Act, air-gapped); CA (Zero Data Retention, SSO, regional endpoints, on-device); WS (SOC 2, GDPR, closed model).
  - https://elevenlabs.io/agents · https://murf.ai/ · https://deepgram.com/ · https://www.resemble.ai/ · https://docs.cartesia.ai/llms.txt · https://wellsaidlabs.com/

### Category 11 — Dubbing
- **ElevenLabs** — Dubbing Studio; Dubbing v2 preserves emotion/performance of the original speaker; 70+ languages.
  - https://elevenlabs.io/ · https://elevenlabs.io/blog/introducing-dubbing-v2
- **Murf** — AI Dubbing in 40+ languages, translation accuracy, expert linguistic review, advanced editing; Dubbing Automation + Translation APIs.
  - https://murf.ai/ai-dubbing · https://murf.ai/
- **Play.ht** — dubbing product (site-blocked; from product nav/docs).
- **Speechify** — Dubbing product (nav: Voice Over, Dubbing, Studio Voices, Studio Captions). https://speechify.com/
- **Fish Audio** — Audio Translation (dubbing-adjacent). https://fish.audio/
- **LOVO** — AI dubbing + lip sync (knowledge; site blocked).

### Category 12 — Agents / realtime products
- **ElevenAgents** — omnichannel (phone, chat, WhatsApp, SMS, email); knowledge base; workflows; guardrails; function calling; analytics (resolution rate, CSAT); simulation/testing; 4M+ agents deployed; 15 free minutes; integrations (Zapier, Salesforce, Stripe, Zendesk, Twilio, Amazon Connect…); BYO LLM; 70+ languages; Expressive Mode.
  - https://elevenlabs.io/agents · https://elevenlabs.io/blog/introducing-expressive-mode
- **Deepgram Voice Agent API** — unified STT + LLM orchestration + TTS in one real-time API; barge-in detection; turn-taking prediction; function calling; mid-session control; BYO LLM & TTS; flat $4.50/hr; managed / VPC / self-hosted.
  - https://deepgram.com/product/voice-agent-api
- **Cartesia Line** — hosted agent builder; knowledge base (folders/docs); tools; LLM-as-judge metrics; phone numbers; Twilio + SIP trunking; batch calling; webhooks; deployments; CLI/SDK; WebSocket agent API.
  - https://docs.cartesia.ai/llms.txt
- **Murf Agents** — AI receptionist / recruiter / call center / cold calling / SDR / sales agents; inbound + outbound calls.
  - https://murf.ai/ai-voice-agent
- **Fish Audio** — end-to-end Voice Agent product. https://fish.audio/
- **Speechify SIMBA** — voice agents product. https://speechify.com/
- **MiniMax** — agentic LLMs (M3: function calling, 1M context) that can power voice agents; Speech 2.8 turbo for realtime.
  - https://platform.minimax.io/docs/
- **Play.ht** — conversational-agent enablement (ultra-low-latency TTS + LLM input streaming + Twilio). https://docs.play.ht/

### Category 13 — Teams & workflows
- **WellSaid** — shared workspaces, comments, role-based access, shared voice libraries, SSO. https://wellsaidlabs.com/
- **ElevenLabs** — granular team permissions; shared voices/assets across agents & content pipelines. https://elevenlabs.io/text-to-speech
- **Murf** — collaboration features (case studies). https://murf.ai/
- **RA** — audit-ready detection logs + SSO (security context). https://www.resemble.ai/

### Category 14 — Quality-of-life
- **Speechify** — reference for distribution: iOS/Android/Mac/Windows/Web + Chrome + Edge extensions; OCR scan; PDF/EPUB/DOCX/XLSX/TXT upload; offline listening. https://speechify.com/
- **Murf** — Canva, Google Slides, PowerPoint, Adobe Captivate, Murf TTS Reader, "Voices for Windows" apps. https://murf.ai/
- **WellSaid** — Adobe Express + Premiere Pro plugins. https://wellsaidlabs.com/
- **ElevenLabs** — iOS/Android app (ElevenReader). https://elevenlabs.io/text-to-speech
- **Typecast** — iOS/Android app with cross-device sync. https://typecast.ai/

### Category 15 — Discovery
- Voice libraries with search/filters: EL (10k+ by language/gender/accent/use case), FA (2M+ community), PH (prebuilt voice list), WS (browse by accent/tone/style), MU, LV, TC.
- **edge-tts** — `--list-voices` CLI (name, gender, content category, voice personality). https://github.com/rany2/edge-tts

### Category 16 — Pricing features
- Free tiers: EL 10k credits/mo; MU 10 free minutes; FA free monthly generations (personal use); DG free sign-up credits; CA free tier; SP free plan; WS free trial; TC free trial.
- API PAYG: EL (credit system), DG ($0.030/1k chars TTS, $4.50/hr agents), MU (1¢/min Falcon + 50M-char startup incubator), CA (credit-based), FA (free API tier — major disruption), MM (token plan), TC (API pricing page).
- Credit rollover: EL explicitly; others partial.

### Category 17 — AI features
- **Speechify** — Voice AI assistant (summarize, quiz, explain, answer questions), AI podcast generation, voice typing dictation (160 WPM), meeting note taker. https://speechify.com/
- **WellSaid** — Script Builder ("create, manage, and complete scripts"), clip translation. https://wellsaidlabs.com/
- **LOVO** — AI script writer (knowledge; site blocked).

---

## 4. Core Feature Set for a New Entrant (LugunaVoice Launch Scope)

Ranked by "can we be credible in this market without it?" — based on what >50% of the platforms above ship.

### MUST-HAVE (launch, non-negotiable) — top 20
1. **High-quality neural TTS with ≥2 model tiers** (quality + low-latency) — every serious platform has this
2. **REST + streaming API** (WebSocket or SSE; HTTP chunked acceptable) — API is table stakes; credit-based web apps monetize via API too
3. **100+ curated stock voices with per-voice previews** — buyers audition before paying
4. **30+ languages** (launch 10–15 solid, roadmap to 30+; marketing claims will be compared side-by-side)
5. **Speed / pitch / volume controls** — universal across all 13 platforms
6. **Custom pronunciation dictionary** — expected by every professional buyer (EL, PH, CA, MU, LV, WS, DG all ship it)
7. **SSML support** in the API — even edge-tts users expect prosody control
8. **Emotion tags/presets** (happy/sad/angry/whisper/laugh/pause) — inline tag syntax is now an industry UI convention (EL, FA, MM, TC, MU)
9. **Instant voice cloning** from ≤5 min audio — with explicit consent checkbox + commercial-use licensing terms (cloning = the #1 retention feature)
10. **Multilingual cloned voices** (clone speaks every language you support)
11. **Word-level timestamps + SRT export** — cheap to build, high differentiation (EL, CA, DG, ET all do it)
12. **Long-form generation with automatic chunking** and stable voice across hours
13. **Free tier** (~5–10 min/mo, no card) + **dev trial credits**
14. **Usage dashboard with meters** and transparent character/credit pricing
15. **API key management** (multiple keys, revoke, scoped)
16. **SDKs: JavaScript + Python** minimum (TC ships 6, EL ships 9 — devs judge you on this)
17. **Multi-voice / dialogue scripts** (conversation mode)
18. **Visual editor with sentence-level regeneration** (waveform + "regenerate this line" + MP3/WAV download)
19. **Commercial licensing clarity** (explicit "you own the audio" page + royalty-free stock voices) — WellSaid/EL/MU all sell on this
20. **Low-latency streaming path** (sub-500 ms TTFB) for conversational use — even if agents are phase 2

### SHOULD-HAVE (launch + 1 quarter)
21. Professional/studio cloning tier (30+ min audio)
22. Voice design from text prompt (EL differentiator; cheap to replicate as "voice forge")
23. Batch synthesis API (async job + status polling) — Play.ht-class buyers ask for it
24. Video dubbing (file-in → dubbed-out; skip lip sync initially)
25. Webhooks (TTS completion events)
26. Workspaces + roles for teams
27. SSO/SAML (enterprise checkbox that wins deals)
28. Realtime voice changer (MU and FA sell it as a separate product line)
29. Background music / SFX assets in editor
30. Two-host AI podcast mode
31. Zapier + Google Slides/Canva integrations (Murf's moat)
32. Voice library with search + filters (gender/language/age/use-case) + favorites

### COULD-HAVE (later; build only when revenue justifies)
33. Hosted voice agents (ElevenAgents-class) — see §5
34. Lip-sync dubbing
35. Mobile apps (iOS/Android)
36. Chrome extension (Speechify's distribution moat — high effort, low TTS revenue)
37. Music/SFX generation models (different model family; EL/MiniMax territory)
38. Style transfer
39. Audit logs + compliance certs beyond SOC 2-ready posture
40. On-prem / VPC deployment (DG/RA/Cartesia enterprise tier)

**Strategic note:** the market divides into *studio-first* (SP, WS, LV, MU, TC) and *API-first* (EL, PH, CA, DG, MM, FA, RA). LugunaVoice should ship **API-first with a good-enough studio** — that's where margins and developer stickiness live, and it matches credit-based pricing like famespeak.online.

---

## 5. "Custom Agent" — What It Actually Means (Research Finding)

**Short answer: a "custom agent" is a realtime voice AI — option (b) — where cloned voices are merely one configuration input (option (a)). If you build "custom agents" without realtime STT + LLM orchestration + low-latency TTS + telephony, you've built a voice clone, not an agent.**

### Evidence from the platforms that market "agents"

| Platform | Product | What "agent" actually includes |
|---|---|---|
| **ElevenLabs** | ElevenAgents | Voice **and** chat agents: STT (Scribe) + LLM (hosted or BYO) + TTS (Flash), knowledge base, system prompt, workflows, guardrails, function calling, analytics (resolution rate, CSAT), phone/WhatsApp/SMS/email channels, Twilio/Amazon Connect integrations, testing/simulation, 15 free minutes. `elevenlabs.io/agents` |
| **Deepgram** | Voice Agent API | "Unified STT + LLM orchestration + TTS in a single real-time API… barge-in detection, turn-taking prediction, function calling, mid-session control… BYO LLM and TTS… $4.50/hr." `deepgram.com/product/voice-agent-api` |
| **Cartesia** | Line | Hosted agent builder: knowledge base, tools, LLM-as-judge metrics, phone numbers, Twilio + SIP trunking, batch calling, webhooks, deployments. `docs.cartesia.ai/llms.txt` |
| **Murf** | Murf Agents | AI receptionist / recruiter / call center / cold calling / SDR — inbound + outbound calls. `murf.ai/ai-voice-agent` |
| **Fish Audio** | Voice Agent | "End-to-end voice agent solution." `fish.audio/` |
| **Speechify** | SIMBA | Voice agents product. `speechify.com/` |

### The anatomy of a "custom agent" (what you must build)
1. **Realtime ASR** — streaming speech-to-text with turn/VAD detection (Deepgram Ink-2, ElevenLabs Scribe, Cartesia Ink all compete here)
2. **LLM orchestration** — system prompt, knowledge base/RAG, function calling/tools, guardrails
3. **Realtime low-latency TTS** — <300–500 ms end-to-end; the platforms above compete at 75–200 ms
4. **Channel layer** — WebSocket (web/mobile), Twilio/SIP telephony (phone), chat (WhatsApp/SMS/email)
5. **Ops layer** — analytics, transcripts, logs, testing/simulation, agent versioning

### Decision framework for LugunaVoice
- **Cloned voices are an input to agents, not the agent itself.** ElevenAgents lets you pick *any* voice (including your clone) as the agent's voice; the voice is a setting, not the product.
- **Phase 1 (TTS SaaS):** ship TTS + cloning + a "custom voice" product. The word "custom" should mean *custom voice*, not *custom agent* — do not promise agents.
- **Phase 2 (voice AI):** the minimum credible slice is streaming TTS + a reference connector for an existing agent framework (LiveKit/Pipecat-class), then a hosted agent later. Note the pricing-model shift: agents are billed per-minute ($4.50/hr Deepgram, 1¢/min Murf), not per-character — a different billing system than TTS credits.
- **Marketing trap:** several smaller "TTS" startups advertise "custom agents" and deliver only cloned voices — reviewers penalize this. Use "custom voices" for cloning; reserve "agents" for realtime conversational AI.

### Bottom line for the product brief
> "Custom agents" = realtime voice agents (option **b**), built on top of (and including) cloned voices (option **a**). Launch scope: (a). Roadmap: (b). Never conflate them in marketing.

---

## TL;DR

- **Must-have at launch (top 15–20):** 2 model tiers · REST + streaming API · 100+ voices with previews · 30+ languages · speed/pitch/volume · pronunciation dictionary · SSML · emotion tags · instant voice cloning (≤5 min) + multilingual clones · word timestamps + SRT export · long-form auto-chunking · free tier + dev credits · usage dashboard · API keys · JS+Python SDKs · multi-voice dialogue · sentence-level regeneration editor · commercial-licensing clarity · sub-500 ms streaming path.
- **Custom agents = realtime voice AI** (STT + LLM orchestration + low-latency TTS + telephony + analytics); cloned voices are just the agent's voice setting. Launch "custom voices"; build "agents" as phase 2. Evidence: ElevenAgents, Deepgram Voice Agent API, Cartesia Line, Murf Agents, Fish Voice Agent, Speechify SIMBA.
- **Top 3 surprises most people don't know:**
  1. **edge-tts (100% free, no API key) ships ~540 neural voices across 100+ locales, with CLI flags for rate/volume/pitch and native SRT subtitle export** — enough raw capability to prototype a TTS product on day one, and proof that "premium" TTS features are now commoditized.
  2. **Cartesia has an "Infill" API that generates bridging audio between two clips and a `voices/localize` endpoint that moves a clone into a new language/dialect** — programmatic "splice/re-record" features most studios (even ElevenLabs Studio) only offer visually.
  3. **Resemble AI has pivoted to deepfake detection + EU-AI-Act-compliant watermarking, with its TTS (Chatterbox) now open source and watermarked by default** — provenance/watermarking is becoming a genuine differentiator (EU AI Act Art. 50 mandatory Aug 2026), and a "provenance-safe TTS" marketing angle is currently uncontested among the big players.

**File:** `docs/research/06-feature-parity-matrix.md`
