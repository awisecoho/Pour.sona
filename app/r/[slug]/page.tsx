'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import type { Retailer, BlendRecommendation } from '@/lib/types'

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
    const primary = retailer?.brand_color || '#C9A84C'
    const rgb = hexToRgb(primary)
    const rgbStr = rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '201,168,76'
    const luminance = rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0.5
    const onPrimary = luminance > 0.55 ? '#0a0603' : '#F5ECD7'
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
    <div style={{ minHeight: '100vh', background: '#080604', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', animation: `ldot 1.3s ease-in-out ${i * 0.18}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes ldot{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#080604', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
      <div style={{ color: '#C9A84C', fontSize: 32 }}>✦</div>
      <div style={{ color: '#d4c8a8', fontFamily: 'Georgia, serif', fontSize: 18 }}>Guide not found</div>
      <div style={{ color: '#4a3a1a', fontFamily: 'Georgia, serif', fontSize: 14 }}>This QR code may be inactive.</div>
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(170deg,#080604 0%,#0c1208 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle, rgba(${theme.rgbStr},.08) 0%, transparent 70%)`, pointerEvents: 'none' }} />

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
      <div style={{ color: '#F5ECD7', fontSize: 34, fontWeight: 700, fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.2, marginBottom: 6, letterSpacing: '-.3px' }}>
        {retailer.name}
      </div>
      {retailer.location && (
        <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 13, fontFamily: `'${font}', Georgia, serif`, marginBottom: 4, letterSpacing: '.04em' }}>
          {retailer.location}
        </div>
      )}
      {retailer.tagline && (
        <div style={{ color: '#6a5a3a', fontSize: 15, fontStyle: 'italic', fontFamily: `'${font}', Georgia, serif`, marginBottom: 0 }}>
          {retailer.tagline}
        </div>
      )}

      {/* Divider */}
      <div style={{ width: 40, height: 1, background: `rgba(${theme.rgbStr},.2)`, margin: '28px auto' }} />

      {/* Prompt */}
      <div style={{ color: '#8a7a5a', fontSize: 16, lineHeight: 1.8, maxWidth: 320, marginBottom: 36, fontFamily: `'${font}', Georgia, serif` }}>
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
          fontFamily: `'${font}', Georgia, serif`,
          boxShadow: `0 8px 32px rgba(${theme.rgbStr},.25)`,
        }}
      >
        Find My {noun}
      </button>

      {retailer.vertical !== 'coffee' && (
        <div style={{ marginTop: 24, color: '#5a4a2a', fontSize: 11, fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.5, maxWidth: 300 }}>
          Must be 21+. Please enjoy responsibly.
        </div>
      )}
      <div style={{ marginTop: 16, color: '#2a1e0a', fontSize: 11, fontFamily: `'${font}', Georgia, serif`, letterSpacing: '.08em' }}>
        POWERED BY POURSONA
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
              fontFamily: `'${font}', Georgia, serif`,
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
    borderRadius: 11, color: '#F5ECD7',
    fontFamily: `'${font}', Georgia, serif`, fontSize: 15,
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
        background: '#0d0a07',
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
              <div style={{ color: `rgba(${theme.rgbStr},.6)`, fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', marginBottom: 5, fontFamily: `'${font}', Georgia, serif` }}>Confirm Order</div>
              <div style={{ color: '#F5ECD7', fontSize: 21, fontWeight: 700, fontFamily: `'${font}', Georgia, serif` }}>{rec.recommendationName || rec.blendName}</div>
              {rec.tagline && <div style={{ color: '#6a5a3a', fontSize: 13, fontStyle: 'italic', fontFamily: `'${font}', Georgia, serif`, marginTop: 2 }}>{rec.tagline}</div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#3a2a0a', fontSize: 24, cursor: 'pointer', lineHeight: 1, padding: 0, marginTop: -2 }}>×</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 7, fontFamily: `'${font}', Georgia, serif` }}>
              Name <span style={{ color: '#3a2a0a', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex" type="text" style={inp} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 7, fontFamily: `'${font}', Georgia, serif` }}>
              Email for receipt <span style={{ color: '#3a2a0a', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" style={inp} />
          </div>

          {err && (
            <div style={{ background: 'rgba(224,100,100,.08)', border: '1px solid rgba(224,100,100,.2)', borderRadius: 10, padding: '11px 14px', color: '#d07070', fontSize: 13, fontFamily: `'${font}', Georgia, serif`, marginBottom: 16 }}>{err}</div>
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
              letterSpacing: '.1em', fontFamily: `'${font}', Georgia, serif`,
              boxShadow: busy ? 'none' : `0 6px 24px rgba(${theme.rgbStr},.3)`,
              transition: 'all .2s',
            }}
          >
            {busy ? 'Placing Order…' : `Order at ${retailer.name}`}
          </button>
          <div style={{ textAlign: 'center', color: '#2a1e0a', fontSize: 11, fontFamily: `'${font}', Georgia, serif`, marginTop: 12 }}>
            Staff will prepare your selection · no payment here
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Recommendation card ───────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  retailer,
  sessionId,
  onOrder,
  theme,
  font,
}: {
  rec: BlendRecommendation
  retailer: Retailer
  sessionId: string
  onOrder: () => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const [guestName, setGuestName] = useState('')
  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'
  const products = rec.selectedProducts || []

  function handleSuccess(name: string) {
    setGuestName(name); setShowForm(false); setOrdered(true); onOrder()
  }

  if (ordered) {
    return (
      <div style={{
        marginTop: 20,
        background: 'linear-gradient(145deg,#071209,#0a1a08)',
        border: '1px solid rgba(94,207,138,.2)',
        borderRadius: 20,
        padding: '36px 24px',
        textAlign: 'center',
        animation: 'recReveal .5s ease both',
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(94,207,138,.12)', border: '1px solid rgba(94,207,138,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
          ✓
        </div>
        <div style={{ color: '#5ecf8a', fontSize: 20, fontFamily: `'${font}', Georgia, serif`, fontWeight: 700, marginBottom: 6 }}>
          {guestName ? `Enjoy it, ${guestName}!` : 'Order placed!'}
        </div>
        <div style={{ color: '#4a5a3a', fontSize: 14, fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.6 }}>
          {retailer.name} will have your {noun.toLowerCase()} ready shortly.
        </div>
        {retailer.vertical !== 'coffee' && (
          <div style={{ color: '#3a4a2a', fontSize: 11, fontFamily: `'${font}', Georgia, serif`, marginTop: 14 }}>
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
        background: 'linear-gradient(155deg,#100c06 0%,#0a0e08 100%)',
        border: `1px solid rgba(${theme.rgbStr},.22)`,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: `0 0 60px rgba(${theme.rgbStr},.07), 0 24px 48px rgba(0,0,0,.5)`,
        animation: 'recReveal .45s cubic-bezier(.22,1,.36,1) both',
      }}>
        {/* Flavor profile — top of card as the hook */}
        {(rec.flavorProfile || []).length > 0 && (
          <div style={{ padding: '16px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(rec.flavorProfile || []).map(f => (
              <span key={f} style={{
                background: `rgba(${theme.rgbStr},.1)`,
                border: `1px solid rgba(${theme.rgbStr},.2)`,
                borderRadius: 20, padding: '4px 13px',
                color: theme.primary, fontSize: 12,
                fontFamily: `'${font}', Georgia, serif`,
                letterSpacing: '.04em',
              }}>
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Name + tagline */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ color: `rgba(${theme.rgbStr},.5)`, fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', marginBottom: 6, fontFamily: `'${font}', Georgia, serif` }}>
            {retailer.name} · Your {noun}
          </div>
          <div style={{ color: '#F5ECD7', fontFamily: `'${font}', Georgia, serif`, fontSize: 30, fontWeight: 700, lineHeight: 1.1, marginBottom: 6, letterSpacing: '-.3px' }}>
            {rec.recommendationName || rec.blendName}
          </div>
          <div style={{ color: theme.primary, fontFamily: `'${font}', Georgia, serif`, fontSize: 15, fontStyle: 'italic', opacity: .9 }}>
            {rec.tagline}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `rgba(${theme.rgbStr},.08)`, margin: '18px 20px' }} />

        {/* Products */}
        {products.length > 0 && (
          <div style={{ padding: '0 20px 0' }}>
            {products.map((p, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < products.length - 1 ? `1px solid rgba(${theme.rgbStr},.06)` : 'none' }}>
                <div style={{ color: '#ece4cc', fontSize: 15, fontFamily: `'${font}', Georgia, serif`, fontWeight: 600 }}>{p.name}</div>
                {p.why && <div style={{ color: '#6a5a3a', fontSize: 13, marginTop: 3, fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.5 }}>{p.why}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Story */}
        {rec.story && (
          <div style={{ padding: '16px 20px 0', color: '#9a8f78', fontSize: 14, lineHeight: 1.8, fontFamily: `'${font}', Georgia, serif` }}>
            {rec.story}
          </div>
        )}

        {/* Why it fits */}
        {rec.whyItFitsYou && (
          <div style={{ margin: '16px 20px 0', background: `rgba(${theme.rgbStr},.05)`, border: `1px solid rgba(${theme.rgbStr},.12)`, borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ color: `rgba(${theme.rgbStr},.5)`, fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 5, fontFamily: `'${font}', Georgia, serif` }}>Why this fits you</div>
            <div style={{ color: '#d4c8a8', fontSize: 14, lineHeight: 1.7, fontFamily: `'${font}', Georgia, serif` }}>{rec.whyItFitsYou}</div>
          </div>
        )}

        {/* Serve note */}
        {rec.serveNote && (
          <div style={{ padding: '12px 20px 0', color: '#5a4a2a', fontSize: 13, fontStyle: 'italic', fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.6 }}>
            {rec.serveNote}
          </div>
        )}

        {/* CTA */}
        <div style={{ padding: '20px 20px 24px' }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', padding: '16px',
              borderRadius: 14,
              background: theme.primary,
              border: 'none', cursor: 'pointer',
              color: theme.onPrimary, fontSize: 14, fontWeight: 700,
              letterSpacing: '.12em', fontFamily: `'${font}', Georgia, serif`,
              boxShadow: `0 8px 28px rgba(${theme.rgbStr},.35)`,
            }}
          >
            ORDER THIS {noun.toUpperCase()} →
          </button>
        </div>
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
  const [ordered, setOrdered] = useState(false)
  const [started, setStarted] = useState(false)
  // Quick-reply chips suggested by the AI for its current question — kept in sync
  // with what was actually asked, so the options always match the question.
  const [chips, setChips] = useState<string[]>([])
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

  const streamChat = async (msgs: Message[]) => {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setChips([])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    let full = ''
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs }),
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
              if (Array.isArray(p.chips)) setChips(p.chips.filter((c: unknown) => typeof c === 'string').slice(0, 4))
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

  const send = (override?: string) => {
    const text = override ?? input
    if (!text.trim() || streaming) return
    setChips([])
    const msg: Message = { role: 'user', content: text.trim() }
    const next = [...messages, msg]
    setMessages(next)
    setInput('')
    void streamChat(next.map(m => ({ role: m.role, content: m.content })))
  }

  const chipSelect = (chip: string) => send(chip)

  if (loading) return <LoadingScreen />
  if (notFound || !retailer) return <NotFound />

  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'

  const userTurns = messages.filter(m => m.role === 'user').length

  if (!started) {
    return <WelcomeScreen retailer={retailer} onStart={start} theme={theme} font={font} />
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(170deg,#080604 0%,#0c1208 100%)', fontFamily: `'${font}', Georgia, serif` }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:.2;transform:scale(.65)}50%{opacity:1;transform:scale(1)}}
        @keyframes cursor{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes chipFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes recReveal{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(${theme.rgbStr},.15)}
        textarea::placeholder{color:#3a2a0a}
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
          <div style={{ color: '#ede5cc', fontSize: 15, fontWeight: 600, fontFamily: `'${font}', Georgia, serif`, lineHeight: 1.2 }}>{retailer.name}</div>
          <div style={{ color: '#2a1e0a', fontSize: 9, letterSpacing: '.18em', marginTop: 1 }}>PERSONAL GUIDE</div>
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
                fontFamily: `'${font}', Georgia, serif`,
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
          <RecommendationCard rec={rec} retailer={retailer} sessionId={sessionId!} onOrder={() => setOrdered(true)} theme={theme} font={font} />
        )}

        <div ref={bottomRef} style={{ height: 12 }} />
      </div>

      {/* "Just recommend" nudge */}
      {userTurns >= 2 && !rec && !streaming && (
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 16px 6px', alignSelf: 'stretch' }}>
          <button
            onClick={() => send('I think you have enough — go ahead and recommend something.')}
            style={{
              background: 'none',
              border: `1px solid rgba(${theme.rgbStr},.18)`,
              borderRadius: 20, padding: '7px 16px',
              color: `rgba(${theme.rgbStr},.55)`,
              fontSize: 12, letterSpacing: '.1em',
              cursor: 'pointer', fontFamily: `'${font}', Georgia, serif`,
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
                fontFamily: `'${font}', Georgia, serif`,
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
                color: input.trim() && !streaming ? theme.onPrimary : '#2a1e0a',
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
