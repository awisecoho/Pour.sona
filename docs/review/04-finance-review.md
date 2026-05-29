# Pour-Sona — Accounting / Finance Review

**Audience:** Accounting & Finance
**Goal:** Validate the revenue model at $79/mo per vendor, confirm AI cost ceilings are real and tested, and check the bookkeeping shape (Stripe → Pour-Sona books).

---

## 1. Revenue model

| Item | Value |
|---|---|
| **Plan** | Single tier: **$79 / month per vendor**, billed monthly via Stripe subscription |
| **Trial** | 14 days, no card required |
| **Annual plan** | Not offered today |
| **Discounts / promo codes** | Promo-code system exists (`/poursona-admin/promos` + `lib/billing.ts`) but no live promo codes currently issued |
| **Currency** | USD only |

**Pricing copy lives in:** `app/pricing/page.tsx`, marketing site, signup flow Step 2 ("14-day free trial · then $79/mo · No credit card required"), and `app/admin/billing/page.tsx`.

**MRR mapping:** Single source of truth in `lib/billing.ts::planToMrr()` → `'starter' → 79`. Mapped from Stripe price id via `STRIPE_PRICE_ID` env. Unit-tested in `tests/billing.test.ts`. **Not yet verified** end-to-end against a Stripe test charge ($79 actually settles into the account) — finance reviewer should confirm with the Stripe dashboard.

---

## 2. Customer count (as of 2026-05-26)

From production schema probe (`POST /api/migrate` returns row counts):

| Metric | Value |
|---|---|
| Total retailers in DB | **10** |
| Vendor team members | 18 |
| Internal Pour-Sona team | 1 |

Subscription-status breakdown is visible in `/poursona-admin` (Dashboard tab): trial / active / expired counts, plus an "expired trials need follow-up" panel.

---

## 3. Stripe integration

### Endpoints
| Route | Purpose |
|---|---|
| `POST /api/stripe/checkout` | Owner-role only. Creates a checkout session. |
| `POST /api/stripe/portal` | Owner-role only. Customer Stripe portal for self-service cancel/update card. |
| `GET  /api/stripe/status` | Reads subscription status. |
| `POST /api/stripe/webhook` | Stripe-signature-verified webhook. |
| `POST /api/stripe/trial-check` | Cron-style endpoint that finds trials about to expire. |

### Webhook handling
- **Idempotency:** `stripe_webhook_events` table dedupes by Stripe event id via `ON CONFLICT DO NOTHING` before processing. Replay-safe.
- **Signature verification:** `STRIPE_WEBHOOK_SECRET` checked against header. No fallback.
- **Events handled:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Verification script:** `scripts/verify-billing.sh` asserts signature verify + dedupe + $79 price mapping in source.

### Status sync
| Stripe state | Local `subscription_status` |
|---|---|
| `trialing` | `trial` |
| `active` | `active` |
| `past_due` | `past_due` |
| `unpaid` | `past_due` |
| `canceled` | `cancelled` |
| `incomplete*` | `cancelled` |

Mapped in `lib/billing.ts::subStatusFromStripe()`, tested in `tests/billing.test.ts`.

---

## 4. Cost structure

### 4.1 Variable per-vendor cost — AI inference

This is the biggest cost lever and the one that needed the most engineering attention.

| Lever | Value |
|---|---|
| Model | Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Input pricing | **$1 / M tokens** |
| Output pricing | **$5 / M tokens** |
| Per-vendor monthly cap | **$15 / month** (env-configurable: `AI_MONTHLY_BUDGET_USD`) |
| Behavior when cap is hit | Server short-circuits to a deterministic catalog-based fallback recommendation — no Anthropic call. Guest UX never goes dark. Vendor owner gets a once-per-month upsell email. |
| Behavior at 80% of cap | Vendor owner gets a once-per-month warning email so they can choose to act before service degrades. |
| Tracking | Per-retailer columns `ai_input_tokens_month`, `ai_output_tokens_month`, `ai_month_reset_at`. Resets at calendar-month start. |
| Verification | `scripts/verify-ai-budget.sh` confirms the over-budget short-circuit precedes the Anthropic call in source. |

**At the $15 cap, gross margin per vendor on a fully-utilized month:**
```
Revenue              $79.00
Stripe fee (~2.9% + 30¢)   ($2.59)
AI inference (cap)        ($15.00)
Per-vendor net           ≈ $61.41
```

Empirically, most vendors will not hit the AI cap — typical conversation is short, the catalog is relevance-filtered to ~24 SKUs per prompt, and the model returns a recommendation in 3-5 user turns. Reviewer should look at historical token usage in `retailers.ai_*_tokens_month` to estimate realised cost per vendor.

### 4.2 Fixed monthly cost — infrastructure

| Service | Plan | Approx cost |
|---|---|---|
| Vercel | Pro (assumed — Hobby's 10s function timeout couldn't host `/api/poursona-admin/pipeline` which sets `maxDuration = 120`) | ~$20/mo |
| Neon Postgres | Likely Free or Pro tier | $0–$20/mo |
| Upstash Redis | Free tier (rate-limit only) | $0 |
| Sentry | Free / Team | $0–$26/mo |
| Resend | Free tier (3k emails / mo) | $0 today |
| Clerk | Free tier (up to 10k MAUs) | $0 today |
| Anthropic API | Pay-as-you-go | Variable, capped per vendor |
| Google Workspace | Business Starter | **$6 / user / mo** |
| Domain (pour-sona.com) | Annual | ~$15/yr |

**Total fixed infrastructure ≈ $40–$70/mo** plus Workspace per-seat. Reviewer should pull actual invoices for the last 2 months from each vendor dashboard to confirm.

### 4.3 One-time / accrued

- Logo / brand work — none externally contracted to date
- Legal review — pending (this document)
- Stripe `STRIPE_PRICE_ID` — must be the **production** price id once review is complete; currently appears to be a live `price_…` value (verify in Stripe dashboard)

---

## 5. Unit economics

At 10 active paying vendors:

| Item | Monthly |
|---|---|
| Gross revenue | 10 × $79 = **$790** |
| Stripe fees | ~$26 |
| AI inference (worst case, all at cap) | $150 |
| AI inference (realistic, ~$3/vendor avg) | ~$30 |
| Fixed infra | ~$50 |
| **Net at AI cap (worst case)** | ~$564 |
| **Net at realistic AI use** | ~$684 |

**Breakeven on infra-only basis:** ~2 paying vendors clear the fixed-cost floor.

**Per-vendor net contribution at scale (after fixed cost is amortised):** ~$58–$76/mo depending on AI usage. The $15 cap ensures a hard floor on the variable portion.

---

## 6. Free trial accounting

- Trial is **14 days, no card**. Vendor enters Stripe checkout only at trial end or to upgrade early.
- Cost during trial: AI inference + their share of fixed infra. No revenue.
- Trial expiry email sent to owner (`sendTrialExpiringWarning`) at ≤3 days remaining; expired state set on next chat request after the trial ends (`subscription_status = 'expired'`).
- Atomic claim pattern on `trial_warning_sent_at` ensures exactly one warning email per 24h regardless of concurrent chat traffic.

**Accounting question for reviewer:** Should we record any expense allocation against trials as customer-acquisition cost (CAC), or treat trial-AI cost as raw operating expense?

---

## 7. Revenue recognition

Single SaaS subscription with no setup fee, no annual commitments, no usage-based component visible to the vendor. **Monthly subscription model → recognise revenue ratably over the month.**

Stripe invoices monthly. Pour-Sona's books should:
1. Record the Stripe invoice on issue date.
2. Recognise the $79 over the 30-day service period (or simplify to "recognise on invoice if cash-basis").
3. Reverse subscription state on `customer.subscription.deleted` (cancellation effective at period end, per default Stripe behavior).

**No deferred revenue currently tracked in Pour-Sona's own DB** — Stripe is the source of truth for billing state.

---

## 8. Books / accounting setup

| Item | Status |
|---|---|
| Business entity | (Confirm with reviewer) |
| Business bank account | (Confirm — Stripe payouts target this) |
| Bookkeeping software | (Confirm — QuickBooks / Xero / Wave?) |
| Tax registration | (Confirm — state sales tax on SaaS varies; depends on entity state) |
| Stripe payout schedule | Default Stripe rolling 2-day |
| Stripe connect / platform vs. standard | **Standard** Stripe account (not a Connect platform) — Pour-Sona collects, no payout splits |

---

## 9. Promotional / discount system

`lib/billing.ts` includes promo-code logic but **no live promo codes are issued today**. Internal team can create them at `/poursona-admin/promos`.

If finance wants to track promo-driven revenue separately:
- Promo state lives in the `promos` table (review schema in `app/api/poursona-admin/promos`).
- Stripe coupons map to promo records.
- No accounting plumbing yet to separate promo-discounted MRR from full-price MRR in our own books.

---

## 10. Open finance questions

1. **Stripe production verification.** Has a live $79 charge ever settled in the production Stripe account? Confirm in Stripe dashboard before broader marketing push.
2. **Sales tax.** Pour-Sona is a SaaS sold to U.S. businesses. State-by-state sales-tax rules on SaaS vary (NY: not taxable, TX: taxable, etc.). Need a tax-collection decision and Stripe Tax setup if applicable.
3. **CAC accounting.** Treat trial-period AI cost as operating expense vs. CAC allocation.
4. **Per-vendor cost reporting.** We track AI tokens per vendor but don't roll that up into a "cost per vendor this month" report yet. Worth adding for unit-econ tracking?
5. **Annual plan consideration.** No annual plan today. Worth pricing a discounted annual tier (e.g. $79 × 10 months = $790/yr) to lock in revenue and improve CAC payback?
6. **Refund policy.** No formal refund language beyond what Stripe defaults to. Counsel should weigh in (see Legal review §7).
7. **Bookkeeping platform.** Confirm which platform Pour-Sona uses and whether Stripe → bookkeeping sync is automated.

---

## 11. What we'd like signed off

- $79/mo single-tier model and 14-day trial as the launch posture
- AI cost ceiling at $15/mo as the hard guarantee documented in §4.1
- Stripe integration as the sole source of billing truth
- Revenue recognition method (monthly ratable)
- Tax + bookkeeping action items from §10
