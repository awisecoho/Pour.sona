# Poursona — Architecture (Audit Reference)

_Last updated: 2026-05-20_

## Surfaces
| Surface | Path | Auth | Audience |
|---|---|---|---|
| Guest storefront | `/r/[slug]` | none (anonymous) | venue guests on mobile |
| Venue admin | `/admin/*` | Clerk | venue operators |
| Internal admin | `/poursona-admin/*` | Clerk + `poursona_team` membership | Poursona staff |
| Marketing | `/`, `/pricing`, `/privacy`, `/terms`, `/signup` | none | prospects |

## Core data flow
1. **Onboarding** — `POST /api/onboarding/url` validates the URL (SSRF guard), scrapes the
   site (`lib/onboarding.ts`), runs catalog extraction (Haiku) + the vendor-builder persona
   agent (Opus), and writes a `retailer_drafts` row. Sparse/failed scrapes alert the admin team.
2. **Publish** — `POST /api/onboarding/finalize` → `publishDraft()` creates the `retailers`
   row + `products`/`flights`, grants owner access, and (if sparse) emails the venue.
3. **Guest chat** — `POST /api/chat` streams Haiku. Guardrails: relevance-filtered catalog,
   trimmed history, turn cap, in-stock validation, per-venue monthly AI budget with a
   deterministic catalog fallback when over budget.
4. **Order** — `POST /api/order` writes an `orders` row (idempotent) and emails the venue.
5. **Analytics** — `GET /api/admin/dashboard` returns the scan→conversation→recommendation→order
   funnel + daily series + CSV, tenant-scoped.

## Data layer
- **Neon Postgres** via `pg` (`lib/db.ts`, connection from `POSTGRES_URL`/`DATABASE_URL`).
  The project migrated OFF Supabase; the Supabase MCP/project is stale and unused.
- Schema changes are applied to Neon via `POST /api/migrate` (idempotent `ALTER ... duplicate_column`
  pattern + `CREATE INDEX IF NOT EXISTS`). Do NOT use Supabase migrations for production.
- Key tables: `retailers`, `products`, `flights`, `retailer_drafts`, `sessions`, `orders`,
  `events`, `admin_users`, `poursona_team`, `billing_events`.

## External dependencies
| Dependency | Use | Failure mode |
|---|---|---|
| Anthropic | Haiku (guest chat), Opus (vendor-builder) | chat falls back to catalog rec over budget; builder has a static fallback |
| Stripe | subscription billing | checkout/portal/webhook routes |
| Clerk | admin auth | middleware redirects/401; 503 if unconfigured |
| Resend | transactional email | best-effort, logged to Sentry |
| Upstash Redis | rate limiting | optional — middleware uses in-memory fallback if absent |
| Sentry | error tracking | no-op if DSN absent |

## Request protection
- `checkOrigin` (same-origin) on guest POSTs; Clerk on admin routes; `verifyOnboardSecret`
  for server-to-server onboarding.
- Rate limiting in `middleware.ts` (Upstash) with in-memory fallback for `/api/chat`.
- SSRF guard `validateScrapeUrl` on outbound scraping.
- Order idempotency via `X-Idempotency-Key` + partial unique index.
