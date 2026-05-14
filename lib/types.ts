export type Vertical = 'coffee' | 'brewery' | 'winery' | 'distillery'

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

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
  selectedProducts?: Array<{ name: string; why: string }>
  selectedWines?: Array<{ name: string; why: string }>
}
