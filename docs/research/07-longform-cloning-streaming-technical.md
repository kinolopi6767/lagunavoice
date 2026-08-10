# Long-Form TTS, Voice Cloning & Streaming — Deep Technical Research

> **Project:** LugunaVoice — TTS voice-generation SaaS (reference model: famespeak.online, which resells Typecast)
> **Research date:** 2026-08-10
> **Providers covered:** msedge-tts (free/unauthorized Edge endpoint), Typecast API (ssfm-v30/v21), Deepgram (Aura-1/Aura-2, formerly called "Aura" family)
> **Method:** Direct fetch of official docs (typecast.ai/docs, developers.deepgram.com, elevenlabs.io/docs, GitHub source of edge-tts, npm registry) + prior research in `01-tts-api-providers.md`. Every limit below has a source; re-verify before launch because APIs change.
> **Sibling docs:** `01-tts-api-providers.md` (pricing/quality/licensing master table) · `02-open-source-tts.md` · `03-github-resources-and-tools.md` · `04-competitor-analysis.md`

---

## 0. Executive summary (TL;DR)

| Topic | Answer |
|---|---|
| **Chunk size** | Sentence-group chunking, target **~1,800–1,950 chars** per request. This fits Typecast's hard 2,000-char cap (our primary engine) while staying under every other provider's practical limit. Paragraph boundaries preferred over raw sentence splits; never split mid-sentence. |
| **Stitching** | Render all chunks in the **same format** (Typecast MP3 320 kbps / WAV 44.1k mono), set `target_lufs=-16` per request (Typecast native loudness normalization), then concatenate with **ffmpeg concat demuxer + single-pass `loudnorm`**, inserting a **250 ms silence pad** (via `apad` at chunk level or `concat` with padding) so no click/pop survives. Two-pass loudnorm only if the final mix still varies. |
| **Consistency** | Per-generation `seed` (Typecast supports it: same seed + same params = identical audio; Deepgram and edge-tts have **no seed**), `previous_text`/`next_text` context on every call (Typecast SmartPrompt), same voice_id + model + emotion preset + pitch/tempo on every chunk, `target_lufs` locked. Deepgram's new **Flux TTS (`/v2/speak`) persists cross-turn prosody server-side** — its native answer to long-form consistency. |
| **Cloning (build order)** | Ship **Typecast instant cloning first** — it's the only one of the three with a self-serve cloning API (50 slots on Lite / 800 on Plus, 5–150 s sample, `uc_` voice ids). Deepgram has **no public custom-voice API** (enterprise/sales only). edge-tts has **no cloning at all** (confirmed). Add ElevenLabs-style consent + live-mic verification *ourselves* because Typecast's API has no verification gate. |
| **Streaming** | Use Deepgram WebSocket (`wss://api.deepgram.com/v1/speak`, linear16/mulaw/alaw, 45 concurrent) for interactive preview/typing-to-speech; Typecast streaming for the primary engine's preview; edge-tts only as a behind-the-flag free-tier experiment. Async REST + chunk workers for anything > a paragraph. |
| **3 pitfalls** | ① fluent-ffmpeg is **deprecated** (npm shows "Package no longer supported", maintainers wanted) — shell out to `ffmpeg-static` directly. ② Deepgram TTS returns **no word timestamps** (SRT needs an STT pass); only Typecast (`/with-timestamps`) and edge-tts (WordBoundary events) are native. ③ Typecast `voice_id` clone consumption: **only the owning account's key can use a `uc_` voice** — a multi-user SaaS cannot share one cloned voice across customer-scoped API keys; slot math and ownership must be designed up front. |

---

# PART A — LONG-FORM GENERATION (audiobook-length, 50k+ chars)

## A.1 The core problem: every provider has a per-request text cap

Long-form TTS is never "send the whole book". All serious pipelines split text, synthesize in parallel, then stitch. Verified per-request limits:

| Provider | Max text / request | Type of limit | Source |
|---|---|---|---|
| **Typecast** | **2,000 characters** (hard, 400/422 error above) | documented | typecast.ai/docs/api-reference/text-to-speech/text-to-speech |
| **edge-tts** | **4,096 bytes internally** (the library auto-splits your text into 4,096-byte chunks and sends each on its own WebSocket turn) | in source code | `edge_tts/communicate.py` → `split_text_by_byte_length(..., 4096)` |
| **Deepgram** | **No documented max**; 15 concurrent REST / 45 WS; practical guidance: sentence-level chunks, 200–400 chars "preserves intonation" for long-form | docs recommend chunking | developers.deepgram.com/docs/text-chunking-for-tts-optimization.md |
| **ElevenLabs** (benchmark) | ~5,000 chars historical cap; current reference lists no explicit max — chunk ≤4,000 to be safe | reference | elevenlabs.io/docs/api-reference/text-to-speech/convert |
| **Play.ht** (benchmark) | No documented per-request limit; offers a dedicated **Batch TTS API** (create job → poll child jobs) for long-form | docs | docs.play.ht/llms.txt |
| **Speechify** (benchmark) | Per-request API; no public long-form endpoint; chunk client-side | — | — |

**Practical conclusion:** design the pipeline around Typecast's 2,000-char cap (the binding constraint for the primary engine) and it works unmodified on every other provider.

## A.2 Chunking strategy (sentence/paragraph splitting)

### A.2.1 Algorithm (shared chunker, all providers)

1. **Normalize** input (strip BOM, normalize whitespace, strip vertical-tab/control chars — edge-tts errors on `0x0B`/OCR artifacts; its `remove_incompatible_characters` exists for exactly this).
2. **Split into paragraphs** (`\n\n`), then **into sentences** at `. ! ? ;` and their closing quotes/brackets (lookbehind regex `(?<=[.!?])\s+` per Deepgram's docs), then **into clauses** at `,` + coordinating conjunction only when a sentence still exceeds the cap.
3. **Greedy pack sentences into chunks ≤ ~1,900 chars** (safety margin below 2,000). A chunk must **never end mid-sentence**; a chunk should **prefer a paragraph boundary**.
4. **Never split inside:**
   - numbers/dates ("3.14", "Mr. Smith" — sentence splitter must not treat `3.14` or `Mr.` as a boundary),
   - SSML/tags, XML entities (`&amp;` — edge-tts adjusts split points for these), emoji pairs (UTF-8 safety, edge-tts uses `_find_safe_utf8_split_point`).
5. **Context carry:** for Typecast SmartPrompt and ElevenLabs `previous_text`/`next_text`, remember the raw text immediately before/after each chunk (≤2,000 chars each for Typecast) so the model sees the emotional flow across chunks.

### A.2.2 Why sentence/paragraph boundaries (not raw char slicing)

Deepgram's own docs: chunking at sentence boundaries preserves natural prosody; **200–400 chars/chunk** is their recommended size for *long-form intonation*; smaller chunks (50–100) only for voice-agent TTFB. But chunk size is a trade-off:

- **Smaller chunks** → lower latency to first audio, better parallel fill, but weaker context per generation (flatter delivery, more boundary artifacts).
- **Larger chunks** → better prosody/consistency, fewer seams, higher per-request cost risk (Typecast caps at 2,000).

For **audiobook narration** the win is bigger chunks: 1,800–1,950 chars ≈ 9–12 sentences ≈ 90–120 s of audio each.

### A.2.3 Per-provider nuance

| Provider | Recommended chunk | Why |
|---|---|---|
| Typecast | 1,800–1,950 chars | Hard cap 2,000; also max for `previous_text`/`next_text` is 2,000 each |
| Deepgram REST | 1,500–2,000 (or 200–400 for max prosody per their docs; test both) | no hard cap; 15 concurrent |
| edge-tts | ≤4,000 bytes is auto-handled; for progress/SRT control pre-chunk at ~1,500–2,000 chars | library re-splits at 4,096 bytes internally |
| ElevenLabs | ≤4,000 chars | historical ~5,000 cap; WS `chunk_length_schedule` default `[120,160,250,290]` chars shows the model quality drops for tiny inputs |

## A.3 Keeping the VOICE CONSISTENT across chunks

Consistency is 90% "same voice, same model, same settings, same seed, plus context", and 10% "post-process loudness".

### A.3.1 Per-provider consistency mechanisms

| Mechanism | Typecast | Deepgram | edge-tts | ElevenLabs (benchmark) |
|---|---|---|---|---|
| **Seed parameter** | ✅ `seed` (uint ≥ 0) — same seed + same params → **identical audio**. Also makes chunk retries reproducible. | ❌ none | ❌ none | ✅ `seed` (0..2^32-1), "best effort", determinism not guaranteed |
| **Persisted voice settings** | voice_id + model + emotion preset/intensity + pitch + tempo + volume | model string `aura-2-*` + `speed` controls only | voice + rate + pitch + volume strings | `voice_settings` (stability/similarity_boost/style/speed) persist per voice |
| **Cross-chunk text context** | ✅ `prompt.previous_text` / `next_text` (SmartPrompt, ≤2,000 chars each) | ❌ (per-request stateless) | ❌ | ✅ `previous_text`/`next_text` + `previous_request_ids`/`next_request_ids` ("request stitching", max 3 ids, needs `enable_logging=true`) |
| **Cross-turn model state** | ❌ | ✅ **Flux TTS `/v2/speak` persists model state across turns for consistent prosody** (early access) | ❌ | ✅ WS stream-input keeps one generation context per connection |
| **Loudness lock** | ✅ `target_lufs` (-70..0; -14 streaming / -23 broadcast recommended) — cannot combine with `volume` | ❌ (post-process) | ❌ (post-process) | ❌ (post-process) |
| **Emotion consistency** | ✅ preset + `emotion_intensity` (0.0–2.0), or `smart` auto-detect (don't use auto for long-form — it varies per chunk) | ❌ | ❌ | ✅ style setting |

### A.3.2 Recommended consistency recipe (LugunaVoice default)

1. **Lock the entire request template** per generation job: one `voice_id` (or `model` for Deepgram), one `model`, one emotion preset (`preset` + fixed `emotion_intensity`, **never** `smart` for long-form), fixed `audio_pitch`, `audio_tempo=1.0`, fixed output format.
2. **Fix a seed per job** (e.g. `seed = hash(job_id) & 0xFFFFFFFF`). Retries of a failed chunk then produce byte-identical audio (Typecast), so the stitched result is stable.
3. **Feed context every call:** for chunk *i* set `previous_text = text of chunk i-1 (tail)`, `next_text = text of chunk i+1 (head)` — this is the single highest-value consistency lever on Typecast (it's what their SmartPrompt flow analyzes: `previous → text → next`).
4. **Typecast:** `target_lufs = -16` on every request → every chunk arrives already normalized to the same absolute loudness.
5. **Deepgram:** if using the classic Aura REST, chunk at sentence boundaries and accept minor inter-chunk variance; if consistency is critical, evaluate **Flux TTS `/v2/speak`** (streaming-first, cross-turn context — designed for this). For strict determinism it has no seed; use STT-style QA or regenerate.
6. **edge-tts:** fixed voice + fixed `rate/volume/pitch` strings; no seed → runs are non-deterministic; acceptable for the free/experimental tier only.

## A.4 Audio stitching (concat, clicks, loudness)

### A.4.1 Tooling — `fluent-ffmpeg` is DEAD, don't use it

Verified 2026-08 on npm: **fluent-ffmpeg 2.1.3 is deprecated** — npm shows *"Package no longer supported"*; the GitHub repo banner says *"Fluent-ffmpeg is looking for new maintainers"*. It also drags in `ffmpeg` as a system dependency. **Use instead:**
- `ffmpeg-static` (bundled binary, no system install) + **spawn the binary directly** (child_process) — you keep full control of filters and get proper streaming/`stderr` progress.
- Or the `ffmpeg` binary installed in the container.
- Pure-JS fallbacks for light jobs: `node-wav` (WAV headers), `lamejs` (MP3 encode), `mp3-encoder`; not needed for production if ffmpeg-static is present.
- `ffprobe` (ships with ffmpeg-static) for duration/format validation of every chunk before concat (guard against silent truncation).

### A.4.2 The three ways to concatenate (in order of preference)

**Option 1 — Same-format concat demuxer (fastest, lossless, no re-encode):**
```
# list.txt
file 'chunk_001.mp3'
file 'chunk_002.mp3'
...
ffmpeg -f concat -safe 0 -i list.txt -c copy -af loudnorm=I=-16:TP=-1.5:LRA=11 out.mp3
```
- Works only if all chunks share codec, sample rate, channels, bitrate.
- MP3 is **frame-based**: boundary clicks can occur when encoder padding/`LAME` delay differs between chunks. Because Typecast always returns the same bitrate/samplerate for a given `audio_format`, and edge-tts always returns `audio-24khz-48kbitrate-mono-mp3` (CBR), concat-copy is *usually* clean. Verify by ear/spectrogram on 3 real jobs.

**Option 2 — Re-encode everything (guaranteed gapless):**
```
ffmpeg -i chunk_%03d.mp3 -af apad=pad_dur=0.25,loudnorm=I=-16:TP=-1.5:LRA=11 -c:a libmp3lame -b:a 320k out.mp3
```
- Decode to PCM → pad **250 ms silence** between chunks (`apad`) → encode once. Padding is the reliable click killer: clicks come from non-zero waveform discontinuities at the join; silence guarantees a zero-crossing gap.
- Slower (full re-encode), but for 60–120 min audiobooks it's one pass — negligible.

**Option 3 — Crossfade (only for music-style boundaries, NOT narration):**
```
ffmpeg -i a.mp3 -i b.mp3 -filter_complex "[0][1]acrossfade=d=0.05:c1=tri:c2=tri" out.mp3
```
- Crossfading narration corrupts word timing (SRT drifts) and sounds unnatural. Use `apad` silence instead. Crossfade belongs in the **music/background-mixing** feature, not the TTS stitch.

**Recommended pipeline:** Option 1 (copy-concat) when chunks come from the same provider+format+settings, then a single final `loudnorm` pass; fall back to Option 2 with `apad` when chunk formats differ or a click is detected. Keep the **WAV intermediates only when you need lossless mastering** (WAV 16-bit mono 44.1 kHz is Typecast's WAV format; Deepgram linear16 24k/48k).

### A.4.3 Loudness normalization

- **Typecast (native, best):** `target_lufs: -16` per request → every chunk arrives at the same absolute loudness; the final `loudnorm` pass then only does a light touch.
- **ffmpeg loudnorm** (Deepgram/edge-tts chunks):
  - Single-pass: `-af loudnorm=I=-16:TP=-1.5:LRA=11` — fine for podcast/audiobook delivery.
  - Two-pass (accurate, EBU R128): pass 1 `loudnorm=print_format=json` (no output) → read measured `input_i/input_lra/input_tp` → pass 2 `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=...:measured_LRA=...:measured_TP=...:linear=true:print_format=summary`.
- Targets: `-16 LUFS` streaming/podcast, `-23 LUFS` broadcast, `-14 LUFS` loud commercial streaming (YouTube-style). Pick **-16** default.
- Never rely on `volume` scaling alone for cross-chunk consistency (Typecast docs explicitly warn it "amplifies loudness differences between voices" — same applies post-hoc).

### A.4.4 SRT drift after stitching

Each chunk's timestamps are relative to the chunk. After concat, re-base: `global_start(i) = Σ duration(j) for j < i` (use ffprobe durations of the *final* normalized chunks, not the raw ones, because loudnorm does not change duration but `apad` does). Compute from the **stitched** file if possible.

## A.5 Parallel synthesis: concurrency limits & batching

| Provider | Concurrency limit (verified) | Practical worker count | Notes |
|---|---|---|---|
| **Typecast** | **Lite = 5**, Plus = 15, Enterprise custom (pricing page) | 4 (Lite) / 12 (Plus) | Leave 1 spare to avoid 429 cascades; credits are per-plan so cost is fixed per char |
| **Deepgram REST** | **15** concurrent (PAYG, NA/EU/AU), 25+ Enterprise; **45** for WS streaming | 12–14 REST | Limits are **per project**, not per key; splitting across projects to evade limits violates ToS (secondary projects capped at 1 stream) |
| **Deepgram WS** | 45 concurrent (PAYG) | — | streaming path only |
| **edge-tts** | **No documented limit** (unofficial) | **1–2** | Sustained parallel load risks IP blocks and token (Sec-MS-GEC) invalidation; Microsoft can and has broken the protocol |
| ElevenLabs (benchmark) | depends on plan/tier | — | — |

**Batching rules:**
1. A **semaphore-constrained worker pool** per provider (see blueprint §F.2). Never fire-and-forget; always bound the pool.
2. **Wave staggering:** launch ≤ pool size, then fill as each completes. First-chunk priority: for "play while generating", kick off chunk 1 alone, then parallelize the rest (Deepgram's docs call this *first-chunk optimization*).
3. **Retry with backoff:** on 429/5xx → exponential backoff (1s, 2s, 4s…), max 3 attempts, then mark chunk `failed`. With a fixed seed (Typecast) a retry is byte-identical.
4. **edge-tts specific:** serialize to 1–2 concurrent, and the library already handles 403 (DRM token refresh) and re-splits at 4,096 bytes.

## A.6 Progress reporting to UI (chunk worker + progress table)

### A.6.1 State model

```
Job (audiobook chapter / full book)
 ├─ id, provider, voice_id, model, seed, status, created_at
 └─ Chunks (array, ordered)
     └─ id, seq, text_slice, chars, status, attempts, retry_reason,
        audio_url, duration_s, started_at, finished_at, cost_credits
```

Chunk status machine: `queued → generating → done` | `failed` (with retry) | `skipped`.

### A.6.2 UI push

- **Server → client:** WebSocket (or SSE) channel per job id. Events: `chunk_queued {seq}`, `chunk_started {seq}`, `chunk_done {seq, duration_s, audio_url}`, `chunk_failed {seq, reason}`, `job_progress {done, total, pct}`, `job_done {final_url, srt_url}`.
- **Frontend:** progress table — seq, first 40 chars preview, status pill (🟡 queued / 🔵 generating / 🟢 done / 🔴 failed + retry button), duration, retry count. Aggregate bar = `done/total`; ETA = `(done/total) × elapsed`.
- **Backend:** keep job state in Postgres/Redis (job table above); the worker pool writes every transition. On crash, resume `queued`/`failed` chunks on boot (idempotent thanks to seed).

### A.6.3 Cost transparency

Typecast credits ≈ characters. Track `chars × rate` per chunk and show live spend; Deepgram = `chars × $/1K`; edge-tts = $0 (flag "experimental").

## A.7 SRT / subtitle generation per provider (timestamp capabilities)

**This is where providers diverge hard.** Verified capability matrix:

| Provider | Native timestamps from TTS? | How | Best for SRT? |
|---|---|---|---|
| **Typecast** | ✅ **Yes** — `POST /v1/text-to-speech/with-timestamps` returns base64 audio + `words[]` and `characters[]` arrays with `start`/`end` (seconds) | `granularity=word` (default both); **word** collapses to one segment for no-whitespace languages (**jpn/zho must use `granularity=char`**) | ⭐ **Best of the three** — zero extra cost for word-level SRT (credit cost is same as TTS) |
| **edge-tts** | ✅ **Yes** — WordBoundary/SentenceBoundary metadata events over the WS (`offset` in 100-ns ticks + `duration`) | library parses and yields them; offsets are **compensated** across its internal 4,096-byte chunks (`__compensate_offset` uses CBR byte math to fix Microsoft's offset overflow on long text) | ✅ Good — convert `offset/10_000_000` → seconds; note 24 kHz/48 kbps MP3 output only |
| **Deepgram** | ❌ **No** — `/v1/speak` returns audio only; no alignment data in TTS response | Workarounds: ① run the generated audio through **Deepgram STT** (Nova/Fast, `timestamps=true`) for exact word times (extra STT cost); ② estimate proportionally (chars → seconds) for rough captions | ⚠️ Only via extra STT pass |
| ElevenLabs (benchmark) | ✅ WS stream-input returns `alignment`/`normalizedAlignment` (`charStartTimesMs`, `charDurationsMs`); REST `convert` returns none | WS only; also a dedicated "Stream speech with timing" endpoint | ✅ |
| Play.ht (benchmark) | ✅ word timestamps available in WS metadata | WS API | ✅ |

**SRT builder (shared):** collect `{word, start, end}` per chunk → offset by chunk global start (A.4.4) → group into 2–4 word lines, ≤ 42 chars/line, min duration 1 s, end = next line start − 0.1 s → write `00:00:01,250 --> 00:00:03,100` blocks.

## A.8 Worked cost & time example: 100,000-character chapter (~100 min of audio)

Assumptions: ~5.5 chars/word → ~18,000 words → ~100 min at 150 wpm; chunk = 1,900 chars → **53 chunks**.

| Metric | **Typecast** (ssfm-v30) | **Deepgram** (Aura-2 REST) | **edge-tts** |
|---|---|---|---|
| Requests | 53 (≤2,000 chars each) | 53 (or 250–500 smaller) | 53 pre-chunks → ~25 internal 4,096-byte turns |
| **Cost** | **$7.50** (at $0.075/1K wholesale) / $9.00 overage; or $0 if inside the Lite plan's 200K credits ($15/mo) | **$3.00** (Aura-2 $0.03/1K); **$1.50** with Aura-1 | **$0.00** (unauthorized) |
| Concurrency | 4 workers (Lite cap 5) | 12 workers (cap 15) | 1–2 workers (throttle) |
| Latency/request | ~8–15 s per 1,900-char chunk (≈ 2 min audio, faster than realtime) | ~5–10 s per chunk | ~5–15 s per internal turn |
| **Wall time** | 53/4 × ~12 s ≈ **2.5–3.5 min** | 53/12 × ~8 s ≈ **40–70 s** | 25 turns / 1.5 × ~10 s ≈ **3–5 min** |
| Stitch+loudnorm | ~1–2 min (copy-concat + final pass) | ~1–2 min | ~1–2 min |
| **Total (≈100 min audio)** | **≈ 5 min, $7.50** | **≈ 2.5 min, $3.00** | **≈ 6–8 min, $0 (risky)** |
| SRT | word-level, same cost | + STT pass (~$0.01/min ≈ $1) | word-level, free |

ElevenLabs benchmark: 100K chars ≈ 100K credits → ~$20 extra (Starter $0.20/1K) — 2.7× Typecast, ~7× Deepgram.

---

# PART B — VOICE CLONING / CUSTOM VOICES

## B.1 Per-provider process table

### B.1.1 Typecast — instant cloning (the ONLY self-serve cloner of the three) ⭐

**Endpoint:** `POST https://api.typecast.ai/v1/voices/clone` (multipart/form-data, auth `X-API-KEY`)

| Parameter | Requirement (verified from docs) |
|---|---|
| `file` | **WAV or MP3**, max **25 MB**, **5–150 s** duration |
| `name` | 1–30 characters |
| `model` | `ssfm-v21` or `ssfm-v30` — **the clone is bound to that engine** |
| Response | `{ "voice_id": "uc_…", "name": …, "model": … }` |

- **Slots:** 50 (Lite) / 800 (Plus) / unlimited (Enterprise) `custom_voice_slot`. Delete via `DELETE /v1/voices/{voice_id}` to free a slot. (pricing verified in `01-tts-api-providers.md`)
- **Usage:** pass `uc_…` as `voice_id` on `/v1/text-to-speech`, `/with-timestamps`, streaming, compose — it behaves like any built-in voice. **"Only the owner of a cloned voice can use it"** (docs) → see §B.5 pitfall.
- **Emotion on clones:** the clone is bound to the model, so all model-level controls apply — emotion presets (v30: normal/sad/happy/angry/whisper/toneup/tonedown) + `emotion_intensity`, pitch/tempo, `target_lufs`, `seed`. There is **no separate "clone emotion training"** — emotions are the same 7 presets as built-ins.
- **Languages for cloning:** cloning extracts a speaker embedding; the resulting voice speaks any language the bound model supports (37 for ssfm-v30, 27 for v21). No language restriction is documented on the clone endpoint.
- **Cost:** cloning itself is a **slot** (no per-clone fee documented); TTS consumption is normal credits. The sample is uploaded to **S3 in the background after the response** (their note).
- **Consent/verification: NONE in the API.** Typecast does not verify who the speaker is or require consent proof. This is both the fastest UX and our biggest compliance responsibility (see §B.4/B.5).

**Typical flow (from docs):** `POST /voices/clone` with sample → use `uc_` id in TTS calls → `DELETE /voices/{voice_id}` when done.

### B.1.2 Deepgram — "Aura custom voice": NOT publicly available

- **Correction to brief:** Deepgram's TTS models are **Aura-1 and Aura-2** (there is no "TTS-1/TTS-2" in their docs). 
- **Status (verified 2026-08):** the public docs index (developers.deepgram.com/llms.txt, 200+ pages) contains **no custom-voice or cloning page**. The TTS feature matrix covers only stock Aura/Flux voices. Publicly documented capabilities: voices for **en, es, de, fr, nl, it, ja** only.
- **What this means:** Deepgram custom voices are an **enterprise/sales-only offering** (historically: larger sample sets, ~10–30 min of clean studio speech, training time in days, custom contract with one-time training + per-month hosting pricing, all quote-based). There is **no API, no self-serve UI, no published SLA or price list**. 
- **Recommendation:** do **not** build the custom-voice feature on Deepgram. If a customer insists, escalate to Deepgram sales as a "branded voice" project with a contract; treat it as a service we *resell* manually, not an API feature.
- **Terms/consent for that program:** negotiated per contract (consent attestation is standard in the industry; no public form).

### B.1.3 msedge-tts — no cloning: **CONFIRMED**

- The Edge endpoint serves only Microsoft's stock neural voices (`en-US-JennyNeural` etc.); there is no voice creation/upload surface. SSML is restricted to a single `<voice>` + single `<prosody>` (custom SSML blocked). No clone, no embedding, no `uc_`-style ids. (Verified in repo README + prior research.)

### B.1.4 ElevenLabs (benchmark for cloning UX & consent) — why we should mirror it

| Aspect | IVC (Instant Voice Cloning) | PVC (Professional Voice Cloning) |
|---|---|---|
| Endpoint | `POST /v1/voices/add` (multipart: name, files, remove_background_noise) | `POST /v1/voices/create` + **verification step** |
| Samples | **1–3 min** total (≤ 2-3 min recommended; >2-3 min can hurt) | **30–180 min** |
| Training time | Instant (embedding-based, no model training) | **2–6 h** fine-tune queue |
| Response | `{ voice_id, requires_verification }` | model trained on Flash/Turbo/Multilingual v2 |
| Verification | `requires_verification=true` possible (account trust) | **Mandatory live-mic verification**: user reads fixed lines aloud, must match training audio, per-line once; 24 h retry cooldown |
| Ownership | — | **PVC can only clone YOUR OWN voice** — even with consent you cannot clone someone else; they must create + verify on their account and share a link |
| Slots | — | Creator 1 / Scale 3 / Business 10 / Enterprise custom |
| Languages | any language supported by Flash v2.5/Turbo v2.5 | ~39 languages listed |
| Export | **clones are not exportable**; re-clone from saved samples (each clone differs slightly) | same |

**Design takeaway for LugunaVoice:** Typecast gives us the instant-clone API but *no verification*. ElevenLabs shows what "responsible" looks like: mandatory verification lines + owner-only clones + share links. We should implement the ElevenLabs-style consent+verification flow *on top of* Typecast (see §B.5).

## B.2 Consent & ethics — requirements per provider (matrix)

| Provider | Documented consent/verification requirement | What we must enforce ourselves |
|---|---|---|
| **Typecast** | API docs: none. Commercial license on paid plans; no consent gate documented. | ✅ **Full burden on us:** consent attestation, identity verification (recommended), rights-to-sample clause in ToS, abuse/impersonation policy, takedown process, watermarking consideration |
| **Deepgram** | No public custom voice → N/A self-serve; enterprise contract would include terms | N/A (skip feature) |
| **edge-tts** | No cloning → N/A | N/A |
| **ElevenLabs** (benchmark) | PVC: **mandatory verification** (live mic reading lines); "all audio generated can be instantly traced back to the user"; owner-only clones; sharing via private links; prohibited-use + IP enforcement | Not our provider, but the *gold standard UX* to copy: consent checkbox → verification lines → moderation → traceability |
| **Play.ht / Speechify / Cartesia / Fish** (industry) | Instant cloning generally requires only a **consent affirmation** (checkbox/attestation); Cartesia & Speechify state "consented voices only" | Industry baseline = consent checkbox. We exceed it with verification. |

**Global legal note:** EU AI Act transparency obligations + various deepfake/fraud laws (e.g., disinformation legislation) increasingly require: disclosure that content is AI-generated, consent for voice likeness, and watermarking/labeling. LugunaVoice should ship **AI-generated labeling** on outputs from day one (also a market trust feature).

## B.3 Voice verification — practical approaches (how to prove the user owns the voice)

Ranked from weakest to strongest:

1. **Consent checkbox + legal attestation** (industry standard, minimal friction). In flow: *"I confirm I am the speaker, or have explicit permission from the speaker to create this voice clone."* — binds the user contractually. Weaker security, zero UX cost.
2. **Live-mic verification lines** (ElevenLabs PVC pattern; the practical industry standard). User records a fixed script ("I, [name], confirm that this voice belongs to me…") **while logged in**, through the browser (getUserMedia). We compare the recording to the submitted sample.
3. **Automatic speaker-verification scoring** (what ElevenLabs does under the hood). Compare embeddings:
   - Open-source: **Resemblyzer** (speaker embeddings + cosine similarity), **SpeechBrain ECAPA-TDNN** (`speakerrecognition`), both usable via a small Python sidecar or ONNX in Node.
   - Scoring: enroll embedding from the 5–150 s sample → verify the live reading → similarity ≥ threshold (e.g., cosine ≥ 0.75 tuned on your own false-accept/reject curves).
   - Cloud STT route: transcribe the live reading and check **text match + voiceprint** via a voice-ID API if you add one later.
   - Cost: trivial (seconds of inference).
4. **Human review** for flagged cases (low similarity, or sample that sounds like a celebrity/known voice, or user reports): manual listen + policy decision.
5. **KYC-lite** (only for "pro" clones, if ever): government ID upload + selfie video reading lines — overkill for instant clones, reserved for high-risk tiers.

**Recommended LugunaVoice flow (V1):** consent checkbox (mandatory, gates the Clone button) **+** live verification lines with automatic ECAPA cosine scoring; sample rejected if score < threshold; flag for human review between 0.5–threshold; hard reject below 0.4. This is cheap to build and strictly better than any of our three providers' requirements.

## B.4 Abuse prevention for cloning

What platforms actually do (ElevenLabs documented; others inferred from policies):

1. **Consent + verification gate** (see B.3) — raises cost of abuse.
2. **Prohibited-use & impersonation policy** in ToS, with **traceable outputs** — ElevenLabs: "All audio generated by our models can be instantly traced back to the user responsible for the generation." → our job table already logs user, job, chunks, audio hashes — keep an **output watermark** (inaudible) or at minimum full audit trail + takedown capability.
3. **Sample moderation:** no automated celebrity detection is public (researchers keep trying; accuracy is poor), so platforms rely on **reported abuse + name/voice flags + manual review queues**.
4. **Rate limits & slots:** cloning caps per account/day (we inherit Typecast's 50-slot Lite ceiling anyway); e.g., max 3 clones/day per user, verification required after 2.
5. **Known-voice screening (optional):** string blacklist on voice names + celebrity-name detection in the transcript/sample metadata (cheap, blocks the obvious cases, mainly cosmetic).
6. **Takedown & suspension:** documented reporting flow ("This voice is mine/celebrity X") → suspend voice, delete outputs if policy violated, cooperate with rightsholders (ElevenLabs explicitly reviews "all known infringements").
7. **Sharing model:** cloned voices are private-by-default, user-scoped; never in a public voice library unless the owner opts in with consent (Typecast clones are owner-only already — good).

## B.5 The Typecast ownership pitfall (design-critical)

Typecast docs: cloned voices (`uc_`) **can only be used by the owner** — i.e., the API account/key that created them. Consequences for a SaaS:

- If all customer clones are created under **one LugunaVoice master key**, they're all usable — but then *we* hold them all and the "owner" is us (works, but we bear full liability + slot math is shared across all customers).
- If we create **per-customer API keys** (Typecast supports accounts; enterprise can provision), each customer's clones are isolated and usable only by them — better security, but you can't mix one clone across multiple customer keys, and you must manage per-customer subscriptions.
- **Decision needed at architecture time:** master-key model with our own permission layer (recommended for V1: simpler, slots pooled, we can enforce our own consent/verification rules in the same system) vs per-customer keys (V2 for enterprise).

---

# PART C — STREAMING TTS

## C.1 Per-provider streaming capabilities (verified)

| Capability | **Deepgram** ⭐ | **Typecast** | **edge-tts** | ElevenLabs (benchmark) |
|---|---|---|---|---|
| Transport | WebSocket `wss://api.deepgram.com/v1/speak?model=…` (+ new Flux `/v2/speak`) | `POST /v1/text-to-speech/stream` (streaming endpoint) | WebSocket to Microsoft (the library's only transport) | WS `wss://api.elevenlabs.io/v1/text-to-speech/{voice}/stream-input` |
| Message model | send `{"type":"Text","text":…}` + **`Flush`** + **`Clear`** + **`Close`** | — | sends full SSML per turn | `text` messages; `flush:true`; `chunk_length_schedule` [120,160,250,290] |
| Audio formats (streaming) | **linear16** (8k/16k/24k/32k/48k), **mulaw** (8k/16k), **alaw** (8k/16k) — **no MP3/Opus on WS** (REST adds mp3/opus/flac/aac) | WAV/MP3 | MP3 `audio-24khz-48kbitrate-mono-mp3` (fixed CBR) | mp3_44100_128 default, opus, pcm, ulaw, alaw (per output_format) |
| Latency | **<300 ms TTFB** (claimed); chunk-level playout | low-latency claims for v21; v30 trades speed for quality | fast TTFB, but per-4KB-turn overhead | flash models ~75 ms; WS has internal buffering (≥120 chars first chunk) |
| Concurrency (streaming) | **45** concurrent (PAYG), 60 Growth | plan-based (5 Lite / 15 Plus) | throttled (1–2) | plan-based |
| Word timestamps while streaming | ❌ (TTS side) | ✅ timestamps endpoint (separate call) | ✅ WordBoundary events | ✅ alignment in WS messages |
| Interruptibility | ✅ new text replaces buffer (`Clear`/new Text) — **barge-in ready** | — | — | ✅ regenerate-on-append |
| Cross-turn consistency | ⭐ **Flux TTS `/v2/speak` persists prosody state across turns** | via `previous_text`/`next_text` | per-turn only | ✅ same WS session keeps context |

**Deepgram WS flow (from docs):** connect → `on open` send `{"type":"Text","text":"…"}` → server streams binary chunks as they're ready → `Flush` forces the tail → `Close`. Audio arrives as raw PCM bytes (base64 strings in JSON in the JS SDK example, binary in Python SDK — check SDK version). Send `container=none` on REST to avoid WAV-header clicks in telephony.

**Use case for LugunaVoice:** "**realtime preview**" — user types/pastes in the editor and hears the first sentence while the rest renders; perfect for Deepgram WS (interruptible: as the user edits, send new text, clear buffer). For Typecast primary engine, use its streaming endpoint for preview too; fall back to REST chunk streaming (play chunks as they complete) — this is the "chunked REST + sequential playback" pattern Deepgram documents.

## C.2 When streaming vs async (decision rule)

| Situation | Use | Why |
|---|---|---|
| Live editing / typing preview / voice agent | **Streaming WS** | sub-second TTFB, interruptibility (barge-in), no file juggling |
| Whole text known up front (article, chapter, book) | **Async REST + chunk workers** | parallel concurrency (15× REST vs 1 WS connection per job), better quality per chunk, seed reproducibility, deterministic cost/SRT |
| Long text, want "first audio fast" | **Hybrid:** chunked REST, play chunks sequentially as they land | gets TTFB of ~1 chunk without WS complexity |
| Voice agent / conversational | Deepgram WS or Flux `/v2/speak` | built for turns; Flux even keeps prosody consistent across turns |
| edge-tts free tier | Async only (its WS is the only transport but you can't interrupt cleanly) | reliability |

Latency reality check: streaming wins on **TTFB** (ms–hundreds of ms), async wins on **total throughput** (15 concurrent REST calls render a chapter in ~1 min vs ~20+ min of a single audio stream, which is also capped by realtime-ish generation anyway).

## C.3 Node.js patterns: WebSocket audio → browser

### C.3.1 Server relay (Node, `ws`)

```
Browser ◄─(WSS/SSE)─ server ←(WS binary)─ Deepgram /v1/speak
```

- Backend opens Deepgram WS (`@deepgram/sdk` → `deepgram.speak.v1.connect({model, encoding:'linear16', sample_rate:24000})`).
- On `message` → forward raw bytes to the browser over your own WebSocket (or chunked SSE with base64). Never expose the Deepgram key to the client; relay server-side (also lets you cache + record for later stitching).
- Control channel: client sends `text` → server sends `{type:"Text"}` to Deepgram; on client "stop typing" → `Flush`.
- Reconnect logic: Deepgram docs recommend handling NET/DATA errors with backoff (`tts-troubleshooting-websocket-net-and-data-errors`).

### C.3.2 Browser playback (three options)

1. **Web Audio API (best for raw PCM — Deepgram streaming format):**
   - Receive Int16 chunks → `AudioContext.decodeAudioData` per chunk is wasteful; instead decode once (PCM16 → Float32) into `AudioBuffer` and queue via `AudioBufferSourceNode` + `start(offset)` with scheduling, or use `AudioWorklet` for true gapless. Simpler: keep an `AudioBufferSourceNode` chain where each node starts at `context.currentTime` of the previous end.
   - Handles linear16 24k/48k, mulaw needs mu-law→PCM expansion (small `table` decode, ~20 lines).
2. **MediaSource Extensions (best for MP3/Opus — Typecast/edge-tts):**
   - Server converts (or provider streams MP3) → `MediaSource` with `audio/mpeg` (Chrome/Safari support MP3 in MSE; Opus needs `audio/ogg; codecs=opus` for ogg containers).
   - `sourceBuffer.appendBuffer(chunk)` as chunks arrive; `endOfStream()` at end. Buffer pressure: `updateend` events + `remove()` of consumed ranges.
3. **Streaming `<audio>` with `fetch` + `ReadableStream` → `createObjectURL(stream)`**: simplest for MP3 relays (Chrome supports MP3 streaming via MSE-backed `<audio>`; Safari behavior varies). Use option 1 or 2 for control.

### C.3.3 Recording while streaming

Pipe the same relayed bytes to a `WritableStream` → on finish, concatenate (A.4) → this doubles as the "preview that became the final file" path. SRT from preview is optional (Typecast timestamps endpoint requires the full text).

---

# IMPLEMENTATION BLUEPRINT

## F.1 Architecture overview

```
┌─ UI (editor + progress table + clone wizard + player) ───────────────┐
│   ▲ job events (WSS/SSE)          ▲ preview audio (WS relay)          │
├───────────────────────────────────────────────────────────────────────┤
│  API layer: POST /jobs, POST /voices/clone, POST /preview/stream      │
├───────────────────────────────────────────────────────────────────────┤
│  Orchestrator (Node/TS)                                               │
│   ├─ Chunker (paragraph→sentence→clause greedy pack ≤1900 chars)      │
│   ├─ Context provider (previous_text/next_text per chunk)             │
│   ├─ Worker pools (semaphore per provider: TC=4, DG=12, ET=1)         │
│   │    └─ provider adapters (typecast.ts / deepgram.ts / edge.ts)     │
│   ├─ Stitcher (ffmpeg-static: concat demuxer → loudnorm → apad)       │
│   ├─ SRT builder (per-provider timestamps → offset → SRT)             │
│   └─ Job store (Postgres: jobs + chunks, resume on crash)             │
├───────────────────────────────────────────────────────────────────────┤
│  Providers: Typecast API · Deepgram REST/WS · edge-tts (flagged)      │
│  Storage: S3/本地 (chunk mp3, final mp3, srt)                          │
└───────────────────────────────────────────────────────────────────────┘
```

## F.2 Chunk worker (pseudo-code)

```ts
// pool.ts — bounded concurrency per provider
async function runPool<T>(items: T[], concurrency: number,
                          task: (item: T, i: number) => Promise<void>) {
  const queue = [...items.entries()];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const [i, item] = queue.shift()!;
      await task(item, i);
    }
  });
  await Promise.all(workers);
}

// job.ts — orchestrator
async function synthesizeLongForm(job: Job, text: string) {
  const chunks = chunkBySentences(text, 1900);          // A.2.1
  await db.saveChunks(job, chunks);
  const seed = hashJob(job.id) % 2 ** 32;               // A.3.2

  await runPool(chunks, CONCURRENCY[job.provider], async (chunk, i) => {
    await db.update(chunk.id, { status: "generating" });  // → UI event
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const audio = await providers[job.provider].synth({
          text: chunk.text,
          voice: job.voice_id, model: job.model,
          seed,                                        // Typecast: deterministic retries
          previous_text: chunks[i-1]?.tail(2000) ?? "",
          next_text: chunks[i+1]?.head(2000) ?? "",
          target_lufs: -16,                            // A.4.3
          emotion: job.emotion_preset, intensity: job.emotion_intensity,
          format: "mp3",
        });
        await db.update(chunk.id, { status: "done",
          audio_url: await s3.put(audio), ... });        // → UI event
        return;
      } catch (e) {
        if (attempt === 3) { await db.update(chunk.id, { status: "failed", reason: e }); }
        else await sleep(2 ** attempt * 1000);            // backoff
      }
    }
  });

  const final = await stitchWithFfmpeg(chunkFiles(job));  // F.3
  const srt   = await buildSrt(job);                      // A.7
  await db.update(job, { status: "done", final_url, srt_url });
}
```

## F.3 Stitcher (pseudo-code — no fluent-ffmpeg)

```ts
import { ffmpeg, ffprobe } from "ffmpeg-static";  // binary path

async function stitchWithFfmpeg(chunks: string[]): Promise<string> {
  // validate all chunks share format/duration>0 (ffprobe)
  const list = chunks.map((c, i) => `file '${esc(c)}'`).join("\n");
  await writeFile("/tmp/list.txt", list);

  await execFile(ffmpeg, [
    "-y", "-f", "concat", "-safe", "0", "-i", "/tmp/list.txt",
    "-af", "apad=pad_dur=0.25, loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a", "libmp3lame", "-b:a", "320k", "/tmp/final.mp3",
  ]);  // Option 2 (safe). Option 1: "-c copy" + final loudnorm pass if same format
  return "/tmp/final.mp3";
}
```

## F.4 Cloning flow (UX we should build — Typecast first)

```
1. Upload sample (validate: WAV/MP3, ≤25MB, 5–150s, single speaker,
   decent SNR — check with ffprobe + simple RMS gate)
2. Consent attestation (mandatory, logged):
   "I confirm I am the speaker or have written permission; I understand
    this creates an AI voice that can be traced to my account."
3. [Recommended V1.1] Live verification: getUserMedia → read 3 fixed lines →
   ECAPA-TDNN embeddings (sample vs live) → cosine score:
     ≥0.75 accept | 0.40–0.75 manual review | <0.40 reject
4. POST /v1/voices/clone {model: job.model} → uc_… id
5. Store mapping user↔uc_ voice in OUR DB (Typecast "owner" = our master key,
   or per-customer key — see B.5). Enforce our own 50-slot accounting on top.
6. Clone appears in "My Voices"; usable in TTS + timestamps + streaming
   (emotion presets work: same model controls).
7. DELETE /v1/voices/{id} on user delete / slot pressure.
```

## F.5 Streaming preview (pseudo-code)

```ts
// server: deepgram-relay.ts
const dg = await deepgram.speak.v1.connect({ model, encoding: "linear16",
  sample_rate: 24000 });
dg.on("message", (msg) => wsToBrowser.send(msg));   // relay bytes → client
wsFromBrowser.on("message", (m) => {                // client sends text edits
  dg.sendText({ type: "Text", text: m.text });
  dg.sendFlush();                                   // after pause in typing
});
// client: WebAudio playback of linear16
let t = audioCtx.currentTime;
onAudioBytes(buf) {
  const ab = audioCtx.createBuffer(1, buf.length/2, 24000);
  ab.getChannelData(0).set(new Int16Array(buf).map(v => v/32768));
  const src = audioCtx.createBufferSource();
  src.buffer = ab; src.connect(audioCtx.destination);
  src.start(t); t += ab.duration;                    // gapless queue
}
```

## F.6 Rollout order

1. **V1:** Typecast long-form (chunker → 4 workers → seed + context + `target_lufs` → ffmpeg stitch → word-level SRT via `/with-timestamps`) + Typecast instant cloning with consent checkbox (+ slots UI). This covers the flagship features on the proven wholesale engine.
2. **V1.1:** live-mic verification (ECAPA cosine); Deepgram Aura-2 as the *cheap fast* long-form provider + Deepgram WS preview; edge-tts behind the free-tier feature flag.
3. **V2:** per-customer Typecast keys (clone ownership isolation), Flux TTS evaluation for cross-turn consistency, watermarking/labels, celebrity-name screening + manual review queue.

---

## Sources (URL index)

- Typecast TTS: https://typecast.ai/docs/api-reference/text-to-speech/text-to-speech · Timestamps: https://typecast.ai/docs/api-reference/text-to-speech/text-to-speech-with-timestamps · Cloning: https://typecast.ai/docs/api-reference/voices/instant-cloning · Overview: https://typecast.ai/docs/overview
- Deepgram TTS REST: https://developers.deepgram.com/docs/tts-rest.md · Media formats: https://developers.deepgram.com/docs/tts-media-output-settings.md · Chunking: https://developers.deepgram.com/docs/tts-text-chunking.md + https://developers.deepgram.com/docs/text-chunking-for-tts-optimization.md · WS streaming: https://developers.deepgram.com/docs/tts-websocket-streaming.md · Rate limits: https://developers.deepgram.com/reference/api-rate-limits.md · Voices/languages: https://developers.deepgram.com/docs/tts-models.md · Docs index (no custom-voice page): https://developers.deepgram.com/llms.txt
- edge-tts source (4096-byte chunking, boundary events, offset compensation, DRM retry): https://github.com/rany2/edge-tts/blob/master/src/edge_tts/communicate.py · README: https://github.com/rany2/edge-tts
- ElevenLabs TTS (seed, request stitching): https://elevenlabs.io/docs/api-reference/text-to-speech/convert.md · WS stream-input: https://elevenlabs.io/docs/api-reference/text-to-speech/v-1-text-to-speech-voice-id-stream-input · IVC: https://elevenlabs.io/docs/api-reference/voices/ivc/create.md · Cloning guide (PVC verification, samples, slots, languages, traceability): https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning.md
- Play.ht docs index (Batch TTS, streaming): https://docs.play.ht/llms.txt
- fluent-ffmpeg deprecated: https://www.npmjs.com/package/fluent-ffmpeg ("Package no longer supported"; maintainers wanted on GitHub)
- Pricing/plans master table (Typecast Lite/Plus concurrency & clone slots, Deepgram rates, edge-tts risk analysis): `docs/research/01-tts-api-providers.md`
