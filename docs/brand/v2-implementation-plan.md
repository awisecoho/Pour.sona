# Pour-Sona Brand v2 — Implementation Plan

**Status:** Plan only. No code changes have been made.
**Scope:** Adopt new color palette + typography across Pour-Sona's own brand surfaces. Apply the new logo as-is (graphic is locked, no modifications). **Vendor-themed surfaces (`/r/[slug]`) stay vendor-branded — they are not affected.**

---

## 1. Goal

Replace the current gold-on-near-black aesthetic of Pour-Sona's own surfaces with the new palette and the locked logo, without touching the guest experience (which is by design 95% vendor-branded).

## 2. What changes / what doesn't

| Surface | Currently | After v2 | Why |
|---|---|---|---|
| Marketing site (`/`, `/pricing`, `/signup`, `/privacy`, `/terms`) | Gold `#C9A84C` on `#060403` + Georgia serif | New palette + Sora/Outfit | Pour-Sona's own brand storefront |
| Login pages (`/admin/login`, `/poursona-admin/login`) | Gold on dark | New palette | First touch after marketing |
| Vendor admin chrome (sidebar, headers, primary CTAs in `/admin/*`) | Gold accents | New palette | Pour-Sona is the host here |
| Internal team admin (`/poursona-admin/*`) | Gold accents | New palette | Pour-Sona team's workspace |
| Email templates (`lib/email.ts`) | Plain text + gold inline HTML | Updated HTML chrome | Carries the brand outside the app |
| QR code default fallback | Gold `#C9A84C` when vendor has no `brand_color` | Plum `#612A86` (or chosen primary) | Brand-consistent default; vendors with their own color unaffected |
| Favicon | Existing | New mark | Browser tab identity |
| PWA / app icons | None | Generated 7-size set | App store / install prompt readiness |
| **Guest QR-landing page (`/r/[slug]`)** | Vendor's `brand_color` + `brand_font` | **Unchanged.** Still vendor-themed end-to-end. | Doc #1 + #2 mandate "95% vendor brand / 5% Poursona." Current implementation already meets this. |
| Recommendation card, order form, welcome screen on `/r/[slug]` | Vendor-themed | **Unchanged.** | Same reason. |
| Vendor's downloadable QR (when vendor has `brand_color` set) | Vendor color | **Unchanged.** | Default fallback shifts; existing vendor settings honored. |

## 3. Asset preparation (must happen before any code work)

The locked logo graphic needs to land in the repo in usable formats. Currently the logo was shared as a screenshot in chat — we need the source asset.

### 3.1 Required from the source designer / brand owner

| Asset | Format | Purpose | Status |
|---|---|---|---|
| Master logo (mark + wordmark) | **SVG** (preferred) or 4096×4096 PNG | Web embedding at any size | **Needed** |
| Mark-only (no wordmark) | SVG | Small contexts (favicon, app icon, sidebar collapsed) | **Needed** |
| Monochrome white | SVG | Reverse use on dark surfaces | Nice-to-have |
| Monochrome black | SVG | Reverse use on light surfaces | Nice-to-have |
| Wordmark-only (text "POURSONA") | SVG | Header lockups where mark is shown separately | Nice-to-have |

If the source SVG isn't available, the screenshot can be converted via a tracer (e.g., `potrace`, Inkscape SVG export), but quality will degrade. **Strong preference for receiving the original vector file.**

### 3.2 Generated derivatives (from the master SVG)

Done by build script once master assets are in place:

| Output | Sizes | Path |
|---|---|---|
| Favicon | 16, 32, 48 | `public/favicon.ico` (multi-resolution) |
| Apple touch icon | 180×180 | `public/apple-touch-icon.png` |
| Android / PWA icons | 192, 512 | `public/icon-192.png`, `public/icon-512.png` |
| App store icons | 1024 | `public/icon-1024.png` |
| Open Graph (social share) | 1200×630 | `public/og.png` (logo + brand background) |

A PWA manifest (`app/manifest.ts`) registers them.

## 4. Color token module

Currently every component has inline hex values like `#C9A84C`, `#080604`, etc. — scattered across ~30+ files. **A one-shot find-and-replace would work, but it doesn't establish a system, and the next color change repeats the work.**

Proposed approach: a single `lib/brand.ts` with named constants. New components reference the tokens; existing components are migrated phase-by-phase.

```ts
// lib/brand.ts (proposed)

export const BRAND = {
  // Primary palette (Doc #1)
  plum:            '#612A86',  // Primary brand color
  cabernetMagenta: '#C04D86',  // Secondary accent
  copperAmber:     '#D67A31',  // Warm CTA / energy
  discoveryTeal:   '#44C7C4',  // Light accent / data highlight

  // Surfaces
  darkBg:          '#12111A',  // Dark mode background
  lightBg:         '#F8F7F5',  // Light mode / light surface

  // Derived neutrals (cooler grayscale for the new palette)
  textPrimary:     '#F5F2E8',  // High-contrast text on dark
  textSecondary:   '#A89FB8',  // Body text on dark, plum-shifted
  textMuted:       '#6A6080',
  textFaint:       '#3A3450',

  // Status (keep current semantics — green/red are universal)
  success:         '#5ECF8A',
  danger:          '#E07070',
  warning:         '#D67A31',  // reuse copper amber

  // Gradients (named so they're consistent)
  ctaGradient:     'linear-gradient(135deg, #D67A31, #612A86)',
  brandGradient:   'linear-gradient(135deg, #612A86, #C04D86)',
} as const

// RGB tuples for rgba() use (e.g., `rgba(${BRAND.plumRgb}, .2)`)
export const BRAND_RGB = {
  plum: '97, 42, 134',
  copperAmber: '214, 122, 49',
  discoveryTeal: '68, 199, 196',
} as const
```

**Why a TS module rather than CSS variables:**
- Most styling in this codebase is inline `style={{}}` props, not a CSS file. CSS variables would require a parallel approach.
- TS constants get type-checked and autocompleted.
- A future light-mode flip can be a hook (`useBrand()`) that returns the right token set without touching every component.

## 5. Typography setup

Doc #1 specifies **Sora** (primary brand), **Inter** (UI), **Outfit** (marketing).

Three font families is fine performance-wise via Next.js `next/font/google`:

```ts
// app/layout.tsx (proposed addition)
import { Sora, Inter, Outfit } from 'next/font/google'

const sora    = Sora({    subsets: ['latin'], variable: '--font-sora',    display: 'swap', weight: ['400','600','700','800'] })
const inter   = Inter({   subsets: ['latin'], variable: '--font-inter',   display: 'swap', weight: ['400','500','600','700'] })
const outfit  = Outfit({  subsets: ['latin'], variable: '--font-outfit',  display: 'swap', weight: ['400','600','700','800'] })
```

Then in component styles:
- Marketing copy → `font-family: var(--font-outfit)`
- Brand headlines → `var(--font-sora)`
- UI body / admin → `var(--font-inter)`

**Where each font lives:**
- Sora: marketing hero, big numbers in admin dashboard, brand headlines
- Inter: admin tables, forms, dashboards (clean and dense)
- Outfit: marketing body copy, blog/long-form (warmer than Inter)

Per-vendor brand_font_family on `/r/[slug]` remains untouched — the vendor's font wins on the guest page, exactly as today.

## 6. Phased rollout (low risk first)

Production is live with paying customers. The phasing minimizes blast radius and lets each phase ship independently if a later one isn't ready.

### Phase 0 — Prep (no user impact, ~½ day)

- Receive logo SVG from designer (blocker)
- Add `lib/brand.ts` token module
- Add `next/font` loaders in `app/layout.tsx`
- Generate icon set, drop into `public/`
- Add `app/manifest.ts` (PWA manifest)
- Update favicon path in `app/layout.tsx`
- Add `public/og.png` and reference in marketing metadata

**Risk: none.** Adding tokens without using them is invisible.

### Phase 1 — Marketing site (~½ day)

Files affected:
- `app/page.tsx` (homepage)
- `app/pricing/page.tsx`
- `app/signup/page.tsx`
- `app/privacy/page.tsx`
- `app/terms/page.tsx`

Replace gold tokens with `BRAND.copperAmber` / `BRAND.plum` per design. Apply Outfit + Sora.

**Risk: low.** No auth flows, no DB writes. Worst case is a visual regression.

### Phase 2 — Login pages (~¼ day)

Files affected:
- `app/admin/login/[[...rest]]/page.tsx`
- `app/poursona-admin/login/[[...rest]]/page.tsx`

The Clerk `<SignIn>` component picks up the wrapping styles. Apply new chrome.

**Risk: low.** Login is just chrome around the Clerk widget.

### Phase 3 — Admin chrome (~1 day)

Files affected:
- `app/admin/layout.tsx` — sidebar, header, retailer-switcher
- `app/poursona-admin/layout.tsx` — sidebar
- `app/poursona-admin/page.tsx` — tab bar (Dashboard / Vendors / Accounting / Promos / Customers / Pipeline / Leads / Social)
- `app/admin/error.tsx`, loading states

Touch only chrome (sidebars, headers, tab bars, primary buttons). Leave content areas (tables, forms) for Phase 4.

**Risk: low-moderate.** Most-trafficked admin surface; vendors will see the change immediately. No behavior change.

### Phase 4 — Admin content areas (~1-1.5 days)

Sweep tab by tab:
- `app/admin/page.tsx` (Dashboard)
- `app/admin/catalog/page.tsx`
- `app/admin/flights/page.tsx`
- `app/admin/orders/page.tsx`
- `app/admin/billing/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/agent/page.tsx`
- `app/admin/qr/page.tsx`
- `app/poursona-admin/_components/ProspectPipeline.tsx`
- `app/poursona-admin/_components/LeadsManager.tsx`
- `app/poursona-admin/_components/SocialAccounts.tsx`
- `app/poursona-admin/team/page.tsx`
- `app/poursona-admin/onboard/page.tsx`
- `app/poursona-admin/retailer/[id]/page.tsx`

One tab per commit so revert is granular if a screen breaks.

**Risk: moderate.** Lots of inline styles. Carefully avoid changing functional behavior (form field IDs, state, etc.) — pure style swaps.

### Phase 5 — Email templates (~½ day)

File affected:
- `lib/email.ts` — HTML bodies for trial-warning, trial-expired, AI-cap, AI-budget-warning, order confirmation, vendor invite, concierge

Update HTML chrome (header bar, link color, button color). Plain-text fallback unchanged.

**Risk: low.** Email rendering varies by client; test in Gmail / Outlook / Apple Mail before pushing.

### Phase 6 — QR code default + storefront fallbacks (~¼ day)

Files affected:
- `app/api/qr/route.ts` — default fallback from `'#C9A84C'` to `BRAND.plum` (or `BRAND.copperAmber`)
- `app/r/[slug]/page.tsx` — only the Pour-Sona footer link styling. Vendor branding untouched.

**Risk: low.** Vendors who set their own `brand_color` are unaffected (their QR uses their color).

### Phase 7 — Docs cleanup (~¼ day)

- `README.md` — any brand references
- `docs/review/*` — color references in the review packet
- Replace screenshots in marketing material if any

**Risk: zero.**

---

## 7. Total effort estimate

| Phase | Days |
|---|---|
| 0 — Prep | 0.5 |
| 1 — Marketing | 0.5 |
| 2 — Login | 0.25 |
| 3 — Admin chrome | 1 |
| 4 — Admin content | 1.5 |
| 5 — Email | 0.5 |
| 6 — QR + storefront fallback | 0.25 |
| 7 — Docs | 0.25 |
| **Total** | **~4.25 dev-days** |

Add ~1 day buffer for design taste calls (gradient stops, hover states, dark/light mode questions) → realistic **5-6 days of focused work** end to end.

---

## 8. Decisions needed from you before Phase 0

Locking these unblocks the work:

1. **Which color leads on CTAs?**
   - Option A — **Plum `#612A86`**. Most distinctive, matches "Primary Plum" in Doc #1.
   - Option B — **Copper Amber `#D67A31`**. Warmer, reads more clickable on dark backgrounds.
   - Option C — Plum for chrome / brand moments, Copper Amber for action buttons. (My recommendation.)

2. **Logo asset format**. SVG please, ideally with separate mark-only and wordmark-only files. If only the screenshot is available, we'll trace from it but quality will drop on small sizes.

3. **Light mode for marketing site?**
   - Doc #1 specifies both a Dark Background (`#12111A`) and a Light Background (`#F8F7F5`).
   - Current marketing is dark-only. Light mode is a real expansion (every component re-themed).
   - Recommend: **dark-only for v2**; add light mode only if a specific surface (e.g., printable case study) needs it.

4. **Per-vendor brand_color collision risk.**
   - A vendor whose brand_color happens to be `#612A86` (plum) would have their guest-page chat look identical to Pour-Sona's admin chrome. Likely fine — vendor's logo + name dominate — but worth flagging.
   - **No action recommended.** Vendor brand always wins on their own page; this is by design.

5. **Email rendering test scope.** Gmail web + iOS Mail + Outlook desktop covers ~85% of recipients. Confirm acceptable test surface.

---

## 9. What we explicitly are NOT doing in v2

To prevent scope creep:

- **No logo redesign.** Mark is locked per Doc #1.
- **No new components.** Same component inventory; just retoned.
- **No vendor-facing changes to `/r/[slug]`.** Vendor brand stays 95% of the surface.
- **No font changes on `/r/[slug]`.** Vendor's `brand_font_family` continues to win there.
- **No Beverage DNA™, no tier structure, no POS integration.** Those are Phase B/C/D from the earlier review document — separate workstreams.

---

## 10. Quick reference — color migration map

For the engineer doing the sweep:

| Current hex | Frequency | Replace with |
|---|---|---|
| `#C9A84C` (gold) | ~150+ uses | `BRAND.plum` (chrome) or `BRAND.copperAmber` (CTA) per context |
| `#a07830` (gold dark, gradient end) | ~20+ uses | `BRAND.plum` (or remove gradient if static plum works) |
| `#F5ECD7` (cream text) | ~80+ uses | `BRAND.textPrimary` |
| `#080604`, `#0a0603`, `#060403` (near-black) | ~50+ uses | `BRAND.darkBg` |
| `#9a8a64`, `#7a6a44`, `#6a5a3a`, `#4a3a1a`, `#3a2a0a` (muted golds) | ~100+ uses | `BRAND.textSecondary` / `textMuted` / `textFaint` per role |
| `rgba(201,168,76,*)` (gold w/ alpha) | ~80+ uses | `rgba(${BRAND_RGB.plum},*)` |
| `#5ecf8a` (success green) | ~10 uses | keep |
| `#e07070` (danger red) | ~15 uses | keep |

Sweep is mostly mechanical once the token module is in place. Worth doing in small commits (one file or one section per commit) so each diff is reviewable.
