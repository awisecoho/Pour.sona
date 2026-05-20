'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import type { Retailer, BlendRecommendation } from '@/lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

// Quick-reply chip definitions per vertical — shown after the first AI message
const VERTICAL_CHIPS: Record<string, string[][]> = {
  brewery: [
    ['Something bold & hoppy', 'Light & easy-drinking', 'Dark & complex', 'Surprise me'],
    ['I want something adventurous', 'Stay in my comfort zone', 'I\'d like a tasting flight'],
  ],
  winery: [
    ['Red wine', 'White wine', 'Something bubbly', 'Help me explore'],
    ['I know what I like', 'Show me something unexpected', 'What\'s your favorite right now?'],
  ],
  distillery: [
    ['I love whiskey / bourbon', 'Start me with a cocktail', 'Take me somewhere new', 'A tasting flight'],
    ['Go technical with me', 'Keep it approachable', 'What\'s your bestseller?'],
  ],
  coffee: [
    ['Espresso-based', 'Filter / pour-over', 'Something cold', 'Surprise me'],
    ['Light & bright', 'Rich & bold', 'What\'s new this season?'],
  ],
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

const stripRec = (text: string) =>
  text.replace(/===REC===[\s\S]*?===END===/g, '').trim()

async function fetchRetailerBootstrap(slug: string) {
  const response = await fetch(`/api/retailer?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Bootstrap failed: ${response.status}`)
  }
  return (await response.json()) as { retailer: Retailer; flights: unknown[]; sessionId: string | null }
}

// ── Brand theme helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '')
  if (h.length !== 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function useTheme(retailer: Retailer | null) {
  return useMemo(() => {
    const primary = retailer?.brand_color || '#C9A84C'
    const secondary = retailer?.brand_secondary_color || primary
    const accent = retailer?.brand_accent_color || primary

    const rgb = hexToRgb(primary)
    const rgbStr = rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '201,168,76'

    // Determine if primary is light or dark for text contrast
    const luminance = rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0.5
    const onPrimary = luminance > 0.55 ? '#0a0603' : '#F5ECD7'

    return { primary, secondary, accent, rgbStr, onPrimary }
  }, [retailer])
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FontLoader({ fontUrl }: { fontUrl: string | null | undefined }) {
  if (!fontUrl) return null
  return <link rel="stylesheet" href={fontUrl} />
}

function LoadingScreen({ retailer }: { retailer: Retailer | null }) {
  const theme = useTheme(retailer)
  const font = retailer?.brand_font_family || 'Georgia, serif'
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>{retailer ? VERTICAL_ICONS[retailer.vertical] : '✦'}</div>
      <div style={{ fontFamily: `'${font}', Georgia, serif`, color: theme.primary, fontSize: 18 }}>
        {retailer ? `Welcome to ${retailer.name}` : 'Loading…'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: theme.primary, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0603', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>✦</div>
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 20 }}>Guide not found</div>
      <div style={{ color: '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 15 }}>This QR code may be inactive or expired.</div>
    </div>
  )
}

// ── Quick-reply chips ─────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 12px', maxWidth: '85%' }}>
      {chips.map(chip => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          style={{
            background: `rgba(${theme.rgbStr},.08)`,
            border: `1px solid rgba(${theme.rgbStr},.3)`,
            borderRadius: 20,
            padding: '8px 16px',
            color: theme.primary,
            fontSize: 14,
            fontFamily: `'${font}', Georgia, serif`,
            cursor: 'pointer',
            transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

// ── Order form overlay ────────────────────────────────────────────────────────

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
  onSuccess: (name: string, email: string) => void
  theme: ReturnType<typeof useTheme>
  font: string
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  )

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 14px',
    background: 'rgba(255,255,255,.05)',
    border: `1px solid rgba(${theme.rgbStr},.2)`,
    borderRadius: 10, color: '#F5ECD7',
    fontFamily: `'${font}', Georgia, serif`,
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
  }

  async function submit() {
    setLoading(true)
    setError('')
    const products = rec.selectedProducts || []
    const items = products.map(p => ({ name: p.name, qty: 1, price: (rec as any).price ?? 0 }))
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey.current },
        body: JSON.stringify({
          sessionId, retailerId: retailer.id, items,
          blendName: rec.recommendationName || rec.blendName,
          customerName: name.trim() || null,
          customerEmail: email.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Order failed')
      onSuccess(name.trim(), email.trim())
    } catch (err: any) {
      setError(err.message || 'Could not place order. Please ask staff for help.')
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'linear-gradient(160deg,#0e0b06,#0a0805)', border: `1px solid rgba(${theme.rgbStr},.25)`, borderRadius: '20px 20px 0 0', padding: '28px 24px 36px', width: '100%', maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ color: theme.primary, fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 4, fontFamily: `'${font}', Georgia, serif` }}>Confirm Order</div>
            <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, fontFamily: `'${font}', Georgia, serif` }}>{rec.recommendationName || rec.blendName}</div>
            <div style={{ color: '#6a5a3a', fontSize: 13, fontStyle: 'italic', fontFamily: `'${font}', Georgia, serif`, marginTop: 2 }}>{rec.tagline}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a3a1a', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', color: theme.primary, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6, fontFamily: `'${font}', Georgia, serif` }}>
            Your Name <span style={{ color: '#4a3a1a', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex" type="text" style={inp} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: theme.primary, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', marginBottom: 6, fontFamily: `'${font}', Georgia, serif` }}>
            Email for receipt <span style={{ color: '#4a3a1a', textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" style={inp} />
        </div>

        {error && (
          <div style={{ background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10, padding: '12px 14px', color: '#e07070', fontSize: 13, fontFamily: `'${font}', Georgia, serif`, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          style={{ width: '100%', padding: '17px', borderRadius: 12, background: loading ? `rgba(${theme.rgbStr},.3)` : theme.primary, border: 'none', cursor: loading ? 'wait' : 'pointer', color: theme.onPrimary, fontSize: 14, fontWeight: 700, letterSpacing: '.1em', fontFamily: `'${font}', Georgia, serif` }}
        >
          {loading ? 'Placing Order…' : `Place Order at ${retailer.name}`}
        </button>
        <div style={{ textAlign: 'center', color: '#3a2a0a', fontSize: 11, fontFamily: `'${font}', Georgia, serif`, marginTop: 12 }}>
          Staff will prepare your selection — no payment needed here
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
  const products = rec.selectedProducts || []

  function handleSuccess(name: string) {
    setGuestName(name)
    setShowForm(false)
    setOrdered(true)
    onOrder()
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

      <div style={{ background: 'linear-gradient(145deg,#0e0803,#0a1408)', border: `1px solid rgba(${theme.rgbStr},.3)`, borderRadius: 18, padding: '24px 20px', marginTop: 20 }}>
        <div style={{ color: theme.primary, fontFamily: `'${font}', Georgia, serif`, fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>
          {retailer.name} · Your Selection
        </div>
        <div style={{ color: '#F5ECD7', fontFamily: `'${font}', Georgia, serif`, fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          {rec.recommendationName || rec.blendName}
        </div>
        <div style={{ color: theme.primary, fontFamily: `'${font}', Georgia, serif`, fontSize: 15, fontStyle: 'italic', marginBottom: 20 }}>
          {rec.tagline}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(rec.flavorProfile || []).map(flavor => (
            <span key={flavor} style={{ background: `rgba(${theme.rgbStr},.1)`, border: `1px solid rgba(${theme.rgbStr},.25)`, borderRadius: 20, padding: '4px 12px', color: theme.primary, fontSize: 13, fontFamily: `'${font}', Georgia, serif` }}>
              {flavor}
            </span>
          ))}
        </div>

        {products.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {products.map((p, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid rgba(${theme.rgbStr},.07)` }}>
                <div style={{ color: '#F5ECD7', fontSize: 15, fontFamily: `'${font}', Georgia, serif` }}>{p.name}</div>
                {p.why && <div style={{ color: '#8a7a5a', fontSize: 13, marginTop: 2, fontFamily: `'${font}', Georgia, serif` }}>{p.why}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ color: '#c8bfa8', fontSize: 15, lineHeight: 1.75, marginBottom: 16, fontFamily: `'${font}', Georgia, serif` }}>{rec.story}</div>

        <div style={{ background: `rgba(${theme.rgbStr},.06)`, border: `1px solid rgba(${theme.rgbStr},.15)`, borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ color: '#6a5a2a', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4, fontFamily: `'${font}', Georgia, serif` }}>Why This Fits You</div>
          <div style={{ color: '#F5ECD7', fontSize: 14, lineHeight: 1.7, fontFamily: `'${font}', Georgia, serif` }}>{rec.whyItFitsYou}</div>
        </div>

        {rec.serveNote && (
          <div style={{ color: '#8a7a5a', fontSize: 13, fontStyle: 'italic', marginBottom: 20, fontFamily: `'${font}', Georgia, serif` }}>
            {rec.serveNote}
          </div>
        )}

        {ordered ? (
          <div style={{ background: 'rgba(94,207,138,.1)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ color: '#5ecf8a', fontSize: 16, fontFamily: `'${font}', Georgia, serif`, fontWeight: 700, marginBottom: 4 }}>
              {guestName ? `Order placed, ${guestName}!` : 'Order placed!'}
            </div>
            <div style={{ color: '#4a3a1a', fontSize: 13, fontFamily: `'${font}', Georgia, serif` }}>
              {retailer.name} will have your {VERTICAL_NOUN[retailer.vertical] || 'selection'} ready shortly.
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            style={{ width: '100%', padding: '17px', borderRadius: 12, background: theme.primary, border: 'none', cursor: 'pointer', color: theme.onPrimary, fontSize: 13, fontWeight: 700, letterSpacing: '.15em', fontFamily: `'${font}', Georgia, serif` }}
          >
            ORDER THIS {(VERTICAL_NOUN[retailer.vertical] || 'Selection').toUpperCase()} →
          </button>
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
  const [ordered, setOrdered] = useState(false)
  const [started, setStarted] = useState(false)
  // Track how many AI messages have been sent (for chip display logic)
  const [aiTurnCount, setAiTurnCount] = useState(0)
  // Whether chips have been used / dismissed
  const [chipsUsed, setChipsUsed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const theme = useTheme(retailer)
  const font = retailer?.brand_font_family || 'Georgia'

  // Inject Google Font link into head
  useEffect(() => {
    if (!retailer?.brand_font_url) return
    const existing = document.querySelector(`link[href="${retailer.brand_font_url}"]`)
    if (existing) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = retailer.brand_font_url
    document.head.appendChild(link)
  }, [retailer?.brand_font_url])

  useEffect(() => {
    async function init() {
      try {
        const bootstrap = await fetchRetailerBootstrap(params.slug)
        if (!bootstrap) { setNotFound(true); setLoading(false); return }
        setRetailer(bootstrap.retailer)
        setSessionId(bootstrap.sessionId)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [params.slug])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, rec])

  const streamChat = async (nextMessages: Message[], chipContext?: string) => {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    let full = ''
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: nextMessages, chipContext }),
      })

      if (!response.ok) {
        const msg = response.status === 402
          ? 'This Poursona experience is not currently active. Please check back later or contact the venue.'
          : response.status === 429
          ? 'You\'ve sent a lot of messages — please wait a moment before continuing.'
          : 'Something went wrong. Please try again.'
        setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: msg, streaming: false }; return u })
        setStreaming(false)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) { setStreaming(false); return }
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.delta) {
              full += parsed.delta
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: stripRec(full), streaming: true }
                return u
              })
            }
            if (parsed.done) {
              if (parsed.recData) setRec(parsed.recData)
              setMessages(prev => {
                const u = [...prev]
                u[u.length - 1] = { role: 'assistant', content: stripRec(parsed.text || full), streaming: false }
                return u
              })
            }
          } catch {}
        }
      }
    } catch {}

    setAiTurnCount(c => c + 1)
    setStreaming(false)
  }

  const start = async () => {
    setStarted(true)
    await streamChat([{ role: 'user', content: 'START' }])
  }

  const send = async (overrideInput?: string, chipContext?: string) => {
    const text = overrideInput ?? input
    if (!text.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: text.trim() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await streamChat(nextMessages.map(m => ({ role: m.role, content: m.content })), chipContext)
  }

  const handleChipSelect = (chip: string) => {
    setChipsUsed(true)
    void send(chip, chip)
  }

  if (loading) return <LoadingScreen retailer={retailer} />
  if (notFound || !retailer) return <NotFound />

  const icon = VERTICAL_ICONS[retailer.vertical] || '✦'
  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'

  // Chips: show after first AI message only, until user types or uses a chip
  const chipSet = VERTICAL_CHIPS[retailer.vertical] || VERTICAL_CHIPS['brewery']
  const currentChips = aiTurnCount === 1 && !chipsUsed && !rec ? chipSet[0] : null
  // Second set of chips after the second AI message (if they responded to chips)
  const secondChips = aiTurnCount === 2 && !chipsUsed && !rec ? chipSet[1] : null
  const activeChips = currentChips || secondChips

  // How many user exchanges have happened
  const userTurns = messages.filter(m => m.role === 'user').length

  // ── Welcome screen ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <FontLoader fontUrl={retailer.brand_font_url} />
        <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
        <div style={{ color: theme.primary, fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 12, fontFamily: `'${font}', Georgia, serif` }}>Welcome to</div>
        <div style={{ color: '#F5ECD7', fontSize: 36, fontWeight: 700, fontFamily: `'${font}', Georgia, serif`, marginBottom: 6 }}>{retailer.name}</div>
        {retailer.location && <div style={{ color: '#6a5a3a', fontSize: 15, marginBottom: 6, fontFamily: `'${font}', Georgia, serif` }}>{retailer.location}</div>}
        {retailer.tagline && <div style={{ color: '#8a7a5a', fontSize: 16, fontStyle: 'italic', marginBottom: 32, fontFamily: `'${font}', Georgia, serif` }}>{retailer.tagline}</div>}
        <div style={{ color: '#a09070', fontSize: 17, lineHeight: 1.7, maxWidth: 400, marginBottom: 40, fontFamily: `'${font}', Georgia, serif` }}>
          Let me help you find the perfect {noun.toLowerCase()} — just answer a couple of quick questions.
        </div>
        <button
          onClick={start}
          style={{ background: theme.primary, border: 'none', borderRadius: 40, padding: '16px 44px', color: theme.onPrimary, fontSize: 13, fontWeight: 700, letterSpacing: '.2em', cursor: 'pointer', fontFamily: `'${font}', Georgia, serif` }}
        >
          Find My Perfect {noun}
        </button>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
      </div>
    )
  }

  // ── Chat screen ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', fontFamily: `'${font}', Georgia, serif` }}>
      <FontLoader fontUrl={retailer.brand_font_url} />
      <style>{`
        @keyframes blink{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        @keyframes cursor{0%,100%{opacity:1}50%{opacity:0}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(${theme.rgbStr},.2)}
        button:active{opacity:.85}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid rgba(${theme.rgbStr},.18)`, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, fontFamily: `'${font}', Georgia, serif` }}>{retailer.name}</div>
          <div style={{ color: '#3a2a0a', fontSize: 10, letterSpacing: '.15em' }}>PERSONAL GUIDE</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px', maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ color: '#3a2a0a', fontSize: 9, letterSpacing: '.18em', marginBottom: 4, fontFamily: `'${font}', Georgia, serif` }}>GUIDE</div>
            )}
            <div style={{
              maxWidth: '85%', padding: '12px 16px', fontSize: 16, lineHeight: 1.78, whiteSpace: 'pre-wrap',
              background: msg.role === 'user' ? `rgba(${theme.rgbStr},.12)` : 'rgba(255,255,255,.04)',
              border: msg.role === 'user' ? `1px solid rgba(${theme.rgbStr},.25)` : '1px solid rgba(255,255,255,.06)',
              borderRadius: msg.role === 'user' ? '17px 17px 4px 17px' : '4px 17px 17px 17px',
              color: msg.role === 'user' ? theme.primary : '#c8bfa8',
              fontFamily: `'${font}', Georgia, serif`,
            }}>
              {msg.content === '' && msg.streaming ? (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: theme.primary, animation: `blink 1.2s ease-in-out ${j * 0.2}s infinite`, display: 'inline-block' }} />
                  ))}
                </span>
              ) : (
                <>
                  {msg.content}
                  {msg.streaming && msg.content && (
                    <span style={{ display: 'inline-block', width: 2, height: '.85em', background: theme.primary, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'cursor .8s ease-in-out infinite' }} />
                  )}
                </>
              )}
            </div>

            {/* Quick reply chips — shown only after the last AI message, before user responds */}
            {msg.role === 'assistant' && !msg.streaming && i === messages.length - 1 && activeChips && (
              <QuickChips chips={activeChips} onSelect={handleChipSelect} theme={theme} font={font} />
            )}
          </div>
        ))}

        {rec && !ordered && (
          <RecommendationCard rec={rec} retailer={retailer} sessionId={sessionId!} onOrder={() => setOrdered(true)} theme={theme} font={font} />
        )}
        {ordered && (
          <div style={{ textAlign: 'center', marginTop: 24, color: '#5ecf8a', fontSize: 16, fontFamily: `'${font}', Georgia, serif` }}>
            Enjoy your {noun.toLowerCase()}! ✦
          </div>
        )}

        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* "Just give me a recommendation" nudge after 2 user turns */}
      {userTurns >= 2 && !rec && !streaming && (
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 14px 5px', alignSelf: 'stretch' }}>
          <button
            onClick={() => void send('I think you have enough — give me your recommendation.')}
            style={{ background: 'transparent', border: `1px solid rgba(${theme.rgbStr},.22)`, borderRadius: 18, padding: '6px 16px', color: theme.primary, fontSize: 11, letterSpacing: '.12em', cursor: 'pointer', opacity: 0.7, fontFamily: `'${font}', Georgia, serif` }}
          >
            ✦ Just give me a recommendation
          </button>
        </div>
      )}

      {/* Input — hidden once recommendation shown */}
      {!rec && (
        <div style={{ borderTop: `1px solid rgba(${theme.rgbStr},.1)`, padding: '11px 14px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(10px)', flexShrink: 0, maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); if (e.target.value) setChipsUsed(true) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder="Share your thoughts…"
              rows={1}
              disabled={streaming}
              style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: `1px solid rgba(${theme.rgbStr},.18)`, borderRadius: 11, padding: '11px 14px', color: '#F5ECD7', fontFamily: `'${font}', Georgia, serif`, fontSize: 16, resize: 'none', outline: 'none', minHeight: 44, opacity: streaming ? 0.6 : 1 }}
            />
            <button
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              style={{ background: input.trim() && !streaming ? theme.primary : `rgba(${theme.rgbStr},.07)`, border: `1px solid rgba(${theme.rgbStr},.22)`, borderRadius: 9, padding: '11px 16px', color: input.trim() && !streaming ? theme.onPrimary : '#3a2a0a', cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 14, height: 44 }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
