/**
 * AssistantProfile loader + default derivation.
 *
 * A retailer row may or may not have assistant_profile populated (Phase 1 ships
 * with the column NULL for every existing vendor). resolveAssistantProfile()
 * always returns a *complete* profile by overlaying stored values onto sensible
 * defaults derived from the category template and existing retailer fields.
 *
 * This is the single source of truth the prompt builder reads from — no caller
 * should ever reach into retailer.assistant_profile directly, or they'll break
 * on null.
 */
import type { Retailer, AssistantProfile } from '@/lib/types'
import { getCategoryTemplate } from '@/lib/agent/categories'

/**
 * Build a sensible default AssistantProfile for a retailer that hasn't been
 * configured yet. Pulls from the category template + existing retailer fields
 * (host_persona, featured items, tagline) so the assistant has working brand
 * context on day one.
 */
export function deriveDefaultProfile(retailer: Partial<Retailer>): AssistantProfile {
  const category = getCategoryTemplate(retailer.vertical)
  const name = retailer.name?.trim() || 'this place'

  // agent_name: prefer host_persona (set by the Vendor Builder), else generic.
  const agent_name = retailer.host_persona?.trim() || `Your guide at ${name}`

  // best_sellers: lift names from featured_items_json when available.
  const featured = Array.isArray(retailer.featured_items_json) ? retailer.featured_items_json : []
  const best_sellers = featured.map((f) => f?.name).filter((n): n is string => typeof n === 'string' && n.length > 0)

  // All category themes are eligible by default; the model picks the relevant ones.
  const question_themes = category.question_themes.map((t) => t.id)

  return {
    agent_name,
    brand_tone: category.default_tone,
    brand_personality: '',                            // empty — story/culture fields cover this in the prompt
    experience_style: category.default_experience_style,
    preferred_vocab: [],
    avoid_words: [],
    key_differentiators: [],
    best_sellers,
    recommendation_rules: [],
    min_questions: undefined,                         // undefined → use category default
    max_questions: undefined,
    question_themes,
    cta_primary: 'Order this',
    cta_secondary: 'Show me another',
    fallback_line: 'No worries — let me suggest a good starting point.',
  }
}

/**
 * Merge a stored partial profile onto derived defaults. Stored fields win when
 * present and non-empty; undefined / null / empty-array values are treated as
 * "unset" so defaults shine through.
 */
export function resolveAssistantProfile(retailer: Partial<Retailer>): AssistantProfile {
  const defaults = deriveDefaultProfile(retailer)
  const stored = retailer.assistant_profile
  if (!stored || typeof stored !== 'object') return defaults

  return {
    agent_name:           pickString(stored.agent_name,           defaults.agent_name),
    brand_tone:           (stored.brand_tone           ?? defaults.brand_tone),
    brand_personality:    pickString(stored.brand_personality,    defaults.brand_personality),
    experience_style:     (stored.experience_style     ?? defaults.experience_style),
    preferred_vocab:      pickArray(stored.preferred_vocab,       defaults.preferred_vocab),
    avoid_words:          pickArray(stored.avoid_words,           defaults.avoid_words),
    key_differentiators:  pickArray(stored.key_differentiators,   defaults.key_differentiators),
    best_sellers:         pickArray(stored.best_sellers,          defaults.best_sellers),
    recommendation_rules: Array.isArray(stored.recommendation_rules) ? stored.recommendation_rules : defaults.recommendation_rules,
    min_questions:        typeof stored.min_questions === 'number' ? stored.min_questions : defaults.min_questions,
    max_questions:        typeof stored.max_questions === 'number' ? stored.max_questions : defaults.max_questions,
    question_themes:      pickArray(stored.question_themes,       defaults.question_themes),
    cta_primary:          pickString(stored.cta_primary,          defaults.cta_primary),
    cta_secondary:        pickString(stored.cta_secondary,        defaults.cta_secondary),
    fallback_line:        pickString(stored.fallback_line,        defaults.fallback_line),
  }
}

/**
 * Effective question count bounds for a retailer — vendor override wins over
 * the category default. Also enforces a hard absolute ceiling of 6 turns so a
 * misconfigured profile can't burn unbounded tokens per session.
 */
export const ABSOLUTE_MAX_USER_TURNS = 6

export function getQuestionBounds(retailer: Partial<Retailer>): { min: number; max: number } {
  const profile = resolveAssistantProfile(retailer)
  const category = getCategoryTemplate(retailer.vertical)
  const min = Math.max(1, profile.min_questions ?? category.min_questions)
  const maxRaw = profile.max_questions ?? category.max_questions
  const max = Math.min(ABSOLUTE_MAX_USER_TURNS, Math.max(min, maxRaw))
  return { min, max }
}

// ── Small helpers (kept private; not exported) ───────────────────────────────
function pickString(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function pickArray<T>(v: unknown, fallback: T[]): T[] {
  if (!Array.isArray(v) || v.length === 0) return fallback
  return v as T[]
}
