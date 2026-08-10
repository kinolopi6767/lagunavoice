# LugunaVoice — GitHub Resources & Tools Research

**Stack target:** Next.js (App Router, TypeScript) + Supabase (Postgres/Auth/Storage) + job queue + Cloudflare (hosting/CDN) + TTS providers (edge-tts free tier, Typecast premium).
**Audience:** solo developer in India, budget-conscious.
**Research date:** Aug 2026 (star counts as of research time; verify before deciding).

---

## 1. Next.js SaaS starter templates & Auth

### Open-source templates (ranked by stars)

| Repo | Stars | Notes |
|---|---|---|
| [t3-oss/create-t3-app](https://github.com/t3-oss/create-t3-app) | 29.1k | CLI (`npm create t3-app@latest`), MIT. Not a full SaaS — gives typesafe Next.js + tRPC + Prisma/Drizzle + NextAuth options. Bring your own billing/queue/storage. |
| [wasp-lang/open-saas](https://github.com/wasp-lang/open-saas) | 15.2k | MIT, free. Full SaaS: auth (email/Google/GitHub/Slack/MS), Stripe **+ Polar.sh + Lemon Squeezy** payments, background jobs, email, Shadcn UI, S3 uploads, landing page. Caveat: locked to the Wasp framework (React/Node/Prisma) — not plain Next.js. |
| [vercel/next-forge](https://github.com/vercel/next-forge) | 7.6k | Production-grade Turborepo template (monorepo: web/apps/packages), Stripe + Sentry wired, works with Next.js + Postgres. |
| [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) | 7.3k | Next.js + Tailwind + Shadcn + TypeScript. Auth (NextAuth), multi-tenancy, blog. No billing built in. |
| [boxyhq/saas-starter-kit](https://github.com/boxyhq/saas-starter-kit) | 4.9k | Enterprise-style starter: auth (NextAuth), billing (Stripe), teams, audit logs, Tailwind/Shadcn. |
| [async-labs/saas](https://github.com/async-labs/saas) | 4.5k | Older (2019-era), React/Next/MobX/Express/Mongo. Skip. |
| [nextify-limited/saasfly](https://github.com/nextify-limited/saasfly) | 2.9k | `bun create saasfly`. Next.js + Stripe + Postgres + i18n. |
| [revokslab/ShipFree](https://github.com/revokslab/ShipFree) | 1.7k | Open-source clone of the paid ShipFast. Next.js + Stripe + Postgres. |
| [imbhargav5/nextbase-nextjs-supabase-starter](https://github.com/imbhargav5/nextbase-nextjs-supabase-starter) | 803 | Next.js 16 + Supabase + Tailwind 4 + TS. Auth + Stripe included. |
| [makerkit/nextjs-saas-starter-kit-lite](https://github.com/makerkit/nextjs-saas-starter-kit-lite) | 452 | Free "Lite" version of Makerkit (Supabase auth, same Turborepo architecture). Full version: $349 lifetime (Supabase stack) / $649 Teams (see makerkit.dev/pricing). Production-grade multi-tenancy + Stripe billing. |
| [antoineross/Hikari](https://github.com/antoineross/Hikari) | 390 | Next.js 14 App Router + Stripe + Supabase template. |
| [michaeltroya/supa-next-starter](https://github.com/michaeltroya/supa-next-starter) | 371 | Next.js + Supabase + Tailwind + shadcn. |
| [adrianhajdin/saas-template](https://github.com/adrianhajdin/saas-template) | 173 | Next.js + Supabase + Clerk + Stripe. |
| [jabirdev/nextjs-better-auth](https://github.com/jabirdev/nextjs-better-auth) | 109 | Next.js 16 + Better Auth + Drizzle + Supabase starter. |

**Note:** the official Supabase `apps/nextjs-template` inside supabase/supabase was removed from the monorepo (404). Current official reference examples live under [supabase/supabase/tree/master/examples](https://github.com/supabase/supabase/tree/master/examples) (user-management Next.js app). [supabase/supabase](https://github.com/supabase/supabase) itself: **108k stars**, Apache-2.0.

### Paid boilerplates (mention, don't rely on)
- **MakerKit** — [makerkit.dev](https://makerkit.dev) — $349 lifetime. Supabase/Drizzle/Prisma stacks, Stripe, multi-tenant, super admin, MCP server + AI-agent rules. Best-in-class paid option for Next.js+Supabase.
- **ShipFast** — [shipfa.st](https://shipfast.st) — ~$199 one-time, very popular but closed-source codebase delivered via zip/private repo.
- **Jumpstart** — [jumpstart.dev](https://www.jumpstart.dev) — $299, Next.js + Drizzle + tRPC + Better Auth.
- **Taxonomy** — [vercel/taxonomy](https://github.com/shadcn-ui/taxonomy) — archived/removed from vercel org; deprecated, skip.

### Auth: which one for a solo dev on a budget?

| Option | Cost | Verdict |
|---|---|---|
| **Supabase Auth** | Free (50k MAU free; $0.00325/MAU beyond on Pro $25/mo) | Built into the stack, zero extra moving parts, RLS integrates with storage. **Best default.** |
| [better-auth](https://github.com/better-auth/better-auth) (29.5k stars, MIT) | Free, self-hosted | Very popular, comprehensive (2FA, plugins, Stripe plugin). Runs on Supabase Postgres fine. Good if you want auth decoupled from Supabase (e.g., for a future DB migration) — pairs with Drizzle/Prisma. |
| NextAuth/Auth.js | Free | Mature but the v5 rewrite churned; fine but less integrated with Supabase. |
| Clerk | Free tier then usage-based (quickly $20+/mo at scale) | Easiest DX, but adds a vendor + cost and moves user data off Supabase. |
| Kinde | Free tier (7.5k MAU) then ~$25+/mo | Good, but same vendor-lock tradeoff. |

**Recommendation:** Supabase Auth (or Better Auth) — both free for a solo dev; avoid Clerk/Kinde to keep $0 infra and data in one place. If the starter kit you choose ships NextAuth, swapping to Supabase Auth is straightforward.

---

## 2. edge-tts (Microsoft Edge online TTS, free)

### The Python original
- **Repo:** [rany2/edge-tts](https://github.com/rany2/edge-tts) — **11.7k stars**, GPL-3.0, ~1.1k forks. PyPI: `pip install edge-tts`. Active (last release 2026).
- **What it does:** speaks via Microsoft Edge's online "Read Aloud" service. No Edge, no Windows, **no API key**.
- **Endpoint (from source `src/edge_tts/constants.py`):**
  - `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`
  - Voice list: `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=...`
  - Default voice: `en-US-EmmaMultilingualNeural`. Requires a Chrome/Edge user-agent; sends `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold` on the WS handshake.
- **Output:** MP3 at 48 kbps, 24 kHz mono (`audio-24khz-48kbitrate-mono-mp3`). Word/sentence boundary metadata (SRT subtitles) supported.
- **Features:** rate/volume/pitch via `<prosody>`; ~400 voices across ~40 languages; **custom SSML blocked** (Microsoft only allows Edge-generated SSML).
- **Limits (undocumented, empirical):** per-request text cap ~10,000 chars (chunk long scripts); unofficial rate limits — Microsoft throttles aggressive/parallel requests (HTTP 403/WebSocket close). No SLA; endpoint can change at any time.
- **CPU/GPU:** none — pure HTTPS/WebSocket call, runs on any serverless runtime.
- **Licensing risk (IMPORTANT):** Using it in a commercial SaaS is **against Microsoft's terms** — the endpoint is meant for Edge's Read Aloud feature. rany2 ships it GPL-3.0 for personal/educational use. Treat as **"free tier with breakage risk"**: never make it the sole revenue-critical path; wrap it behind your own API so you can swap providers.

### JS/TS ports (the key question)
| Package | Notes |
|---|---|
| [msedge-tts](https://www.npmjs.com/package/msedge-tts) (repo [Migushthe2nd/MsEdgeTTS](https://github.com/Migushthe2nd/MsEdgeTTS)) — **335 stars**, latest **2.0.7** | Pure TypeScript, works server-side in Node/Bun/Deno. `toStream()`/`toFile()` with output formats, rate/pitch/volume, word+ sentence boundary metadata. **Dec 2025 update:** the Read Aloud API now requires an Edge/Chromium user-agent → **no longer works in browsers, still fine server-side.** License: MIT on GitHub; npm registry lists GPLv3 for 1.1.0+ (verify before commercial use). |
| [edge-tts (npm)](https://www.npmjs.com/package/edge-tts) (author f53), v1.0.1 | Direct JS port of rany2's lib, `tts()`/`ttsSave()`/`getVoices()`, Bun-based, deps: `ws`. **License CC BY-NC-SA 4.0 → non-commercial, avoid.** Last publish 2024 (stale). |

### How to proxy it from a Node/Next.js backend
- Never call the Bing endpoint from the browser (CORS + UA check will fail + you'd leak the pattern).
- Recommended pattern (proven by [travisvn/openai-edge-tts](https://github.com/travisvn/openai-edge-tts) — **2k stars**, Python/FastAPI): expose a thin `/v1/tts` route on your backend that:
  1. validates auth/usage/quota,
  2. calls `msedge-tts` (or edge-tts CLI),
  3. uploads the MP3 to R2/Supabase Storage,
  4. returns the URL + duration + subtitles.
- Because the WS handshake needs a browser-like Origin, run it on a Node runtime (not pure edge functions with WS restrictions — Cloudflare Workers' native WS works, but keep it simple on Node).
- Other references that use edge-tts in production-ish apps: [hass-edge-tts](https://github.com/hasscc/hass-edge-tts), [Podcastfy](https://github.com/souzatharsis/podcastfy) (tts/providers/edge.py), [tts-samples](https://github.com/yaph/tts-samples).

---

## 3. Typecast (premium provider)

- **Docs:** [typecast.ai/docs](https://typecast.ai/docs) (overview, quickstart, models, API reference, CLI). Company: Neosapience (Korea), Typecast US Inc.
- **API key:** generated in the API Console at [studio.typecast.ai/developers/api](https://studio.typecast.ai/developers/api). Keys are per-account; no additional server-side SDK secrets beyond the key.
- **Models:** `ssfm-v30` (SSFM 3.0 — context-aware emotion, 37 languages, 500+ voices), `ssfm-v21` legacy. Features: full TTS (WAV/MP3), **streaming TTS** (chunked playback — good for voice agents), **timestamp TTS** (word/char-level alignment → subtitles), **instant cloning** (custom voice from a short sample).
- **Official SDKs:** [neosapience/typecast-sdk](https://github.com/neosapience/typecast-sdk) — single repo, 13 languages including **Python, JavaScript/TypeScript, C#/.NET, Go, Rust, Java, Kotlin, C/C++, Swift, PHP, Dart/Flutter, Ruby, Zig**. Also [n8n node](https://github.com/neosapience/n8n-nodes-typecast) and a [MCP server](https://typecast.ai/docs/integrations/mcp-server).
- **Pricing (api pricing page, Aug 2026):** Free $0/mo → 30k credits, concurrency 2. Lite **$15/mo** → 200k credits ($0.075/1k), concurrency 5, 50 instant-cloning slots, overage $0.09/1k. Plus **$280/mo** → 4M credits, concurrency 15, 800 cloning slots. **1 credit = 1 character.** Enterprise custom.
- **Webhooks:** no documented outgoing webhooks for job completion — TTS is synchronous (or streamed). Use your queue's polling/durable-step pattern to track completion.
- **Rate limits:** enforced via plan **concurrency limits** (2/5/15); no hard per-second ceiling documented — keep your queue concurrency ≤ plan limit.

---

## 4. Job queue / background processing for TTS generation

| Option | Star/status | Cost | Fit for Next.js + Supabase |
|---|---|---|---|
| **Supabase Queues** (pgmq) | GA since Dec 2024 — [blog](https://supabase.com/blog/supabase-queues), built on [tembo-io/pgmq](https://github.com/tembo-io/pgmq) | **$0 extra** (runs in your Postgres) | Durable, exactly-once, RLS-protected, dashboard monitoring, `send/read/pop` RPC from client libs. Zero new infra. Worker = your Next.js route handler or a cron-scheduled function. **Top pick for MVP.** |
| **BullMQ + Redis** | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) 9.3k stars, MIT | Redis cost (Upstash free tier, then ~$0.15/GB data + requests; or self-host) | Mature, retries/delays/parent-child, **now also supports Postgres as backend** (native adapters for Python/.NET/etc.). But: on Vercel serverless you must run a **separate always-on worker** (VPS/Railway/Fly) — more ops. |
| **Inngest** | [inngest.com](https://inngest.com/docs) | Generous free tier (50k steps/mo historically), paid after | Durable execution + steps, TS/Python/Go, deploys on Vercel/Cloudflare/Netlify, no separate queue infra, dashboard + observability built in. Great DX for "generate → save → notify" pipelines. |
| **Trigger.dev** | [trigger.dev](https://trigger.dev/docs/introduction) — open source | Free tier (25 tasks/mo → now wider free limits; cloud paid after, self-hostable) | Purpose-built for AI/long jobs: **ffmpeg and audioWaveform build extensions**, React hooks for realtime task status, Supabase guide. Excellent for TTS post-processing. |
| **QStash (Upstash)** | [upstash.com/docs/qstash](https://upstash.com/docs/qstash/overall/getstarted) | Free 100k requests/mo class | HTTP-based "middleman" queue: publish to your public endpoint; retries, delays, FIFO, DLQ, callbacks, flow control (per-endpoint concurrency/rate). Simplest possible serverless queue; pairs with Upstash Workflow SDK for durable steps. |
| **Cloudflare Queues** | [developers.cloudflare.com/queues](https://developers.cloudflare.com/queues/) | Free on Workers plans | Guaranteed delivery, batching/retry/DLQ, pull consumers. **But** requires a Cloudflare Worker as the consumer; TTS libs that need Node runtime are awkward. Good only if you're fully on Workers. |

**Verdict for this project:** start with **Supabase Queues** (zero cost, transactional with your DB) or **QStash** if you want fan-out/retries without a long-lived worker; move to **Trigger.dev** or **BullMQ-on-a-VPS** when you need multi-step pipelines (chunk → synthesize → ffmpeg concat → upload → notify) with real concurrency control. Avoid Cloudflare Queues unless you commit to Workers-only.

---

## 5. Payments — solo developer in India, selling internationally

| Option | Works for selling to international users from India? | Notes |
|---|---|---|
| **Razorpay** | **Yes** — [international payments docs](https://razorpay.com/docs/payments/international-payments/): 160+ foreign currencies, 3DS 2.0 for international cards, PayPal, SWIFT/local-currency bank transfer (MoneySaver Export Account), settles in INR. KYC: PAN + Aadhaar + video KYC; registered businesses need GSTIN/Udyam. | Best domestic+international combo from an Indian entity. Fees ~2% domestic cards / ~2-4% international (check current pricing). |
| **Cashfree** | Yes — international cards + INR settlement | Similar to Razorpay; slightly lower fees sometimes, weaker dev-ecosystem. |
| **Stripe India** | Partial — accepts **only INR** for Indian entities; since **May 2024 Stripe India new accounts are invite-only** (confirmed by Lemon Squeezy's supported-countries page). | Great DX but the hardest path for an Indian solo dev today. |
| **Paddle** (Merchant of Record) | **Yes** — [paddle.com](https://www.paddle.com/), MoR for 300+ markets: they handle global cards, Apple Pay, tax/VAT/GST, fraud. Standard fee 5% + $0.50. | Zero tax compliance work; invoice in USD/EUR; payouts to Indian bank. Best "set and forget" for global SaaS. |
| **Lemon Squeezy** (Merchant of Record) | **Yes** — [supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries) lists **India** for bank payouts (note: since May 2024 you may need **PayPal payouts** if your Stripe-backed bank payout isn't pre-approved). Fee 5% + $0.50. | Same MoR advantages as Paddle; smaller, indie-friendly. |
| **PhonePe Payment Gateway / UPI intents** | No (domestic UPI only) | Only relevant if you later sell to Indian customers; cheap (0-1% UPI). |
| **WhatsApp manual payments** | Yes — common bootstrapping move in India | Take UPI/GPay transfer to your number; after confirmation, manually activate the user's plan in Supabase. Zero fees, zero integration; not scalable, no receipts/tax handling. Works as an early, pre-launch revenue channel while you wire up Razorpay/Paddle. |

**Recommendation:** launch with **Razorpay** (Indian entity, international cards, UPI for domestic) OR go **Paddle/Lemon Squeezy as MoR** to sell globally with zero GST/VAT paperwork. Many solo Indian devs use **Paddle** for the global checkout + WhatsApp/UPI for Indian beta customers.

---

## 6. Storage for generated audio

| Option | Storage | Egress | Key detail |
|---|---|---|---|
| **Cloudflare R2** | **$0.015/GB-mo** (10 GB free) | **Free egress** | $4.50/M Class A (write) ops, $0.36/M Class B (read); 1M Class A + 10M Class B free/mo. S3-compatible API, presigned URLs (`r2.dev` dev domain), serves from Cloudflare's edge. **Cheapest option, zero egress risk.** |
| **Supabase Storage** | Free 1 GB; Pro $25/mo includes **100 GB** ($0.0213/GB after) | 5 GB free / 250 GB on Pro ($0.09/GB after) | Best DX with Supabase (RLS, presigned URLs via `createSignedUrl`, Smart CDN on Pro, 500 GB max upload). Egress metering is the cost risk for audio streaming. |
| **Vercel Blob** | $0.023/GB | ~$0.05-0.12/GB (regional) + Fast Origin on miss | Hobby free within tight limits; $5/M advanced ops; 512 MB cache max per blob (TTS files are small, fine). Fine if fully on Vercel. |
| **AWS S3** | $0.023/GB (standard) | $0.09/GB (first 10TB) | Industry default; more config, CloudFront needed for cheap CDN. |

**Recommendation:** **R2 for generated audio** (free egress + CDN caching via Cloudflare, presigned uploads/downloads) with **Supabase Storage for user uploads/voice samples** (voice cloning reference audio, avatars). Cache both behind Cloudflare CDN with long TTLs for generated (immutable) files.

---

## 7. Rate limiting + analytics

- **Rate limiting:** [Upstash Redis + @upstash/ratelimit](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — the standard for Next.js serverless (free tier ~100k commands/mo); sliding window/fixed window/token bucket, no cold starts. Alternatives: Vercel's own `@vercel/rate-limit` (in-memory, weaker), or Postgres-based limiting if you want zero new services.
- **Analytics:**
  - [Cloudflare Web Analytics](https://developers.cloudflare.com/analytics/web-analytics/) — **free**, privacy-first, no cookie banner needed, works via script tag or automatic (if proxied by CF). Enough for traffic counts.
  - **Vercel Analytics** — free on hobby, page-view/Web-Vitals only.
  - [PostHog](https://posthog.com/pricing) — **1M events/mo free**, product analytics + session replay + feature flags in one; open-source (MIT) core, self-hostable. Best when you need *product* analytics (who generates what, funnel to paid).
  - **Supabase event tables** — zero cost, full control (e.g., `audio_generations` rows already give you usage analytics). Use as the source of truth for billing/quotas; PostHog for behavioral analysis.

**Recommendation:** `@upstash/ratelimit` for TTS API endpoints + **Cloudflare Web Analytics** at launch; add PostHog (or Postgres-based event tracking) when you need funnels. Keep quota/usage in Supabase tables either way.

---

## 8. Audio processing

- **ffmpeg** — required binary for any concat/convert task. **fluent-ffmpeg is DEPRECATED/ARCHIVED** (May 2025, [node-fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), 8.2k stars, read-only, "no longer works properly with recent ffmpeg"). Use instead:
  - `ffmpeg-static` (bundles the binary) + `child_process`/`execa` directly, or
  - **ffmpeg.wasm** for client-side processing, or
  - if using Trigger.dev — use their **built-in ffmpeg build extension**.
- **Long scripts:** edge-tts chunks (~10k chars/request) → concat MP3s with ffmpeg concat demuxer (safe for identical codec/bitrate) — this is the standard "tts for long text" pattern (see [cosin2077/easyVoice](https://github.com/cosin2077/easyVoice), 2.3k stars, does exactly this in TS).
- **Waveforms:** [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) — **10.4k stars**, BSD-3, v7/v8, TS + plugins (Regions, Timeline, Spectrogram, Record). For long files, generate **pre-decoded peaks server-side** (audiowaveform, or ffmpeg → peaks JSON) to avoid browser decode memory issues.
- **Streaming audio:** HTML5 `<audio>` with a CDN URL is enough for generated files; for real-time streaming use Typecast's streaming endpoint + MediaSource, or server-sent chunks from your Node API.

---

## 9. AI-voice awesome lists

| List | Stars | Focus |
|---|---|---|
| [zzw922cn/awesome-speech-recognition-speech-synthesis-papers](https://github.com/zzw922cn/awesome-speech-recognition-speech-synthesis-papers) | 3.1k | Academic papers: ASR, TTS, voice conversion. |
| [libukai/Awesome-ChatTTS](https://github.com/libukai/Awesome-ChatTTS) | 1.9k | ChatTTS resources (official). |
| [guan-yuan/Awesome-Singing-Voice-Synthesis-and-Singing-Voice-Conversion](https://github.com/guan-yuan/Awesome-Singing-Voice-Synthesis-and-Singing-Voice-Conversion) | 488 | SVS + TTS + voice conversion projects. |
| [metame-ai/awesome-audio-plaza](https://github.com/metame-ai/awesome-audio-plaza) | 411 | Daily-tracked audio papers incl. zero-shot TTS. |
| [wildminder/awesome-ai-voice](https://github.com/wildminder/awesome-ai-voice) | 406 | Open-source TTS, voice cloning, music-gen models — most practical list. |
| [mahimairaja/voiceai](https://github.com/mahimairaja/voiceai) | 310 | Voice-AI agent stack (TTS/STT/WebRTC) links. |

(There is no single canonical "awesome-tts"; the lists above are the closest, plus [awesome-typecast](https://github.com/jaebong-human/awesome-typecast) for Typecast resources.)

---

## 10. Example open-source TTS SaaS implementations

| Repo | Stars | What it teaches |
|---|---|---|
| [abus-aikorea/voice-pro](https://github.com/abus-aikorea/voice-pro) | 12.2k | Gradio WebUI: Edge-TTS + Kokoro + zero-shot cloning (E2/F5-TTS, CosyVoice), audiobook/podcast workflows. |
| [rany2/edge-tts](https://github.com/rany2/edge-tts) | 11.7k | The canonical edge-tts implementation. |
| [cosin2077/easyVoice](https://github.com/cosin2077/easyVoice) | 2.3k | TypeScript long-text TTS with multi-role narration (edge-tts based) — good chunking/concat reference. |
| [travisvn/openai-edge-tts](https://github.com/travisvn/openai-edge-tts) | 2k | **Most relevant:** a free self-hosted API (OpenAI/Azure/ElevenLabs-compatible `/v1/audio/speech`) backed by edge-tts — the exact "proxy behind your backend" pattern. |
| [BernieTv/ElevenLabs-Clone](https://github.com/BernieTv/ElevenLabs-Clone) | 116 | Self-hosted ElevenLabs clone: Docker + FastAPI + Next.js, TTS + voice conversion + audio generation. |
| [bigsk1/voice-chat-ai](https://github.com/bigsk1/voice-chat-ai) | 454 | Voice-agent with pluggable TTS (SparkTTS/OpenAI/ElevenLabs/**Typecast**), WebRTC, self-hosted. |
| [Anil-matcha/AI-Voice-Agent](https://github.com/Anil-matcha/AI-Voice-Agent) | 35 | Next.js + Python self-hosted voice agent. |
| [SamurAIGPT/my-podcast](https://github.com/SamurAIGPT/my-podcast) | 7 | Production-style Next.js TTS SaaS (Stripe + voice controls) — small but recent and relevant. |
| [greeves89/hyperframes-saas](https://github.com/greeves89/hyperframes-saas) | 2 | Multi-user SaaS using edge-tts, Docker — tiny but demonstrates the exact free-voice-stack. |
| [neosapience/typecast-sdk](https://github.com/neosapience/typecast-sdk) | 6 | Official Typecast multi-language SDK. |

---

## Recommended stack (final)

1. **Boilerplate:** [vercel/next-forge](https://github.com/vercel/next-forge) (7.6k) or [makerkit/nextjs-saas-starter-kit-lite](https://github.com/makerkit/nextjs-saas-starter-kit-lite) if you want Supabase-native auth+storage scaffolding; upgrade to full Makerkit ($349) only if Stripe multi-tenancy is worth it. Don't pay for ShipFast/Jumpstart — ShipFree (1.7k) or ixartz (7.3k) give you the same for $0. **Auth:** Supabase Auth (free, integrated).
2. **Job queue:** **Supabase Queues (pgmq)** at launch ($0, transactional with your data) → **Trigger.dev** (ffmpeg + audioWaveform extensions, React status hooks) or **BullMQ** (9.3k, on a $5 VPS) when pipelines get complex. QStash is the no-brainer alternative if you want retries/DLQ without a worker.
3. **Payments (India):** **Razorpay international payments** as primary (160+ currencies, INR settlement, works from an Indian entity) — with **Paddle** as the MoR alternative for pure-global sales (no GST/VAT handling). Keep **WhatsApp/UPI manual payment** as the pre-launch channel.
4. **Edge-tts JS library:** **[msedge-tts](https://www.npmjs.com/package/msedge-tts) v2.x** (TypeScript, server-side only — required since Dec 2025 UA check). Avoid the CC BY-NC-SA `edge-tts` npm port. Wrap it behind your own API route (pattern from travisvn/openai-edge-tts) and treat it as a non-SLA free tier (Microsoft ToS risk).
5. **Typecast:** official **JS/TS SDK** from [neosapience/typecast-sdk](https://github.com/neosapience/typecast-sdk), **Lite $15/mo** plan (200k chars, 50 cloning slots), streamed or file-based TTS with timestamp support; keep queue concurrency ≤ 5.
6. **Storage:** **Cloudflare R2** for generated MP3s (free egress, $0.015/GB) + **Supabase Storage** for user uploads; presigned URLs; CDN-cache immutable audio with long TTLs.
7. **Rate limiting/analytics:** **@upstash/ratelimit** on TTS endpoints + **Cloudflare Web Analytics** (free) + usage rows in Supabase; PostHog (1M events free) when funnels matter.
8. **Audio:** `ffmpeg-static` + execa for concat/convert (fluent-ffmpeg is dead), **wavesurfer.js** for waveforms (pre-decoded peaks for long audio).
9. **Egress/CDN safety net:** all generated audio behind Cloudflare CDN so repeated plays never hit origin egress.

**Reference implementations to copy from:** travisvn/openai-edge-tts (proxy pattern), cosin2077/easyVoice (chunking/concat), BernieTv/ElevenLabs-Clone (full SaaS shape), vercel/next-forge (monorepo structure).
