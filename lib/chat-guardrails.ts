/**
 * Pure, server-side chat guardrail logic — extracted from the chat route so it
 * can be unit-tested in isolation (no network, no DB, no Anthropic).
 *
 * Covers: catalog relevance filtering, in-stock recommendation validation,
 * AI cost math, monthly usage windowing, and the deterministic catalog fallback.
 */

// ── Tunables ──────────────────────────────────────────────────────────────────
export const MAX_CATALOG_ITEMS = 24      // SKUs injected into the prompt (relevance-filtered)
export const MAX_HISTORY_MESSAGES = 14   // recent turns sent to the model
/**
 * Absolute backstop on guest turns. Per-vendor caps (driven by AssistantProfile +
 * category template) are usually tighter; see getMaxUserTurns(retailer). This
 * constant survives only so the chat route can short-circuit before even loading
 * a retailer when something is malformed.
 */
export const MAX_USER_TURNS = 6

// Per-venue monthly AI budget. Haiku pricing ≈ $1/M input, $5/M output.
export const AI_MONTHLY_BUDGET_USD  = Number(process.env.AI_MONTHLY_BUDGET_USD  || 15)
export const AI_INPUT_USD_PER_MTOK  = Number(process.env.AI_INPUT_USD_PER_MTOK  || 1)
export const AI_OUTPUT_USD_PER_MTOK = Number(process.env.AI_OUTPUT_USD_PER_MTOK || 5)

export interface ProductLike {
  name?: string
  description?: string | null
  category?: string | null
  style?: string | null
  flavor_notes?: string | null
  price?: number | null
}

/** Estimated USD cost of a token spend at the configured per-MTok prices. */
export function monthlyCostUsd(inputTok: number, outputTok: number): number {
  return (inputTok / 1e6) * AI_INPUT_USD_PER_MTOK + (outputTok / 1e6) * AI_OUTPUT_USD_PER_MTOK
}

/** True when the venue's recorded usage is over its monthly budget. */
export function isOverBudget(inputTok: number, outputTok: number, budget = AI_MONTHLY_BUDGET_USD): boolean {
  return monthlyCostUsd(inputTok, outputTok) >= budget
}

/**
 * Usage so far this calendar month — treats a stale/absent reset timestamp as
 * zero so a new month starts clean. `now` is injectable for deterministic tests.
 */
export function effectiveMonthlyUsage(
  retailer: { ai_month_reset_at?: string | Date | null; ai_input_tokens_month?: number | string | null; ai_output_tokens_month?: number | string | null },
  now: Date = new Date()
): { input: number; output: number } {
  const reset = retailer.ai_month_reset_at ? new Date(retailer.ai_month_reset_at) : null
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const active = reset != null && reset.getTime() >= monthStart
  return {
    input: active ? Number(retailer.ai_input_tokens_month || 0) : 0,
    output: active ? Number(retailer.ai_output_tokens_month || 0) : 0,
  }
}

/**
 * Pick the most relevant in-stock products for the conversation instead of
 * dumping the whole catalog. Keyword overlap with the guest's messages; falls
 * back to catalog order when nothing matches or there's no conversation yet.
 */
export function selectRelevantProducts<T extends ProductLike>(products: T[], convoText: string, max: number = MAX_CATALOG_ITEMS): T[] {
  if (products.length <= max) return products
  const text = (convoText || '').toLowerCase()
  const tokens = Array.from(new Set(text.split(/[^a-z0-9]+/).filter(w => w.length >= 3)))
  if (tokens.length === 0) return products.slice(0, max)
  const scored = products.map((p, idx) => {
    const hay = [p.name, p.category, p.style, p.flavor_notes, p.description].filter(Boolean).join(' ').toLowerCase()
    let score = 0
    for (const t of tokens) if (hay.includes(t)) score++
    return { p, score, idx }
  })
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.slice(0, max).map(s => s.p)
}

/** Case/punctuation/diacritic-insensitive form of a product name for matching. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resolve a model-produced product name to the catalog row it refers to.
 * Exact normalized match first; then two safe fuzzy passes that only accept a
 * UNIQUE candidate (ambiguity returns null so we never guess between SKUs):
 *  - containment either way ("Czech Ya Later Pilsner" ↔ "Czech Ya Later")
 *  - same word set in any order ("Estate Collection Cabernet Franc" ↔
 *    "Cabernet Franc — Estate Collection")
 */
export function matchCatalogProduct<T extends ProductLike>(name: string, products: T[]): T | null {
  const target = normalizeName(name)
  if (!target) return null

  const exact = products.filter(p => normalizeName(String(p.name || '')) === target)
  if (exact.length > 0) return exact[0]

  if (target.length >= 4) {
    const contains = products.filter(p => {
      const pn = normalizeName(String(p.name || ''))
      return pn.length >= 4 && (pn.includes(target) || target.includes(pn))
    })
    if (contains.length === 1) return contains[0]
  }

  const targetTokens = target.split(' ').sort().join(' ')
  const tokenMatches = products.filter(
    p => normalizeName(String(p.name || '')).split(' ').sort().join(' ') === targetTokens
  )
  if (tokenMatches.length === 1) return tokenMatches[0]

  return null
}

/**
 * Hard guardrail against hallucinated recommendations: every product in the REC
 * block must exist in the live in-stock catalog. Off-menu items are dropped; if
 * nothing valid remains, the recommendation is discarded entirely (returns null).
 * Matched items get their name rewritten to the catalog's canonical spelling so
 * downstream exact-name joins (image/price enrichment, orders) always hit.
 */
export function validateRecAgainstCatalog(recData: any, products: ProductLike[]): any | null {
  if (!recData) return null
  if (Array.isArray(recData.selectedProducts)) {
    const resolved = recData.selectedProducts
      .map((sp: any) => {
        if (!sp || typeof sp.name !== 'string') return null
        const match = matchCatalogProduct(sp.name, products)
        return match ? { ...sp, name: match.name } : null
      })
      .filter((sp: any) => sp !== null)
    if (resolved.length === 0) return null
    recData.selectedProducts = resolved
  }
  return recData
}

/**
 * Reorder products so the most popular ones come first (by name, case-insensitive),
 * keeping the original relative order for everything else. `popularNames` is a
 * priority list, most-popular first. Stable: ties and unranked items fall back to
 * catalog order. Lets the over-budget fallback surface a genuine guest favorite
 * instead of whatever happens to sort first.
 */
export function rankProductsByPopularity<T extends { name?: string }>(
  products: T[],
  popularNames: string[]
): T[] {
  if (popularNames.length === 0 || products.length <= 1) return products
  const rank = new Map<string, number>()
  popularNames.forEach((n, i) => {
    const key = String(n || '').trim().toLowerCase()
    if (key && !rank.has(key)) rank.set(key, i)
  })
  const scoreOf = (p: T) => {
    const r = rank.get(String(p.name || '').trim().toLowerCase())
    return r === undefined ? Number.POSITIVE_INFINITY : r
  }
  // Decorate with original index so the sort is stable (ties keep catalog order).
  return products
    .map((p, i) => ({ p, i, s: scoreOf(p) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(x => x.p)
}

/**
 * The SKU names in a rec that do NOT exist in the live in-stock catalog — i.e.
 * the hallucinations validateRecAgainstCatalog is about to drop. Pure; meant to
 * be called *before* that destructive step so the route can record telemetry on
 * what the model invented. Returns [] for a null rec or one with no products.
 */
export function droppedHallucinations(recData: any, products: ProductLike[]): string[] {
  if (!recData || !Array.isArray(recData.selectedProducts)) return []
  // Same matcher as validateRecAgainstCatalog so telemetry agrees with what
  // actually gets dropped (fuzzy-rescued names are not hallucinations).
  return recData.selectedProducts
    .map((sp: any) => (sp && typeof sp.name === 'string' ? sp.name : null))
    .filter((n: string | null): n is string => !!n && !matchCatalogProduct(n, products))
}

/** A no-AI recommendation built straight from the catalog, used when a venue is
 *  over its monthly AI budget so the guest experience never goes dark. */
export function buildFallbackRecommendation(products: ProductLike[]): any | null {
  const pick = products[0]
  if (!pick) return null
  return {
    format: 'single',
    recommendationName: pick.name,
    tagline: 'A guest favorite',
    selectedProducts: [{ name: pick.name, why: 'One of our most-loved picks — ask our staff to tell you more.', price: pick.price ?? null }],
    flightDetails: null,
    flavorProfile: [pick.style, pick.category].filter(Boolean).slice(0, 3),
    story: pick.description || '',
    whyItFitsYou: 'A reliable crowd-pleaser to start with.',
    serveNote: '',
  }
}
