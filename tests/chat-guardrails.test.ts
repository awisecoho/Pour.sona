import { describe, it, expect } from 'vitest'
import {
  monthlyCostUsd,
  isOverBudget,
  effectiveMonthlyUsage,
  selectRelevantProducts,
  validateRecAgainstCatalog,
  matchCatalogProduct,
  buildFallbackRecommendation,
  rankProductsByPopularity,
  droppedHallucinations,
  AI_MONTHLY_BUDGET_USD,
} from '@/lib/chat-guardrails'

describe('monthlyCostUsd', () => {
  it('prices input at $1/MTok and output at $5/MTok by default', () => {
    expect(monthlyCostUsd(1_000_000, 0)).toBeCloseTo(1, 6)
    expect(monthlyCostUsd(0, 1_000_000)).toBeCloseTo(5, 6)
    expect(monthlyCostUsd(2_000_000, 1_000_000)).toBeCloseTo(7, 6)
  })
})

describe('isOverBudget (threshold boundary)', () => {
  it('is true exactly at the budget and above', () => {
    // $15 budget => 3,000,000 output tokens * $5/MTok = $15.00
    expect(isOverBudget(0, 3_000_000)).toBe(true)
    expect(isOverBudget(0, 3_000_001)).toBe(true)
  })
  it('is false just under the budget', () => {
    expect(isOverBudget(0, 2_999_999)).toBe(false)
  })
  it('honors a custom budget', () => {
    expect(isOverBudget(0, 1_000_000, 5)).toBe(true)
    expect(isOverBudget(0, 999_999, 5)).toBe(false)
  })
  it('default budget constant is $15', () => {
    expect(AI_MONTHLY_BUDGET_USD).toBe(15)
  })
})

describe('effectiveMonthlyUsage (monthly window)', () => {
  const now = new Date(Date.UTC(2026, 4, 20)) // 2026-05-20
  it('counts usage when reset is within the current month', () => {
    const u = effectiveMonthlyUsage(
      { ai_month_reset_at: '2026-05-01T00:00:00Z', ai_input_tokens_month: 100, ai_output_tokens_month: 200 },
      now
    )
    expect(u).toEqual({ input: 100, output: 200 })
  })
  it('treats a prior-month reset as zero (new window)', () => {
    const u = effectiveMonthlyUsage(
      { ai_month_reset_at: '2026-04-15T00:00:00Z', ai_input_tokens_month: 100, ai_output_tokens_month: 200 },
      now
    )
    expect(u).toEqual({ input: 0, output: 0 })
  })
  it('treats a null reset as zero', () => {
    const u = effectiveMonthlyUsage({ ai_month_reset_at: null, ai_input_tokens_month: 9, ai_output_tokens_month: 9 }, now)
    expect(u).toEqual({ input: 0, output: 0 })
  })
})

describe('selectRelevantProducts', () => {
  const products = Array.from({ length: 40 }, (_, i) => ({ name: `P${i}`, category: i === 7 ? 'bourbon' : 'other', flavor_notes: i === 12 ? 'smoky oak' : '' }))

  it('returns all products when under the cap', () => {
    const few = products.slice(0, 5)
    expect(selectRelevantProducts(few, 'anything', 24)).toHaveLength(5)
  })
  it('caps to max and surfaces keyword-relevant items first', () => {
    const out = selectRelevantProducts(products, 'I love smoky bourbon', 24)
    expect(out).toHaveLength(24)
    const names = out.map(p => p.name)
    expect(names).toContain('P7')  // matched "bourbon"
    expect(names).toContain('P12') // matched "smoky"
  })
  it('falls back to catalog order when there is no conversation', () => {
    const out = selectRelevantProducts(products, '', 10)
    expect(out.map(p => p.name)).toEqual(products.slice(0, 10).map(p => p.name))
  })
})

describe('validateRecAgainstCatalog (in-stock hard guardrail)', () => {
  const catalog = [{ name: 'Smokies Dew Moonshine' }, { name: 'Peach Moonshine' }]

  it('keeps only SKUs that exist in the catalog, canonicalized to catalog spelling', () => {
    const rec = { selectedProducts: [{ name: 'smokies dew moonshine' }, { name: 'Imaginary IPA' }] }
    const out = validateRecAgainstCatalog(rec, catalog)
    expect(out.selectedProducts).toHaveLength(1)
    expect(out.selectedProducts[0].name).toBe('Smokies Dew Moonshine')
  })
  it('discards the whole rec when every SKU is hallucinated', () => {
    const rec = { selectedProducts: [{ name: 'Ghost Whiskey' }, { name: 'Vapor Vodka' }] }
    expect(validateRecAgainstCatalog(rec, catalog)).toBeNull()
  })
  it('passes through a null rec', () => {
    expect(validateRecAgainstCatalog(null, catalog)).toBeNull()
  })
})

describe('matchCatalogProduct (fuzzy SKU resolution)', () => {
  const catalog = [
    { name: 'Cabernet Franc — Estate Collection' },
    { name: 'Czech Ya Later' },
    { name: 'Hazy IPA' },
    { name: 'Juicy IPA' },
  ]

  it('matches exactly, ignoring case and punctuation', () => {
    expect(matchCatalogProduct('cabernet franc estate collection', catalog)?.name)
      .toBe('Cabernet Franc — Estate Collection')
  })
  it('matches word-reordered names (model paraphrased the order)', () => {
    expect(matchCatalogProduct('Estate Collection Cabernet Franc', catalog)?.name)
      .toBe('Cabernet Franc — Estate Collection')
  })
  it('matches when the model appends a descriptor (unique containment)', () => {
    expect(matchCatalogProduct('Czech Ya Later Pilsner', catalog)?.name)
      .toBe('Czech Ya Later')
  })
  it('refuses ambiguous containment instead of guessing between SKUs', () => {
    expect(matchCatalogProduct('IPA', catalog)).toBeNull()
  })
  it('returns null for genuinely off-menu names', () => {
    expect(matchCatalogProduct('Ghost Whiskey', catalog)).toBeNull()
  })
})

describe('validateRecAgainstCatalog + fuzzy rescue', () => {
  it('rescues a near-miss name instead of discarding the rec (wine-venue bug)', () => {
    const catalog = [{ name: 'Cabernet Franc — Estate Collection' }]
    const rec = { selectedProducts: [{ name: 'Estate Collection Cabernet Franc', why: 'silky' }] }
    const out = validateRecAgainstCatalog(rec, catalog)
    expect(out).not.toBeNull()
    expect(out.selectedProducts[0].name).toBe('Cabernet Franc — Estate Collection')
    expect(out.selectedProducts[0].why).toBe('silky')
  })
})

describe('buildFallbackRecommendation (deterministic, no LLM)', () => {
  it('builds a valid single rec from the first catalog item', () => {
    const rec = buildFallbackRecommendation([{ name: 'Peach Moonshine', price: 12, style: 'moonshine', category: 'spirits' }])
    expect(rec).not.toBeNull()
    expect(rec.format).toBe('single')
    expect(rec.selectedProducts[0].name).toBe('Peach Moonshine')
    expect(rec.selectedProducts[0].price).toBe(12)
  })
  it('returns null when the catalog is empty', () => {
    expect(buildFallbackRecommendation([])).toBeNull()
  })
})

describe('rankProductsByPopularity', () => {
  const products = [{ name: 'Stout' }, { name: 'IPA' }, { name: 'Pilsner' }, { name: 'Saison' }]

  it('moves popular items to the front in popularity order, case-insensitively', () => {
    const out = rankProductsByPopularity(products, ['pilsner', 'SAISON'])
    expect(out.map(p => p.name)).toEqual(['Pilsner', 'Saison', 'Stout', 'IPA'])
  })
  it('keeps catalog order for items not in the popularity list (stable)', () => {
    const out = rankProductsByPopularity(products, ['ipa'])
    expect(out.map(p => p.name)).toEqual(['IPA', 'Stout', 'Pilsner', 'Saison'])
  })
  it('is a no-op when the popularity list is empty', () => {
    expect(rankProductsByPopularity(products, [])).toEqual(products)
  })
  it('so the catalog-order fallback (products[0]) now surfaces the top seller', () => {
    const ranked = rankProductsByPopularity(products, ['saison'])
    const rec = buildFallbackRecommendation(ranked)
    expect(rec.selectedProducts[0].name).toBe('Saison')
  })
})

describe('droppedHallucinations', () => {
  const catalog = [{ name: 'Smokies Dew Moonshine' }, { name: 'Peach Moonshine' }]

  it('lists only the off-menu SKUs (case-insensitive), preserving the model casing', () => {
    const rec = { selectedProducts: [{ name: 'smokies dew moonshine' }, { name: 'Imaginary IPA' }] }
    expect(droppedHallucinations(rec, catalog)).toEqual(['Imaginary IPA'])
  })
  it('returns all names when every SKU is hallucinated (the whole rec will be discarded)', () => {
    const rec = { selectedProducts: [{ name: 'Ghost Whiskey' }, { name: 'Vapor Vodka' }] }
    expect(droppedHallucinations(rec, catalog)).toEqual(['Ghost Whiskey', 'Vapor Vodka'])
  })
  it('returns [] for a null rec or one without products', () => {
    expect(droppedHallucinations(null, catalog)).toEqual([])
    expect(droppedHallucinations({}, catalog)).toEqual([])
  })
})
