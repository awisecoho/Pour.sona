import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ensureUniqueSlug } from './slug'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`)
  return res.text()
}

export function extractSignals(html: string, url: string) {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000)
  return { title, metaDesc, ogImage, text, sourceUrl: url }
}

export async function normalizeToRetailerDraft(signals: ReturnType<typeof extractSignals>) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You are converting vendor website content into structured onboarding data for a beverage recommendation app.

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "retailer": {
    "name": "",
    "slug": "",
    "vertical": "coffee|brewery|winery",
    "location": "",
    "tagline": "",
    "logo_url": "",
    "brand_color": ""
  },
  "products": [
    { "name": "", "description": "", "category": "", "flavor_notes": "", "price": null, "style": "", "abv": "", "ibu": "", "in_stock": true, "sort_order": 0 }
  ],
  "flights": [
    { "name": "", "description": "", "count": 4, "pour_size": "4oz", "price": 0, "active": true, "sort_order": 0 }
  ]
}

Rules:
- vertical must be exactly: coffee, brewery, or winery
- Extract only real menu/catalog items
- If price is unclear use null
- If brand color unknown use "#C9A84C"
- Propose 0-3 sensible starter flights
- slug should be lowercase-hyphenated business name
- Return valid JSON only, no code fences

Website data:
title: ${signals.title}
description: ${signals.metaDesc}
og:image: ${signals.ogImage}
source: ${signals.sourceUrl}
text: ${signals.text.slice(0, 8000)}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(clean)
}

export async function createDraftFromUrl(url: string) {
  const supabase = getAdmin()
  const html = await fetchHtml(url)
  const signals = extractSignals(html, url)

  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert({ source_type: 'url', source_value: url, status: 'uploaded', raw_text: signals.text, raw_json: signals })
    .select('id').single()

  const normalized = await normalizeToRetailerDraft(signals)
  const { data: existing } = await supabase.from('retailers').select('slug')
  const slug = ensureUniqueSlug(normalized.retailer.slug || normalized.retailer.name, (existing || []).map((r: any) => r.slug))
  normalized.retailer.slug = slug
  normalized.retailer.brand_color = normalized.retailer.brand_color || '#C9A84C'

  const { data: draft } = await supabase
    .from('retailer_drafts')
    .insert({
      ingestion_job_id: job?.id,
      status: 'draft',
      name: normalized.retailer.name,
      slug,
      vertical: normalized.retailer.vertical,
      location: normalized.retailer.location || null,
      tagline: normalized.retailer.tagline || null,
      logo_url: normalized.retailer.logo_url || null,
      brand_color: normalized.retailer.brand_color,
      source_url: url,
      menu_json: normalized.products,
      flight_json: normalized.flights,
      parsed_json: normalized,
    })
    .select('*').single()

  if (job?.id) {
    await supabase.from('ingestion_jobs').update({ status: 'parsed', normalized_json: normalized }).eq('id', job.id)
  }
  return draft
}

export async function publishDraft(draftId: string, ownerEmail?: string) {
  const supabase = getAdmin()
  const { data: draft } = await supabase.from('retailer_drafts').select('*').eq('id', draftId).single()
  if (!draft) throw new Error('Draft not found')

  const { data: retailer } = await supabase
    .from('retailers')
    .insert({
      name: draft.name,
      slug: draft.slug,
      vertical: draft.vertical,
      location: draft.location,
      tagline: draft.tagline,
      logo_url: draft.logo_url,
      brand_color: draft.brand_color || '#C9A84C',
      owner_email: ownerEmail || `owner+${draft.slug}@poursona.app`,
      active: true,
    })
    .select('*').single()

  if (!retailer) throw new Error('Failed to create retailer')

  const products = Array.isArray(draft.menu_json) ? draft.menu_json : []
  if (products.length) {
    await supabase.from('products').insert(
      products.map((p: any, i: number) => ({
        retailer_id: retailer.id, name: p.name, description: p.description || null,
        category: p.category || null, flavor_notes: p.flavor_notes || null,
        price: p.price ?? null, style: p.style || null, abv: p.abv || null,
        ibu: p.ibu || null, in_stock: p.in_stock ?? true, sort_order: i,
      }))
    )
  }

  const flights = Array.isArray(draft.flight_json) ? draft.flight_json : []
  if (flights.length) {
    await supabase.from('flights').insert(
      flights.map((f: any, i: number) => ({
        retailer_id: retailer.id, name: f.name, description: f.description || null,
        count: f.count ?? 4, pour_size: f.pour_size || '4oz',
        price: f.price ?? 0, active: f.active ?? true, sort_order: i,
      }))
    )
  }

  await supabase.from('retailer_drafts').update({ status: 'published' }).eq('id', draft.id)
  return retailer
}