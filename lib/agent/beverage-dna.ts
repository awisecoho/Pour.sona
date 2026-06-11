/**
 * Parse + validate the ===DNA=== block the chat model emits alongside its
 * ===REC=== recommendation. See docs/features/beverage-dna-spec.md.
 *
 * Two audiences, deliberately split:
 *   - `persona` is a SILENT vendor-only analytics tag (one of six canonical
 *     names). An off-list persona ⇒ the whole DNA object is dropped, so we never
 *     persist a garbage persona that would pollute the vendor's rollup.
 *   - everything else is guest-facing: `tasteLine` (the "because…" justification),
 *     plus the expandable flavor/score detail.
 *
 * DNA is additive: a missing or malformed block returns null and the caller
 * degrades gracefully (no panel). It must NEVER block the recommendation.
 *
 * Mirrors the defensive, pure-function style of lib/recommendation-enrich.ts —
 * loose input, runtime-checked, fully normalised output.
 */
import { BEVERAGE_DNA_PERSONAS, type BeverageDNA, type BeverageDnaPersona } from '@/lib/types'

const PERSONA_SET = new Set<string>(BEVERAGE_DNA_PERSONAS)
const MAX_AXES = 6

/** Coerce to an integer score in [0, 100]; non-numeric ⇒ 0. */
function clampScore(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.min(100, Math.max(0, n)))
}

/** Coerce to a [0, 1] axis value; non-numeric ⇒ 0. */
function clampUnit(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** Keep only well-formed { axis, value } entries, cap at MAX_AXES. */
function cleanFlavorProfile(raw: unknown): BeverageDNA['flavorProfile'] {
  if (!Array.isArray(raw)) return []
  const out: BeverageDNA['flavorProfile'] = []
  for (const entry of raw) {
    const axis = entry && typeof entry === 'object' && typeof (entry as any).axis === 'string'
      ? (entry as any).axis.trim()
      : ''
    if (!axis) continue
    out.push({ axis, value: clampUnit((entry as any).value) })
    if (out.length >= MAX_AXES) break
  }
  return out
}

/**
 * Extract, parse and validate the DNA block from the model's full text.
 * Returns a fully-normalised BeverageDNA, or null when there's no block, the
 * JSON is malformed, the persona is off-list, or the guest-facing tasteLine is
 * missing (it's the payoff — no point persisting DNA without it).
 */
export function parseBeverageDNA(fullText: string): BeverageDNA | null {
  const match = fullText.match(/===DNA===([\s\S]*?)===END===/)
  if (!match) return null

  let parsed: any
  try {
    parsed = JSON.parse(match[1].trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim())
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  // persona ∈ the six (vendor analytics integrity) — drop the whole object otherwise.
  if (typeof parsed.persona !== 'string' || !PERSONA_SET.has(parsed.persona)) return null
  // tasteLine is the guest payoff; without it there's nothing to reveal.
  const tasteLine = typeof parsed.tasteLine === 'string' ? parsed.tasteLine.trim() : ''
  if (!tasteLine) return null

  return {
    persona: parsed.persona as BeverageDnaPersona,
    tasteLine,
    flavorProfile: cleanFlavorProfile(parsed.flavorProfile),
    confidenceScore: clampScore(parsed.confidenceScore),
    discoveryScore: clampScore(parsed.discoveryScore),
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
  }
}
