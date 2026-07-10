import { describe, it, expect } from 'vitest'
import { deriveDefaultProfile, resolveAssistantProfile, getQuestionBounds, ABSOLUTE_MAX_USER_TURNS } from '@/lib/agent/profile'
import { getCategoryTemplate, listCategoryTemplates } from '@/lib/agent/categories'

// Minimal stub the resolver actually reads from.
type R = Parameters<typeof deriveDefaultProfile>[0]

describe('deriveDefaultProfile', () => {
  it('picks the category default tone & experience style by vertical', () => {
    const brewery = deriveDefaultProfile({ vertical: 'brewery' } as R)
    expect(brewery.experience_style).toBe('bartender')
    expect(brewery.brand_tone).toBe('warm')

    const winery = deriveDefaultProfile({ vertical: 'winery' } as R)
    expect(winery.experience_style).toBe('sommelier')
    expect(winery.brand_tone).toBe('reverent')

    const coffee = deriveDefaultProfile({ vertical: 'coffee' } as R)
    expect(coffee.experience_style).toBe('barista')

    const distillery = deriveDefaultProfile({ vertical: 'distillery' } as R)
    expect(distillery.experience_style).toBe('spirits-guide')
  })

  it('uses host_persona as agent_name when present', () => {
    const profile = deriveDefaultProfile({ vertical: 'brewery', name: 'Steuben', host_persona: 'Maya' } as R)
    expect(profile.agent_name).toBe('Maya')
  })

  it('falls back to "Your guide at {name}" when host_persona is empty', () => {
    const profile = deriveDefaultProfile({ vertical: 'brewery', name: 'Steuben' } as R)
    expect(profile.agent_name).toBe('Your guide at Steuben')
  })

  it('lifts best_sellers from featured_items_json names', () => {
    const profile = deriveDefaultProfile({
      vertical: 'brewery',
      featured_items_json: [{ name: 'Keuka Pils', reason: 'flagship' }, { name: 'Smoked Porter', reason: 'seasonal' }],
    } as R)
    expect(profile.best_sellers).toEqual(['Keuka Pils', 'Smoked Porter'])
  })

  it('enables every category theme by default', () => {
    const profile = deriveDefaultProfile({ vertical: 'winery' } as R)
    const template = getCategoryTemplate('winery')
    expect(profile.question_themes).toEqual(template.question_themes.map(t => t.id))
  })

  it('derives brand_personality/key_differentiators/preferred_vocab from scan columns', () => {
    const profile = deriveDefaultProfile({
      vertical: 'brewery',
      brand_personality: 'irreverent, craft-forward — playful and unpretentious',
      key_differentiators: ['barrel-aged sours', 'onsite malting'],
      preferred_vocab: ['flight', 'growler'],
    } as R)
    expect(profile.brand_personality).toBe('irreverent, craft-forward — playful and unpretentious')
    expect(profile.key_differentiators).toEqual(['barrel-aged sours', 'onsite malting'])
    expect(profile.preferred_vocab).toEqual(['flight', 'growler'])
  })

  it('falls back to empty brand_personality/key_differentiators/preferred_vocab when scan columns are absent', () => {
    const profile = deriveDefaultProfile({ vertical: 'brewery', name: 'Steuben' } as R)
    expect(profile.brand_personality).toBe('')
    expect(profile.key_differentiators).toEqual([])
    expect(profile.preferred_vocab).toEqual([])
  })
})

describe('resolveAssistantProfile', () => {
  it('returns derived defaults when assistant_profile is null', () => {
    const resolved = resolveAssistantProfile({ vertical: 'brewery', name: 'Steuben' } as R)
    expect(resolved.agent_name).toBe('Your guide at Steuben')
    expect(resolved.experience_style).toBe('bartender')
    expect(resolved.preferred_vocab).toEqual([])
  })

  it('overlays stored fields onto defaults; empty arrays fall through to defaults', () => {
    const resolved = resolveAssistantProfile({
      vertical: 'brewery',
      name: 'Steuben',
      assistant_profile: {
        agent_name: 'Maya',
        preferred_vocab: ['taproom', 'small-batch'],
        avoid_words: [],                            // empty → keep default ([])
      } as any,
    } as R)
    expect(resolved.agent_name).toBe('Maya')
    expect(resolved.preferred_vocab).toEqual(['taproom', 'small-batch'])
    expect(resolved.avoid_words).toEqual([])
    expect(resolved.experience_style).toBe('bartender') // still derived
  })

  it('treats whitespace-only strings as unset', () => {
    const resolved = resolveAssistantProfile({
      vertical: 'brewery',
      name: 'Steuben',
      assistant_profile: { agent_name: '   ' } as any,
    } as R)
    expect(resolved.agent_name).toBe('Your guide at Steuben')
  })
})

describe('getQuestionBounds', () => {
  it('uses category defaults when profile does not override', () => {
    expect(getQuestionBounds({ vertical: 'brewery' } as R)).toEqual({ min: 2, max: 3 })
    expect(getQuestionBounds({ vertical: 'coffee' } as R)).toEqual({ min: 3, max: 4 })
    expect(getQuestionBounds({ vertical: 'winery' } as R)).toEqual({ min: 3, max: 4 })
    expect(getQuestionBounds({ vertical: 'distillery' } as R)).toEqual({ min: 3, max: 5 })
  })

  it('respects vendor override within the absolute ceiling', () => {
    const { min, max } = getQuestionBounds({
      vertical: 'brewery',
      assistant_profile: { min_questions: 4, max_questions: 5 } as any,
    } as R)
    expect(min).toBe(4)
    expect(max).toBe(5)
  })

  it('clamps vendor max to ABSOLUTE_MAX_USER_TURNS', () => {
    const { max } = getQuestionBounds({
      vertical: 'brewery',
      assistant_profile: { min_questions: 2, max_questions: 99 } as any,
    } as R)
    expect(max).toBe(ABSOLUTE_MAX_USER_TURNS)
    expect(ABSOLUTE_MAX_USER_TURNS).toBe(6)
  })

  it('clamps min to at least 1 and keeps min <= max', () => {
    const { min, max } = getQuestionBounds({
      vertical: 'brewery',
      assistant_profile: { min_questions: 0, max_questions: 2 } as any,
    } as R)
    expect(min).toBe(1)
    expect(max).toBeGreaterThanOrEqual(min)
  })
})

describe('category registry', () => {
  it('exposes all 4 beverage verticals', () => {
    const templates = listCategoryTemplates()
    const verticals = templates.map(t => t.vertical).sort()
    expect(verticals).toEqual(['brewery', 'coffee', 'distillery', 'winery'])
  })

  it('every template has min <= max within the absolute ceiling', () => {
    for (const t of listCategoryTemplates()) {
      expect(t.min_questions).toBeGreaterThanOrEqual(1)
      expect(t.max_questions).toBeGreaterThanOrEqual(t.min_questions)
      expect(t.max_questions).toBeLessThanOrEqual(ABSOLUTE_MAX_USER_TURNS)
    }
  })

  it('every template has at least 3 question themes (so adaptive logic has options)', () => {
    for (const t of listCategoryTemplates()) {
      expect(t.question_themes.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('falls back to brewery template for an unknown vertical', () => {
    const fallback = getCategoryTemplate('unicorn' as any)
    expect(fallback.vertical).toBe('brewery')
  })
})
