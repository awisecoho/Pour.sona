import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ensureUniqueSlug } from './slug'
import { extractBrand } from './agents/brand'
import { extractEvents } from './agents/events'
import { generateHostPersona } from './agents/host'
import type { RawSignals } from './agents/research'

const EVENT_KEYWORDS = ['events','calendar','happenings','upcoming','whats-on','live','schedule','entertainment']

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

async function extractColorsViaScreenshot(url: string): Promise<{ primary: string; logoUrl: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const fnUrl = supabaseUrl.replace('https://', 'https://') + '/functions/v1/extract-brand-colors'
    const baseUrl = new URL(supabaseUrl)
    const fnFullUrl = `https://${baseUrl.hostname}/functions/v1/extract-brand-colors`
    const res = await fetch(fnFullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return { primary: data.colors.primary || '#C9A84C', logoUrl: data.colors.logoUrl || '' }
  } catch { return null }
}

function scoreLink(url: string, base: string): number {
  const path = url.toLowerCase()
  const menuKeywords = ['menu','beer','tap','drink','wine','coffee','cocktail','spirits','spirit','whiskey','bourbon','gin','vodka','rum','product','our-spirits','craft','moonshine','barrel']
  const storyKeywords = ['about','story','our-story','history','team','people','founder','philosophy','process','craft','heritage','mission','who-we-are','tradition','distill','brew','winemaking']
  const eventKeywords = EVENT_KEYWORDS
  const skipKeywords = ['cart','checkout','login','account','privacy','terms','facebook','instagram','twitter','mailto:','tel:','wedding','press','contact','club','class','party','bottling','shop','buy','order']
  if (!url.startsWith(base)) return -1
  if (skipKeywords.some(k => path.includes(k))) return -1
  const menuScore = menuKeywords.reduce((s, kw) => path.includes(kw) ? s + 3 : s, 0)
  const storyScore = storyKeywords.reduce((s, kw) => path.includes(kw) ? s + 2 : s, 0)
  const eventScore = eventKeywords.reduce((s, kw) => path.includes(kw) ? s + 2 : s, 0)
  return menuScore + storyScore + eventScore
}

function extractLinks(html: string, baseUrl: string): Array<{ url: string; score: number; type: 'menu' | 'story' | 'events' | 'both' }> {
  const base = new URL(baseUrl).origin
  const hrefRegex = /href=["']([^"'#?]+)["']/gi
  const seen = new Set<string>()
  const links: Array<{ url: string; score: number; type: 'menu' | 'story' | 'events' | 'both' }> = []
  let match
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim()
    if (!raw || raw.startsWith('javascript')) continue
    let full: string
    try { full = new URL(raw, base).toString() } catch { continue }
    if (seen.has(full)) continue
    seen.add(full)
    const score = scoreLink(full, base)
    if (score <= 0) continue
    const path = full.toLowerCase()
    const isMenu = ['menu','beer','tap','spirits','product','moonshine','cocktail','wine','coffee'].some(k => path.includes(k))
    const isStory = ['about','story','team','founder','philosophy','heritage','history','process'].some(k => path.includes(k))
    const isEvents = EVENT_KEYWORDS.some(k => path.includes(k))
    const type = (isMenu && isStory) || (isMenu && isEvents) || (isStory && isEvents) ? 'both' : isMenu ? 'menu' : isEvents ? 'events' : 'story'
    links.push({ url: full, score, type })
  }
  return links.sort((a, b) => b.score - a.score).slice(0, 10)
}

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

export async function extractSignals(rootUrl: string): Promise<RawSignals> {
  const rootHtml = await fetchPage(rootUrl)
  if (!rootHtml) throw new Error('Could not fetch website')

  const title = rootHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = rootHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
  const links = extractLinks(rootHtml, rootUrl)

  // Run screenshot + page crawl in parallel
  const [screenshotColors, crawlResults] = await Promise.all([
    extractColorsViaScreenshot(rootUrl),
    Promise.allSettled(
      links.map(async (link) => {
        const html = await fetchPage(link.url)
        if (!html) return null
        return { url: link.url, type: link.type, text: stripHtml(html).slice(0, 5000) }
      })
    )
  ])

  const menuPages: string[] = []
  const storyPages: string[] = []
  const eventPages: string[] = []
  const crawledUrls: string[] = [rootUrl]

  for (const result of crawlResults) {
    if (result.status === 'fulfilled' && result.value) {
      const { url, type, text } = result.value
      crawledUrls.push(url)
      if (type === 'menu' || type === 'both') menuPages.push(`--- ${url} ---\n${text}`)
      if (type === 'story' || type === 'both') storyPages.push(`--- ${url} ---\n${text}`)
      if (type === 'events' || type === 'both') eventPages.push(`--- ${url} ---\n${text}`)
    }
  }

  const rootText = stripHtml(rootHtml).slice(0, 3000)
  const menuText = [rootText, ...menuPages].join('\n\n').slice(0, 10000)
  const storyText = storyPages.join('\n\n').slice(0, 6000)
  const eventsText = eventPages.join('\n\n').slice(0, 4000)

  return {
    title, metaDesc,
    logoUrl: screenshotColors?.logoUrl || '',
    brandColor: screenshotColors?.primary || '',
    menuText,
    storyText,
    eventsText,
    rootText,
    sourceUrl: rootUrl,
    crawledUrls,
  }
}

export async function normalizeToRetailerDraft(signals: Awaited<ReturnType<typeof extractSignals>>) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Catalog and brand intelligence run in parallel; catalog remains the critical path.
  const [catalogMsg, brandData] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Extract product catalog from this beverage vendor website.

VERTICAL DETECTION:
- distillery/spirits/whiskey/bourbon/rye/gin/vodka/rum/moonshine → "distillery"
- brewery/brewed/craft beer/IPA/stout/lager/ale/tap → "brewery"
- winery/vineyard/wine/varietal/vintage → "winery"
- coffee/roaster/espresso → "coffee"
NEVER default to brewery.

COLORS: ${signals.brandColor ? `primary = ${signals.brandColor}` : 'use #C9A84C'}
LOGO: ${signals.logoUrl || 'not detected'}

Return ONLY valid JSON:
{
  "retailer": { "name": "", "slug": "", "vertical": "", "location": "", "tagline": "", "logo_url": "${signals.logoUrl || ''}", "brand_color": "${signals.brandColor || '#C9A84C'}" },
  "products": [{ "name": "", "description": "", "category": "", "flavor_notes": "", "price": null, "style": "", "abv": "", "ibu": "", "in_stock": true, "sort_order": 0 }],
  "flights": [{ "name": "", "description": "", "count": 4, "pour_size": "4oz", "price": 0, "active": true, "sort_order": 0 }]
}

Site: ${signals.sourceUrl}
Title: ${signals.title}
Content:
${signals.menuText}`
      }]
    }),
    extractBrand({
      storyText: signals.storyText,
      rootText: signals.rootText,
      title: signals.title,
      sourceUrl: signals.sourceUrl,
    })
  ])

  // Parse catalog
  const catalogRaw = catalogMsg.content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
  const catalogClean = catalogRaw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  const catalog = JSON.parse(catalogClean)
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error('Catalog extraction returned no products')
  }

  const eventsData = signals.eventsText
    ? await extractEvents({ eventsText: signals.eventsText, sourceUrl: signals.sourceUrl, currentDate: new Date().toISOString() })
    : []

  const storyData = {
    story: brandData.story,
    culture: brandData.culture,
    region: brandData.region,
    voice: brandData.voice,
  }

  // Override with screenshot-extracted values
  if (signals.brandColor) catalog.retailer.brand_color = signals.brandColor
  if (signals.logoUrl) catalog.retailer.logo_url = signals.logoUrl

  return { ...catalog, storyData, brandData, eventsData }
}

export async function createDraftFromUrl(url: string) {
  const supabase = getAdmin()
  const signals = await extractSignals(url)
  const { data: job } = await supabase
    .from('ingestion_jobs')
    .insert({ source_type: 'url', source_value: url, status: 'uploaded', raw_text: signals.menuText.slice(0, 10000), raw_json: { ...signals, menuText: signals.menuText.slice(0, 2000) } })
    .select('id').single()

  const normalized = await normalizeToRetailerDraft(signals)
  const hostOutput = await generateHostPersona({
    retailerName: normalized.retailer.name,
    vertical: normalized.retailer.vertical,
    location: normalized.retailer.location || null,
    tagline: normalized.retailer.tagline || null,
    story: normalized.storyData?.story || null,
    culture: normalized.storyData?.culture || null,
    brand_personality: normalized.brandData?.brand_personality || [],
    brand_voice_tone: normalized.brandData?.brand_voice_tone || '',
    signature_items: normalized.brandData?.signature_items || [],
    topProducts: Array.isArray(normalized.products) ? normalized.products.slice(0, 5).map((p: any) => p.name).filter(Boolean) : [],
    hasFlights: Array.isArray(normalized.flights) && normalized.flights.length > 0,
  })
  const intelligenceJson = {
    ...(normalized.brandData || {}),
    ...hostOutput,
  }
  const { data: existing } = await supabase.from('retailers').select('slug')
  const { data: existingDrafts } = await supabase.from('retailer_drafts').select('slug')
  const allSlugs = [...(existing || []), ...(existingDrafts || [])].map((r: any) => r.slug)
  const slug = ensureUniqueSlug(normalized.retailer.slug || normalized.retailer.name, allSlugs)
  normalized.retailer.slug = slug

  const { data: draft } = await supabase
    .from('retailer_drafts')
    .insert({
      ingestion_job_id: job?.id, status: 'draft',
      name: normalized.retailer.name, slug,
      vertical: normalized.retailer.vertical,
      location: normalized.retailer.location || null,
      tagline: normalized.retailer.tagline || null,
      logo_url: normalized.retailer.logo_url || null,
      brand_color: normalized.retailer.brand_color || '#C9A84C',
      source_url: url,
      menu_json: normalized.products,
      flight_json: normalized.flights,
      parsed_json: normalized,
      story: normalized.storyData?.story || null,
      culture: normalized.storyData?.culture || null,
      region: normalized.storyData?.region || null,
      voice: normalized.storyData?.voice || null,
      events_json: normalized.eventsData || [],
      intelligence_json: intelligenceJson,
      research_confidence: normalized.brandData?.research_confidence || 0,
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

  // Check slug doesn't conflict with existing retailers only
  const { data: existing } = await supabase.from('retailers').select('slug')
  const existingSlugs = (existing || []).map((r: any) => r.slug)
  let slug = draft.slug
  if (existingSlugs.includes(slug)) {
    slug = ensureUniqueSlug(slug, existingSlugs)
  }

  const { data: retailer } = await supabase
    .from('retailers')
    .insert({
      name: draft.name, slug, vertical: draft.vertical,
      location: draft.location, tagline: draft.tagline,
      logo_url: draft.logo_url, brand_color: draft.brand_color || '#C9A84C',
      owner_email: ownerEmail || `owner+${slug}@poursona.app`,
      story: draft.story || null,
      culture: draft.culture || null,
      region: draft.region || null,
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

  // Auto-link all poursona team members
  const { data: team } = await supabase.from('poursona_team').select('email')
  if (team?.length) {
    const { data: users } = await supabase.auth.admin.listUsers()
    for (const member of team) {
      const user = users?.users?.find((u: any) => u.email === member.email)
      if (user) {
        await supabase.from('admin_users').upsert(
          { user_id: user.id, retailer_id: retailer.id, role: 'owner' },
          { onConflict: 'user_id,retailer_id' }
        )
      }
    }
  }

  return retailer
}

export async function rescanRetailer(retailerId: string, url: string, mode: 'catalog' | 'branding' | 'full') {
  const supabase = getAdmin()
  const signals = await extractSignals(url)
  const normalized = await normalizeToRetailerDraft(signals)
  const updates: any = {}

  if (mode === 'branding' || mode === 'full') {
    if (signals.brandColor) updates.brand_color = signals.brandColor
    if (signals.logoUrl) updates.logo_url = signals.logoUrl
    if (normalized.storyData?.story) updates.story = normalized.storyData.story
    if (normalized.storyData?.culture) updates.culture = normalized.storyData.culture
    if (normalized.storyData?.region) updates.region = normalized.storyData.region
    if (normalized.retailer.tagline) updates.tagline = normalized.retailer.tagline
    if (normalized.retailer.location) updates.location = normalized.retailer.location
  }

  if (mode === 'catalog' || mode === 'full') {
    const products = Array.isArray(normalized.products) ? normalized.products : []
    if (products.length) {
      if (mode === 'full') {
        // Full replace
        await supabase.from('products').delete().eq('retailer_id', retailerId)
        await supabase.from('products').insert(
          products.map((p: any, i: number) => ({
            retailer_id: retailerId, name: p.name, description: p.description || null,
            category: p.category || null, flavor_notes: p.flavor_notes || null,
            price: p.price ?? null, style: p.style || null, abv: p.abv || null,
            ibu: p.ibu || null, in_stock: true, sort_order: i,
          }))
        )
      } else {
        // Catalog mode: add new items only
        const { data: existing } = await supabase.from('products').select('name').eq('retailer_id', retailerId)
        const existingNames = new Set((existing || []).map((p: any) => p.name.toLowerCase()))
        const newProducts = products.filter((p: any) => !existingNames.has(p.name.toLowerCase()))
        if (newProducts.length) {
          await supabase.from('products').insert(
            newProducts.map((p: any, i: number) => ({
              retailer_id: retailerId, name: p.name, description: p.description || null,
              category: p.category || null, flavor_notes: p.flavor_notes || null,
              price: p.price ?? null, style: p.style || null, abv: p.abv || null,
              ibu: p.ibu || null, in_stock: true, sort_order: 1000 + i,
            }))
          )
        }
        updates._newProductsAdded = newProducts.length
      }
    }
  }

  if (Object.keys(updates).filter(k => !k.startsWith('_')).length > 0) {
    await supabase.from('retailers').update(updates).eq('id', retailerId)
  }

  const { data: updatedRetailer } = await supabase.from('retailers').select('*').eq('id', retailerId).single()
  return { retailer: updatedRetailer, changes: updates, newProducts: updates._newProductsAdded || 0 }
}
