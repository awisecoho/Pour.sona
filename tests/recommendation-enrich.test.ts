import { describe, it, expect } from 'vitest'
import { enrichRecommendationWithCatalog } from '@/lib/recommendation-enrich'
import type { BlendRecommendation } from '@/lib/types'

const CATALOG = [
  { name: 'Keuka Pils',     image_url: 'https://cdn.example.com/keuka-pils.jpg',     price: 7,  category: 'Lager' },
  { name: 'Smoked Porter',  image_url: null,                                        price: 8,  category: 'Dark'  },
  { name: 'Cellar Reserve', image_url: 'https://cdn.example.com/cellar.jpg',        price: 42, category: 'Whiskey' },
]

function baseRec(overrides: Partial<BlendRecommendation> = {}): BlendRecommendation {
  return {
    blendName: 'X', tagline: '', flavorProfile: [], storyTitle: '', story: '', whyItFitsYou: '',
    selectedProducts: [{ name: 'Keuka Pils', why: 'crisp' }],
    ...overrides,
  }
}

describe('enrichRecommendationWithCatalog', () => {
  it('returns null when rec is null', () => {
    expect(enrichRecommendationWithCatalog(null, CATALOG)).toBeNull()
  })

  it('fills image_url from the matched catalog row', () => {
    const out = enrichRecommendationWithCatalog(baseRec(), CATALOG)!
    expect(out.selectedProducts![0].image_url).toBe('https://cdn.example.com/keuka-pils.jpg')
  })

  it('leaves image_url null when catalog row has no image', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: 'Smoked Porter', why: 'cozy' }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].image_url).toBeNull()
  })

  it('matches case-insensitively and trims whitespace', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: '  CELLAR RESERVE  ', why: '' }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].image_url).toBe('https://cdn.example.com/cellar.jpg')
  })

  it('does not overwrite an existing image_url on the rec', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: 'Keuka Pils', why: '', image_url: 'https://other.example/override.jpg' }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].image_url).toBe('https://other.example/override.jpg')
  })

  it('fills price from catalog when the rec omitted it', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: 'Cellar Reserve', why: '' }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].price).toBe(42)
  })

  it('keeps the model-supplied price when one was provided', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: 'Cellar Reserve', why: '', price: 50 }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].price).toBe(50)
  })

  it('leaves unknown product names untouched (validateRecAgainstCatalog runs first)', () => {
    const out = enrichRecommendationWithCatalog(
      baseRec({ selectedProducts: [{ name: 'Ghost SKU', why: '' }] }),
      CATALOG
    )!
    expect(out.selectedProducts![0].image_url).toBeUndefined()
  })

  it('returns the same rec reference (mutation-friendly)', () => {
    const rec = baseRec()
    const out = enrichRecommendationWithCatalog(rec, CATALOG)
    expect(out).toBe(rec)
  })
})
