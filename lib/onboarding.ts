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

// Fetch a single page
async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// Extract all internal links from HTML, scored by menu-relevance
function extractMenuLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const menuKeywords = ['menu', 'beer', 'tap', 'drink', 'wine', 'coffee', 'food', 'brew', 'cocktail', 'spirits', 'list', 'selection', 'offering', 'product']
  const skipKeywords = ['cart', 'checkout', 'login', 'account', 'contact', 'privacy', 'terms', 'facebook', 'instagram', 'twitter', 'mailto', 'tel:']

  const hrefRegex = /href=["']([^"'#?]+)["']/gi
  const seen = new Set<string>()
  const links: Array<{ url: string; score: number }> = []
  let match

  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim()
    if (!raw || raw.startsWith('javascript')) continue

    let full: string
    try {
      full = new URL(raw, base.origin).toString()
    } catch { continue }

    // Must be same domain
    if (!full.startsWith(base.origin)) continue
    if (seen.has(full)) continue
    if (skipKeywords.some(k => full.toLowerCase().includes(k))) continue
    seen.add(full)

    const path = full.toLowerCase()
    const score = menuKeywords.reduce((s, kw) => path.includes(kw) ? s + 2 : s, 0)
    links.push({ url: full, score })
  }

  // Return top 6 most relevant links
  return links
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(l => l.url)
}

// Strip HTML to plain text
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Multi-page crawl and signal extraction
export async function extractSignals(rootUrl: string) {
  const rootHtml = await fetchPage(rootUrl)
  if (!rootHtml) throw new Error('Could not fetch website')

  const title = rootHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = rootHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
  const ogImage = rootHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''

  // Find menu-relevant subpages
  const subpageUrls = extractMenuLinks(rootHtml, rootUrl)

  // Crawl subpages in parallel
  const subpageTexts: string[] = []
  const crawled: string[] = [rootUrl]

  const pages = await Promise.allSettled(
    subpageUrls.map(async (url) => {
      const html = await fetchPage(url)
      if (html) {
        crawled.push(url)
        return { url, text: stripHtml(html).slice(0, 4000) }
      }
      return null
    })
  )

  for (const p of pages) {
    if (p.status === 'fulfilled' && p.value) {
      subpageTexts.push(`--- Page: ${p.value.url} ---\n${p.value.text}`)
    }
  }

  const rootText = stripHtml(rootHtml).slice(0, 3000)
  const allText = [rootText, ...subpageTexts].join('\n\n').slice(0, 14000)

  return { title, metaDesc, ogImage, text: allText, sourceUrl: rootUrl, crawledPages: crawled }
}

export async function normalizeToRetailerDraft(signals: Awaited<ReturnType<typeof extractSignals>>) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = `You are converting vendor website content into structured onboarding data for a beverage recommendation app.

The content below was scraped from MULTIPLE PAGES of the vendor website including their menu, tap list, and product pages.
Extract ALL products/items you can find across all pages.

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
- Extract EVERY product, beer, coffee, or wine item you can find — be thorough
- Include ABV, IBU, style for beers when available
- Include flavor notes, origin, roast for coffee when available
- If price is unclear use null
- If brand color unknown use "#C9A84C"
- Propose 1-3 sensible starter flights based on the menu
- slug should be lowercase-hyphenated business name
- Return valid JSON only, no code fences

Pages crawled: ${signals.crawledPages.join(', ')}

Website content:
title: ${signals.title}
description: ${signals.metaDesc}
source: ${signals.sourceUrl}

--- Full text from all pages ---
${signals.text}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(clean)
}

export async function createDraftFromUrl(url: string) {
  const supabase = getAdmin()
  const signals = await extractSignals(url)

  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert({
      source_type: 'url',
      source_value: url,
      status: 'uploaded',
      raw_text: signals.text.slice(0, 10000),
      raw_json: { ...signals, text: signals.text.slice(0, 2000) }
    })
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
    await supabase.from('ingestion_jobs')
      .update({ status: 'parsed', normalized_json: normalized })
      .eq('id', job.id)
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