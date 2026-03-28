// lib/supabase.ts
// ─── Supabase clients ────────────────────────────────────────────────────────
// Two clients:
//   supabase       → browser / API routes (anon key, respects RLS)
//   supabaseAdmin  → server-only (service role, bypasses RLS for admin ops)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Public client — use in components and API routes for customer-facing ops
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Admin client — use ONLY in API routes (server-side), never in components
export const supabaseAdmin = createClient(supabaseUrl, supabaseRole, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────────

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
  // Coffee
  origin?: string
  process?: string
  altitude?: string
  roast_date?: string
  // Brewery
  abv?: string
  ibu?: string
  style?: string
  tap_handle?: string
  // Winery
  vintage?: string
  appellation?: string
  varietal?: string
  cellar_note?: string
}

export interface Session {
  id: string
  retailer_id: string
  customer_name?: string
  customer_email?: string
  messages: Message[]
  blend_name?: string
  blend_data?: BlendRecommendation
  order_status: string
  completed: boolean
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
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
  // Brewery
  selectedProducts?: Array<{ name: string; why: string }>
  // Winery
  selectedWines?: Array<{ name: string; why: string }>
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export async function getRetailerBySlug(slug: string): Promise<Retailer | null> {
  const { data, error } = await supabase
    .from('retailers')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (error) return null
  return data
}

export async function getProductsByRetailer(retailerId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('retailer_id', retailerId)
    .eq('in_stock', true)
    .order('sort_order')
  if (error) return []
  return data || []
}

export async function createSession(retailerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ retailer_id: retailerId, messages: [] })
    .select('id')
    .single()
  if (error) return null
  return data.id
}

export async function updateSession(sessionId: string, updates: Partial<Session>) {
  await supabase.from('sessions').update(updates).eq('id', sessionId)
}

export async function logEvent(
  retailerId: string,
  sessionId: string | null,
  eventType: string,
  payload: Record<string, unknown> = {}
) {
  await supabase.from('events').insert({
    retailer_id: retailerId,
    session_id: sessionId,
    event_type: eventType,
    payload
  })
}
