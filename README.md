# LugunaVoice

AI voice studio & developer platform (TTS SaaS). **Three engines:** Edge TTS (free) + Typecast (premium) + Deepgram (flagship).

> Full research & planning: [`docs/`](docs/README.md) (start with the glossary).

## Status: M0 — Foundation ✅

- Next.js 16 (App Router, TypeScript, Tailwind v4, shadcn/ui)
- Supabase clients (server / browser / admin) + session-refresh middleware
- Drizzle ORM schema v2 — 22 tables, 18 enums (migration generated)
- GitHub Actions CI (lint · typecheck · build · secret leak guard)
- Git repo initialized on `main`

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # fill in keys (see docs/planning/01-build-plan.md §10)
pnpm dev                     # http://localhost:3000
```

### Database

```bash
pnpm db:generate   # create migration from src/db/schema.ts
pnpm db:migrate    # apply migrations (requires DATABASE_URL)
pnpm db:studio     # Drizzle Studio (browser DB explorer)
```

Local dev against Supabase: `supabase start` (Supabase CLI), or point `DATABASE_URL` at your cloud project. M1 requirement: create the Supabase project, run migrations, regenerate types (`supabase gen types` → `src/types/supabase.ts`), enable Google OAuth.

## Checks

```bash
pnpm check         # lint + typecheck
pnpm build
```

## Project layout

```
src/
  app/          # routes (landing, /studio, /voice-library …)
  components/   # shadcn/ui components
  db/           # Drizzle schema + client
  lib/
    supabase/   # server.ts (session) · client.ts (browser) · admin.ts (service role) · middleware.ts
  middleware.ts # session refresh + route protection
  types/        # Supabase generated types (regenerate in M1)
docs/           # research (01–09) + planning (01–06)
```
