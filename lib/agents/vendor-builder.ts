/**
 * Vendor Builder Agent
 *
 * Runs after the initial catalog scan. Given the raw signals already collected
 * from the vendor website, this agent produces:
 *   - A custom AI system prompt that matches the venue's exact tone/voice
 *   - Extended brand palette (secondary + accent colors)
 *   - Google-Fonts-compatible font suggestion
 *   - Take-home / packaged goods detection
 *   - Seasonal / featured item flags
 *   - Confidence score (low → trigger manual-entry prompt)
 *   - 1-sentence personality preview for the post-scan UI
 *
 * It never overwrites fields that have been manually edited — the caller is
 * responsible for implementing that diff-based guard.
 */

import Anthropic from '@anthropic-ai/sdk'
import { sanitizePromptInput } from '@/lib/security'

export interface VendorBuilderInput {
  /** Retailer name */
  name: string
  vertical: string
  location: string | null
  tagline: string | null
  /** Raw site text already collected by the onboarding scan */
  menuText: string
  storyText: string
  rootText: string
  sourceUrl: string
  /** Catalog already extracted */
  products: Array<{ name: string; description?: string; category?: string; price?: number }>
  /** Already extracted brand data */
  brandColor: string | null
  story: string | null
  culture: string | null
  voice: string | null
  brand_personality: string[]
  brand_voice_tone: string
}

export interface TakeHomeItem {
  name: string
  description: string
  price: number | null
  category: string
}

export interface FeaturedItem {
  name: string
  reason: string // e.g. "seasonal", "new release", "staff pick"
}

export interface VendorBuilderOutput {
  /** Full system prompt for the consumer chat AI — persona + instructions only,
   *  catalog is injected separately by buildSystemPrompt */
  chat_system_prompt: string
  /** The venue's true primary identity color. Used only when the scraped primary
   *  was missing or rejected (e.g. a pale background tone). */
  brand_primary_color: string | null
  /** Hex colors for the storefront palette */
  brand_secondary_color: string | null
  brand_accent_color: string | null
  /** Google Fonts family name, e.g. "Playfair Display" */
  brand_font_family: string | null
  /** Google Fonts embed URL */
  brand_font_url: string | null
  /** Packaged / take-home items detected */
  take_home_items: TakeHomeItem[]
  has_take_home: boolean
  /** Seasonal or featured items */
  featured_items: FeaturedItem[]
  /** 0–1 confidence the site had enough content for good results */
  scan_confidence: number
  /** 1-sentence preview shown post-scan: "Your agent sounds like…" */
  personality_preview: string
}

function textFromContent(content: any[]): string {
  return content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
}

function extractJson(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.search(/[{[]/)
  if (start < 0) throw new Error('No JSON found')
  const open = cleaned[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inStr) { esc = !esc && ch === '\\'; if (!esc && ch === '"') inStr = false; continue }
    if (ch === '"') { inStr = true }
    else if (ch === open) depth++
    else if (ch === close && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1))
  }
  throw new Error('Incomplete JSON')
}

/** Derive a darkened / lightened hex from a base hex for palette rounding */
function shiftHex(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amount))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

const GOOGLE_FONT_MAP: Record<string, { family: string; url: string }> = {
  'playfair display': { family: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap' },
  'cormorant garamond': { family: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=swap' },
  'lora': { family: 'Lora', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600&display=swap' },
  'eb garamond': { family: 'EB Garamond', url: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;600&display=swap' },
  'merriweather': { family: 'Merriweather', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap' },
  'dm serif display': { family: 'DM Serif Display', url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap' },
  'josefin sans': { family: 'Josefin Sans', url: 'https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600&display=swap' },
  'raleway': { family: 'Raleway', url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;600&display=swap' },
  'montserrat': { family: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600&display=swap' },
  'inter': { family: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap' },
}

function resolveFontUrl(family: string | null): { family: string | null; url: string | null } {
  if (!family) return { family: null, url: null }
  const key = family.toLowerCase().trim()
  const match = GOOGLE_FONT_MAP[key]
  if (match) return match
  // Partial match
  for (const [k, v] of Object.entries(GOOGLE_FONT_MAP)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  // Fallback to safe default per vertical style
  return { family: 'Playfair Display', url: GOOGLE_FONT_MAP['playfair display'].url }
}

function buildFallback(input: VendorBuilderInput): VendorBuilderOutput {
  return {
    chat_system_prompt: '',
    brand_primary_color: null,
    brand_secondary_color: input.brandColor ? shiftHex(input.brandColor, -30) : null,
    brand_accent_color: input.brandColor ? shiftHex(input.brandColor, 40) : null,
    brand_font_family: null,
    brand_font_url: null,
    take_home_items: [],
    has_take_home: false,
    featured_items: [],
    scan_confidence: 0.3,
    personality_preview: `Your guide knows every item at ${input.name} and will help guests find the perfect selection.`,
  }
}

export async function runVendorBuilder(input: VendorBuilderInput): Promise<VendorBuilderOutput> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const safeName    = sanitizePromptInput(input.name)
  const safeVoice   = sanitizePromptInput(input.voice || '')
  const safeStory   = sanitizePromptInput(input.story || '')
  const safeCulture = sanitizePromptInput(input.culture || '')
  const safeTagline = sanitizePromptInput(input.tagline || '')
  const topProducts = input.products.slice(0, 12).map(p => `${sanitizePromptInput(p.name)}${p.category ? ` (${p.category})` : ''}`).join(', ')

  const allText = [input.rootText, input.storyText, input.menuText]
    .filter(Boolean).join('\n\n').slice(0, 8000)

  const prompt = `You are an AI personality designer for beverage venue guest experiences.
Analyze this venue's website content and generate a complete brand intelligence profile.

VENUE:
Name: ${safeName}
Vertical: ${input.vertical}
Location: ${input.location || 'unknown'}
Tagline: ${safeTagline}
Brand voice tone: ${input.voice || input.brand_voice_tone || 'warm, knowledgeable'}
Story: ${safeStory}
Culture/vibe: ${safeCulture}
Brand personality traits: ${input.brand_personality.join(', ') || 'not detected'}
Detected primary color (may be a background tone, treat skeptically): ${input.brandColor || 'none detected'}
Top products: ${topProducts}

WEBSITE CONTENT:
${allText}

Generate a complete brand intelligence JSON. The chat_system_prompt must:
1. Open as a natural staff member — NOT a bot or "AI assistant"
2. Match the venue's exact tone (formal winery vs casual taproom vs sophisticated distillery)
3. Instruct the AI to ask ONE simple question at a time (never stack or combine questions in a single message), keep each message to 1-2 short sentences, and ask at most TWO brief questions before making ONE confident recommendation
4. Include specific conversation openers for when guests say START
5. Know to offer a "take-home" branch naturally if the venue sells packaged goods
6. Reference the venue's story/culture where natural
7. Never use generic phrases like "Great choice!" or "I'd be happy to help"
8. For fonts: suggest the closest GOOGLE FONTS equivalent to the venue's apparent typography style

Return ONLY valid JSON:
{
  "chat_system_prompt": "Full persona + conversation instructions (2-4 paragraphs). Write in second person as instructions to the AI. Be specific to this venue — name the place, reference actual things about them.",
  "brand_primary_color": "#hex — the venue's TRUE primary identity color (the color a guest associates with this brand: its logo/sign color, woody/earthy for a rustic distillery, etc.). This renders as an accent on a DARK storefront, so it must be a saturated, mid-to-rich tone — NEVER near-white, cream, or near-black. If the detected primary above is a pale background, IGNORE it and infer the real brand color from the logo, imagery, and vertical.",
  "brand_secondary_color": "#hex or null — a complementary color that works with the primary, for UI accents",
  "brand_accent_color": "#hex or null — a lighter highlight/contrast color",
  "brand_font_suggestion": "one of: Playfair Display, Cormorant Garamond, Lora, EB Garamond, Merriweather, DM Serif Display, Josefin Sans, Raleway, Montserrat, Inter — choose based on venue personality",
  "take_home_items": [
    { "name": "product name", "description": "short description", "price": null, "category": "spirits|wine|beer|merch|gift" }
  ],
  "has_take_home": true,
  "featured_items": [
    { "name": "product name", "reason": "seasonal|new release|staff pick|limited edition" }
  ],
  "scan_confidence": 0.85,
  "personality_preview": "One sentence, e.g. 'Your guide speaks like a passionate craft brewer who makes everyone feel like a regular.'"
}

Rules:
- scan_confidence: 0.9+ = rich content, clear personality; 0.6-0.89 = decent content; below 0.6 = sparse site
- take_home_items: only include if the site explicitly sells packaged goods, bottles, or merch to take away
- featured_items: only items that appear seasonal, new, or highlighted on the site
- brand_secondary_color: if primary is dark, secondary should be mid-tone; if primary is light, secondary darker
- The chat_system_prompt is the most important field — make it genuinely venue-specific`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = textFromContent(msg.content as any[])
    const data = extractJson(raw)

    const fontKey = (data.brand_font_suggestion || '').toLowerCase().trim()
    const { family: fontFamily, url: fontUrl } = resolveFontUrl(fontKey)

    const takeHomeItems: TakeHomeItem[] = Array.isArray(data.take_home_items)
      ? data.take_home_items.slice(0, 10).map((item: any) => ({
          name: String(item.name || ''),
          description: String(item.description || ''),
          price: typeof item.price === 'number' ? item.price : null,
          category: String(item.category || 'other'),
        }))
      : []

    const featuredItems: FeaturedItem[] = Array.isArray(data.featured_items)
      ? data.featured_items.slice(0, 8).map((item: any) => ({
          name: String(item.name || ''),
          reason: String(item.reason || 'featured'),
        }))
      : []

    const confidence = typeof data.scan_confidence === 'number'
      ? Math.max(0, Math.min(1, data.scan_confidence))
      : 0.5

    const primaryColor = data.brand_primary_color && /^#[0-9a-f]{6}$/i.test(data.brand_primary_color)
      ? data.brand_primary_color
      : null

    // Derive palette fallbacks from primary color if AI didn't provide
    const paletteBase = primaryColor || input.brandColor
    const secondary = data.brand_secondary_color && /^#[0-9a-f]{6}$/i.test(data.brand_secondary_color)
      ? data.brand_secondary_color
      : paletteBase ? shiftHex(paletteBase, -35) : null

    const accent = data.brand_accent_color && /^#[0-9a-f]{6}$/i.test(data.brand_accent_color)
      ? data.brand_accent_color
      : paletteBase ? shiftHex(paletteBase, 50) : null

    return {
      chat_system_prompt: typeof data.chat_system_prompt === 'string' && data.chat_system_prompt.length > 50
        ? data.chat_system_prompt
        : '',
      brand_primary_color: primaryColor,
      brand_secondary_color: secondary,
      brand_accent_color: accent,
      brand_font_family: fontFamily,
      brand_font_url: fontUrl,
      take_home_items: takeHomeItems,
      has_take_home: Boolean(data.has_take_home) || takeHomeItems.length > 0,
      featured_items: featuredItems,
      scan_confidence: confidence,
      personality_preview: typeof data.personality_preview === 'string' && data.personality_preview.trim()
        ? data.personality_preview.trim()
        : `Your guide knows every item at ${safeName} and will help guests find the perfect selection.`,
    }
  } catch (err) {
    console.error('[VendorBuilder] failed:', err instanceof Error ? err.message : String(err))
    return buildFallback(input)
  }
}
