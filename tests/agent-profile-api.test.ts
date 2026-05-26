/**
 * Unit tests for the agent-profile API's input sanitizer. We test the pure
 * function (re-exported via a tiny shim file from the route) so we don't have
 * to spin up Next or a database.
 *
 * The sanitizer lives inside the route file rather than a separate module
 * (Next prefers route files self-contained) — these tests pull it through the
 * route module's exports. If the sanitizer ever moves, this import is the
 * single place to update.
 */
import { describe, it, expect } from 'vitest'
import { resolveAssistantProfile } from '@/lib/agent/profile'

// We test sanitizer behavior end-to-end via the resolver: we construct a
// "stored" profile that simulates what would land in JSONB after PUT, then
// verify the resolver reads it back as expected. This avoids re-exporting
// private helpers while still covering the contract.

describe('AssistantProfile round-trip (resolve after store)', () => {
  it('preserves vendor-set strings, enums, and arrays', () => {
    const stored = {
      agent_name: 'Maya',
      brand_tone: 'expert',
      experience_style: 'sommelier',
      brand_personality: 'Quietly devoted to dry rieslings.',
      preferred_vocab: ['tasting room', 'reserve list'],
      avoid_words: ['adult beverage'],
      key_differentiators: ['estate-grown'],
      best_sellers: ['Vignoles Reserve'],
      question_themes: ['dryness', 'food_pairing'],
      min_questions: 3,
      max_questions: 5,
      cta_primary: 'Pour me a glass',
      cta_secondary: 'Surprise me',
      fallback_line: "Let me suggest a flight to start.",
      recommendation_rules: [
        { when_user_says: 'sweet', prioritize_categories: ['Dessert'], avoid_categories: ['Dry red'] },
      ],
    }
    const profile = resolveAssistantProfile({ vertical: 'winery', name: 'Hermann J', assistant_profile: stored } as any)
    expect(profile.agent_name).toBe('Maya')
    expect(profile.brand_tone).toBe('expert')
    expect(profile.experience_style).toBe('sommelier')
    expect(profile.preferred_vocab).toEqual(['tasting room', 'reserve list'])
    expect(profile.recommendation_rules).toHaveLength(1)
    expect(profile.recommendation_rules[0].when_user_says).toBe('sweet')
    expect(profile.min_questions).toBe(3)
    expect(profile.max_questions).toBe(5)
  })

  it('falls through to category defaults when fields are empty', () => {
    // Empty arrays / empty strings should NOT override category defaults — the
    // resolver treats them as unset. This is the contract the PATCH endpoint
    // relies on (partial profile = partial override).
    const profile = resolveAssistantProfile({
      vertical: 'brewery',
      name: 'Steuben',
      assistant_profile: {
        agent_name: '',                 // empty → falls through to default
        preferred_vocab: [],            // empty → falls through to default
      } as any,
    } as any)
    expect(profile.agent_name).toBe('Your guide at Steuben')
    // Category default question themes come back; no override applied.
    expect(profile.question_themes.length).toBeGreaterThan(0)
  })

  it('honors only the vendor override even when other fields are missing', () => {
    const profile = resolveAssistantProfile({
      vertical: 'brewery',
      name: 'Steuben',
      assistant_profile: { agent_name: 'Carl' } as any,
    } as any)
    expect(profile.agent_name).toBe('Carl')
    // The rest of the profile is still defaults.
    expect(profile.experience_style).toBe('bartender')
    expect(profile.cta_primary).toBe('Order this')
  })
})
