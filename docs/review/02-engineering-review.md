# Pour-Sona — Engineering Review

**Audience:** Software engineering review
**Goal:** Verify production architecture, code quality, security posture, and cost controls before broader rollout.

---

## 1. Tech stack

| Layer | Tool | Version |
|---|---|---|
| Runtime | Node.js | 18 (Vercel default) |
| Framework | Next.js | 14.2.5 (App Router) |
| Language | TypeScript | ^5 (strict mode on) |
| UI | React | 18 |
| Database | PostgreSQL on Neon | — |
| ORM / Query layer | `pg` (raw queries via parameterized SQL, helper at `lib/db.ts`) | ^8.20 |
| Auth | Clerk | `@clerk/nextjs` ^5.7.6 |
| AI | Anthropic SDK | `@anthropic-ai/sdk` ^0.24 — currently model `claude-haiku-4-5-20251001` |
| Payments | Stripe SDK | ^16.0 |
| Email | Resend | ^3.2 |
| Rate limiting | Upstash Ratelimit + Redis | ^2.0 / ^1.38 |
| Error tracking | Sentry | `@sentry/nextjs` ^10.53 |
| QR generation | `qrcode` + `sharp` | 1.5 / 0.34 |
| Test runner | Vitest | ^2.1 |

`package.json` is the single source of truth.

---

## 2. Repository layout

```
poursona/
├── app/                      Next.js App Router
│   ├── page.tsx              Marketing home (pour-sona.com)
│   ├── pricing/              Pricing page
│   ├── privacy/              Privacy policy (legal review)
│   ├── terms/                Terms of service (legal review)
│   ├── signup/page.tsx       Vendor signup (URL → scan → finalize)
│   ├── r/[slug]/page.tsx     **Guest-facing QR-landing page**
│   ├── admin/                Vendor admin (Clerk-gated)
│   │   ├── page.tsx          Dashboard
│   │   ├── catalog/          Catalog management
│   │   ├── flights/          Tasting flight management
│   │   ├── orders/           Order list
│   │   ├── billing/          Stripe portal handoff
│   │   ├── agent/            **Per-vendor Assistant Profile editor**
│   │   ├── qr/               QR code download
│   │   ├── settings/         Brand color / tagline / location
│   │   └── login/            Clerk SignIn
│   ├── poursona-admin/       **Internal team admin (team-member gated)**
│   │   ├── page.tsx          Tabbed command center (dashboard, vendors, pipeline, leads, social)
│   │   ├── onboard/          Manual onboarding tool
│   │   ├── team/             Internal team management (mobile-responsive)
│   │   ├── retailer/[id]/    Per-retailer admin
│   │   ├── _components/      ProspectPipeline, LeadsManager, SocialAccounts
│   │   └── login/            Clerk SignIn (internal portal)
│   └── api/                  Server routes (full list in §4)
├── lib/                      Pure / shared logic (preferred for testability)
│   ├── agent/                Assistant Profile system (Phase 1)
│   │   ├── categories.ts     Per-vertical templates (brewery/coffee/winery/distillery)
│   │   ├── profile.ts        Resolver + default derivation
│   │   └── build-prompt.ts   Composes the chat system prompt
│   ├── auth.ts               Clerk + DB identity resolution
│   ├── authz.ts              Role-based authorization (owner > manager > staff)
│   ├── billing.ts            planToMrr() + subStatusFromStripe()
│   ├── chat-guardrails.ts    Token / cost / budget enforcement
│   ├── contact-extract.ts    Public email scraper (signup + pipeline)
│   ├── db.ts                 Neon connection pool
│   ├── email.ts              Resend wrappers (trial expiring, AI cap, order receipt, etc.)
│   ├── leads-constants.ts    Lead lifecycle + activity type enums
│   ├── prompts.ts            Back-compat shim → lib/agent/build-prompt.ts
│   ├── recommendation-enrich.ts  Server-side join of catalog image_url onto AI rec
│   ├── security.ts           SSRF guard, prompt-injection sanitiser, Origin/CSRF
│   ├── slug.ts, urls.ts, types.ts, rate-limit.ts, etc.
├── tests/                    Vitest (80 tests, all green)
├── scripts/                  verify-*.sh helpers + check-encoding.js
├── docs/audit/               Pre-existing audit checklist
├── docs/review/              **This document set**
├── middleware.ts             Clerk + rate-limit + RBAC entry point
├── sentry.*.config.ts        Sentry initialization (client / server / edge)
└── package.json
```

---

## 3. Data model (Neon Postgres)

Schema lives in `app/api/migrate/route.ts` — `FIX_SCHEMA` is a single idempotent block of `ALTER TABLE ... ADD COLUMN ... EXCEPTION WHEN duplicate_column THEN NULL` statements. There is **no traditional migration framework**; schema evolves additively via that block and re-running the endpoint applies any new columns.

Tables (production, verified via migration probe 2026-05-26):

| Table | Purpose |
|---|---|
| `retailers` | Vendors. Includes brand, billing, AI-usage metering, and the per-vendor `assistant_profile` JSONB. |
| `products` | Per-vendor catalog. Includes `image_url` (Phase 3). |
| `flights` | Tasting flights. |
| `sessions` | Guest chat sessions. Stores conversation transcript + recommendation. |
| `orders` | Customer orders (placed through staff, not card-on-file). |
| `events` | Analytics funnel events (`chat_started`, `recommendation_shown`, etc.). |
| `admin_users` | Vendor team members (`role`: owner / manager / staff). FK to retailer. |
| `poursona_team` | Internal Pour-Sona employees. Gates `/poursona-admin/*` access. |
| `retailer_drafts` | Onboarding scrape outputs prior to finalize. |
| `stripe_webhook_events` | Replay-protection idempotency table for Stripe webhooks. |
| `social_accounts` / `social_posts` | Marketing-agent integration (FB/IG/X/LinkedIn). Tokens AES-256-GCM encrypted via `SOCIAL_TOKEN_KEY`. |
| `prospect_leads` / `prospect_activities` | CRM-lite. Saved leads from the pipeline + activity timeline. |
| `ingestion_jobs`, `vendor_events`, `vendor_intelligence` | Pre-existing onboarding-pipeline tables. |

**Tenant isolation:** every guest-touching table carries `retailer_id`. Server routes pin queries by the authenticated user's resolved retailer (`getRetailersForIdentity` in `lib/auth.ts`). `lib/authz.ts::authorizeRetailer` enforces cross-tenant denial — see `tests/authz.test.ts`.

**Indexes:** every multi-row query path has a supporting index, see lines in `FIX_SCHEMA`. Particularly: `idx_sessions_retailer_id_created_at`, `idx_orders_retailer_id_created_at`, `idx_admin_users_email`, `idx_retailers_slug`.

---

## 4. API surface

All routes live in `app/api/`. Grouped by audience:

### Guest-facing (no auth)
| Route | Purpose |
|---|---|
| `POST /api/chat` | **Hot path.** Streams the AI conversation via SSE. Rate-limited 20/hr per IP. |
| `POST /api/order` | Place an order. Rate-limited 30/hr per IP. |
| `GET  /api/retailer?slug=X` | Bootstraps the guest landing page. Returns a **column-whitelisted** retailer object (no `owner_email`, `stripe_customer_id`, `chat_system_prompt`, AI metering). |
| `POST /api/session` / `POST /api/session/email` | Anonymous session tracking. |

### Vendor admin (Clerk session + retailer scope)
| Route | Method | Role gate |
|---|---|---|
| `/api/admin/access` | GET | authenticated |
| `/api/admin/access-diagnostic` | GET | authenticated |
| `/api/admin/dashboard` | GET | staff |
| `/api/admin/agent-profile` | GET/PUT | staff/manager |
| `/api/admin/retailer` | GET/PUT | staff/manager |
| `/api/admin/flights` | GET/POST/PUT/DELETE | staff/manager |
| `/api/admin/orders` | GET | staff |
| `/api/catalog` | GET/POST/PUT/DELETE | staff/manager |
| `/api/menu-scan` | POST | manager |
| `/api/qr` | GET | retailer access verified |
| `/api/stripe/checkout` | POST | **owner** |
| `/api/stripe/portal` | POST | owner |
| `/api/stripe/status` | GET | owner |
| `/api/stripe/webhook` | POST | Stripe-signature verified (no Clerk) |
| `/api/stripe/trial-check` | POST | cron-style endpoint |

### Internal team (`/api/poursona-admin/*`)
Gated by `poursona_team` table membership via `getInternalMemberByEmail`. Routes include `/me`, `/retailers`, `/analytics`, `/accounting`, `/promos`, `/customers`, `/pipeline` (AI prospect search + screen), `/leads` (CRM), `/social/*` (FB/IG/X OAuth + post), `/team-{add,list,remove}`, `/extend-trial`, `/toggle`, `/invite`, `/rescan`, `/system-check`.

### Onboarding (mixed)
| Route | Auth |
|---|---|
| `/api/onboarding/url`, `/finalize` | `POURSONA_ONBOARD_SECRET` header for CLI calls; Clerk for UI calls |
| `/api/signup/url`, `/finalize` | Public (rate-limited) — vendor self-signup |

### Migration
| Route | Auth |
|---|---|
| `POST /api/migrate` | Shared secret `poursona-migrate-2026` |

Full handler files: `app/api/**/route.ts`. Total LoC in `app/api/migrate/route.ts` (schema source of truth): **246**.

---

## 5. Security posture

Reviewer should validate each item against the cited file.

| Concern | Mitigation | Where |
|---|---|---|
| **SSRF on URL scrape** | `validateScrapeUrl()` blocks loopback, RFC1918, 169.254 (cloud metadata), IPv6 private + link-local, `.local` / `.internal`, and embedded credentials. | `lib/security.ts`, used by `app/api/signup/url`, `app/api/onboarding/url` |
| **Prompt injection** | `sanitizePromptInput()` strips `===WORD===` sentinel patterns from vendor-supplied story/culture/tagline before they enter the system prompt. The chat output protocol uses the same sentinel pattern (`===REC===`, `===CHIPS===`), so unsanitised vendor text could otherwise inject fake recommendations. | `lib/security.ts`, applied throughout `lib/agent/build-prompt.ts` |
| **AI cost runaway** | Per-vendor monthly token meter (`ai_input_tokens_month`, `ai_output_tokens_month`); over-budget vendors get a catalog-fallback recommendation, never an LLM call. Hard turn cap per session enforced both client-side (UI nudge) and server-side. | `lib/chat-guardrails.ts`, `app/api/chat/route.ts` |
| **Hallucinated SKUs** | `validateRecAgainstCatalog()` drops any product the AI proposed that isn't in the live in-stock catalog. If nothing valid remains, the recommendation is discarded. | `lib/chat-guardrails.ts` |
| **CSRF** | `checkOrigin()` enforces same-origin; localhost allowed only in dev. | `lib/security.ts`, called from `/api/chat`, `/api/order` |
| **Rate limiting** | Upstash sliding-window: `/api/chat` (20/hr), `/api/menu-scan` (10/hr), `/api/retailer` (120/hr), `/api/order` (30/hr), plus prefix-based limits on admin routes. Fail-CLOSED on Redis outage for `/api/chat` (degrades to in-memory limiter, never lets the LLM bill freely). | `middleware.ts` |
| **RBAC** | Pure `roleSatisfies()` function + `authorizeRetailer()` that combines tenant scope + role rank. Owner > manager > staff. | `lib/authz.ts`, `tests/authz.test.ts` |
| **Secret handling** | All AI / Clerk / Stripe / Resend keys read from `process.env.*` server-side only; nothing prefixed `NEXT_PUBLIC_` except the documented publishable keys. | `.env.example` documents every required var. |
| **Social tokens** | AES-256-GCM encrypted with `SOCIAL_TOKEN_KEY` before storage. | `lib/social.ts` |
| **Stripe webhook replay** | Idempotency table `stripe_webhook_events`; dedupes by event id via `ON CONFLICT DO NOTHING` before processing. | `app/api/stripe/webhook/route.ts`, `lib/billing.ts` |
| **Migration secret rotation** | `poursona-migrate-2026` literal currently hardcoded. **GAP** — should move to env var. |

---

## 6. AI cost controls (verify rigorously)

This is the single biggest production risk because Pour-Sona pays Anthropic per token and bills vendors a flat $79/mo.

**Constants** (`lib/chat-guardrails.ts`):
```
MAX_CATALOG_ITEMS  = 24      // SKUs injected into the prompt per turn
MAX_HISTORY_MESSAGES = 14    // recent turns sent to the model
MAX_USER_TURNS     = 6       // ABSOLUTE backstop; per-vendor cap lives in AssistantProfile
AI_MONTHLY_BUDGET_USD = 15   // override via env
AI_INPUT_USD_PER_MTOK = 1
AI_OUTPUT_USD_PER_MTOK = 5   // Haiku pricing
```

**Flow:**
1. Every chat request reads the venue's accumulated month-to-date tokens.
2. Per-vendor cost is computed via `monthlyCostUsd()`.
3. If ≥ budget → `degradedResponse()` short-circuits **before** the Anthropic stream is opened.
4. If ≥ 80% of budget → owner gets a once-per-month email warning.
5. If still under budget → Anthropic streams; usage is accumulated post-stream into the same Neon row.

**Verification scripts:**
- `scripts/verify-ai-budget.sh` — asserts `degradedResponse` is called BEFORE `anthropic.messages.stream` in the route source.
- `tests/chat-guardrails.test.ts` — 16 unit tests around the boundary math.

---

## 7. Testing baseline

```
$ npx vitest run
Test Files:  8 passed
Tests:      80 passed
```

| File | Coverage |
|---|---|
| `tests/chat-guardrails.test.ts` | Token cost math, budget threshold boundary, monthly window, relevance filter, in-stock hard guardrail incl. fully-hallucinated discard |
| `tests/security.test.ts` | SSRF allow/deny matrix, sentinel sanitisation, email validation, onboarding-secret timing-safe compare |
| `tests/authz.test.ts` | Role hierarchy, case-insensitivity, unknown/empty deny, cross-tenant denial decision logic |
| `tests/billing.test.ts` | `planToMrr()` + `subStatusFromStripe()` mappings |
| `tests/agent-profile.test.ts` + `tests/agent-profile-api.test.ts` | Default derivation, question-bounds clamp to absolute ceiling, profile resolver round-trip |
| `tests/agent-build-prompt.test.ts` | Per-vertical prompt assembly snapshots + sentinel-injection regression |
| `tests/recommendation-enrich.test.ts` | Catalog image_url join, price coercion, case-insensitive matching |

**Build verification:**
- `npm run build` runs `node scripts/check-encoding.js` (mojibake check) → `next build` (TS + ESLint + bundling)
- Vercel runs the same on every push to `main`
- A pre-push `npm run build` habit is now part of process (see incident note in §10)

---

## 8. Deployment

| Aspect | Setting |
|---|---|
| Vercel project | `prj_v9QazXxkNJ1mfDLCvirV0DRdO1kV` (team `team_s6Ol8tWSsdxA9k15SVO2iZ7G`) |
| Region | `iad1` (US East) |
| Build command | `npm run build` (overridden in `vercel.json` — see file if present) |
| Branch → environment | `main` → production |
| Function timeout | Default 60s; `/api/poursona-admin/pipeline` opts to 120s |
| Edge middleware | `middleware.ts` runs Clerk + rate-limit on every request |
| Domain | `pour-sona.com` (apex, `www` redirects), DNS via Vercel Domains |

**Deployment failure mode observed 2026-05-26:** A single unescaped apostrophe in JSX (`react/no-unescaped-entities`) silently failed every Vercel build for 4 consecutive commits while production continued serving stale code. **Process change:** `npm run build` runs locally before every push (the ESLint blocker doesn't surface in `tsc --noEmit`). Vercel deploy state is also now verified via the API (`READY` + alias check) rather than a footer-string probe.

---

## 9. Open engineering questions for the reviewer

1. **Migration secret in code.** `poursona-migrate-2026` is hardcoded in `app/api/migrate/route.ts`. Should be rotated and moved to env var. Low exploit value (it only triggers schema-add operations against a pre-defined block) but a soft gap.
2. **`r.*` in `getRetailersForIdentity`.** The query returns every column on `retailers` including sensitive ones (`owner_email`, `stripe_customer_id`, `chat_system_prompt`). The data goes to authenticated team members only — but column whitelist would be defense-in-depth.
3. **Single-region database (Neon `iad1`).** No cross-region replication. Acceptable for current scale; revisit at multi-region or compliance commitments.
4. **No formal schema migration history.** `FIX_SCHEMA` is idempotent and additive but doesn't track applied versions. If a column needs to be *removed* or backfilled non-trivially, a real migration framework (e.g. Drizzle, Prisma migrate) becomes worth the lift.
5. **Sentry coverage of route handlers.** Some catch blocks return JSON 500s without `console.error` (means the error body is invisible in logs). I added one to `/api/poursona-admin/me` after the 2026-05-26 redirect-loop incident; a sweep across the rest would help.
6. **Test coverage on /api/chat happy path.** Pure guardrail logic is well-tested; the SSE streaming wrapper is not (mocking Anthropic's stream is non-trivial). The full chat route is exercised only via manual / production traffic today.

---

## 10. What we'd like signed off

- Architecture suitability for current scale (10 vendors → 1,000-vendor horizon)
- Security posture as described in §5
- AI cost ceiling enforcement (§6) as a hard guarantee, not a soft target
- Acceptance of the open questions in §9 as **acknowledged** (not necessarily fixed)
- Recommendation on whether to add a real migration framework before the next vertical (bakery / wellness) expands the schema materially
