# Poursona

AI beverage-recommendation platform for tasting rooms, bars, and bottle shops.
Guests scan a venue's QR code, chat briefly with an AI host, and get a
recommendation constrained to the venue's real in-stock catalog. Live at
[pour-sona.com](https://pour-sona.com).

## Stack

- **Next.js 14 (App Router)** on Vercel
- **Neon Postgres** via `pg` (see [AGENTS.md](AGENTS.md) — there is no live Supabase database)
- **Claude Haiku** (`@anthropic-ai/sdk`) for guest chat + recommendations
- **Clerk** auth (vendor admins + internal team), **Stripe** billing,
  **Resend** email, **Upstash Redis** rate limiting, **Sentry** monitoring

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest unit tests
npm run lint
npm run build      # production build (runs encoding check first)
```

Required env vars are inventoried in [docs/audit/env-matrix.md](docs/audit/env-matrix.md).
First-time, step-by-step setup lives in [SETUP.md](SETUP.md).

## Key surfaces

| Path | What it is |
|---|---|
| `/r/[slug]` | Guest chat experience (QR target) |
| `/admin` | Vendor (venue) dashboard — Clerk-gated |
| `/poursona-admin` | Internal team console — Clerk + `poursona_team` membership |
| `/api/chat` | Streaming recommendation endpoint (per-venue AI budget caps) |
| `/api/migrate` | Idempotent schema migration runner, gated by `MIGRATE_SECRET` |

## Conventions

- Schema changes go through `app/api/migrate/route.ts` (`FIX_SCHEMA`) — see
  [AGENTS.md](AGENTS.md) for the workflow. Never target the stale Supabase project.
- Every `/api/poursona-admin/*` handler must enforce auth itself via
  `requireTeamMember()` from `lib/auth.ts` — the middleware allowlist is not
  sufficient. `tests/internal-admin-auth.test.ts` enforces this statically.
- Guest-facing routes use `checkOrigin()` (CSRF) and per-IP rate limits;
  expensive AI routes fail closed when Redis is down.
