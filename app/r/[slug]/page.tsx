'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import type { Retailer, BlendRecommendation, BeverageDNA } from '@/lib/types'
import { DnaTasteLine, DnaDetails } from '@/app/_components/BeverageDnaReveal'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const VERTICAL_ICONS: Record<string, string> = {
  coffee: '☕',
  brewery: '🍺',
  winery: '🍷',
  distillery: '🥃',
}

const VERTICAL_NOUN: Record<string, string> = {
  coffee: 'Blend',
  brewery: 'Beer',
  distillery: 'Pour',
  winery: 'Wine',
}

const VERTICAL_PLURAL: Record<string, string> = {
  coffee: 'coffees',
  brewery: 'beers',
  distillery: 'pours',
  winery: 'wines',
}

const stripRec = (text: string) =>
  text
    .replace(/===REC===[\s\S]*?===END===/g, '')
    .replace(/===CHIPS===[\s\S]*?===END===/g, '')
    .replace(/===DNA===[\s\S]*?===END===/g, '')
    .replace(/===[\s\S]*$/, '') // hide any partial/unclosed sentinel block while streaming
    .trim()

async function fetchRetailerBootstrap(slug: string) {
  const res = await fetch(`/api/retailer?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Bootstrap failed: ${res.status}`)
  }
  return (await res.json()) as { retailer: Retailer; flights: unknown[]; sessionId: string | null }
}

// ── Brand theme ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (h.length !== 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function useTheme(retailer: Retailer | null) {
  return useMemo(() => {
    const primary = retailer?.brand_color || '#D67A31'
    const rgb = hexToRgb(primary)
    const rgbStr = rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '214,122,49'
    const luminance = rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0.5
    const onPrimary = luminance > 0.55 ? '#0A0E15' : '#E8EDF2'
    return { primary, rgbStr, onPrimary }
  }, [retailer])
}

// ── Font loader ───────────────────────────────────────────────────────────────

function useFont(retailer: Retailer | null) {
  useEffect(() => {
    if (!retailer?.brand_font_url) return
    const id = 'brand-font'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = retailer.brand_font_url
    document.head.appendChild(link)
  }, [retailer?.brand_font_url])

  return retailer?.brand_font_family || 'Georgia'
}

// ── Screens ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#12111A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#D67A31', animation: `ldot 1.3s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes ldot{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#12111A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: '#D67A31', fontSize: 32 }}>✦</div>
      <div style={{ color: '#F5F2E8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 18 }}>Guide not found</div>
      <div style={{ color: '#3A3450', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14 }}>This QR code may be inactive.</div>
    </div>
  )
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function WelcomeScreen({
  retailer,
  onStart,
  theme,
  font,
}: {
  retailer: Retailer
  onStart: () => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'
  const hasLogo = Boolean(retailer.logo_url)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#0A0E15 0%,#101622 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 28px', textAlign: 'center', position: 'relative', boxSizing: 'border-box' }}>
      {/* Ambient glow — fixed so it never expands the scroll area or clips the top on short viewports */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, rgba(${theme.rgbStr},.08) 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Logo or icon */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        {hasLogo ? (
          <div style={{ minWidth: 88, height: 100, maxWidth: 260, borderRadius: 20, overflow: 'hidden', border: `1px solid rgba(${theme.rgbStr},.18)`, background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px' }}>
            <img
              src={retailer.logo_url}
              alt={retailer.name}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: '50%', border: `1.5px solid rgba(${theme.rgbStr},.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(${theme.rgbStr},.06)`, fontSize: 32 }}>
            {VERTICAL_ICONS[retailer.vertical] || '✦'}
          </div>
        )}
      </div>

      {/* Name + location */}
      <div style={{ color: '#E8EDF2', fontSize: 34, fontWeight: 700, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.2, marginBottom: 6, letterSpacing: '-.3px' }}>
        {retailer.name}
      </div>
      {retailer.location && (
        <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginBottom: 4, letterSpacing: '.04em' }}>
          {retailer.location}
        </div>
      )}
      {retailer.tagline && (
        <div style={{ color: '#6B7588', fontSize: 15, fontStyle: 'italic', fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginBottom: 0 }}>
          {retailer.tagline}
        </div>
      )}

      {/* Divider */}
      <div style={{ width: 40, height: 1, background: `rgba(${theme.rgbStr},.2)`, margin: '28px auto' }} />

      {/* Prompt */}
      <div style={{ color: '#7B8598', fontSize: 16, lineHeight: 1.8, maxWidth: 320, marginBottom: 36, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
        I&apos;ll help you find the perfect {VERTICAL_PLURAL[retailer.vertical] || 'selection'}. Just a question or two.
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        style={{
          background: theme.primary,
          border: 'none',
          borderRadius: 50,
          padding: '15px 0',
          width: '100%',
          maxWidth: 280,
          color: theme.onPrimary,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '.15em',
          cursor: 'pointer',
          fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
          boxShadow: `0 8px 32px rgba(${theme.rgbStr},.25)`,
        }}
      >
        Find My {noun}
      </button>

      {retailer.vertical !== 'coffee' && (
        <div style={{ marginTop: 24, color: '#4A5468', fontSize: 11, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.5, maxWidth: 300 }}>
          Must be 21+. Please enjoy responsibly.
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <a
          href="https://pour-sona.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1E2531', fontSize: 11, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, letterSpacing: '.08em', textDecoration: 'none' }}
        >
          POWERED BY POURSONA
        </a>
        <a
          href="/admin/login"
          style={{ color: '#1E2531', fontSize: 10, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, letterSpacing: '.05em', textDecoration: 'none' }}
        >
          Vendor login →
        </a>
      </div>
    </div>
  )
}

// ── Chips ─────────────────────────────────────────────────────────────────────

function QuickChips({
  chips,
  onSelect,
  theme,
  font,
}: {
  chips: string[]
  onSelect: (chip: string) => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4, marginTop: 8, maxWidth: '100%', animation: 'chipFadeIn .35s ease both' }}>
      <div style={{ display: 'flex', gap: 8, paddingRight: 4, width: 'max-content' }}>
        {chips.map(chip => (
          <button
            key={chip}
            onClick={() => onSelect(chip)}
            style={{
              background: `rgba(${theme.rgbStr},.06)`,
              border: `1px solid rgba(${theme.rgbStr},.28)`,
              borderRadius: 24,
              padding: '9px 18px',
              color: theme.primary,
              fontSize: 14,
              fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Order form ────────────────────────────────────────────────────────────────

function OrderForm({
  rec,
  retailer,
  sessionId,
  onClose,
  onSuccess,
  theme,
  font,
}: {
  rec: BlendRecommendation
  retailer: Retailer
  sessionId: string
  onClose: () => void
  onSuccess: (name: string) => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const ikey = useRef(
    typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`
  )

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 15px',
    background: 'rgba(255,255,255,.06)',
    border: `1px solid rgba(${theme.rgbStr},.18)`,
    borderRadius: 11, color: '#E8EDF2',
    fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
  }

  async function submit() {
    setBusy(true); setErr('')
    const items = (rec.selectedProducts || []).map(p => ({ name: p.name, qty: 1, price: p.price ?? 0 }))
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': ikey.current },
        body: JSON.stringify({
          sessionId, retailerId: retailer.id, items,
          blendName: rec.recommendationName || rec.blendName,
          customerName: name.trim() || null,
          customerEmail: email.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Order failed')
      onSuccess(name.trim())
    } catch (e: any) {
      setErr(e.message || 'Could not place order. Please ask staff.')
      setBusy(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{
        background: '#12161F',
        border: `1px solid rgba(${theme.rgbStr},.2)`,
        borderRadius: '22px 22px 0 0',
        padding: '10px 0 0',
        width: '100%', maxWidth: 500,
        animation: 'slideUp .28s ease both',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.1)' }} />
        </div>

        <div style={{ padding: '0 24px 36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
            <div>
              <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 5, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>Confirm Order</div>
              <div style={{ color: '#E8EDF2', fontSize: 21, fontWeight: 700, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>{rec.recommendationName || rec.blendName}</div>
              {rec.tagline && <div style={{ color: '#6B7588', fontSize: 13, fontStyle: 'italic', fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginTop: 2 }}>{rec.tagline}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#2A3242', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0, marginTop: -2 }}>×</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 7, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
              Name <span style={{ color: '#2A3242', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex" type="text" style={inp} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 7, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
              Email for receipt <span style={{ color: '#2A3242', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" style={inp} />
          </div>

          {err && (
            <div style={{ background: 'rgba(224,100,100,.08)', border: '1px solid rgba(224,100,100,.2)', borderRadius: 10, padding: '11px 14px', color: '#d07070', fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginBottom: 16 }}>{err}</div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            style={{
              width: '100%', padding: '16px',
              borderRadius: 14,
              background: busy ? `rgba(${theme.rgbStr},.25)` : theme.primary,
              border: 'none', cursor: busy ? 'wait' : 'pointer',
              color: theme.onPrimary, fontSize: 14, fontWeight: 700,
              letterSpacing: '.1em', fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
              boxShadow: busy ? 'none' : `0 6px 24px rgba(${theme.rgbStr},.3)`,
              transition: 'all .2s',
            }}
          >
            {busy ? 'Placing Order…' : `Order at ${retailer.name}`}
          </button>
          <div style={{ textAlign: 'center', color: '#1E2531', fontSize: 11, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginTop: 12 }}>
            Staff will prepare your selection · no payment here
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Recommendation card (Phase 3 mobile-first reveal) ───────────────────────
// Hierarchy: image → name → reason → primary CTA. Story / serve note / pairing
// /upsell are progressively disclosed below the fold so the buy moment stays
// above it. The cocktailContext block (distillery cocktails) keeps the
// vendor's spirit visually + textually central instead of demoting it to an
// ingredient line in a recipe.

function ProductHero({ product, retailer, theme, font }: {
  product: { name: string; image_url?: string | null } | undefined
  retailer: Retailer
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const [errored, setErrored] = useState(false)
  const hasImage = !!(product?.image_url) && !errored
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      // Cap to a square that fits comfortably above the fold on a 6"-class phone.
      aspectRatio: '4 / 3',
      maxHeight: 280,
      background: hasImage
        ? '#000'
        : `radial-gradient(circle at 50% 40%, rgba(${theme.rgbStr},.18) 0%, rgba(${theme.rgbStr},.04) 60%, transparent 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      borderBottom: `1px solid rgba(${theme.rgbStr},.1)`,
    }}>
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product!.image_url!}
          alt={product!.name}
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 52, opacity: .55, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
            {VERTICAL_ICONS[retailer.vertical] || '✦'}
          </div>
          <div style={{ color: `rgba(${theme.rgbStr},.45)`, fontSize: 10, letterSpacing: '.3em', fontFamily: `'${font}', 'Space Grotesk', sans-serif`, textTransform: 'uppercase' }}>
            {retailer.name}
          </div>
        </div>
      )}
    </div>
  )
}

function RecommendationCard({
  rec,
  dna,
  retailer,
  sessionId,
  ctas,
  onOrder,
  onTryAnother,
  theme,
  font,
}: {
  rec: BlendRecommendation
  dna: BeverageDNA | null
  retailer: Retailer
  sessionId: string
  ctas: { primary: string; secondary: string }
  onOrder: () => void
  onTryAnother: () => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'
  const products = rec.selectedProducts || []
  const heroProduct = products[0]
  const cocktail = rec.cocktailContext || null

  function handleSuccess(name: string) {
    setGuestName(name); setShowForm(false); setOrdered(true); onOrder()
  }

  if (ordered) {
    return (
      <div style={{
        marginTop: 20,
        background: 'linear-gradient(145deg,#0A1622,#0C1B26)',
        border: '1px solid rgba(94,207,138,.2)',
        borderRadius: 20,
        padding: '36px 24px',
        textAlign: 'center',
        animation: 'recReveal .5s ease both',
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(94,207,138,.12)', border: '1px solid rgba(94,207,138,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
          ✓
        </div>
        <div style={{ color: '#5ecf8a', fontSize: 20, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontWeight: 700, marginBottom: 6 }}>
          {guestName ? `Enjoy it, ${guestName}!` : 'Order placed!'}
        </div>
        <div style={{ color: '#4a5a3a', fontSize: 14, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.6 }}>
          {retailer.name} will have your {noun.toLowerCase()} ready shortly.
        </div>
        {retailer.vertical !== 'coffee' && (
          <div style={{ color: '#3a4a2a', fontSize: 11, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, marginTop: 14 }}>
            Must be 21+. Please enjoy responsibly.
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {showForm && (
        <OrderForm
          rec={rec} retailer={retailer} sessionId={sessionId}
          onClose={() => setShowForm(false)} onSuccess={handleSuccess}
          theme={theme} font={font}
        />
      )}

      <div style={{
        marginTop: 20,
        background: 'linear-gradient(155deg,#141925 0%,#10141D 100%)',
        border: `1px solid rgba(${theme.rgbStr},.22)`,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: `0 0 60px rgba(${theme.rgbStr},.07), 0 24px 48px rgba(0,0,0,.5)`,
        animation: 'recReveal .45s cubic-bezier(.22,1,.36,1) both',
      }}>
        {/* Hero image */}
        <ProductHero product={heroProduct} retailer={retailer} theme={theme} font={font} />

        {/* Beverage DNA — the "because…" taste lead-in, framing the pick (above
            the product, vendor-themed). Renders nothing when no DNA. */}
        <DnaTasteLine dna={dna} primary={theme.primary} font={font} />

        {/* Cocktail context (distillery flow) — surfaces the cocktail name while
            keeping the vendor's spirit as the headline product below. */}
        {cocktail && cocktail.cocktailName && (
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{
              background: `rgba(${theme.rgbStr},.08)`,
              border: `1px solid rgba(${theme.rgbStr},.18)`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 4, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
                The cocktail
              </div>
              <div style={{ color: '#E8EDF2', fontSize: 16, fontWeight: 700, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.25 }}>
                {cocktail.cocktailName}
              </div>
              {cocktail.cocktailDescription && (
                <div style={{ color: '#9a8f78', fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.55, marginTop: 4 }}>
                  {cocktail.cocktailDescription}
                </div>
              )}
              {cocktail.builtAround && (
                <div style={{ color: theme.primary, fontSize: 11, fontStyle: 'italic', marginTop: 6, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
                  built around <strong>{cocktail.builtAround}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flavor chips */}
        {(rec.flavorProfile || []).length > 0 && (
          <div style={{ padding: '14px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(rec.flavorProfile || []).map(f => (
              <span key={f} style={{
                background: `rgba(${theme.rgbStr},.1)`,
                border: `1px solid rgba(${theme.rgbStr},.2)`,
                borderRadius: 20, padding: '4px 13px',
                color: theme.primary, fontSize: 12,
                fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
                letterSpacing: '.04em',
              }}>
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Name + tagline */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: 6, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
            {retailer.name} · {cocktail ? `Featuring ${noun.toLowerCase()}` : `Your ${noun}`}
          </div>
          <div style={{ color: '#E8EDF2', fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontSize: 26, fontWeight: 700, lineHeight: 1.12, marginBottom: 4, letterSpacing: '-.3px' }}>
            {rec.recommendationName || rec.blendName}
          </div>
          {rec.tagline && (
            <div style={{ color: theme.primary, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontSize: 14, fontStyle: 'italic', opacity: .9 }}>
              {rec.tagline}
            </div>
          )}
        </div>

        {/* Products list (compact — heroed item gets a subtle highlight) */}
        {products.length > 0 && (
          <div style={{ padding: '14px 20px 0' }}>
            {products.map((p, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < products.length - 1 ? `1px solid rgba(${theme.rgbStr},.06)` : 'none', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {i === 0 && (
                  <span style={{ marginTop: 5, width: 6, height: 6, borderRadius: '50%', background: theme.primary, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ color: '#DCE3EC', fontSize: 15, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontWeight: 600 }}>{p.name}</div>
                    {typeof p.price === 'number' && (
                      <div style={{ color: theme.primary, fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontWeight: 600 }}>${p.price.toFixed(2)}</div>
                    )}
                  </div>
                  {p.why && <div style={{ color: '#6B7588', fontSize: 13, marginTop: 3, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.5 }}>{p.why}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Why it fits — the punch line for the buy moment */}
        {rec.whyItFitsYou && (
          <div style={{ margin: '14px 20px 0', background: `rgba(${theme.rgbStr},.05)`, border: `1px solid rgba(${theme.rgbStr},.12)`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ color: `rgba(${theme.rgbStr},.5)`, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 4, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>Why this fits you</div>
            <div style={{ color: '#C4CDD9', fontSize: 14, lineHeight: 1.6, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>{rec.whyItFitsYou}</div>
          </div>
        )}

        {/* Ordering off (no POS / fulfillment flow): point the guest at staff
            instead of a dead-end order form. Only explicit false disables. */}
        {retailer.ordering_enabled === false && (
          <div style={{ margin: '18px 20px 0', background: `rgba(${theme.rgbStr},.07)`, border: `1px solid rgba(${theme.rgbStr},.18)`, borderRadius: 12, padding: '13px 15px', textAlign: 'center' }}>
            <div style={{ color: theme.primary, fontSize: 13, fontWeight: 600, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.55 }}>
              Show this screen to our staff and they&apos;ll get it started for you.
            </div>
          </div>
        )}

        {/* CTAs — primary + secondary side-by-side, mobile-comfortable hit areas */}
        <div style={{ padding: '18px 20px 12px', display: 'flex', gap: 10 }}>
          {retailer.ordering_enabled !== false && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              flex: 1, padding: '15px 12px',
              borderRadius: 14,
              background: theme.primary,
              border: 'none', cursor: 'pointer',
              color: theme.onPrimary, fontSize: 13, fontWeight: 700,
              letterSpacing: '.1em', fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
              boxShadow: `0 8px 28px rgba(${theme.rgbStr},.35)`,
              textTransform: 'uppercase',
            }}
          >
            {ctas.primary} →
          </button>
          )}
          <button
            onClick={onTryAnother}
            style={{
              // Full-width when it's the only CTA (ordering disabled).
              ...(retailer.ordering_enabled === false ? { flex: 1 } : {}),
              padding: '15px 16px',
              borderRadius: 14,
              background: 'transparent',
              border: `1px solid rgba(${theme.rgbStr},.28)`,
              cursor: 'pointer',
              color: theme.primary, fontSize: 12, fontWeight: 600,
              letterSpacing: '.06em', fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
              whiteSpace: 'nowrap',
            }}
          >
            {ctas.secondary}
          </button>
        </div>

        {/* Beverage DNA — expandable taste profile (flavor bars + scores +
            summary), collapsed by default so the buy moment stays primary. */}
        <DnaDetails dna={dna} primary={theme.primary} rgbStr={theme.rgbStr} font={font} />

        {/* Vendor website — let guests explore the full brand */}
        {retailer.source_url && (
          <div style={{ padding: '0 20px 4px', textAlign: 'center' }}>
            <a href={retailer.source_url} target="_blank" rel="noopener noreferrer"
              style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none', fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
              Visit {retailer.name} ↗
            </a>
          </div>
        )}

        {/* Pairing + upsell — small secondary touches, not the focus */}
        {(rec.pairing || rec.upsellSuggestion) && (
          <div style={{ padding: '0 20px 4px' }}>
            {rec.pairing && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', color: '#6B7588', fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.55 }}>
                <span style={{ color: theme.primary, fontWeight: 700 }}>✦</span>
                <span><span style={{ color: `rgba(${theme.rgbStr},.7)`, fontWeight: 600 }}>Pair it with:</span> {rec.pairing}</span>
              </div>
            )}
            {rec.upsellSuggestion?.name && (
              <div style={{
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 10,
                background: `rgba(${theme.rgbStr},.04)`,
                border: `1px dashed rgba(${theme.rgbStr},.18)`,
              }}>
                <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 3, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>While you&apos;re here</div>
                <div style={{ color: '#C4CDD9', fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, fontWeight: 600 }}>{rec.upsellSuggestion.name}</div>
                {rec.upsellSuggestion.reason && (
                  <div style={{ color: '#6B7588', fontSize: 12, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.5, marginTop: 2 }}>{rec.upsellSuggestion.reason}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expandable: story + serve note (kept below the fold so the buy moment stays primary) */}
        {(rec.story || rec.serveNote) && (
          <div style={{ padding: '4px 20px 18px' }}>
            <button
              onClick={() => setShowDetails(d => !d)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: `rgba(${theme.rgbStr},.55)`,
                fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase',
                fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
                padding: '8px 0',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {showDetails ? '− Hide the story' : '+ Read the story'}
            </button>
            {showDetails && (
              <div style={{ marginTop: 6, animation: 'recReveal .25s ease both' }}>
                {rec.story && (
                  <div style={{ color: '#9a8f78', fontSize: 13.5, lineHeight: 1.75, fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
                    {rec.story}
                  </div>
                )}
                {rec.serveNote && (
                  <div style={{ marginTop: 10, color: '#4A5468', fontSize: 12.5, fontStyle: 'italic', fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.6 }}>
                    {rec.serveNote}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerPage({ params }: { params: { slug: string } }) {
  const [retailer, setRetailer] = useState<Retailer | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [rec, setRec] = useState<BlendRecommendation | null>(null)
  const [dna, setDna] = useState<BeverageDNA | null>(null)
  const [ordered, setOrdered] = useState(false)
  const [started, setStarted] = useState(false)
  // Quick-reply chips suggested by the AI for its current question — kept in sync
  // with what was actually asked, so the options always match the question.
  const [chips, setChips] = useState<string[]>([])
  // Phase 3: vendor CTA copy + fallback line, populated by the chat endpoint on
  // each `done` frame. We keep a default until the first response lands so the
  // first render never has empty button labels.
  const [ctas, setCtas] = useState<{ primary: string; secondary: string }>({ primary: 'Order this', secondary: 'Show me another' })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const theme = useTheme(retailer)
  const font = useFont(retailer)

  useEffect(() => {
    async function init() {
      try {
        const boot = await fetchRetailerBootstrap(params.slug)
        if (!boot) { setNotFound(true); setLoading(false); return }
        setRetailer(boot.retailer)
        setSessionId(boot.sessionId)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    void init()
  }, [params.slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, rec])

  const streamChat = async (msgs: Message[], opts?: { forceRec?: boolean }) => {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setChips([])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    let full = ''
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs, forceRec: opts?.forceRec === true }),
      })

      if (!res.ok) {
        const msg =
          res.status === 402 ? 'This experience is currently inactive. Please contact the venue.' :
          res.status === 429 ? 'One moment — please wait before sending another message.' :
          'Something went wrong. Please try again.'
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: msg }; return u })
        setStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6))
            if (p.delta) {
              full += p.delta
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: stripRec(full), streaming: true }; return u })
            }
            if (p.done) {
              if (p.recData) setRec(p.recData)
              setDna(p.dna ?? null)
              if (Array.isArray(p.chips)) setChips(p.chips.filter((c: unknown) => typeof c === 'string').slice(0, 4))
              if (p.ctas && typeof p.ctas.primary === 'string' && typeof p.ctas.secondary === 'string') {
                setCtas({ primary: p.ctas.primary, secondary: p.ctas.secondary })
              }
              setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: stripRec(p.text || full), streaming: false }; return u })
            }
          } catch {}
        }
      }
    } catch {}

    setStreaming(false)
  }

  const start = () => {
    setStarted(true)
    void streamChat([{ role: 'user', content: 'START' }])
  }

  const send = (override?: string, opts?: { forceRec?: boolean }) => {
    const text = override ?? input
    if (!text.trim() || streaming) return
    setChips([])
    const msg: Message = { role: 'user', content: text.trim() }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    void streamChat(next.map(m => ({ role: m.role, content: m.content })), opts)
  }

  const chipSelect = (chip: string) => send(chip)

  // Phase 3 secondary CTA: clear the current rec and re-engage the assistant
  // with a "show me a different match" turn. Conversation history is preserved
  // so the next recommendation can build on what we already learned.
  const tryAnother = () => {
    if (streaming) return
    setRec(null)
    setDna(null)
    setChips([])
    const next: Message[] = [...messages, { role: 'user', content: 'Show me a different option — what else fits, based on what I told you?' }]
    setMessages(next)
    // forceRec: the old card is already cleared, so a prose-only reply would
    // leave the guest with nothing to order — guarantee a new ===REC=== block.
    void streamChat(next.map(m => ({ role: m.role, content: m.content })), { forceRec: true })
  }

  if (loading) return <LoadingScreen />
  if (notFound || !retailer) return <NotFound />

  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'

  const userTurns = messages.filter(m => m.role === 'user').length

  if (!started) {
    return <WelcomeScreen retailer={retailer} onStart={start} theme={theme} font={font} />
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(170deg,#0A0E15 0%,#101622 100%)', fontFamily: `'${font}', 'Space Grotesk', sans-serif` }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:.2;transform:scale(.65)}50%{opacity:1;transform:scale(1)}}
        @keyframes cursor{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes chipFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes recReveal{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(${theme.rgbStr},.15)}
        textarea::placeholder{color:#2A3242}
        button:active{opacity:.8}
      `}</style>

      {/* Header */}
      <div style={{
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 11,
        background: 'rgba(5,3,1,.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid rgba(${theme.rgbStr},.1)`,
        flexShrink: 0,
      }}>
        {retailer.logo_url ? (
          <div style={{ height: 34, maxWidth: 120, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <img src={retailer.logo_url} alt="" style={{ height: '100%', maxWidth: 120, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }} />
          </div>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `rgba(${theme.rgbStr},.1)`, border: `1px solid rgba(${theme.rgbStr},.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
            {VERTICAL_ICONS[retailer.vertical] || '✦'}
          </div>
        )}
        <div>
          <div style={{ color: '#ede5cc', fontSize: 15, fontWeight: 600, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.2 }}>{retailer.name}</div>
          <div style={{ color: '#1E2531', fontSize: 9, letterSpacing: '.18em', marginTop: 1 }}>PERSONAL GUIDE</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1
          const isAI = msg.role === 'assistant'
          return (
            <div key={i} style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', alignItems: isAI ? 'flex-start' : 'flex-end' }}>
              <div style={{
                maxWidth: '84%',
                padding: isAI ? '13px 17px' : '11px 16px',
                fontSize: 15,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                background: isAI ? 'rgba(255,255,255,.055)' : `rgba(${theme.rgbStr},.1)`,
                border: isAI ? '1px solid rgba(255,255,255,.07)' : `1px solid rgba(${theme.rgbStr},.22)`,
                borderRadius: isAI ? '4px 18px 18px 18px' : '18px 18px 4px 18px',
                color: isAI ? '#cfc5a8' : theme.primary,
                fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
              }}>
                {msg.content === '' && msg.streaming ? (
                  <span style={{ display: 'inline-flex', gap: 5, padding: '2px 0' }}>
                    {[0, 1, 2].map(j => (
                      <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: theme.primary, animation: `blink 1.3s ease-in-out ${j * 0.2}s infinite`, display: 'inline-block' }} />
                    ))}
                  </span>
                ) : (
                  <>
                    {msg.content}
                    {msg.streaming && msg.content && (
                      <span style={{ display: 'inline-block', width: 1.5, height: '1em', background: theme.primary, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'cursor .85s ease-in-out infinite' }} />
                    )}
                  </>
                )}
              </div>

              {/* AI-suggested quick replies for the last question — always match it */}
              {isAI && !msg.streaming && isLast && !rec && chips.length > 0 && (
                <QuickChips chips={chips} onSelect={chipSelect} theme={theme} font={font} />
              )}
            </div>
          )
        })}

        {rec && (
          <RecommendationCard
            rec={rec}
            dna={dna}
            retailer={retailer}
            sessionId={sessionId!}
            ctas={ctas}
            onOrder={() => setOrdered(true)}
            onTryAnother={tryAnother}
            theme={theme}
            font={font}
          />
        )}

        <div ref={bottomRef} style={{ height: 12 }} />
      </div>

      {/* "Just recommend" nudge */}
      {userTurns >= 2 && !rec && !streaming && (
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 16px 6px', alignSelf: 'stretch' }}>
          <button
            onClick={() => send('Just give me a recommendation.', { forceRec: true })}
            style={{
              background: 'none',
              border: `1px solid rgba(${theme.rgbStr},.18)`,
              borderRadius: 20, padding: '7px 16px',
              color: `rgba(${theme.rgbStr},.55)`,
              fontSize: 12, letterSpacing: '.1em',
              cursor: 'pointer', fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
            }}
          >
            ✦ Just give me a recommendation
          </button>
        </div>
      )}

      {/* Input */}
      {!rec && (
        <div style={{
          borderTop: `1px solid rgba(${theme.rgbStr},.08)`,
          padding: '10px 14px 14px',
          background: 'rgba(4,3,1,.7)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
          maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); if (e.target.value) setChips([]) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type your answer…"
              rows={1}
              disabled={streaming}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,.04)',
                border: `1px solid rgba(${theme.rgbStr},.14)`,
                borderRadius: 12,
                padding: '12px 15px',
                color: '#ede5cc',
                fontFamily: `'${font}', 'Space Grotesk', sans-serif`,
                fontSize: 15,
                resize: 'none',
                outline: 'none',
                minHeight: 44,
                opacity: streaming ? 0.5 : 1,
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => send()}
              disabled={streaming || !input.trim()}
              style={{
                background: input.trim() && !streaming ? theme.primary : 'rgba(255,255,255,.04)',
                border: `1px solid rgba(${theme.rgbStr},.16)`,
                borderRadius: 10,
                width: 44, height: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: input.trim() && !streaming ? theme.onPrimary : '#1E2531',
                cursor: input.trim() && !streaming ? 'pointer' : 'default',
                fontSize: 16,
                transition: 'all .15s',
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
