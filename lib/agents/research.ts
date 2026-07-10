// Phase 2: type definitions for shared signal contract.
// Crawling logic remains in lib/onboarding.ts extractSignals().

/** A PDF or image menu fetched directly from the vendor's site. */
export interface MenuAsset {
  url: string
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
  base64: string
}

export interface RawSignals {
  title: string
  metaDesc: string
  logoUrl: string
  brandColor: string
  /** The site's actual background color (body/theme-color), used as the guest
   *  storefront background + logo backdrop. May be a pale tone (unlike
   *  brandColor, which is filtered to a usable accent). '' when undetected. */
  bgColor: string
  menuText: string
  storyText: string
  eventsText: string
  rootText: string
  sourceUrl: string
  crawledUrls: string[]
  /** PDF or image menus linked from the homepage — empty array when none found. */
  menuAssets: MenuAsset[]
}

export interface VendorEvent {
  name: string
  description: string
  event_type: 'upcoming' | 'recurring' | 'seasonal' | 'unknown'
  event_date: string | null
  recurrence_pattern: string | null
  source_url: string
  visible_to_guests: boolean
}

export interface BrandData {
  story: string
  culture: string
  region: string
  voice: string
  mission_statement: string
  brand_personality: string[]
  brand_voice_tone: string
  signature_items: string[]
  /** Vendor-specific or regional terms the AI should adopt when talking to
   *  guests (e.g. "flight", "growler", a house nickname for a category). */
  preferred_vocab: string[]
  research_confidence: number
}
