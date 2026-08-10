# LugunaVoice

AI voice studio & developer platform (TTS SaaS). **Three engines:** Edge TTS (free) + Typecast (premium) + Deepgram (flagship).

> Full research & planning: [`docs/`](docs/README.md) (start with the glossary).

## Status: M0–M8 — ALL MILESTONES BUILT ✅

| Milestone | Built |
|---|---|
| M0 Foundation (Next.js 16, Supabase clients, Drizzle schema, CI) | ✅ |
| M1 Auth + landing + no-signup demo (Edge TTS) | ✅ |
| M2 Voice library (322 free voices) + Studio | ✅ |
| M3 Typecast premium engine + atomic credit ledger | ✅ |
| M4 Deepgram flagship (Aura-2 catalog, streaming, tags) | ✅ |
| M5 Long-form (chunking, ffmpeg stitch, SRT on all engines) | ✅ |
| M6 Voice cloning (consent, owner-scoped, slots) | ✅ |
| M7 Payments (Razorpay + manual), abuse rules R1–R24, admin dashboard | ✅ |
| M8 Developer API (`/api/v1/*`), JS+Python SDKs, docs, referrals, OpenAPI | ✅ |

**Before launch** (needs your accounts): Supabase project (+ `pnpm db:migrate` + `supabase/setup.sql`), provider keys (`TYPECAST_API_KEY`, `DEEPGRAM_API_KEY`), Razorpay keys, Turnstile + OpenAI keys, then the launch checklist in `docs/planning/01-build-plan.md`.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in keys
pnpm dev                     # http://localhost:3000
```

### Developer API

```
POST /api/v1/tts/generations   # create (async) — Authorization: Bearer lug_... + Idempotency-Key
GET  /api/v1/generations/:id   # poll until completed (audioBase64)
GET  /api/v1/voices            # catalog (search/filter/paginate)
GET  /api/v1/me                # balance + keys
```
- SDKs: `sdk/js` (`@lugunavoice/sdk`) and `sdk/python` (`lugunavoice`)
- OpenAPI spec: `/openapi.json` · docs page: `/developers`

### Database

```bash
pnpm db:generate   # migration from src/db/schema.ts
pnpm db:migrate    # apply (requires DATABASE_URL)
pnpm db:studio
```

### Checks

```bash
pnpm check         # lint + typecheck
pnpm build
```

## Project layout

```
src/
  app/             # pages: / /voices /studio /voice-cloning /developers /api-keys /referrals /admin /login /signup
  app/api/         # landing demo · studio (generate/longform/stream) · voice-cloning
                   # payments (checkout/webhook/orders) · admin · keys · referrals
                   # v1 developer API (tts/generations · voices · me)
  components/      # shadcn/ui + feature components
  lib/
    tts/           # provider abstraction: edge · typecast · deepgram + catalog + longform + custom voices
    credits/       # ledger (Postgres + in-memory fallback)
    payments/      # razorpay + orders
    abuse/         # R1–R24 rules
    costs/         # COGS tracking
    keys/          # developer API keys
    ops/           # admin session + provider kill-switches
    security/      # turnstile + moderation
  db/              # Drizzle schema (22 tables) + client
sdk/               # js + python SDKs
docs/              # research (01–09) + planning (01–06)
```
