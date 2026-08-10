# LugunaVoice — Tech Stack Decision Record (v2)

> Updated for 3-provider architecture (Edge TTS + Typecast + Deepgram), full feature scope, streaming, long-form, cloning, and security. Grounded in `docs/research/03, 05, 07, 08`.

---

## 1. Frontend & Framework

| Layer | Chosen | Alternatives | Rationale |
|---|---|---|---|
| Framework | **Next.js 16 (App Router, TS)** | Remix, Astro | SEO landing + API + server actions + WS upgrade on one platform |
| UI | **Tailwind v4 + shadcn/ui** | MUI, Mantine | no lock-in, professional look |
| Editor/waveform | **wavesurfer.js** (MIT) | waveform-playlist | sentence-level regenerate UI + preview waveforms |
| Animation | motion | GSAP | lightweight |
| Audio playback | Web Audio API queue (streaming) | `<audio>` | needed for WS chunk streaming |
| Icons | lucide-react | — | shadcn standard |

## 2. Data & Auth

| Layer | Chosen | Alternatives | Rationale |
|---|---|---|---|
| Database | **Supabase Postgres** | Neon, RDS | $0 start, integrated auth/storage/RLS |
| ORM | **Drizzle** | Prisma | SQL-first, light, typesafe; raw SQL escapes for ledger transactions |
| Auth | **Supabase Auth** (email + Google) | Clerk, Better-Auth | $0, RLS-native; Turnstile added on top |
| Storage | **Supabase Storage** (private + presigned) → **Cloudflare R2** in v2 | S3 | RLS + zero config now; R2 0-egress later |
| Queue (M0→v1.5) | **Supabase Queues (pgmq)** | Inngest, Trigger.dev, BullMQ | $0, transactional; chunk workers poll when needed |

## 3. The Three TTS Engines

| Tier | Chosen | Package | Key params | Cost |
|---|---|---|---|---|
| Free | **Microsoft Edge TTS** | `msedge-tts@^2` (npm, server-only) | voices from `listVoices()`; rate/pitch/volume prosody; MP3 24kHz | $0 (unofficial; best-effort tier) |
| Premium | **Typecast** | plain `fetch` → `api.typecast.ai` (no official JS SDK) | `model=ssfm-v30`; emotions+intensity; `target_lufs:-16`; clone `POST /v1/voices/clone` | Lite $15/mo, $0.08/1K wholesale |
| Flagship | **Deepgram** | `@deepgram/sdk` (npm v5.x, MIT) + **`@deepgram/captions`** (SRT/WebVTT for STT timestamps) | REST `model=aura-2-<name>-en` (or `aura-1`), `encoding/container`, inline IPA `\{"word":..,"pronounce":..}`; WS `encoding=linear16`; **STT `nova-3` for SRT round-trip ($0.0043/min)**; `tag=` params + `billing/breakdown` API for COGS | $200 trial credit; Aura-2 $0.030/1K, Aura-1 $0.015/1K, STT Nova-3 $0.0043/min |

**Decision notes (from research/05 + 07 + 09):**
- Deepgram has **no cloning, no SSML, no native TTS timestamps** → cloning = Typecast, "SSML-lite" = Typecast emotions + Edge styles, **SRT for flagship = STT round-trip** via `@deepgram/captions` (free timestamps, ~$0.0043/min).
- **Full Deepgram platform integration** (research/09): STT transcription tool (v2), Voice Agent API resell (phase 2), Text Intelligence `/v1/read` (v2), usage tags + billing/breakdown for per-user COGS (launch), async `callback` in job pipeline (launch).
- **Translation: not a Deepgram API** — dubbing (v2) = STT → external MT → Aura TTS cascade.
- Don't use Deepgram's Early-Access **Flux TTS** for production yet (EA, `/v2/speak`); watch it for cross-turn prosody consistency + future agents.
- `mip_opt_out=true` has a pricing impact — decide globally before launch (research/05 §1.1).

## 4. Payments (India)

| Phase | Chosen | Alternative | Rationale |
|---|---|---|---|
| Pre-launch | WhatsApp/UPI manual + admin confirm | — | instant, $0 |
| Launch | **Razorpay** (Payment Links + webhooks, UPI + intl. cards, 3DS on) | Stripe (needs foreign entity) | Indian entity path; risk engine + webhook HMAC |
| v2 | Paddle / Lemon Squeezy (MoR) | — | VAT/tax handling if international friction grows |

## 5. Security & Abuse Stack (new)

| Need | Chosen | Alternative | Rationale |
|---|---|---|---|
| CAPTCHA | **Cloudflare Turnstile** (free, managed) | hCaptcha, reCAPTCHA | free + CF-native |
| Moderation | **OpenAI Moderation API** (free) | Perspective API, blocklist | free; 3-strikes ban |
| Device fingerprint | **FingerprintJS open-source** (MVP) → Fingerprint Pro ($99/mo when abuse costs more) | custom | open-source covers multi-account detection at launch |
| Email abuse | **disposable-email-domains** (github, CC0) + email verify | — | free blocklist |
| Edge protection | **Cloudflare** WAF managed rules, Bot Fight, rate limit rule | — | free tier |
| Webhook verify | Razorpay `verifyPaymentSignature` (HMAC-SHA256 raw body) + `x-razorpay-event-id` dedupe | — | required |
| Rate limits | custom Postgres token-bucket (M0) → **Upstash Redis** (v2) | — | $0 now, scale later |
| Errors | **Sentry** | — | free tier |
| Analytics | Cloudflare Web Analytics + own `app_events` | PostHog (v2) | privacy-light, $0 |

## 6. Media Processing

| Need | Chosen | Notes |
|---|---|---|
| Chunk concat + normalize | **ffmpeg-static** (shell out) | `fluent-ffmpeg` is **deprecated** — never use (research/07 pitfall #1) |
| Loudness lock | ffmpeg `loudnorm` + Typecast `target_lufs=-16` | kills boundary clicks; 250ms `apad` |
| Subtitle assembly | own TS from timestamps | per-provider timestamp mapping (07 §SRT) |
| Audio format conversion | Deepgram `container` params + ffmpeg | WAV/MP3/opus/flac |

## 7. SDKs & Dev Experience (v2 API)
| Deliverable | Tool |
|---|---|
| JS SDK | our own TS package wrapping REST + WS (`lugunavoice` npm, published at M8) |
| Python SDK | thin `httpx` client (PyPI) |
| API docs | OpenAPI spec (from zod schemas) → /developers page |
| Test suite | vitest + curl smoke tests; Playwright for Studio |

## 8. Full Dependency List (M0 scaffold)

```txt
# core
next@16 react@19 typescript tailwindcss@4 shadcn/ui lucide-react motion react-hot-toast

# data
@supabase/supabase-js @supabase/ssr drizzle-orm drizzle-kit pg zod

# tts
msedge-tts@^2            # free tier (server-only)
@deepgram/sdk@^5         # flagship + streaming + STT round-trip (MIT)
@deepgram/captions       # official SRT/WebVTT converter (research/09)
# Typecast: plain fetch (no SDK needed)

# audio
ffmpeg-static            # chunk concat, loudnorm
wavesurfer.js            # editor waveform

# security
@cloudflare/turnstile   # server-side verify (fetch)
openai                   # moderation (free)
fingerprintjs            # open-source device fingerprint
disposable-email-domains # blocklist data

# payments
razorpay                 # Payment Link + webhook verify

# misc
nanoid uuid date-fns ws  # ws used by streaming relay + msedge-tts
```

## 9. Environments & Workflow
- pnpm, Node 22, Vercel CLI, Supabase CLI (`supabase start` local), `.env.example` (never commit `.env.local`)
- CI: GitHub Actions — `pnpm lint`, `tsc --noEmit`, `drizzle-kit generate` drift check, grep for leaked keys
- Staging: Vercel preview env + `staging` Supabase project with real provider keys (dev keys separate)
- Cost guards: hourly spend monitor job + admin kill-switch per provider
