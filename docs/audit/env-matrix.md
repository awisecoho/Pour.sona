# Poursona — Environment Variable Matrix (Audit Reference)

Required = app is broken without it. Recommended = degrades gracefully but should be set in prod.
All are set in Vercel project env (production) — none are committed.

| Var | Tier | Surface / use | Notes |
|---|---|---|---|
| `POSTGRES_URL` / `DATABASE_URL` | **Required** | Neon Postgres connection (`lib/db.ts`) | `lib/db.ts` tries `POSTGRES_URL`, then `DATABASE_URL`, then `POSTGRES_PRISMA_URL`, then `POSTGRES_URL_NON_POOLING` |
| `ANTHROPIC_API_KEY` | **Required** | guest chat + onboarding agents | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Required** | admin auth (client) | without Clerk env, admin routes 503/redirect |
| `CLERK_SECRET_KEY` | **Required** | admin auth (server) | |
| `STRIPE_SECRET_KEY` | **Required (billing)** | checkout/portal/webhook | |
| `STRIPE_WEBHOOK_SECRET` | **Required (billing)** | webhook signature verification | |
| `STRIPE_PRICE_STARTER` | **Required (billing)** | $79 plan price object id | **MUST map to a $79/mo recurring price** for charged == displayed |
| `STRIPE_PRICE_GROWTH` | Optional | $99 plan | future tier |
| `STRIPE_PRICE_PRO` | Optional | $199 plan | future tier |
| `RESEND_API_KEY` | Recommended | transactional email | absent → emails fail (best-effort, logged) |
| `POURSONA_ONBOARD_SECRET` | Recommended | server-to-server onboarding auth | |
| `POURSONA_ADMIN_EMAIL` | Recommended | scrape-failure alerts recipient(s) | comma-separated; falls back to `poursona_team` table |
| `NEXT_PUBLIC_APP_URL` | Recommended | origin allow-listing | absent → falls back to same-origin Host check |
| `UPSTASH_REDIS_REST_URL` | Recommended | rate limiting | absent → in-memory fallback limiter |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | rate limiting | |
| `AI_MONTHLY_BUDGET_USD` | Optional | per-venue AI cap (default 15) | |
| `AI_INPUT_USD_PER_MTOK` | Optional | cost model input price (default 1) | |
| `AI_OUTPUT_USD_PER_MTOK` | Optional | cost model output price (default 5) | |
| `SENTRY_DSN` / related | Optional | error tracking | no-op if absent |
| `SOCIAL_TOKEN_KEY` | **Required (social)** | AES-256-GCM key for OAuth token encryption (`lib/social.ts`) | any string; SHA-256 → 32-byte key. Connect/posting refuses to store tokens without it |
| `META_APP_ID` / `META_APP_SECRET` | Optional (social) | Facebook + Instagram OAuth | needs Meta app + Business verification + app review for posting scopes |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Optional (social) | LinkedIn OAuth | posting (`w_member_social`) needs partner-program approval |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | Optional (social) | X / Twitter OAuth2 (PKCE) | posting requires a paid X API tier |

## Social platform setup
Each platform's **Connect** button stays disabled ("Not configured") until both its
client-id and secret env vars are set. OAuth redirect URI to register on each platform:
`https://pour-sona.com/api/poursona-admin/social/callback/<platform>`
(`facebook` | `instagram` | `linkedin` | `twitter`). Manual "+ Add" works without any
credentials — it tracks an account for selection/research but can't post until connected.

## Migration secret
`POST /api/migrate` is gated by a hardcoded secret (`poursona-migrate-2026`) — rotate to an
env var before GA. (Open risk, see evidence-checklist.)
