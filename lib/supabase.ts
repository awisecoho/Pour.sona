type RetailerBootstrap = {
  retailer: Retailer
  flights: unknown[]
  sessionId: string | null
}

const retailerBootstrapBySlug = new Map<string, RetailerBootstrap>()
const sessionIdByRetailerId = new Map<string, string | null>()

export const supabase = null as any
export const supabaseAdmin = null as any

async function fetchRetailerBootstrap(slug: string) {
  const response = await fetch(`/api/retailer?slug=${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Retailer bootstrap failed with status ${response.status}`)
  }

  const payload = (await response.json()) as RetailerBootstrap
  retailerBootstrapBySlug.set(slug, payload)
  sessionIdByRetailerId.set(payload.retailer.id, payload.sessionId)
  return payload
}

export async function getRetailerBySlug(slug: string) {
  const cached = retailerBootstrapBySlug.get(slug)
  if (cached) return cached.retailer

  const payload = await fetchRetailerBootstrap(slug)
  return payload?.retailer || null
}

export async function getProductsByRetailer(retailerId: string) {
  void retailerId
  return []
}

export async function createSession(retailerId: string) {
  return sessionIdByRetailerId.get(retailerId) || null
}

export async function updateSession(sessionId: string, updates: any) {
  void sessionId
  void updates
}

export async function logEvent(retailerId: string, sessionId: string | null, eventType: string, payload: any = {}) {
  void retailerId
  void sessionId
  void eventType
  void payload
}

export type Vertical = 'coffee' | 'brewery' | 'winery'

export interface Retailer {
  id: string
  name: string
  slug: string
  vertical: Vertical
  location?: string
  tagline?: string
  logo_url?: string
  brand_color: string
  owner_email: string
  subscription_status: string
  subscription_tier: string
  active: boolean
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
}

export interface BlendRecommendation {
  blendName: string
  recommendationName?: string
  tagline: string
  beans?: Array<{ name: string; ratio: number }>
  roastLevel?: string
  flavorProfile: string[]
  acidity: string
  body: string
  bestBrew: string[]
  storyTitle: string
  story: string
  whyItFitsYou: string
  grindNote: string
  origin?: string[]
  selectedProducts?: Array<{ name: string; why: string }>
  selectedWines?: Array<{ name: string; why: string }>
}
