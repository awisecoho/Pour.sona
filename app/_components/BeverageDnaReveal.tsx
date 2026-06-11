'use client'

/**
 * Guest-facing Beverage DNA reveal — the Phase B UI.
 *
 * Product-first, taste as the "because" (see docs/features/beverage-dna-spec.md).
 * Two pieces, placed separately inside the recommendation card:
 *   - <DnaTasteLine>  — the "because…" lead-in ABOVE the product. Always visible.
 *   - <DnaDetails>    — the "See your taste profile" expandable BELOW the CTA:
 *                       flavor bars + match/adventure pills + summary.
 *
 * Both render in the VENDOR theme (primary / rgbStr / font) — never Poursona
 * colors — and render nothing when `dna` is absent. The recommendation never
 * depends on DNA; a missing block simply means no panel. The persona is NOT
 * rendered here: it's a silent vendor-only analytics tag.
 */
import { useState } from 'react'
import type { BeverageDNA } from '@/lib/types'

interface DnaThemeProps {
  primary: string
  rgbStr: string
  font: string
}

const stack = (font: string) => `'${font}', 'Space Grotesk', sans-serif`
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The "Because you go for…" lead-in, placed directly above the product. */
export function DnaTasteLine({ dna, primary, font }: { dna: BeverageDNA | null } & Omit<DnaThemeProps, 'rgbStr'>) {
  if (!dna?.tasteLine) return null
  return (
    <div style={{ padding: '16px 20px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        color: '#C4CDD9', fontSize: 14.5, lineHeight: 1.55,
        fontFamily: stack(font), fontStyle: 'italic',
      }}>
        <span style={{ color: primary, fontWeight: 700, fontStyle: 'normal', flexShrink: 0 }}>✦</span>
        <span>{dna.tasteLine}</span>
      </div>
    </div>
  )
}

/** Expandable taste detail (flavor bars + scores + summary), placed below the CTA. */
export function DnaDetails({ dna, primary, rgbStr, font }: { dna: BeverageDNA | null } & DnaThemeProps) {
  const [open, setOpen] = useState(false)
  if (!dna) return null
  const hasDetail =
    dna.flavorProfile.length > 0 || !!dna.summary || dna.confidenceScore > 0 || dna.discoveryScore > 0
  if (!hasDetail) return null

  return (
    <div style={{ padding: '4px 20px 18px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          color: `rgba(${rgbStr},.55)`, fontSize: 12, letterSpacing: '.12em',
          textTransform: 'uppercase', fontFamily: stack(font),
          padding: '8px 0', cursor: 'pointer', textAlign: 'left',
        }}
      >
        {open ? '− Hide your taste profile' : '+ See your taste profile'}
      </button>

      {open && (
        <div style={{ marginTop: 8, animation: 'recReveal .25s ease both' }}>
          {dna.flavorProfile.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {dna.flavorProfile.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 82, flexShrink: 0, textAlign: 'right', color: '#9aa3b2', fontSize: 12, fontFamily: stack(font) }}>
                    {f.axis}
                  </div>
                  <div style={{ flex: 1, height: 7, borderRadius: 4, background: `rgba(${rgbStr},.1)`, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(clamp01(f.value) * 100)}%`, height: '100%', borderRadius: 4, background: primary }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(dna.confidenceScore > 0 || dna.discoveryScore > 0) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: dna.summary ? 12 : 0 }}>
              <ScorePill label="Match" value={dna.confidenceScore} primary={primary} rgbStr={rgbStr} font={font} />
              <ScorePill label="Adventure" value={dna.discoveryScore} primary={primary} rgbStr={rgbStr} font={font} />
            </div>
          )}

          {dna.summary && (
            <div style={{ color: '#9a8f78', fontSize: 13, lineHeight: 1.7, fontFamily: stack(font) }}>
              {dna.summary}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScorePill({ label, value, primary, rgbStr, font }: { label: string; value: number } & DnaThemeProps) {
  return (
    <div style={{
      flex: 1, padding: '10px 12px', borderRadius: 12, textAlign: 'center',
      background: `rgba(${rgbStr},.06)`, border: `1px solid rgba(${rgbStr},.16)`,
    }}>
      <div style={{ color: primary, fontSize: 20, fontWeight: 700, lineHeight: 1, fontFamily: stack(font) }}>
        {Math.round(value)}<span style={{ fontSize: 11, opacity: .6 }}>/100</span>
      </div>
      <div style={{ color: `rgba(${rgbStr},.5)`, fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', marginTop: 5, fontFamily: stack(font) }}>
        {label}
      </div>
    </div>
  )
}
