// Phase 2: type definitions for shared signal contract.
// Crawling logic remains in lib/onboarding.ts extractSignals().

export interface RawSignals {
  title: string
  metaDesc: string
  logoUrl: string
  brandColor: string
  menuText: string
  storyText: string
  eventsText: string
  rootText: string
  sourceUrl: string
  crawledUrls: string[]
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
  research_confidence: number
}
