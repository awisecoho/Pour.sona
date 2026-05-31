import Anthropic from '@anthropic-ai/sdk'
import { ensureUniqueSlug } from './slug'
import { extractBrand } from './agents/brand'
import { extractEvents } from './agents/events'
import { generateHostPersona } from './agents/host'
import { runVendorBuilder } from './agents/vendor-builder'
import type { RawSignals, MenuAsset } from './agents/research'
import { dbQuery, getPool } from './db'
import { grantRetailerAccessByEmail } from './auth'

const EVENT_KEYWORDS = ['events','calendar','happenings','upcoming','whats-on','live','schedule','entertainment']

async function fetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const text = await res.text()
    return text.replace(/\x00/g, '')  // strip null bytes before any processing
  } catch { return '' }
}

/**
 * Whether a detected hex is a usable *brand accent* color (not a page background).
 * The storefront renders brand_color as the primary accent on a DARK theme, so
 * near-white, near-black, and washed-out greys look generic / off-brand — those
 * are almost always background tones the scraper picked up, not the identity color.
 */
function isUsableBrandColor(hex: string | null | undefined): boolean {
  if (!hex) return false
  const h = hex.replace('#', '')
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return false
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const sat = max === 0 ? 0 : (max - min) / max
  if (lum > 0.82) return false           // too pale / near-white (e.g. cream backgrounds)
  if (lum < 0.05) return false           // near-black
  if (sat < 0.12 && (lum > 0.6 || lum < 0.2)) return false  // washed-out grey extremes
  return true
}

function resolveAssetUrl(raw: string | null | undefined, baseUrl: string): string | null {
  if (!raw) return null
  const cleaned = raw.trim()
  if (!cleaned) return null
  if (cleaned.startsWith('http')) return cleaned
  if (cleaned.startsWith('//')) {
    try { return new URL('https:' + cleaned).toString() } catch { return null }
  }
  try { return new URL(cleaned, baseUrl).toString() } catch { return null }
}

function extractColorsFromHtml(html: string, baseUrl: string): { primary: string | null; logoUrl: string | null } {
  // --- Color detection (most reliable first) ---
  const themeColor =
    html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i)?.[1] ||
    null

  // CSS custom properties on :root or body (--primary-color, --brand-color, etc.)
  const cssVarColor =
    html.match(/--(?:primary|brand|accent|main|theme)(?:-color)?:\s*(#[0-9a-fA-F]{6})/i)?.[1] || null

  // Inline background-color on <body>
  const bodyBgColor =
    html.match(/<body[^>]+style=["'][^"']*background(?:-color)?:\s*(#[0-9a-fA-F]{6})/i)?.[1] || null

  // Prefer the first candidate that is actually a usable brand accent. This stops
  // pale background tones (cream, near-white) from becoming the storefront primary.
  const candidates = [themeColor, cssVarColor, bodyBgColor]
  const primary = candidates.find(isUsableBrandColor) || null

  // --- Logo detection (most specific first) ---
  // 1. A real in-page logo: an <img> whose src/alt/class/id references "logo".
  //    Prefer one with a recognized image extension; keep the first as a fallback.
  let logoFromImg: string | null = null
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    if (!/logo/i.test(tag)) continue
    const src =
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ||
      tag.match(/\bsrcset=["']([^"'\s,]+)/i)?.[1] ||
      null
    if (!src) continue
    if (/\.(svg|png|webp|jpe?g|gif)(\?|$)/i.test(src)) { logoFromImg = src; break }
    if (!logoFromImg) logoFromImg = src
  }

  // 2. apple-touch-icon (clean square icon — decent fallback)
  const appleTouchIcon =
    html.match(/<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i)?.[1] ||
    null

  // 3. og:image (often a social banner — last resort)
  const ogImage =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
    null

  // 4. <link rel="icon"> png/svg/webp (skip .ico favicons)
  const iconMatches = [...html.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/gi)]
  const iconUrl = iconMatches
    .map(m => m[1])
    .find(u => !u.endsWith('.ico') && (u.endsWith('.png') || u.endsWith('.svg') || u.endsWith('.webp'))) || null

  const logoUrl =
    resolveAssetUrl(logoFromImg, baseUrl) ||
    resolveAssetUrl(appleTouchIcon, baseUrl) ||
    resolveAssetUrl(ogImage, baseUrl) ||
    resolveAssetUrl(iconUrl, baseUrl)

  return { primary, logoUrl }
}

async function insertIngestionJob(url: string, signals: RawSignals) {
  const result = await dbQuery<{ id: string }>(
    `insert into ingestion_jobs (source_type, source_value, status, raw_text, raw_json)
     values ($1, $2, $3, $4, $5)
     returning id`,
    ['url', url, 'uploaded', signals.menuText.slice(0, 10000), {
      ...signals,
      menuText: signals.menuText.slice(0, 2000),
      // Strip base64 from assets — store only URL + MIME for audit, not the binary payload
      menuAssets: signals.menuAssets.map(({ url: u, mimeType }) => ({ url: u, mimeType })),
    }]
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
      events_json, intelligence_json, research_confidence,
      demo_expires_at
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15, $16, $17,
      $18, $19, $20,
      now() + interval '7 days'
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
    .replace(/\x00/g, '')           // PostgreSQL rejects null bytes in text fields
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

// ── PDF / image menu asset helpers ───────────────────────────────────────────

const MENU_ASSET_MIME: Record<string, MenuAsset['mimeType']> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
}

/**
 * Scan the homepage HTML for <a href> links pointing at PDF or image files.
 * Returns up to 3 URLs, same-domain links first.
 */
function extractMenuAssetUrls(html: string, baseUrl: string): string[] {
  const regex = /href=["']([^"']+\.(?:pdf|jpe?g|png|webp)(?:\?[^"']*)?)/gi
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const results: string[] = []
  let m
  while ((m = regex.exec(html)) !== null) {
    try {
      const full = new URL(m[1].trim(), base).toString()
      if (!seen.has(full)) { seen.add(full); results.push(full) }
    } catch { /* ignore malformed hrefs */ }
  }
  // same-domain first, then cross-domain CDN links
  const origin = base.origin
  return results
    .sort((a, b) => (a.startsWith(origin) ? 0 : 1) - (b.startsWith(origin) ? 0 : 1))
    .slice(0, 3)
}

/**
 * Fetch a PDF or image from `url` and return it as a base64 MenuAsset.
 * Returns null on any error or if the file exceeds 15 MB.
 */
async function fetchMenuAsset(url: string): Promise<MenuAsset | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const buf = await res.arrayBuffer()
    if (buf.byteLength > 15 * 1024 * 1024) {
      console.warn('[Onboarding] menu asset too large, skipping:', url)
      return null
    }

    // Derive MIME type from URL extension (Content-Type headers are unreliable for PDFs on S3/CDNs)
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
    const mimeType = MENU_ASSET_MIME[ext] ?? null
    if (!mimeType) return null

    return { url, mimeType, base64: Buffer.from(buf).toString('base64') }
  } catch (err) {
    console.warn('[Onboarding] fetchMenuAsset failed for', url, ':', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function extractSignals(rootUrl: string): Promise<RawSignals> {
  const rootHtml = await fetchPage(rootUrl)
  if (!rootHtml) throw new Error('Could not fetch website')

  const title = rootHtml.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || ''
  const metaDesc = rootHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
  const links = extractLinks(rootHtml, rootUrl)

  const screenshotColors = extractColorsFromHtml(rootHtml, rootUrl)

  // Detect PDF/image menu assets and crawl sub-pages in parallel
  const assetUrls = extractMenuAssetUrls(rootHtml, rootUrl)
  const [crawlResults, ...assetResults] = await Promise.allSettled([
    Promise.allSettled(
      links.map(async (link) => {
        const html = await fetchPage(link.url)
        if (!html) return null
        return { url: link.url, type: link.type, text: stripHtml(html).slice(0, 5000) }
      })
    ),
    ...assetUrls.map(fetchMenuAsset),
  ])

  const menuPages: string[] = []
  const storyPages: string[] = []
  const eventPages: string[] = []
  const crawledUrls: string[] = [rootUrl]

  if (crawlResults.status === 'fulfilled') {
    for (const result of crawlResults.value) {
      if (result.status === 'fulfilled' && result.value) {
        const { url, type, text } = result.value
        crawledUrls.push(url)
        if (type === 'menu' || type === 'both') menuPages.push(`--- ${url} ---\n${text}`)
        if (type === 'story' || type === 'both') storyPages.push(`--- ${url} ---\n${text}`)
        if (type === 'events' || type === 'both') eventPages.push(`--- ${url} ---\n${text}`)
      }
    }
  }

  // Collect successfully fetched PDF/image assets (cap at 2 to control token spend)
  const menuAssets: MenuAsset[] = assetResults
    .filter((r): r is PromiseFulfilledResult<MenuAsset | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value as MenuAsset)
    .slice(0, 2)

  if (menuAssets.length > 0) {
    console.log('[Onboarding] found menu assets:', menuAssets.map(a => `${a.mimeType} ${a.url}`))
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
    menuAssets,
  }
}

export async function normalizeToRetailerDraft(signals: Awaited<ReturnType<typeof extractSignals>>) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Catalog and brand intelligence run in parallel; catalog remains the critical path.
  // Build content blocks: always start with the text prompt, then attach any PDF/image assets.
  const catalogPromptText = `Extract product catalog from this beverage vendor website.

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
${signals.menuAssets.length > 0 ? 'Web content (menu may also be in the attached document/image below):' : 'Content:'}
${signals.menuText}`

  const catalogContent: Anthropic.Messages.ContentBlockParam[] = [
    { type: 'text', text: catalogPromptText },
    ...signals.menuAssets.map((asset): Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam => {
      if (asset.mimeType === 'application/pdf') {
        return {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: asset.base64 },
          title: 'Menu PDF',
        } satisfies Anthropic.Messages.DocumentBlockParam
      }
      return {
        type: 'image',
        source: { type: 'base64', media_type: asset.mimeType, data: asset.base64 },
      } satisfies Anthropic.Messages.ImageBlockParam
    }),
  ]

  const [catalogMsg, brandData] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: catalogContent }],
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
  // Soft-fail on empty products: JS-rendered menus return no data to a static scraper.
  // Still create the draft with brand info intact — vendor adds catalog in the admin.
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    console.warn('[Onboarding] catalog extraction returned no products (JS-rendered menu or no menu page found); draft will have empty catalog')
    catalog.products = []
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
  // Non-fatal: ingestion_jobs is for audit/diagnostics only; a failure here must not abort signup.
  let job: { id: string } | null = null
  try {
    job = await insertIngestionJob(url, signals)
  } catch (jobErr) {
    console.warn('[Onboarding] insertIngestionJob failed (non-fatal):', jobErr instanceof Error ? jobErr.message : String(jobErr))
  }

  const normalized = await normalizeToRetailerDraft(signals)
  const [hostOutput, vendorBuilder] = await Promise.all([
    generateHostPersona({
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
    }),
    runVendorBuilder({
      name: normalized.retailer.name,
      vertical: normalized.retailer.vertical,
      location: normalized.retailer.location || null,
      tagline: normalized.retailer.tagline || null,
      menuText: signals.menuText,
      storyText: signals.storyText,
      rootText: signals.rootText,
      sourceUrl: signals.sourceUrl,
      products: Array.isArray(normalized.products) ? normalized.products : [],
      brandColor: signals.brandColor || normalized.retailer.brand_color || null,
      story: normalized.storyData?.story || null,
      culture: normalized.storyData?.culture || null,
      voice: normalized.storyData?.voice || null,
      brand_personality: normalized.brandData?.brand_personality || [],
      brand_voice_tone: normalized.brandData?.brand_voice_tone || '',
    }),
  ])
  const intelligenceJson = {
    ...(normalized.brandData || {}),
    ...hostOutput,
    vendorBuilder,
  }

  // If the scraped primary wasn't a usable brand accent (e.g. a pale background
  // tone), fall back to the vendor builder's inferred identity color so the
  // dark-themed storefront isn't washed out and actually matches the venue.
  if (!isUsableBrandColor(signals.brandColor) && vendorBuilder.brand_primary_color) {
    normalized.retailer.brand_color = vendorBuilder.brand_primary_color
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

// Number of per-row columns in each batch insert (excludes the shared retailer_id $1)
const PRODUCT_ROW_COLS = 10 // name, description, category, flavor_notes, price, style, abv, ibu, in_stock, sort_order
const FLIGHT_ROW_COLS  = 7  // name, description, count, pour_size, price, active, sort_order

function buildBatchInsert(rowCount: number, perRowCols: number): string {
  return Array.from({ length: rowCount }, (_, i) => {
    const params = Array.from({ length: perRowCols }, (_, j) => `$${2 + i * perRowCols + j}`)
    return `($1, ${params.join(', ')})`
  }).join(',\n')
}

/**
 * Publish a draft retailer atomically.
 *
 * All DB writes (retailer row, admin access grant, products, flights, draft
 * status update) happen inside a single PostgreSQL transaction.  If any step
 * fails the entire transaction is rolled back and no partial data is left.
 */
export async function publishDraft(draftId: string, ownerEmail?: string) {
  const draft = await getRetailerDraftById(draftId)
  if (!draft) throw new Error('Draft not found')

  // Resolve slug before entering the transaction — read-only, no lock needed.
  const existingRetailers = await getExistingRetailerSlugs()
  const existingSlugs = existingRetailers.map((r) => r.slug)
  let slug = draft.slug
  if (existingSlugs.includes(slug)) {
    slug = ensureUniqueSlug(slug, existingSlugs)
  }

  const finalOwnerEmail = ownerEmail || draft.owner_email || `owner+${slug}@poursona.app`
  const products: any[] = Array.isArray(draft.menu_json) ? draft.menu_json : []
  const flights: any[]  = Array.isArray(draft.flight_json) ? draft.flight_json : []

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    // Extract vendor builder data from intelligence_json if available
    const vb = draft.intelligence_json?.vendorBuilder || {}

    // 1. Create retailer row
    const retailerResult = await client.query<any>(
      `insert into retailers (
        name, slug, vertical, location, tagline, logo_url, brand_color, owner_email,
        story, culture, region, active, source_url,
        chat_system_prompt, brand_secondary_color, brand_accent_color,
        brand_font_family, brand_font_url,
        take_home_json, has_take_home, featured_items_json,
        scan_confidence, personality_preview, vendor_builder_ran_at,
        subscription_status, trial_ends_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18,
        $19, $20, $21,
        $22, $23, now(),
        'trial', now() + interval '14 days'
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
        draft.story   || null,
        draft.culture || null,
        draft.region  || null,
        true,
        draft.source_url || null,
        vb.chat_system_prompt   || null,
        vb.brand_secondary_color || null,
        vb.brand_accent_color    || null,
        vb.brand_font_family     || null,
        vb.brand_font_url        || null,
        JSON.stringify(vb.take_home_items  || []),
        Boolean(vb.has_take_home),
        JSON.stringify(vb.featured_items   || []),
        vb.scan_confidence ?? 0,
        vb.personality_preview || null,
      ]
    )
    const retailer = retailerResult.rows[0]
    if (!retailer) throw new Error('Failed to create retailer')

    // 2. Grant owner access — uses the same transaction client
    await grantRetailerAccessByEmail(retailer.id, finalOwnerEmail, 'owner', client)

    // 3. Batch-insert products (single round-trip instead of N queries)
    if (products.length) {
      const placeholders = buildBatchInsert(products.length, PRODUCT_ROW_COLS)
      const values: unknown[] = [retailer.id]
      for (const [i, p] of products.entries()) {
        values.push(
          p.name,
          p.description  || null,
          p.category     || null,
          p.flavor_notes || null,
          p.price        ?? null,
          p.style        || null,
          p.abv          || null,
          p.ibu          || null,
          p.in_stock     ?? true,
          i,  // sort_order
        )
      }
      await client.query(
        `insert into products
           (retailer_id, name, description, category, flavor_notes, price, style, abv, ibu, in_stock, sort_order)
         values ${placeholders}`,
        values
      )
    }

    // 4. Batch-insert flights
    if (flights.length) {
      const placeholders = buildBatchInsert(flights.length, FLIGHT_ROW_COLS)
      const values: unknown[] = [retailer.id]
      for (const [i, f] of flights.entries()) {
        values.push(
          f.name,
          f.description || null,
          f.count       ?? 4,
          f.pour_size   || '4oz',
          f.price       ?? 0,
          f.active      ?? true,
          i,  // sort_order
        )
      }
      await client.query(
        `insert into flights
           (retailer_id, name, description, count, pour_size, price, active, sort_order)
         values ${placeholders}`,
        values
      )
    }

    // 5. Mark draft published — keeps the draft around for audit purposes
    await client.query(
      'update retailer_drafts set status = $2 where id = $1',
      [draftId, 'published']
    )

    await client.query('COMMIT')
    return retailer
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function rescanRetailer(retailerId: string, url: string, mode: 'catalog' | 'branding' | 'full') {
  const signals = await extractSignals(url)
  const normalized = await normalizeToRetailerDraft(signals)
  const updates: any = {}

  // Run vendor builder on branding or full rescan (not catalog-only)
  let vb: Awaited<ReturnType<typeof runVendorBuilder>> | null = null
  if (mode === 'branding' || mode === 'full') {
    vb = await runVendorBuilder({
      name: normalized.retailer.name,
      vertical: normalized.retailer.vertical,
      location: normalized.retailer.location || null,
      tagline: normalized.retailer.tagline || null,
      menuText: signals.menuText,
      storyText: signals.storyText,
      rootText: signals.rootText,
      sourceUrl: signals.sourceUrl,
      products: Array.isArray(normalized.products) ? normalized.products : [],
      brandColor: signals.brandColor || normalized.retailer.brand_color || null,
      story: normalized.storyData?.story || null,
      culture: normalized.storyData?.culture || null,
      voice: normalized.storyData?.voice || null,
      brand_personality: normalized.brandData?.brand_personality || [],
      brand_voice_tone: normalized.brandData?.brand_voice_tone || '',
    })
  }

  if (mode === 'branding' || mode === 'full') {
    if (isUsableBrandColor(signals.brandColor)) updates.brand_color = signals.brandColor
    else if (vb?.brand_primary_color) updates.brand_color = vb.brand_primary_color
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
     set brand_color          = coalesce($2, brand_color),
         logo_url             = coalesce($3, logo_url),
         story                = coalesce($4, story),
         culture              = coalesce($5, culture),
         region               = coalesce($6, region),
         tagline              = coalesce($7, tagline),
         location             = coalesce($8, location),
         source_url           = $9,
         brand_secondary_color = coalesce($10, brand_secondary_color),
         brand_accent_color    = coalesce($11, brand_accent_color),
         brand_font_family     = coalesce($12, brand_font_family),
         brand_font_url        = coalesce($13, brand_font_url),
         take_home_json        = coalesce($14, take_home_json),
         has_take_home         = coalesce($15, has_take_home),
         featured_items_json   = coalesce($16, featured_items_json),
         scan_confidence       = coalesce($17, scan_confidence),
         personality_preview   = coalesce($18, personality_preview),
         vendor_builder_ran_at = case when $10 is not null then now() else vendor_builder_ran_at end
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
      vb?.brand_secondary_color || null,
      vb?.brand_accent_color    || null,
      vb?.brand_font_family     || null,
      vb?.brand_font_url        || null,
      vb ? JSON.stringify(vb.take_home_items) : null,
      vb ? vb.has_take_home : null,
      vb ? JSON.stringify(vb.featured_items) : null,
      vb?.scan_confidence ?? null,
      vb?.personality_preview || null,
    ]
  )

  const updatedRetailerResult = await dbQuery<any>(
    'select * from retailers where id = $1 limit 1',
    [retailerId]
  )
  const updatedRetailer = updatedRetailerResult.rows[0] || null
  return { retailer: updatedRetailer, changes: updates, newProducts: updates._newProductsAdded || 0 }
}
