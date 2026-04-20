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

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch { return '' }
}

// Use AI vision to extract brand colors from a screenshot
async function extractColorsViaScreenshot(url: string): Promise<{ primary: string; logoUrl: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const fnUrl = supabaseUrl.replace('/rest/v1', '') + '/functions/v1/extract-brand-colors'
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return {
      primary: data.colors.primary || '#C9A84C',
      logoUrl: data.colors.logoUrl || '',
    }
  } catch { return null }
}

function extractMenuLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const menuKeywords = ['menu', 'beer', 'tap', 'drink', 'wine', 'coffee', 'food', 'brew', 'cocktail', 'spirits', 'spirit', 'whiskey', 'bourbon', 'gin', 'vodka', 'rum', 'list', 'selection', 'product', 'our-spirits', 'craft']
  const skipKeywords = ['cart', 'checkout', 'login', 'account', 'privacy', 'terms', 'facebook', 'instagram', 'twitter', 'mailto:', 'tel:', 'wedding', 'press', 'contact', 'about', 'club', 'class', 'party']
  const hrefRegex = /href=["']([^"'#?]+)["']/gi
  const seen = new Set<string>()
  const links: Array<{ url: string; score: number }> = []
  let match
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim()
    if (!raw || raw.startsWith('javascript')) continue
    let full: string
    try { full = new URL(raw, base.origin).toString() } catch { continue }
    if (!full.startsWith(base.origin)) continue
    if (seen.has(full)) continue
    if (skipKeywords.some(k => full.toLowerCase().includes(k))) continue
    seen.add(full)
    const path = full.toLowerCase()
    const score = menuKeywords.reduce((s, kw) => path.includes(kw) ? s + 2 : s, 0)
    if (score > 0) links.push({ url: full, score })
  }
  return links.sort((a, b) => b.score - a.score).slice(0, 8).map(l => l.url)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function extractSignals(rootUrl: string) {
  const rootHtml = await fetchPage(rootUrl)
  if (!rootHtml) throw new Error('Could not fetch website')

  const title = rootHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = rootHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''

  // Run screenshot color extraction in parallel with page crawl
  const [screenshotColors, subpageTexts] = await Promise.all([
    extractColorsViaScreenshot(rootUrl),
    (async () => {
      const subpageUrls = extractMenuLinks(rootHtml, rootUrl)
      const results: string[] = []
      const pages = await Promise.allSettled(
        subpageUrls.map(async (url) => {
          const html = await fetchPage(url)
          if (html) return { url, text: stripHtml(html).slice(0, 4000) }
          return null
        })
      )
      for (const p of pages) {
        if (p.status === 'fulfilled' && p.value) {
          results.push(`--- Page: ${p.value.url} ---\n${p.value.text}`)
        }
      }
      return results
    })()
  ])

  const rootText = stripHtml(rootHtml).slice(0, 3000)
  const allText = [rootText, ...subpageTexts].join('\n\n').slice(0, 16000)

  return {
    title,
    metaDesc,
    logoUrl: screenshotColors?.logoUrl || '',
    brandColor: screenshotColors?.primary || '',
    text: allText,
    sourceUrl: rootUrl,
  }
}

export async function normalizeToRetailerDraft(signals: Awaited<ReturnType<typeof extractSignals>>) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = `You are converting vendor website content into structured data for a beverage recommendation app.

VERTICAL DETECTION RULES:
- distillery/spirits/whiskey/bourbon/rye/gin/vodka/rum/moonshine → vertical = "distillery"
- brewery/brewed/craft beer/IPA/stout/lager/ale/tap → vertical = "brewery"
- winery/vineyard/wine/varietal/vintage → vertical = "winery"
- coffee/roaster/espresso/latte/pour over → vertical = "coffee"
- NEVER default to brewery.

COLORS ALREADY EXTRACTED: ${signals.brandColor ? `primary brand color = ${signals.brandColor}` : 'not detected — infer from content or use #C9A84C'}
LOGO: ${signals.logoUrl ? `detected = ${signals.logoUrl}` : 'not detected'}

Extract ALL products. For cocktails use category = "Cocktail". Include full specs.

Return ONLY valid JSON:
{
  "retailer": { "name": "", "slug": "", "vertical": "distillery|brewery|winery|coffee", "location": "", "tagline": "", "logo_url": "${signals.logoUrl || ''}", "brand_color": "${signals.brandColor || '#C9A84C'}" },
  "products": [{ "name": "", "description": "", "category": "", "flavor_notes": "", "price": null, "style": "", "abv": "", "ibu": "", "in_stock": true, "sort_order": 0 }],
  "flights": [{ "name": "", "description": "", "count": 4, "pour_size": "4oz", "price": 0, "active": true, "sort_order": 0 }]
}

Site: ${signals.sourceUrl}
Title: ${signals.title}
Description: ${signals.metaDesc}

Content:
${signals.text}`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(clean)

  // Always trust the screenshot-extracted color over AI guess
  if (signals.brandColor) parsed.retailer.brand_color = signals.brandColor
  if (signals.logoUrl) parsed.retailer.logo_url = signals.logoUrl

  return parsed
}

export async function createDraftFromUrl(url: string) {
  const supabase = getAdmin()
  const signals = await extractSignals(url)
  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert({ source_type: 'url', source_value: url, status: 'uploaded', raw_text: signals.text.slice(0, 10000), raw_json: { ...signals, text: signals.text.slice(0, 2000) } })
    .select('id').single()

  const normalized = await normalizeToRetailerDraft(signals)
  const { data: existing } = await supabase.from('retailers').select('slug')
  const slug = ensureUniqueSlug(normalized.retailer.slug || normalized.retailer.name, (existing || []).map((r: any) => r.slug))
  normalized.retailer.slug = slug
  normalized.retailer.brand_color = normalized.retailer.brand_color || '#C9A84C'

  const { data: draft } = await supabase
    .from('retailer_drafts')
    .insert({
      ingestion_job_id: job?.id, status: 'draft',
      name: normalized.retailer.name, slug,
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
      name: draft.name, slug: draft.slug, vertical: draft.vertical,
      location: draft.location, tagline: draft.tagline,
      logo_url: draft.logo_url, brand_color: draft.brand_color || '#C9A84C',
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
