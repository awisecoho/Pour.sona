# Pour-Sona — Executive Summary

**Prepared for:** Software engineering review · Legal review · Accounting / Finance review
**Date prepared:** 2026-05-26
**System status:** Live in production at https://pour-sona.com
**Document set (read in order):**

| # | Document | Audience |
|---|---|---|
| 00 | [Mutual NDA](./00-nda.md) — **execute before reading further** | All reviewers |
| 01 | This page (Executive Summary) | All reviewers |
| 02 | [Engineering review](./02-engineering-review.md) | Software engineer / technical reviewer |
| 03 | [Legal review](./03-legal-review.md) | Legal counsel |
| 04 | [Finance review](./04-finance-review.md) | Accounting / Finance |

> All material distributed with this packet is provided subject to the executed Mutual Non-Disclosure Agreement (Document 00). Please do not circulate the packet without first returning a signed copy of the NDA to `andy@pour-sona.com`.

---

## What Pour-Sona is

A SaaS platform that gives independent craft-beverage venues a **per-vendor AI guide** that converts QR-code scans into personalized product recommendations. Guests scan a QR code on a table card, have a short natural-language conversation with the venue's brand-specific assistant ("your personal Coffee Sommelier", "your Beer Curator", etc.), and receive a confident recommendation tied to the venue's actual in-stock catalog — culminating in an order placed through staff.

**Verticals served today:** Craft breweries, wineries, distilleries, specialty coffee roasters. Extensible to bakeries, bottle shops, tea rooms.

**Two principal user surfaces:**
- **Guest UX** — anonymous, QR-driven, no signup. Lives at `pour-sona.com/r/<vendor-slug>`.
- **Vendor admin** — Clerk-authenticated. Catalog, QR code, analytics, billing, AI agent configuration. Lives at `pour-sona.com/admin`.

**Internal (Pour-Sona team) surface:**
- `pour-sona.com/poursona-admin` — gated by `poursona_team` table membership. Houses vendor onboarding, the Prospect Pipeline (AI-assisted lead generation), the Leads CRM, social-media accounts, and platform analytics.

---

## Business model

| Item | Value |
|---|---|
| Pricing | **$79 / month** per venue, flat. 14-day free trial. No credit card to start. |
| Revenue mechanism | Stripe subscription. Webhook-driven status sync (`/api/stripe/webhook`). |
| Current vendor count (production) | **10** active retailers (as of migration check 2026-05-26) |
| AI cost ceiling | $15/month per vendor enforced server-side (`AI_MONTHLY_BUDGET_USD`). Over-budget vendors get a catalog-based fallback recommendation; guest UX never goes dark. |
| Gross margin per active vendor (target) | ~$60/mo after AI, infrastructure, and Stripe fees (see [Finance review](./03-finance-review.md)) |

---

## Hosting & key vendors

| Function | Vendor | Status |
|---|---|---|
| Hosting + DNS | **Vercel** (project `pour-sona` in team `andy-wiises-projects`) | Live |
| Database | **Neon** PostgreSQL | Live, 9 tables |
| AI inference | **Anthropic** Claude (Haiku 4.5) | Live |
| Authentication | **Clerk** | Live |
| Payments | **Stripe** subscriptions | Live |
| Transactional email | **Resend** (`pour-sona.com` DKIM-signed) | Live |
| Team email | **Google Workspace** (`andy@pour-sona.com`) | Active setup in progress |
| Rate limiting | **Upstash Redis** | Live |
| Error tracking | **Sentry** | Live |
| Domain | `pour-sona.com` (registered via Vercel Domains) | Live |

A full data-flow diagram and the access surface for each vendor is in the engineering review.

---

## Why each review matters

- **Engineering:** verify production architecture, security posture (SSRF, prompt-injection, RBAC, secret handling), AI-cost guardrails, and that the test/CI baseline matches what production runs.
- **Legal:** approve the consumer-facing terms / privacy / age-gate copy, identify any liability surface around AI-generated drink recommendations (especially alcohol verticals), and clear the data-processor chain.
- **Finance:** validate unit economics at $79/mo, confirm AI cost ceilings are real and tested, and check the bookkeeping shape (Stripe → Pour-Sona books).

Each review document lists the specific files, routes, and external dashboards the reviewer needs.

---

## Repository

- **Root:** `C:\Users\awise\poursona` (Windows working copy) / `github.com/awisecoho/Pour.sona` (private repo)
- **Branch:** `main` (production target)
- **Tech stack:** Next.js 14.2 (App Router), TypeScript 5, React 18, PostgreSQL (Neon)
- **Test runner:** Vitest. **Current passing:** 80 / 80
- **Build verification:** `npm run build` (runs ESLint + Next compile + encoding check). CI = Vercel build pipeline.

---

## Document conventions

Within each review document, file paths are written from the repo root (e.g. `app/api/chat/route.ts`). External resources (Vercel project ID, Stripe dashboard, Clerk app) are listed in the Engineering and Finance documents as appropriate. **VERIFIED**, **INFERRED**, and **NOT VERIFIED** tags indicate the evidence strength of each claim, matching the convention from `docs/audit/evidence-checklist.md`.
