import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabaseRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnon)

export const supabaseAdmin = createClient(supabaseUrl, supabaseRole, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export async function getRetailerBySlug(slug: string) {
  const { data } = await supabase.from('retailers').select('*').eq('slug', slug).eq('active', true).single()
  return data
}

export async function getProductsByRetailer(retailerId: string) {
  const { data } = await supabase.from('products').select('*').eq('retailer_id', retailerId).eq('in_stock', true).order('sort_order')
  return data || []
}

export async function createSession(retailerId: string) {
  const { data } = await supabase.from('sessions').insert({ retailer_id: retailerId, messages: [] }).select('id').single()
  return data?.id || null
}

export async function updateSession(sessionId: string, updates: any) {
  await supabase.from('sessions').update(updates).eq('id', sessionId)
}

export async function logEvent(retailerId: string, sessionId: string | null, eventType: string, payload: any = {}) {
  await supabase.from('events').insert({ retailer_id: retailerId, session_id: sessionId, event_type: eventType, payload })
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
