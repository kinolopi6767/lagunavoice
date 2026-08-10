# LugunaVoice — System Architecture (v2)

> Companion to `01-build-plan.md`. Covers: 3-provider synthesis, long-form pipeline, streaming relay, cloning, security layer, data flows, scaling path.

---

## 1. Architecture Overview (v2)

```
                              INTERNET
                                 │
              ┌──────────────────┴───────────────────┐
              │            VERCEL (Next.js 16)        │
              │  App Router · Node runtime · RSC      │
              ├───────────────────────────────────────┤
              │  /                Landing + guest demo│
              │  /studio          Editor (waveform,   │
              │                    regenerate, SRT)   │
              │  /voice-library   Search/filter/favs  │
              │  /voice-cloning   Clone studio        │
              │  /pricing /developers /login          │
              │  /api/landing/demo                    │
              │  /api/v1/tts/*        Developer API   │
              │  /api/v1/stream/*     WS streaming    │
              │  /api/moderation      Input filter    │
              │  /api/payments/*      Razorpay        │
              └───────┬───────────┬───────────┬───────┘
                      │           │           │
      ┌───────────────┘           │           └──────────────┐
      ▼                           ▼                         ▼
┌──────────────┐          ┌──────────────┐          ┌───────────────┐
│  SUPABASE    │          │  RAZORPAY    │          │  CLOUDFLARE   │
│ Postgres     │          │ links/UPI    │          │  DNS · WAF    │
│ Auth         │          │ webhooks     │          │  Bot Fight    │
│ Storage      │          └──────────────┘          │  Turnstile    │
│ RLS          │                                    │  (R2 in v2)   │
└──────┬───────┘                                    └───────────────┘
       │ server-only (service role)
       ▼
┌──────────────────────────────────────────────────────┐
│            TTS ENGINE LAYER (lib/tts)                 │
│  registry: edge | typecast | deepgram | (kokoro v2)   │
├───────────┬───────────────┬───────────────┬───────────┤
│  Edge     │   Typecast    │   Deepgram    │  Long-    │
│ msedge-tts│ api.typecast  │ api.deepgram  │  form     │
│ WS→Bing   │ X-API-KEY     │ @deepgram/sdk │  chunk    │
│ MP3 24kHz │ ssfm-v30/v21  │ Aura-2/1      │  worker   │
│           │ clone (uc_)   │ WS stream     │ + ffmpeg  │
│           │ 37 langs      │ 7 langs       │  concat   │
└───────────┴───────────────┴───────────────┴───────────┘
                ↕ cross-cutting (every request):
        credits · moderation · rate limits · auth · audit
```

---

## 2. Component details

### 2.1 Next.js app — routes & runtimes
| Route | Runtime | Notes |
|---|---|---|
| `/` landing + `/api/landing/demo` | Node | demo: Edge TTS, Turnstile-verified, 12/day/IP |
| `/studio`, `/voice-library`, `/voice-cloning` | Node (server actions) | session auth |
| `/api/v1/tts/*` | Node | developer API, Bearer keys |
| `/api/v1/stream/*` | Node (WebSocket upgrade) | Deepgram relay |
| `/api/payments/*` | Node | Razorpay webhooks (HMAC) |

Node runtime everywhere TTS happens (edge-tts WS handshake + Deepgram WS relay need Node; no edge/worker functions for synthesis).

### 2.2 TTS Provider Interface (unchanged contract, 3 impls)

```ts
interface TtsProvider {
  name: 'edge' | 'typecast' | 'deepgram' | 'kokoro';
  listVoices(): Promise<VoiceRecord[]>;
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;  // async REST path
  stream?(req: SynthesizeRequest): AsyncIterable<Buffer>;          // streaming path
  clone?(sample: Buffer, name: string): Promise<string>;           // → providerVoiceId
  maxCharsPerRequest: number;          // edge 10000 · typecast 2000 · deepgram 2000
  maxConcurrent: number;               // edge ~2 (throttled) · typecast 5 (Lite) · deepgram 15
  healthCheck(): Promise<boolean>;
}
```

**Provider facts baked into registry config (from research/05+07):**
| | Edge | Typecast | Deepgram |
|---|---|---|---|
| Max chars/req | 10,000 (self-chunks @4096B) | 2,000 | 2,000 |
| Concurrency | self-throttle ~2 | 5 (Lite) | 15 REST / 45 WS |
| Output | MP3 24kHz | WAV/MP3 44.1kHz | MP3/WAV/opus; WS = linear16/mulaw/alaw |
| Emotions | 5 styles (neutral/cheerful/calm/serious/excited) | 7 presets + intensity 0–2 | speed + IPA overrides |
| Timestamps | WordBoundary events | `/v1/text-to-speech-with-timestamps` | ❌ (STT pass needed) |
| Cloning | ❌ | ✅ instant (5–150s) | ❌ |
| Languages | 75+ | 37 | 7 (en/es/de/fr/nl/it/ja) |

### 2.3 Long-form pipeline (research/07 blueprint)

```
Long text (e.g. 120K chars) ──▶ LongFormJob (generations row, type=longform)
  │ split: pack sentences to ≤1,900 chars (Typecast 2,000 cap − headroom)
  │   + keep <previous_text>/<next_text> context for prosody continuity
  ├─▶ chunks queued (per-provider concurrency cap honored)
  ├─▶ each chunk: same voice, same model, fixed seed where available,
  │     target_lufs=-16 per request (Typecast native loudness lock)
  ├─▶ per-chunk progress rows (generations_chunks) → UI progress %
  └─▶ ffmpeg concat demuxer → single loudnorm pass + 250ms apad
       → final MP3 + SRT (from timestamps) + duration
```
- **Never crossfade narration** (research/07). 
- **Voice consistency** = same voice/model/settings + seed + context + loudness lock.
- **SRT source per provider:** Edge = WordBoundary metadata · Typecast = timestamps endpoint (jpn/zho use `granularity=char`) · Deepgram = no timestamps → for Deepgram chunks run a cheap STT pass (Deepgram STT) or restrict Deepgram long-form to `SRT: disabled` at launch.

### 2.4 Streaming relay (Deepgram)

```
Browser (Web Audio queue) ←── Node WS relay (/api/v1/stream) ←── Deepgram WSS
                                    │ auth + credits + moderation + rate limit
```
- Client sends text over our WS (or sends whole request, receives chunked audio).
- Relay opens `wss://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=16000`, pipes bytes back. Browser decodes with `Web Audio API` (AudioContext + queue). 
- 45 concurrent WS per Deepgram project — we pool; cap active relays at ~8/user.
- Streaming billing: **2 credits/char same as REST flagship**; debited at start, refunded on abort mid-generation (partial chars).

### 2.5 Cloning pipeline (Typecast; research/07 Part B)

```
/user uploads 5–150s WAV/MP3 + name + language
  → consent attestation stored (user_id, voice_id, sample hash, SHA256, date, IP)
  → public-figure/moderation check on metadata (name/desc)
  → POST api.typecast.ai/v1/voices/clone  → uc_xxx
  → insert voices row: provider=typecast, provider_voice_id=uc_xxx,
    owner_user_id=<user>, is_premium=true, is_custom=true
  → clone usable ONLY by owner (Typecast owner-scope; master-key mode — research/07 pitfall #3)
  → 50 slots on Lite plan → slot tracking table; grant-based enable
```
- v2 upgrade: voiceprint verification (ECAPA cosine) comparing live mic vs sample before cloning — ElevenLabs-style (research/07).
- Deletion: user deletes clone → DELETE Typecast custom voice + hard-delete rows + stored consent.

### 2.6 Deepgram platform services (beyond TTS — research/09)

**A. SRT round-trip service (flagship subtitles).** Deepgram TTS returns no timestamps, so after flagship synthesis we run the stored audio back through STT:
```
flagship audio (storage) → POST api.deepgram.com/v1/listen?model=nova-3&smart_format=true&utterances=true&punctuate=true
   → word-level timestamps (free feature) → @deepgram/captions (toSrt) → store .srt → subtitlesUrl
Cost ≈ $0.0043/min (10-min VO ≈ $0.043) — added to generation COGS, surfaced in admin cost view.
```
- Batch STT endpoint accepts `callback` too (async) — used by long-form worker.
- v2: the same pipeline becomes the **transcription tool** (user uploads any audio → transcript + SRT + speaker labels via `diarize=true`).

**B. Cost/COGS pipeline (per-user cost tracking).**
- Every Deepgram request carries `tag=lv:${userId}:${plan}:${generationId}` (TTS + STT).
- Nightly job: `GET /v1/projects/{id}/billing/breakdown?grouping=["tags","line_item"]` → upsert `provider_usage_daily` (cost_cents per provider per user) → admin dashboard "cost by user/plan".
- Same job aggregates Typecast (chars × rate) and Edge (chars, $0) for the blended view.

**C. Async callback receiver.** Deepgram can POST completion to `POST /api/deepgram/callback` (`callback_method=POST`); verify + route into our generation finalize step (idempotent by generation_id). Used in M5 long-form; polling remains the fallback.

**D. Streaming relay (unchanged from §2.4)** — WS path for realtime.

**E. Phase-2 voice agents** — separate subsystem: our `/api/v1/agents` CRUD creates Deepgram **Agent Configurations** (LLM choice, prompt, voice, STT), users embed a WebSocket widget; wholesale $0.075/min, resold at $9–15/hr; 45-connection cap pooled.

### 2.7 Cross-cutting layer (every TTS request)
1. **Auth** — session (Studio) or API key hash lookup (API)
2. **Moderation** — OpenAI Moderation API on text; block → error `content_policy`
3. **Limits** — per-user daily caps (edge 100K chars; generation count), per-key token bucket + `X-RateLimit-*` headers, per-IP guest demo caps
4. **Credits** — atomic ledger debit (schema §7); refund on failure
5. **Audit** — generation row + app_events; abuse flags (R1–R24, research/08)

### 2.7 Background jobs
| Job | When | Runs |
|---|---|---|
| Long-form chunk processing | on long-form create | in-request loop until per-provider concurrency bound, else M0 queue via Supabase Queues (pgmq) |
| Nightly voice catalog sync | daily 02:00 UTC | Edge list + Typecast + Deepgram voices → `voices` upsert |
| Preview generation | first library visit | Typecast/Deepgram one-time, cached to storage |
| Provider spend monitor | hourly | sum `provider_usage_daily` → alert if > $5/day any provider |
| Credit rollover (90-day) | daily | expire old monthly credits per policy (packs never expire) |
| Usage summary email | monthly | Resend |

---

## 3. Data flows

### 3.1 Premium (Typecast) generation — happy path
1. Studio: voice fs_x (→ tc_y, ssfm-v30) + 1,200 chars + emotion preset
2. Server: auth → moderation → caps → `BEGIN`: debit 1,200 credits (guarded UPDATE) + insert generation (idempotency_key unique) → `COMMIT`
3. `TypecastProvider.synthesize` (1 call, ≤2,000 chars; `target_lufs:-16`)
4. Upload MP3 → storage; update status=completed (+duration, charCount)
5. Client polls → player. History + SRT (timestamps endpoint, 1 extra call)

### 3.2 Flagship (Deepgram) generation
Same, but: debit 2× chars; `@deepgram/sdk` REST `speak` with `model=aura-2-thalia-en&encoding=mp3&container=mp3` + inline IPA overrides + `tag=lv:...`; `mip_opt_out` decision applied per config. If `subtitles:true` → SRT round-trip (§2.6.A) after audio stored.

### 3.3 Guest demo (free)
Turnstile token verified server-side → no auth → IP-session table (12/day) → moderation → Edge TTS (or Typecast fallback if Edge down) → base64 MP3 in response (FameSpeak-style), no storage, no ledger.

### 3.4 Failure & refund paths
- Provider 5xx → retry ×2 (1s/3s backoff) → failed → **auto-refund ledger row** + `refunded` status
- Edge down → demo falls back to Typecast cheapest voice (no charge to guest); Studio free tier → transparent "engine unavailable, retry later"
- Deepgram 429 (concurrency) → queue with jitter; exceeded budget → admin kill-switch toggles provider off

---

## 4. Security architecture (summary — full: research/08)

```
Cloudflare edge: WAF managed rules · Bot Fight Mode · Turnstile · rate rule on /login /api/landing/demo
App layer:      RLS on all tables · service_role server-only · zod input validation
                OpenAI moderation on text · HMAC webhook verify · idempotency unique
Secrets:        Vercel env, no client bundles (CI grep check)
Keys:           SHA-256 hash + prefix · scopes · revoke/rotate · per-key limits
Storage:        private bucket, presigned URLs ≤1h, bucket-policy per user path
Admin:          flags queue, temp bans, provider kill-switches, spend alerts
```

---

## 5. Scaling path (v2+)
- Long-form workers out of Vercel → small VPS (Hetzner ~$6) running Node worker + Supabase Queues
- Audio storage → Cloudflare R2 (0 egress) + CDN cache by (voice,text-hash)
- Self-hosted tier → Kokoro-82M on the VPS CPU (Apache-2.0, Elo 1056) exposed as `kokoro` provider
- Voice agents → Deepgram Voice Agent API ($4.50/hr) as engine, our own orchestration
