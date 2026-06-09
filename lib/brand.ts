/**
 * Pour-Sona v2 brand tokens — single source of truth for color + gradient
 * values used across Pour-Sona's own surfaces (marketing, login, admin chrome,
 * email templates, QR fallback).
 *
 * Locked palette per docs/brand/v2-locked-spec.md.
 *
 * IMPORTANT: These tokens are for Pour-Sona's OWN brand. The guest QR-landing
 * page (`app/r/[slug]/page.tsx`) intentionally honors the vendor's `brand_color`
 * and `brand_font_family` — DO NOT reference these tokens there for primary
 * theme colors. The 95% vendor / 5% Pour-Sona rule is set in Doc #1.
 */

export const BRAND = {
  // Primary palette
  plum:            '#612A86',  // Chrome, sidebars, brand moments, secondary buttons
  copperAmber:     '#D67A31',  // PRIMARY CTA color — Save / Submit / Sign In / Order
  cabernetMagenta: '#C04D86',  // Hover states, badges, secondary highlights
  discoveryTeal:   '#44C7C4',  // Charts, success ticks, data accents

  // Surfaces
  darkBg:          '#12111A',  // Default background
  lightBg:         '#F8F7F5',  // Reserved — light mode deferred from v2

  // Text scale on dark
  textPrimary:     '#F5F2E8',  // Body, primary headings
  textSecondary:   '#A89FB8',  // Subtitles, secondary body
  textMuted:       '#6A6080',  // Labels, captions
  textFaint:       '#3A3450',  // Dividers, low-emphasis chrome

  // Status (kept universal)
  success:         '#5ECF8A',
  danger:          '#E07070',
  warning:         '#D67A31',  // reuses copperAmber

  // Gradients (named for consistency)
  ctaGradient:     'linear-gradient(135deg, #D67A31, #612A86)',
  brandGradient:   'linear-gradient(135deg, #612A86, #C04D86)',
} as const

/**
 * RGB tuples for use in rgba() — e.g. `rgba(${BRAND_RGB.plum}, .2)`.
 * Saves having to convert hex → rgb at every translucent-border / shadow site.
 */
export const BRAND_RGB = {
  plum:            '97, 42, 134',
  copperAmber:     '214, 122, 49',
  cabernetMagenta: '192, 77, 134',
  discoveryTeal:   '68, 199, 196',
  darkBg:          '18, 17, 26',
  textPrimary:     '245, 242, 232',
} as const

/**
 * Font CSS variables exposed by `next/font/google` loaders in app/layout.tsx.
 * Use these via `fontFamily: 'var(--font-sora)'` (etc.) in inline styles, or
 * via Tailwind class equivalents if Tailwind is added later.
 *
 * Vendor-themed `/r/[slug]` keeps using the vendor's `brand_font_family` —
 * these tokens never apply there.
 */
export const FONT = {
  brand:     'var(--font-sora), system-ui, -apple-system, sans-serif',     // Brand headlines, big numbers, marketing hero
  ui:        'var(--font-inter), system-ui, -apple-system, sans-serif',    // Admin UI body, forms, tables
  marketing: 'var(--font-outfit), system-ui, -apple-system, sans-serif',   // Marketing site body, long-form copy
} as const

export type BrandKey = keyof typeof BRAND
export type FontKey  = keyof typeof FONT
