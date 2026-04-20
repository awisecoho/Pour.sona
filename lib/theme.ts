export interface BrandTheme {
  primary: string
  primaryDim: string
  bg: string
  surface: string
  surfaceHover: string
  border: string
  borderStrong: string
  text: string
  textMuted: string
  textFaint: string
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255
  const g = parseInt(hex.slice(3,5),16)/255
  const b = parseInt(hex.slice(5,7),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h = 0, s = 0
  const l = (max+min)/2
  if (max !== min) {
    const d = max-min
    s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    switch(max) {
      case r: h=((g-b)/d+(g<b?6:0))/6; break
      case g: h=((b-r)/d+2)/6; break
      case b: h=((r-g)/d+4)/6; break
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)]
}

function hslToHex(h: number, s: number, l: number): string {
  s/=100; l/=100
  const k=(n:number)=>(n+h/30)%12
  const a=s*Math.min(l,1-l)
  const f=(n:number)=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))
  return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')
}

export function deriveTheme(brandColor: string): BrandTheme {
  let hex = brandColor?.trim() || '#C9A84C'
  if (!hex.startsWith('#') || hex.length < 7) hex = '#C9A84C'
  try {
    const [h, s, l] = hexToHsl(hex)

    // Primary: use brand color exactly as-is for the accent
    // If very dark (l < 25), lighten it enough to be visible as an accent
    // but NEVER change the hue — preserve brand identity
    const accentL = Math.max(l, 42)
    const primary = accentL !== l ? hslToHex(h, s, accentL) : hex

    // For very desaturated colors, boost saturation for accents
    const accentS = Math.max(s, 45)
    const primaryFinal = (accentL !== l || accentS !== s) ? hslToHex(h, accentS, accentL) : hex

    // Backgrounds: dark, hue-tinted, low saturation
    const bgS = Math.min(s * 0.4, 30)
    const bg = hslToHex(h, bgS, 5)
    const surface = hslToHex(h, bgS, 8)
    const surfaceHover = hslToHex(h, bgS, 11)

    // Text: always near-white, slight hue warmth — NEVER affected by dark brand
    const textS = Math.min(s * 0.1, 8)
    const text = hslToHex(h, textS, 93)
    const textMuted = hslToHex(h, textS, 62)
    const textFaint = hslToHex(h, textS * 0.8, 36)

    return {
      primary: primaryFinal,
      primaryDim: primaryFinal + '99',
      bg,
      surface,
      surfaceHover,
      border: primaryFinal + '28',
      borderStrong: primaryFinal + '55',
      text,
      textMuted,
      textFaint,
    }
  } catch {
    return {
      primary: '#C9A84C', primaryDim: '#C9A84C99',
      bg: '#0a0603', surface: '#0e0b06', surfaceHover: '#120e08',
      border: '#C9A84C28', borderStrong: '#C9A84C55',
      text: '#F5ECD7', textMuted: '#a09070', textFaint: '#6a5a3a',
    }
  }
}

export function getVerticalVoice(vertical: string, categories: string[]) {
  const hasCocktails = categories.some(c => c?.toLowerCase().includes('cocktail'))
  const hasSpirits = categories.some(c => ['spirit','whiskey','bourbon','gin','vodka','rum','tequila','scotch','whisky','moonshine'].some(s => c?.toLowerCase().includes(s)))
  switch(vertical) {
    case 'brewery': return { icon: '🍺', greeting: 'taproom guide', placeholder: 'What are you in the mood for?', cta: 'Find My Beer', singleLabel: 'Your Pour', flightLabel: 'Your Flight' }
    case 'winery': return { icon: '🍷', greeting: 'wine guide', placeholder: 'Tell me about your taste…', cta: 'Find My Wine', singleLabel: 'Your Selection', flightLabel: 'Your Tasting' }
    case 'distillery': return { icon: hasCocktails ? '🍸' : '🥃', greeting: 'spirits guide', placeholder: hasCocktails ? 'Cocktail or spirit — what sounds good?' : 'Tell me what you enjoy…', cta: hasCocktails ? 'Find My Drink' : 'Find My Spirit', singleLabel: hasSpirits ? 'Your Pour' : 'Your Cocktail', flightLabel: 'Your Tasting Flight' }
    case 'coffee': return { icon: '☕', greeting: 'coffee guide', placeholder: 'What are you feeling today?', cta: 'Find My Coffee', singleLabel: 'Your Cup', flightLabel: 'Your Tasting' }
    default: return { icon: '✦', greeting: 'guide', placeholder: 'What sounds good?', cta: 'Get Started', singleLabel: 'Your Selection', flightLabel: 'Your Tasting' }
  }
}
