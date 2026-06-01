// CuvAi brand color tokens — single source of truth.
// Palette derived from the CuvAi logo: teal primary, magenta secondary, cool
// slate darks, silver text. Legacy token NAMES (gold/cream/brown) are kept as
// internal aliases — many components reference var(--gold) etc. — but now hold
// the new cool values. Prefer the semantic aliases (teal/magenta/slate) in new code.
export const colors = {
  // semantic (new)
  teal:        '#3FC6D4',  // primary accent — the "AI" + circuit lines
  tealDim:     '#2A9BA8',
  magenta:     '#B0537E',  // secondary accent — the cuvée wave
  magentaDeep: '#7A4A8C',
  silver:      '#E8EDF2',  // light text — the "CUV"
  slate:       '#0C1018',  // base background
  // legacy aliases (same values, kept so var(--gold) etc. keep working)
  gold:        '#3FC6D4',
  goldDim:     '#2A9BA8',
  black:       '#0C1018',
  blackSoft:   '#10141D',
  blackCard:   '#161C28',
  cream:       '#E8EDF2',
  brownMuted:  '#3A4456',
  brownDark:   '#2A3242',
  brownFaint:  '#6B7588',
  green:       '#5ecf8a',
  red:         '#e07070',
  blue:        '#7ec8e3',
} as const

// CSS custom property declarations — injected into :root via RootLayout.
export const cssVars = `
  :root {
    --teal:        ${colors.teal};
    --teal-dim:    ${colors.tealDim};
    --magenta:     ${colors.magenta};
    --magenta-deep:${colors.magentaDeep};
    --silver:      ${colors.silver};
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
