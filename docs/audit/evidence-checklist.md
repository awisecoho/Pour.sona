# Poursona — Evidence Checklist (Audit Reproduction)

Each claim is tagged **VERIFIED** (backed by a runnable artifact), **INFERRED** (reasoned from
code, not executed), or **NOT VERIFIED** (needs an environment/credential we don't control).

Run all local checks from the repo root.

## Quick start
```bash
npm install
npm test                       # unit tests (vitest)
bash scripts/verify-core.sh    # encoding + typecheck + tests
bash scripts/verify-ai-budget.sh
bash scripts/verify-rbac.sh
bash scripts/verify-billing.sh
bash scripts/verify-prelaunch.sh  # 5 pre-launch security checks
```

## Claims

### AI cost controls + deterministic fallback
- **VERIFIED** — budget threshold math, monthly windowing, and the catalog fallback are unit
  tested: `npx vitest run tests/chat-guardrails.test.ts`.
- **VERIFIED** — `app/api/chat/route.ts` calls `effectiveMonthlyUsage` + returns
  `degradedResponse` (no LLM call) when `monthlyCostUsd >= AI_MONTHLY_BUDGET_USD`:
  `bash scripts/verify-ai-budget.sh`.
- **INFERRED** — token accounting writes back per request via the metering UPDATE; correctness
  of Anthropic `usage` extraction is not unit-tested (requires a live stream).

### Recommendation trust guardrails
- **VERIFIED** — in-stock-only validation drops hallucinated SKUs and discards a fully-invalid
  rec: `tests/chat-guardrails.test.ts` (`validateRecAgainstCatalog`).
- **VERIFIED** — relevance filtering caps the catalog and surfaces keyword matches first.
- **INFERRED** — turn-cap force-recommend and history trim are wired in the route (grep), not
  exercised end-to-end here.

### SSRF protection
- **VERIFIED** — `validateScrapeUrl` blocks loopback, RFC1918, 169.254 metadata, IPv6 ULA/
  link-local, internal TLDs, credentials, and non-http schemes: `tests/security.test.ts`.
- **VERIFIED** — `/api/signup/url` (self-serve onboarding) now calls `validateScrapeUrl` from
  `lib/security.ts` instead of the prior partial inline blocklist: `bash scripts/verify-prelaunch.sh`.

### Guest API data exposure (PII)
- **VERIFIED** — `/api/retailer` (public, anonymous) now selects only a whitelisted column set;
  `owner_email`, `stripe_customer_id`, `subscription_status`, `trial_ends_at`, `chat_system_prompt`,
  and all AI-metering fields are excluded: `bash scripts/verify-prelaunch.sh`.

### Rate limiting completeness
- **VERIFIED** — `/api/order` is in the middleware LIMITS map (30 req/hr per IP):
  `bash scripts/verify-prelaunch.sh`.

### Marketing copy integrity
- **VERIFIED** — Single consistent CTA "Start Free Trial" (stale "Get Early Access" removed):
  `bash scripts/verify-prelaunch.sh`.
- **VERIFIED** — Body text color updated to `#9a8a64` / `#7a6a44`; the failing-contrast
  `#4a3a1a` / `#3a2a0a` values are no longer present in marketing pages: `bash scripts/verify-prelaunch.sh`.

### Tenant isolation + RBAC
- **VERIFIED** — role hierarchy + decision logic unit tested: `tests/authz.test.ts`
  (`bash scripts/verify-rbac.sh`).
- **VERIFIED (code)** — sensitive endpoints call the server-side role guard (grep in verify-rbac).
- **INFERRED** — full HTTP-level cross-tenant denial would need an integration harness with
  Clerk sessions; decision logic is covered by unit tests.

### Billing correctness
- **VERIFIED (code)** — webhook verifies the Stripe signature (`constructEvent`) and dedupes
  replays by `stripe_event_id`: `bash scripts/verify-billing.sh`.
- **VERIFIED (code)** — starter MRR is $79 in checkout + webhook mapping.
- **NOT VERIFIED** — that the *charged* amount equals $79 requires `STRIPE_PRICE_STARTER` to
  point at a $79 recurring price object in the Stripe dashboard, and a Stripe test-mode run
  (test event IDs + sample invoice JSON). This needs the owner's Stripe environment.

### Funnel analytics
- **VERIFIED (code)** — `/api/admin/dashboard` aggregates scan→conversation→recommendation→order
  with daily series + CSV, tenant-scoped (grep + code review).
- **INFERRED** — `chat_started` / `recommendation_shown` events are emitted from the chat route;
  not exercised against a seeded tenant here.

## Open items requiring owner/runtime
- Stripe live test-mode billing evidence (test event IDs, invoice JSON).
- Clerk-authenticated integration tests for RBAC at the HTTP layer.
- Rotating the `/api/migrate` secret to an env var.
- **Switch Clerk to production tenant** (`pk_live_*`) — currently using dev key in production.
- **Verify `STRIPE_PRICE_STARTER`** resolves to a $79/month recurring price in Stripe Dashboard.
- Email verification before `publishDraft` — venue goes live on first draft; magic-link flow
  is a roadmap item before 10-venue scale.
