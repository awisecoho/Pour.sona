export type Vertical = 'coffee' | 'brewery' | 'winery' | 'distillery'

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

// ── Assistant Profile (Phase 1) ───────────────────────────────────────────────
// Per-vendor configuration that drives the guest-facing chat: brand voice,
// question strategy, recommendation rules, CTA copy. Stored as JSONB in
// retailers.assistant_profile. NULL is valid — see lib/agent/profile.ts which
// derives a working profile from the retailer's vertical + existing fields.

export type BrandTone = 'warm' | 'expert' | 'playful' | 'minimalist' | 'reverent'
export type ExperienceStyle = 'bartender' | 'sommelier' | 'barista' | 'spirits-guide' | 'host'

export interface RecommendationRule {
  when_user_says: string                  // free-text trigger phrase, e.g. "light and sessionable"
  prioritize_categories?: string[]        // catalog category names
  avoid_categories?: string[]
}

export interface AssistantProfile {
  // — Brand Identity —
  agent_name: string
  brand_tone: BrandTone
  brand_personality: string               // 1-2 sentences
  experience_style: ExperienceStyle
  preferred_vocab: string[]
  avoid_words: string[]

  // — Product Strategy —
  key_differentiators: string[]
  best_sellers: string[]                  // exact product names
  recommendation_rules: RecommendationRule[]

  // — Question Strategy — (undefined = use category default)
  min_questions?: number
  max_questions?: number
  question_themes: string[]               // ordered subset of category theme IDs

  // — CTA / Fallback —
  cta_primary: string
  cta_secondary: string
  fallback_line: string
}

export interface Retailer {
  id: string
  name: string
  slug: string
  vertical: Vertical
  location?: string
  tagline?: string
  logo_url?: string
  source_url?: string | null
  brand_color: string
  // Vendor site background color (guest storefront bg + logo backdrop). Captured
  // during scraping; null on venues onboarded before the feature.
  bg_color?: string | null
  owner_email: string
  subscription_status: SubscriptionStatus
  subscription_tier?: string
  active: boolean
  website_url?: string
  trial_ends_at?: string | null
  trial_warning_sent_at?: string | null
  stripe_customer_id?: string | null
  story?: string
  culture?: string
  region?: string
  host_persona?: string
  // Vendor Builder fields
  chat_system_prompt?: string | null
  brand_secondary_color?: string | null
  brand_accent_color?: string | null
  brand_font_family?: string | null
  brand_font_url?: string | null
  take_home_json?: Array<{ name: string; description: string; price: number | null; category: string }> | null
  has_take_home?: boolean
  featured_items_json?: Array<{ name: string; reason: string }> | null
  scan_confidence?: number
  personality_preview?: string | null
  // Phase 1 Assistant Profile. NULL = derive defaults from category at runtime.
  assistant_profile?: AssistantProfile | null
  // Venues without an ordering workflow hide the guest order CTA. Only an
  // explicit false disables; null/undefined (pre-migration rows) means enabled.
  ordering_enabled?: boolean | null
  // Soft-delete: NULL = active, a timestamp = archived (hidden + guest-disabled).
  archived_at?: string | null
}

export interface Product {
  id: string
  retailer_id: string
  name: string
  description?: string
  category?: string
  flavor_notes?: string
  price?: number
  sizes?: string
  pairing?: string
  sku?: string
  in_stock: boolean
  sort_order?: number
  origin?: string
  process?: string
  altitude?: string
  roast_date?: string
  abv?: string
  ibu?: string
  style?: string
  tap_handle?: string
  vintage?: string
  appellation?: string
  varietal?: string
  cellar_note?: string
  // Phase 3: per-product image rendered on the guest-facing recommendation card.
  image_url?: string | null
}

export interface Flight {
  id: string
  retailer_id: string
  name: string
  description?: string
  count?: number
  pour_size?: string
  price?: number
  active: boolean
  sort_order?: number
}

export interface Order {
  id: string
  session_id?: string
  retailer_id: string
  customer_email?: string
  customer_name?: string
  blend_name?: string
  items: Array<{ name: string; price?: number; qty?: number }>
  subtotal: number
  status: string
  created_at: string
}

export interface Session {
  id: string
  retailer_id: string
  order_status: 'browsing' | 'recommended' | 'ordered'
  blend_name?: string
  blend_data?: BlendRecommendation | null
  created_at: string
}

export interface BlendRecommendation {
  blendName: string
  recommendationName?: string
  tagline: string
  beans?: Array<{ name: string; ratio: number }>
  roastLevel?: string
  flavorProfile: string[]
  acidity?: string
  body?: string
  bestBrew?: string[]
  storyTitle: string
  story: string
  whyItFitsYou: string
  grindNote?: string
  origin?: string[]
  format?: 'single' | 'flight'
  price?: number | null
  // Each item may be enriched server-side with image_url from the catalog row.
  // The AI never produces image_url; lib/recommendation-enrich.ts fills it in.
  selectedProducts?: Array<{ name: string; why: string; price?: number | null; image_url?: string | null }>
  selectedWines?: Array<{ name: string; why: string }>
  serveNote?: string
  // Phase 3 additions — all optional, all model-generated where present.
  // For distillery flows when the rec is a cocktail built on a vendor's spirit.
  // The vendor's SKU is still selectedProducts[0]; cocktailContext narrates the drink.
  cocktailContext?: {
    cocktailName: string
    cocktailDescription: string
    builtAround?: string          // vendor product name the cocktail features
  } | null
  // Short food / activity pairing line.
  pairing?: string | null
  // One add-on / take-home / next-pour nudge the venue would actually offer.
  upsellSuggestion?: { name: string; reason: string } | null
}

// ── Beverage DNA — taste-intelligence layer ──────────────────────────────────
// Generated alongside each recommendation (parsed in lib/agent/beverage-dna.ts).
// Two audiences, deliberately split (see docs/features/beverage-dna-spec.md):
//   - `persona` is a SILENT, vendor-only analytics classification — one of six
//     canonical names, NEVER rendered to the guest.
//   - everything else is guest-facing: `tasteLine` (the "because…" justification
//     folded into the rec) plus expandable flavor/score detail.

export const BEVERAGE_DNA_PERSONAS = [
  'The Bold Explorer',
  'The Curious Adventurer',
  'The Smooth Traditionalist',
  'The Flavor Hunter',
  'The Comfort Seeker',
  'The Refined Collector',
] as const

export type BeverageDnaPersona = (typeof BEVERAGE_DNA_PERSONAS)[number]

export interface BeverageDNA {
  // Vendor analytics only — NEVER rendered to the guest.
  persona: BeverageDnaPersona
  // Guest-facing.
  tasteLine: string                                      // the "because…" lead-in, in the venue's voice
  flavorProfile: Array<{ axis: string; value: number }>  // 4-6 axes, value 0-1
  confidenceScore: number                                // 0-100, AI's confidence in the match
  discoveryScore: number                                 // 0-100, how adventurous the guest is
  summary: string                                        // 1-2 sentence taste identity
}

// ── Stream payload to the guest UI ───────────────────────────────────────────
// What the /api/chat SSE endpoint emits in its `done` frame. Centralised here
// so both server and client stay in sync as the shape grows.
export interface ChatRecommendationPayload {
  text: string
  recData: BlendRecommendation | null
  chips: string[]
  // From the retailer's resolved AssistantProfile so the UI can render the
  // vendor's chosen CTA copy without a second round-trip.
  ctas?: { primary: string; secondary: string }
  fallbackLine?: string
  // Beverage DNA — null when the model produced no valid block. The rec must
  // never depend on it; the guest UI renders dna.tasteLine + expandable detail.
  dna?: BeverageDNA | null
}
