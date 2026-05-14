// Brand color tokens — single source of truth.
// Use CSS custom properties (var(--gold) etc.) in components where possible.
// Use these JS constants in inline styles or SSR-rendered email HTML.
export const colors = {
  gold:        '#C9A84C',
  goldDim:     '#a07830',
  black:       '#060403',
  blackSoft:   '#0a0805',
  blackCard:   '#0e0b06',
  cream:       '#F5ECD7',
  brownMuted:  '#4a3a1a',
  brownDark:   '#3a2a0a',
  brownFaint:  '#6a5a3a',
  green:       '#5ecf8a',
  red:         '#e07070',
  blue:        '#7ec8e3',
} as const

// CSS custom property declarations — injected into :root via RootLayout.
export const cssVars = `
  :root {
    --gold:        ${colors.gold};
    --gold-dim:    ${colors.goldDim};
    --black:       ${colors.black};
    --black-soft:  ${colors.blackSoft};
    --black-card:  ${colors.blackCard};
    --cream:       ${colors.cream};
    --brown:       ${colors.brownMuted};
    --brown-dark:  ${colors.brownDark};
    --brown-faint: ${colors.brownFaint};
    --green:       ${colors.green};
    --red:         ${colors.red};
    --blue:        ${colors.blue};
  }
`.trim()
