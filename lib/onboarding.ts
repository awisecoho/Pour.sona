import Anthropic from '@anthropic-ai/sdk'
import { ensureUniqueSlug } from './slug'
import { extractBrand } from './agents/brand'
import { extractEvents } from './agents/events'
import { generateHostPersona } from './agents/host'
import type { RawSignals } from './agents/research'
import { dbQuery } from './db'
import { grantRetailerAccessByEmail } from './auth'

const EVENT_KEYWORDS = ['events','calendar','happenings','upcoming','whats-on','live','schedule','entertainment']

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

function getSupabaseBrandExtractionConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    functionPath: '/functions/v1/extract-brand-colors',
  }
}

async function extractBrandColorsWithSupabase(url: string) {
  const { supabaseUrl, serviceRoleKey, functionPath } = getSupabaseBrandExtractionConfig()
  const baseUrl = new URL(supabaseUrl)
  const functionUrl = `https://${baseUrl.hostname}${functionPath}`

  return fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30000),
  })
}

async function extractColorsViaScreenshot(url: string): Promise<{ primary: string; logoUrl: string } | null> {
  try {
    const res = await extractBrandColorsWithSupabase(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.ok) return null
    return { primary: data.colors.primary || '#C9A84C', logoUrl: data.colors.logoUrl || '' }
  } catch { return null }
}

async function insertIngestionJob(url: string, signals: RawSignals) {
  const result = await dbQuery<{ id: string }>(
    `insert into ingestion_jobs (source_type, source_value, status, raw_text, raw_json)
     values ($1, $2, $3, $4, $5)
     returning id`,
    ['url', url, 'uploaded', signals.menuText.slice(0, 10000), { ...signals, menuText: signals.menuText.slice(0, 2000) }]
  )
  return result.rows[0] || null
}

async function updateIngestionJobParsed(jobId: string, normalized: any) {
  await dbQuery(
    'update ingestion_jobs set status = $2, normalized_json = $3 where id = $1',
    [jobId, 'parsed', normalized]
  )
}

async function getExistingRetailerSlugs() {
  const result = await dbQuery<{ slug: string }>('select slug from retailers', [])
  return result.rows
}

async function getExistingDraftSlugs() {
  const result = await dbQuery<{ slug: string }>('select slug from retailer_drafts', [])
  return result.rows
}

async function insertRetailerDraft(params: {
  jobId: string | null
  slug: string
  url: string
  normalized: any
  intelligenceJson: any
}) {
  const { jobId, slug, url, normalized, intelligenceJson } = params

  const result = await dbQuery(
    `insert into retailer_drafts (
      ingestion_job_id, status, name, slug, vertical, location, tagline, logo_url, brand_color,
      source_url, menu_json, flight_json, parsed_json, story, culture, region, voice,
      events_json, intelligence_json, research_confidence
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20
    )
    returning *`,
    [
      jobId,
      'draft',
      normalized.retailer.name,
      slug,
      normalized.retailer.vertical,
      normalized.retailer.location || null,
      normalized.retailer.tagline || null,
      normalized.retailer.logo_url || null,
      normalized.retailer.brand_color || '#C9A84C',
      url,
      JSON.stringify(normalized.products),
      JSON.stringify(normalized.flights),
      JSON.stringify(normalized),
      normalized.storyData?.story || null,
      normalized.storyData?.culture || null,
      normalized.storyData?.region || null,
      normalized.storyData?.voice || null,
      JSON.stringify(normalized.eventsData || []),
      JSON.stringify(intelligenceJson),
      normalized.brandData?.research_confidence || 0,
    ]
  )

  return result.rows[0] || null
}

async function getRetailerDraftById(draftId: string) {
  const result = await dbQuery<any>(
    'select * from retailer_drafts where id = $1 limit 1',
    [draftId]
  )
  return result.rows[0] || null
}

async function markDraftPublished(draftId: string) {
  await dbQuery('update retailer_drafts set status = $2 where id = $1', [draftId, 'published'])
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

function extractJsonFromClaude(raw: string): any {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.search(/[\[{]/)
  if (start < 0) throw new Error('No JSON object or array found in Claude response')

  const open = cleaned[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
    } else if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) {
        return JSON.parse(cleaned.slice(start, i + 1))
      }
    }
  }

  throw new Error('Incomplete JSON object or array in Claude response')
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
  let catalog: any
  try {
    catalog = extractJsonFromClaude(catalogRaw)
  } catch (err) {
    console.error('[Onboarding] catalog parse failed:', err instanceof Error ? err.message : String(err))
    console.error('[Onboarding] catalog raw preview:', catalogRaw.slice(0, 500))
    throw err
  }
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error('Catalog extraction returned no products')
  }

  // Defensive normalization — Claude may omit keys when no data exists
  catalog.products = Array.isArray(catalog.products) ? catalog.products : []
  catalog.flights = Array.isArray(catalog.flights) ? catalog.flights : []
  if (catalog.retailer && !catalog.retailer.brand_color) catalog.retailer.brand_color = signals.brandColor || '#C9A84C'
  if (catalog.retailer && !catalog.retailer.logo_url) catalog.retailer.logo_url = signals.logoUrl || ''

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
  const signals = await extractSignals(url)
  const job = await insertIngestionJob(url, signals)

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
  const [existingRetailers, existingDrafts] = await Promise.all([
    getExistingRetailerSlugs(),
    getExistingDraftSlugs(),
  ])
  const allSlugs = [...existingRetailers, ...existingDrafts].map((r) => r.slug)
  const slug = ensureUniqueSlug(normalized.retailer.slug || normalized.retailer.name, allSlugs)
  normalized.retailer.slug = slug

  let draft: any = null
  try {
    draft = await insertRetailerDraft({
      jobId: job?.id || null,
      slug,
      url,
      normalized,
      intelligenceJson,
    })
  } catch (draftError: any) {
    console.error('[Onboarding] retailer_drafts insert failed:', draftError.message)
    throw new Error(`retailer_drafts insert failed: ${draftError.message}`)
  }
  if (!draft) {
    console.error('[Onboarding] retailer_drafts insert returned no draft')
    throw new Error('retailer_drafts insert returned no draft')
  }

  if (job?.id) {
    await updateIngestionJobParsed(job.id, normalized)
  }
  return draft
}

export async function publishDraft(draftId: string, ownerEmail?: string) {
  const draft = await getRetailerDraftById(draftId)
  if (!draft) throw new Error('Draft not found')

  // Check slug doesn't conflict with existing retailers only
  const existingRetailers = await getExistingRetailerSlugs()
  const existingSlugs = existingRetailers.map((r) => r.slug)
  let slug = draft.slug
  if (existingSlugs.includes(slug)) {
    slug = ensureUniqueSlug(slug, existingSlugs)
  }

  const finalOwnerEmail = ownerEmail || draft.owner_email || `owner+${slug}@poursona.app`
  const retailerResult = await dbQuery<any>(
    `insert into retailers (
      name, slug, vertical, location, tagline, logo_url, brand_color, owner_email,
      story, culture, region, active, website_url
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13
    )
    returning *`,
    [
      draft.name,
      slug,
      draft.vertical,
      draft.location,
      draft.tagline,
      draft.logo_url,
      draft.brand_color || '#C9A84C',
      finalOwnerEmail,
      draft.story || null,
      draft.culture || null,
      draft.region || null,
      true,
      draft.source_url || null,
    ]
  )
  const retailer = retailerResult.rows[0] || null

  if (!retailer) throw new Error('Failed to create retailer')

  if (finalOwnerEmail) {
    await grantRetailerAccessByEmail(retailer.id, finalOwnerEmail, 'owner')
  }

  const products = Array.isArray(draft.menu_json) ? draft.menu_json : []
  if (products.length) {
    for (const [i, p] of products.entries()) {
      await dbQuery(
        `insert into products (
          retailer_id, name, description, category, flavor_notes, price, style, abv, ibu, in_stock, sort_order
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )`,
        [
          retailer.id,
          p.name,
          p.description || null,
          p.category || null,
          p.flavor_notes || null,
          p.price ?? null,
          p.style || null,
          p.abv || null,
          p.ibu || null,
          p.in_stock ?? true,
          i,
        ]
      )
    }
  }

  const flights = Array.isArray(draft.flight_json) ? draft.flight_json : []
  if (flights.length) {
    for (const [i, f] of flights.entries()) {
      await dbQuery(
        `insert into flights (
          retailer_id, name, description, count, pour_size, price, active, sort_order
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8
        )`,
        [
          retailer.id,
          f.name,
          f.description || null,
          f.count ?? 4,
          f.pour_size || '4oz',
          f.price ?? 0,
          f.active ?? true,
          i,
        ]
      )
    }
  }

  await markDraftPublished(draft.id)

  return retailer
}

export async function rescanRetailer(retailerId: string, url: string, mode: 'catalog' | 'branding' | 'full') {
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
        await dbQuery('delete from products where retailer_id = $1', [retailerId])
        for (const [i, p] of products.entries()) {
          await dbQuery(
            `insert into products (
              retailer_id, name, description, category, flavor_notes, price, style, abv, ibu, in_stock, sort_order
            ) values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )`,
            [
              retailerId,
              p.name,
              p.description || null,
              p.category || null,
              p.flavor_notes || null,
              p.price ?? null,
              p.style || null,
              p.abv || null,
              p.ibu || null,
              true,
              i,
            ]
          )
        }
      } else {
        // Catalog mode: add new items only
        const existing = await dbQuery<{ name: string }>(
          'select name from products where retailer_id = $1',
          [retailerId]
        )
        const existingNames = new Set(existing.rows.map((p) => p.name.toLowerCase()))
        const newProducts = products.filter((p: any) => !existingNames.has(p.name.toLowerCase()))
        if (newProducts.length) {
          for (const [i, p] of newProducts.entries()) {
            await dbQuery(
              `insert into products (
                retailer_id, name, description, category, flavor_notes, price, style, abv, ibu, in_stock, sort_order
              ) values (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
              )`,
              [
                retailerId,
                p.name,
                p.description || null,
                p.category || null,
                p.flavor_notes || null,
                p.price ?? null,
                p.style || null,
                p.abv || null,
                p.ibu || null,
                true,
                1000 + i,
              ]
            )
          }
        }
        updates._newProductsAdded = newProducts.length
      }
    }
  }

  await dbQuery(
    `update retailers
     set brand_color = coalesce($2, brand_color),
         logo_url = coalesce($3, logo_url),
         story = coalesce($4, story),
         culture = coalesce($5, culture),
         region = coalesce($6, region),
         tagline = coalesce($7, tagline),
         location = coalesce($8, location),
         website_url = $9
     where id = $1`,
    [
      retailerId,
      updates.brand_color || null,
      updates.logo_url || null,
      updates.story || null,
      updates.culture || null,
      updates.region || null,
      updates.tagline || null,
      updates.location || null,
      url,
    ]
  )

  const updatedRetailerResult = await dbQuery<any>(
    'select * from retailers where id = $1 limit 1',
    [retailerId]
  )
  const updatedRetailer = updatedRetailerResult.rows[0] || null
  return { retailer: updatedRetailer, changes: updates, newProducts: updates._newProductsAdded || 0 }
}
