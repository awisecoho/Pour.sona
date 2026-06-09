// Poursona v2 brand color tokens — single source of truth for CSS variables.
//
// Palette per docs/brand/v2-locked-spec.md:
//   - Plum (#612A86) — primary chrome / brand moments
//   - Copper Amber (#D67A31) — primary CTA color
//   - Cabernet Magenta (#C04D86) — secondary accent
//   - Discovery Teal (#44C7C4) — data / success-tick accent
//   - Slate dark (#12111A) — base background
//
// This file declares the CSS variable layer used across Poursona's own
// surfaces. New code should prefer the semantic constants in `lib/brand.ts`
// (BRAND.plum, BRAND.copperAmber, etc.) — but for legacy components that
// still reference var(--gold) / var(--cream) etc. through inline styles,
// those CSS variable NAMES are preserved as aliases pointing to the new
// values so the existing markup migrates in-place without find/replace.
//
// IMPORTANT: These tokens are for Poursona's OWN brand. The guest QR-landing
// page (`app/r/[slug]/page.tsx`) intentionally honors the vendor's brand
// color and font — DO NOT plug these tokens into vendor-themed surfaces.
export const colors = {
  // Semantic (v2 — new code should prefer these names)
  plum:            '#612A86',  // primary chrome / brand moments
  copperAmber:     '#D67A31',  // primary CTA — Save / Submit / Order / Sign In
  cabernetMagenta: '#C04D86',  // secondary accent / hover states
  discoveryTeal:   '#44C7C4',  // data accents / success ticks
  slate:           '#12111A',  // base background
  silver:          '#F5F2E8',  // primary text on dark

  // Legacy aliases — kept so existing `var(--gold)` / `var(--cream)` etc.
  // markup continues to render. They now hold v2 values:
  //   --gold        → copperAmber (the CTA color most components used --gold for)
  //   --gold-dim    → plum (was darker gold, now the chrome plum)
  //   --black-*     → slate variants
  //   --cream       → silver text
  //   --brown-*     → cool muted scale (was warm browns, now plum-shifted)
  gold:        '#D67A31',  // primary CTA — mapped from old gold to copperAmber
  goldDim:     '#612A86',  // darker accent — mapped to plum for chrome moments
  black:       '#12111A',
  blackSoft:   '#161423',
  blackCard:   '#1C1A2A',
  cream:       '#F5F2E8',
  brownMuted:  '#A89FB8',   // was warm muted gold; now cool muted plum-shifted
  brownDark:   '#3A3450',
  brownFaint:  '#6A6080',
  green:       '#5ECF8A',
  red:         '#E07070',
  blue:        '#44C7C4',   // alias to Discovery Teal so var(--blue) reads on-brand
} as const

// CSS custom property declarations — injected into :root via RootLayout.
export const cssVars = `
  :root {
    --plum:         ${colors.plum};
    --copper-amber: ${colors.copperAmber};
    --cabernet:     ${colors.cabernetMagenta};
    --teal:         ${colors.discoveryTeal};
    --slate:        ${colors.slate};
    --silver:       ${colors.silver};
    --gold:         ${colors.gold};
    --gold-dim:     ${colors.goldDim};
    --black:        ${colors.black};
    --black-soft:   ${colors.blackSoft};
    --black-card:   ${colors.blackCard};
    --cream:        ${colors.cream};
    --brown:        ${colors.brownMuted};
    --brown-dark:   ${colors.brownDark};
    --brown-faint:  ${colors.brownFaint};
    --green:        ${colors.green};
    --red:          ${colors.red};
    --blue:         ${colors.blue};
  }
`.trim()
