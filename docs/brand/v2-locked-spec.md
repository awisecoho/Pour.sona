# Pour-Sona Brand v2 — Locked Spec

**Status:** All design decisions locked 2026-05-26. Implementation can begin.
**Companion documents:** [v2-implementation-plan.md](./v2-implementation-plan.md)

---

## 1. Palette (final)

| Role | Hex | Notes |
|---|---|---|
| Primary brand / chrome | **Plum `#612A86`** | Sidebars, header bars, brand moments, secondary buttons |
| Primary CTA | **Copper Amber `#D67A31`** | All "do the thing" buttons — Save, Submit, Order, Confirm, Sign In |
| Secondary accent | **Cabernet Magenta `#C04D86`** | Hover states, badges, secondary highlights |
| Light accent / data | **Discovery Teal `#44C7C4`** | Charts, success ticks, data highlights, "Saved ✓" confirmations |
| Dark background | **`#12111A`** | Default page background |
| Light surface | **`#F8F7F5`** | Reserved — not used in v2 (light mode deferred) |
| Status — success | **`#5ECF8A`** | Keep (universal) |
| Status — danger | **`#E07070`** | Keep (universal) |
| Status — warning | Copper Amber `#D67A31` | Reuse primary CTA color |

### Derived text scale (on dark)

| Token | Hex | Use |
|---|---|---|
| `textPrimary` | `#F5F2E8` | Body text, primary headings |
| `textSecondary` | `#A89FB8` | Subtitles, secondary body |
| `textMuted` | `#6A6080` | Labels, captions |
| `textFaint` | `#3A3450` | Dividers, low-emphasis chrome |

### Gradients

| Name | Definition | Use |
|---|---|---|
| `ctaGradient` | `linear-gradient(135deg, #D67A31, #612A86)` | Primary CTAs that warrant a gradient |
| `brandGradient` | `linear-gradient(135deg, #612A86, #C04D86)` | Hero panels, brand moments |

---

## 2. Typography (final)

| Family | Variable | Use |
|---|---|---|
| **Sora** | `--font-sora` | Brand headlines, big numbers, marketing hero |
| **Inter** | `--font-inter` | Admin UI body, forms, tables, dashboards |
| **Outfit** | `--font-outfit` | Marketing site body, long-form copy |

Loaded via `next/font/google` with `display: 'swap'`. Weights: 400 / 600 / 700 (+ 800 for Sora/Outfit).

**Vendor's per-retailer `brand_font_family` continues to win on `/r/[slug]`.** Untouched.

---

## 3. Logo (locked, no redesign)

Master asset is the composite mark provided 2026-05-26 (stylized P + grape cluster + coffee bean + leaf + circuit pathways + gradient + "POURSONA" wordmark + "GUIDED BEVERAGE DISCOVERY" tagline).

**Variants needed (to be produced from source SVG once available):**
- Full lockup (mark + wordmark + tagline) — marketing hero
- Mark + wordmark (no tagline) — admin headers, email
- Mark only — favicon, app icons, sidebar collapsed, small contexts
- Monochrome white — reverse contexts (dark photos, etc.)
- Monochrome dark `#12111A` — reverse contexts (rare in v2)

**Sizes to generate from master:**
- `favicon.ico` — 16, 32, 48 (multi-res)
- `apple-touch-icon.png` — 180×180
- `icon-192.png`, `icon-512.png` — PWA manifest
- `icon-1024.png` — app store reserve
- `og.png` — 1200×630 — social share with logo + brand gradient background

---

## 4. Light mode

**Deferred.** v2 ships dark-only across all Pour-Sona surfaces. Light Background `#F8F7F5` token is reserved in `lib/brand.ts` for future use but no component consumes it.

---

## 5. Per-vendor brand_color collision

**No action.** Vendors whose `brand_color` happens to be plum/magenta/copper/teal will see their guest-page chat (`/r/[slug]`) look superficially similar to Pour-Sona's admin. Vendor logo + name dominate, so the practical confusion risk is minimal.

---

## 6. Email render test scope

Test surface for Phase 5 (email template restyling):
- Gmail (web) — primary
- iOS Mail (mobile)
- Outlook (web) if available

Covers ~85% of real recipients. Test method: send live test messages to `andy@pour-sona.com` and visually confirm header bar, link color, and button color render correctly. Plain-text fallbacks unchanged.

---

## 7. Scope reminder

**v2 brand work is paint, not structure.** The following are explicitly out of scope and remain as separate workstreams from the strategic review:
- Beverage DNA™ persona system
- Tier 1 / 2 / 3 packaging
- POS integration (Toast, Square, Clover, Shopify, Lightspeed)
- New verticals (tea, restaurants, retail, distribution)
- Light mode
- Logo redesign
