export type Vertical = 'coffee' | 'brewery' | 'winery' | 'distillery'

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
  website_url?: string
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
