# LugunaVoice — Project Documentation

AI voice studio & developer platform (TTS SaaS). **Three engines:** Edge TTS (free) + Typecast (premium) + Deepgram (flagship). Next.js + Supabase + Vercel + Cloudflare + Razorpay.

> New to this? Start with [Planning → 06-glossary](planning/06-glossary.md) (plain-English terms), then the build plan.

## Research (`docs/research/`)
| File | Content |
|---|---|
| [01-tts-api-providers.md](research/01-tts-api-providers.md) | 20 TTS API providers: pricing, quality, cloning, licensing, reseller viability |
| [02-open-source-tts.md](research/02-open-source-tts.md) | Self-hostable engines + licenses (which are commercial-blocked) |
| [03-github-resources-and-tools.md](research/03-github-resources-and-tools.md) | Boilerplates, auth, queues, payments for India, storage, analytics |
| [04-competitor-analysis.md](research/04-competitor-analysis.md) | FameSpeak, ElevenLabs, Typecast, Voicemaker + differentiation gaps |
| [05-deepgram-deep-dive.md](research/05-deepgram-deep-dive.md) | **Deepgram TTS exhaustively**: Aura-1/2 pricing ($0.015/$0.030 per 1K), 91 voices/7 langs, streaming WS, IPA overrides, NO cloning/SSML, SDKs, reseller terms |
| [06-feature-parity-matrix.md](research/06-feature-parity-matrix.md) | Every feature of 13 top platforms + MUST-HAVE launch list (20) + what "custom agents" really means |
| [07-longform-cloning-streaming-technical.md](research/07-longform-cloning-streaming-technical.md) | Engineering blueprint: chunking (~1,900 chars), voice consistency, ffmpeg stitching, SRT per provider, cloning process + consent, Deepgram WS streaming |
| [08-security-and-abuse-detection.md](research/08-security-and-abuse-detection.md) | API security, payment fraud, content safety, cloning abuse, 24 abuse rules R1–R24, 40-item checklist |
| [09-deepgram-full-platform-api.md](research/09-deepgram-full-platform-api.md) | **Deepgram's complete platform beyond TTS**: STT Nova-3 (word timestamps → SRT round-trip, $0.0043/min, `@deepgram/captions`), Voice Agent API ($0.075/min), Text Intelligence `/v1/read`, usage tags + billing/breakdown API, async callbacks, translation = does NOT exist |

## Planning (`docs/planning/`)
| File | Content |
|---|---|
| [01-build-plan.md](planning/01-build-plan.md) | **Master plan v2**: 3-engine strategy, 20 launch features, plans & pricing with margins, M0–M8 roadmap (~14 wks), security workstream, metrics, risks, glossary pointer |
| [02-architecture.md](planning/02-architecture.md) | System diagram, provider abstraction, long-form pipeline, streaming relay, cloning pipeline, cross-cutting security layer |
| [03-tech-stack.md](planning/03-tech-stack.md) | Every tech choice + alternatives + why (incl. `@deepgram/sdk`, `msedge-tts`, ffmpeg-static, Turnstile, FingerprintJS) |
| [04-database-schema.md](planning/04-database-schema.md) | Postgres schema v2: ledger, generations+chunks, subscriptions, cloned voices + consent, transcriptions, abuse tables, RLS |
| [05-api-and-payments-design.md](planning/05-api-and-payments-design.md) | REST + streaming WS API, transcription endpoint, cloning endpoint, long-form jobs, Razorpay flow, security checklist |
| [06-glossary.md](planning/06-glossary.md) | Plain-English explanation of every technical term |

## Stack at a glance
Next.js 16 + Tailwind v4 + shadcn/ui · Supabase (Postgres/Auth/Storage + Drizzle) · `msedge-tts` + Typecast API + `@deepgram/sdk` + `@deepgram/captions` (STT SRT round-trip, tags/COGS, callbacks; Voice Agents phase 2) · Razorpay + WhatsApp manual · Vercel + Cloudflare (WAF/Turnstile) · ffmpeg-static · Sentry
