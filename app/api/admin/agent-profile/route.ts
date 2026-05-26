/**
 * Per-vendor AssistantProfile editor backing API.
 *
 *   GET  /api/admin/agent-profile?retailerId=...
 *     Returns { profile (resolved, with defaults applied), stored (raw or null),
 *               category_template, bounds: { min, max } } so the form can show
 *               which fields are vendor-set vs. category defaults.
 *
 *   PUT  /api/admin/agent-profile
 *     body: { retailerId, profile: Partial<AssistantProfile> }
 *     Validates / sanitizes / caps array sizes, writes the JSONB column, returns
 *     the resolved profile post-save.
 *
 * Auth: identical to /api/admin/retailer — requires manager-or-owner on the
 * retailer. Anonymous callers get 401 (post-auth-fix from earlier this session).
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { authorizeRetailer } from '@/lib/authz'
import { resolveAssistantProfile, getQuestionBounds, ABSOLUTE_MAX_USER_TURNS } from '@/lib/agent/profile'
import { getCategoryTemplate } from '@/lib/agent/categories'
import { sanitizePromptInput } from '@/lib/security'
import type { AssistantProfile, BrandTone, ExperienceStyle, RecommendationRule } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Hard caps so a misconfigured/abusive profile can't bloat the system prompt.
const CAP_VOCAB           = 20
const CAP_DIFFERENTIATORS = 10
const CAP_BEST_SELLERS    = 20
const CAP_RULES           = 15
const CAP_THEMES          = 12
const CAP_STR             = 280              // single string field
const CAP_LONG_STR        = 1000             // brand_personality

const BRAND_TONES: BrandTone[] = ['warm', 'expert', 'playful', 'minimalist', 'reverent']
const EXPERIENCE_STYLES: ExperienceStyle[] = ['bartender', 'sommelier', 'barista', 'spirits-guide', 'host']

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await authorizeRetailer(retailerId, 'staff')
    if (!authz.ok) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      'select id, name, vertical, host_persona, featured_items_json, assistant_profile from retailers where id = $1 limit 1',
      [retailerId]
    )
    const retailer = result.rows[0]
    if (!retailer) {
      return NextResponse.json({ ok: false, error: 'retailer not found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      profile: resolveAssistantProfile(retailer),
      stored: retailer.assistant_profile || null,
      category_template: getCategoryTemplate(retailer.vertical),
      bounds: getQuestionBounds(retailer),
      absolute_max_questions: ABSOLUTE_MAX_USER_TURNS,
    })
  } catch (error) {
    console.error('[api/admin/agent-profile] get failed:', error)
    return NextResponse.json({ ok: false, error: 'agent profile lookup failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { retailerId, profile } = await req.json()
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await authorizeRetailer(retailerId, 'manager')
    if (!authz.ok) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    // Look up the retailer so we know the category template for theme validation.
    const before = await dbQuery(
      'select id, vertical from retailers where id = $1 limit 1',
      [retailerId]
    )
    if (!before.rows[0]) {
      return NextResponse.json({ ok: false, error: 'retailer not found' }, { status: 404 })
    }
    const validThemeIds = new Set(
      getCategoryTemplate(before.rows[0].vertical).question_themes.map((t) => t.id)
    )

    const cleaned = sanitizeProfile(profile, validThemeIds)
    if (cleaned.error) {
      return NextResponse.json({ ok: false, error: cleaned.error }, { status: 400 })
    }

    // A null/empty profile means "reset to defaults" — we store SQL NULL so the
    // resolver synthesizes from the category template on every read.
    const writeValue = cleaned.profile === null ? null : JSON.stringify(cleaned.profile)

    const result = await dbQuery(
      `update retailers
       set assistant_profile = $1::jsonb
       where id = $2
       returning id, name, vertical, host_persona, featured_items_json, assistant_profile`,
      [writeValue, retailerId]
    )

    const saved = result.rows[0]
    return NextResponse.json({
      ok: true,
      profile: resolveAssistantProfile(saved),
      stored: saved?.assistant_profile || null,
      bounds: getQuestionBounds(saved),
    })
  } catch (error) {
    console.error('[api/admin/agent-profile] update failed:', error)
    return NextResponse.json({ ok: false, error: 'agent profile update failed' }, { status: 500 })
  }
}

// ── Server-side sanitizer ────────────────────────────────────────────────────
// Returns either { profile: <clean partial or null> } or { error: string }.
// We accept a partial — only fields the client explicitly sent get persisted.
// A reset is signaled by sending `null`, in which case we write SQL NULL.
type SanitizeResult = { profile: Partial<AssistantProfile> | null; error?: undefined } | { error: string; profile?: undefined }

function sanitizeProfile(input: unknown, validThemeIds: Set<string>): SanitizeResult {
  if (input === null) return { profile: null }
  if (!input || typeof input !== 'object') return { error: 'profile must be an object or null' }

  const out: Partial<AssistantProfile> = {}
  const i = input as Record<string, unknown>

  // — Strings (with sanitization + length cap) —
  if ('agent_name' in i)         out.agent_name        = cleanStr(i.agent_name, CAP_STR)
  if ('brand_personality' in i)  out.brand_personality = cleanStr(i.brand_personality, CAP_LONG_STR)
  if ('cta_primary' in i)        out.cta_primary       = cleanStr(i.cta_primary, CAP_STR)
  if ('cta_secondary' in i)      out.cta_secondary     = cleanStr(i.cta_secondary, CAP_STR)
  if ('fallback_line' in i)      out.fallback_line     = cleanStr(i.fallback_line, CAP_LONG_STR)

  // — Enums —
  if ('brand_tone' in i) {
    if (i.brand_tone !== null && !BRAND_TONES.includes(i.brand_tone as BrandTone)) {
      return { error: `brand_tone must be one of: ${BRAND_TONES.join(', ')}` }
    }
    if (i.brand_tone !== null) out.brand_tone = i.brand_tone as BrandTone
  }
  if ('experience_style' in i) {
    if (i.experience_style !== null && !EXPERIENCE_STYLES.includes(i.experience_style as ExperienceStyle)) {
      return { error: `experience_style must be one of: ${EXPERIENCE_STYLES.join(', ')}` }
    }
    if (i.experience_style !== null) out.experience_style = i.experience_style as ExperienceStyle
  }

  // — String arrays (length caps + per-item cap) —
  if ('preferred_vocab' in i)     out.preferred_vocab     = cleanStrArray(i.preferred_vocab, CAP_VOCAB)
  if ('avoid_words' in i)         out.avoid_words         = cleanStrArray(i.avoid_words, CAP_VOCAB)
  if ('key_differentiators' in i) out.key_differentiators = cleanStrArray(i.key_differentiators, CAP_DIFFERENTIATORS)
  if ('best_sellers' in i)        out.best_sellers        = cleanStrArray(i.best_sellers, CAP_BEST_SELLERS)

  // — Question themes: only accept IDs that exist in this vertical's template —
  if ('question_themes' in i) {
    const all = cleanStrArray(i.question_themes, CAP_THEMES)
    out.question_themes = all.filter((id) => validThemeIds.has(id))
  }

  // — Numbers (bounded to absolute ceiling) —
  if ('min_questions' in i) {
    const n = Number(i.min_questions)
    if (Number.isFinite(n) && n >= 1 && n <= ABSOLUTE_MAX_USER_TURNS) out.min_questions = Math.floor(n)
  }
  if ('max_questions' in i) {
    const n = Number(i.max_questions)
    if (Number.isFinite(n) && n >= 1 && n <= ABSOLUTE_MAX_USER_TURNS) out.max_questions = Math.floor(n)
  }
  if (typeof out.min_questions === 'number' && typeof out.max_questions === 'number' && out.min_questions > out.max_questions) {
    return { error: 'min_questions cannot exceed max_questions' }
  }

  // — Recommendation rules (structured) —
  if ('recommendation_rules' in i) {
    if (!Array.isArray(i.recommendation_rules)) {
      return { error: 'recommendation_rules must be an array' }
    }
    const rules: RecommendationRule[] = []
    for (const raw of (i.recommendation_rules as unknown[]).slice(0, CAP_RULES)) {
      if (!raw || typeof raw !== 'object') continue
      const r = raw as Record<string, unknown>
      const trigger = cleanStr(r.when_user_says, CAP_STR)
      if (!trigger) continue                        // drop empty rules silently
      rules.push({
        when_user_says:         trigger,
        prioritize_categories:  cleanStrArray(r.prioritize_categories, CAP_VOCAB),
        avoid_categories:       cleanStrArray(r.avoid_categories,      CAP_VOCAB),
      })
    }
    out.recommendation_rules = rules
  }

  return { profile: out }
}

function cleanStr(v: unknown, cap: number): string {
  if (typeof v !== 'string') return ''
  return sanitizePromptInput(v).slice(0, cap)
}

function cleanStrArray(v: unknown, cap: number): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    const cleaned = sanitizePromptInput(item).slice(0, CAP_STR)
    if (cleaned.length > 0) out.push(cleaned)
    if (out.length >= cap) break
  }
  return out
}
