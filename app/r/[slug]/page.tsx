'use client'
import { useEffect, useState, useRef } from 'react'
import { deriveTheme, getVerticalVoice, BrandTheme } from '@/lib/theme'

interface Message { role: 'user' | 'assistant'; content: string; streaming?: boolean }
interface RecData {
  format: 'single' | 'flight'
  recommendationName: string; tagline: string
  selectedProducts: Array<{ name: string; why: string; price: number }>
  flightDetails: { flightName: string; price: number; pourSize: string; count: number } | null
  flavorProfile: string[]; story: string; whyItFitsYou: string; serveNote: string
}

function stripRec(t: string) { return t.replace(/===REC===[\s\S]*?===END===/g, '').trim() }

export default function CustomerPage({ params }: { params: { slug: string } }) {
  const [retailer, setRetailer] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [rec, setRec] = useState<RecData | null>(null)
  const [ordered, setOrdered] = useState(false)
  const [started, setStarted] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [theme, setTheme] = useState<BrandTheme | null>(null)
  const [voice, setVoice] = useState<ReturnType<typeof getVerticalVoice> | null>(null)
  const msgListRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/retailer?slug=' + params.slug)
        if (!res.ok) { setNotFound(true); setLoading(false); return }
        const data = await res.json()
        if (!data.retailer) { setNotFound(true); setLoading(false); return }
        const r = data.retailer
        setRetailer(r); setSessionId(data.sessionId)
        setTheme(deriveTheme(r.brand_color))
        const cats = (data.products || []).map((p: any) => p.category).filter(Boolean)
        setVoice(getVerticalVoice(r.vertical, cats))
        setLoading(false)
      } catch { setNotFound(true); setLoading(false) }
    }
    init()
  }, [params.slug])

  useEffect(() => {
    if (messages.length === 1 && msgListRef.current) {
      msgListRef.current.scrollTop = 0
    } else if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [messages])

  async function chat(msgs: Message[]) {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs }) })
      const data = await res.json()
      const text = data.text || ''
      if (data.recData) setRec(data.recData)
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: text, streaming: false }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Try again.', streaming: false }; return u })
    }
    setStreaming(false)
  }

  async function start() { setStarted(true); await chat([{ role: 'user', content: 'START_SESSION' }]); setTimeout(() => inputRef.current?.focus(), 500) }

  async function send() {
    if (!input.trim() || streaming) return
    const newMsgs = [...messages, { role: 'user' as const, content: input.trim() }]
    setMessages(newMsgs); setInput('')
    await chat(newMsgs.map(m => ({ role: m.role, content: m.content })))
  }

  async function placeOrder() {
    if (!rec || !retailer || !sessionId) return
    setOrdering(true)
    await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, retailerId: retailer.id, items: rec.selectedProducts.map(p => ({ name: p.name, size: rec.flightDetails?.pourSize || 'Standard', price: p.price || 0, qty: 1 })), blendName: rec.recommendationName }) })
    setOrdering(false); setOrdered(true)
  }

  if (loading || !theme || !voice) return (
    <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,.1)', borderTopColor: 'rgba(255,255,255,.8)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 18 }}>Guide not found</div>
      <div style={{ color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>This QR code may be inactive.</div>
    </div>
  )

  const t = theme, v = voice

  // ── WELCOME SCREEN ────────────────────────────────────────────────────────
  if (!started) return (
    <div style={{ minHeight: '100dvh', background: t.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', position: 'relative', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}}
      ` }} />

      {/* Background glow from brand color */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '140%', height: '60%', background: `radial-gradient(ellipse, ${t.primary}30 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 28px 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ animation: 'fadeUp .5s ease both', animationDelay: '.1s', width: '100%', maxWidth: 360 }}>
          {/* Logo or icon */}
          {retailer.logo_url ? (
            <img src={retailer.logo_url} alt={retailer.name}
              style={{ height: 80, maxWidth: 240, objectFit: 'contain', marginBottom: 28 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div style={{ fontSize: 72, marginBottom: 20, lineHeight: 1, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.4))' }}>{v.icon}</div>
          )}

          {/* Venue name — the hero moment */}
          <h1 style={{ color: t.text, fontSize: 36, fontWeight: 700, lineHeight: 1.15, margin: '0 0 10px', letterSpacing: '-.01em' }}>{retailer.name}</h1>

          {retailer.location && (
            <div style={{ color: t.textFaint, fontSize: 13, marginBottom: 8, letterSpacing: '.05em', textTransform: 'uppercase' as const }}>{retailer.location}</div>
          )}

          {/* Tagline or culture teaser */}
          {(retailer.tagline || retailer.culture) && (
            <p style={{ color: t.textMuted, fontSize: 16, fontStyle: 'italic', lineHeight: 1.65, margin: '12px 0 0', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
              {retailer.tagline || retailer.culture?.split('.')[0]}
            </p>
          )}

          <div style={{ width: 48, height: 2, background: t.primary, borderRadius: 2, margin: '24px auto' }} />

          <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.75, margin: '0 0 36px', maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}>
            Your personal {v.greeting} will help you find exactly what you're in the mood for.
          </p>
        </div>

        {/* CTA — big, magnetic, unmissable */}
        <div style={{ animation: 'fadeUp .5s ease both', animationDelay: '.3s', width: '100%', maxWidth: 320 }}>
          <button
            onClick={start}
            style={{ width: '100%', padding: '20px 0', background: t.primary, border: 'none', borderRadius: 16, color: '#fff', fontSize: 17, fontWeight: 700, letterSpacing: '.06em', cursor: 'pointer', fontFamily: 'Georgia, serif', boxShadow: `0 8px 32px ${t.primary}60, 0 2px 8px rgba(0,0,0,.3)`, transition: 'transform .15s, box-shadow .15s' }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            onTouchStart={e => (e.currentTarget.style.transform = 'scale(.97)')}
            onTouchEnd={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {v.cta}
          </button>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `pulse 1.6s ease-in-out ${i * 0.3}s infinite` }} />)}
          </div>
        </div>
      </div>

      {/* Bottom brand accent */}
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${t.primary}, transparent)`, opacity: .6 }} />
    </div>
  )

  // ── RECOMMENDATION REVEAL ─────────────────────────────────────────────────
  if (rec) return (
    <div style={{ minHeight: '100dvh', background: t.bg, fontFamily: 'Georgia, serif', overflowY: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: '*{box-sizing:border-box}::-webkit-scrollbar{width:0}@keyframes revealUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}' }} />

      {/* Sticky header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface + 'f0', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid rgba(255,255,255,.06)` }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <span style={{ fontSize: 20 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.primary, fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 1 }}>
            {rec.format === 'flight' ? v.flightLabel : v.singleLabel}
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 20px 48px', maxWidth: 540, margin: '0 auto' }}>
        {/* Hero rec card */}
        <div style={{ animation: 'revealUp .4s ease both', background: t.surface, border: `1px solid rgba(255,255,255,.1)`, borderRadius: 24, overflow: 'hidden', marginBottom: 16 }}>
          {/* Top accent bar */}
          <div style={{ height: 4, background: t.primary }} />

          <div style={{ padding: '24px 22px' }}>
            {/* Label badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${t.primary}20`, border: `1px solid ${t.primary}50`, borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.primary }} />
              <span style={{ color: t.primary, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' as const }}>
                {rec.format === 'flight' && rec.flightDetails ? `${rec.flightDetails.count} × ${rec.flightDetails.pourSize} Flight` : v.singleLabel}
              </span>
            </div>

            {/* The name — this is the moment */}
            <h2 style={{ color: t.text, fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px', letterSpacing: '-.01em' }}>{rec.recommendationName}</h2>
            <p style={{ color: t.primary, fontStyle: 'italic', fontSize: 16, margin: '0 0 20px', lineHeight: 1.5 }}>{rec.tagline}</p>

            {/* Flavor chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              {rec.flavorProfile.map(f => (
                <span key={f} style={{ background: `${t.primary}15`, border: `1px solid ${t.primary}40`, borderRadius: 20, padding: '6px 14px', color: t.primary, fontSize: 13 }}>{f}</span>
              ))}
            </div>

            {/* Products */}
            <div style={{ marginBottom: 20 }}>
              {rec.selectedProducts.map((p, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,.06)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ color: t.text, fontSize: 16, fontWeight: 600, flex: 1 }}>{p.name}</div>
                    {p.price > 0 && <div style={{ color: t.primary, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>${p.price}</div>}
                  </div>
                  {p.why && <div style={{ color: t.textMuted, fontSize: 14, marginTop: 4, lineHeight: 1.55 }}>{p.why}</div>}
                </div>
              ))}
            </div>

            {/* Flight details */}
            {rec.format === 'flight' && rec.flightDetails && (
              <div style={{ background: `${t.primary}15`, borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{rec.flightDetails.flightName}</div>
                  <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{rec.flightDetails.count} pours · {rec.flightDetails.pourSize} each</div>
                </div>
                <div style={{ color: t.primary, fontSize: 22, fontWeight: 700 }}>${rec.flightDetails.price}</div>
              </div>
            )}

            {/* Story */}
            <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.75, margin: '0 0 16px' }}>{rec.story}</p>

            {/* Why you */}
            <div style={{ background: `rgba(255,255,255,.04)`, borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ color: t.textFaint, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>Why this for you</div>
              <div style={{ color: t.text, fontSize: 15, lineHeight: 1.6 }}>{rec.whyItFitsYou}</div>
            </div>

            {rec.serveNote && <div style={{ color: t.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, paddingTop: 4 }}>{rec.serveNote}</div>}
          </div>
        </div>

        {/* Order CTA */}
        {ordered ? (
          <div style={{ animation: 'revealUp .3s ease both', background: 'rgba(60,200,100,.1)', border: '1px solid rgba(60,200,100,.3)', borderRadius: 20, padding: '28px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ color: '#4ade80', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Order placed!</div>
            <div style={{ color: t.textMuted, fontSize: 15 }}>{retailer.name} will have it ready for you.</div>
          </div>
        ) : (
          <>
            <button
              onClick={placeOrder}
              disabled={ordering}
              style={{ width: '100%', padding: '20px', borderRadius: 16, background: t.primary, border: 'none', cursor: ordering ? 'wait' : 'pointer', color: '#fff', fontSize: 17, fontWeight: 700, fontFamily: 'Georgia, serif', boxShadow: `0 6px 28px ${t.primary}50`, opacity: ordering ? .7 : 1, marginBottom: 12, letterSpacing: '.04em' }}
            >
              {ordering ? 'Placing Order…' : `Order from ${retailer.name}`}
            </button>
            <button
              onClick={() => setRec(null)}
              style={{ width: '100%', padding: '16px', background: 'transparent', border: `1px solid rgba(255,255,255,.12)`, borderRadius: 14, color: t.textMuted, fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia, serif' }}
            >
              ← Back to conversation
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── CONVERSATION SCREEN ───────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        *{box-sizing:border-box}
        @keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:0}
        textarea{-webkit-appearance:none;appearance:none}
      ` }} />

      {/* Header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderBottom: `1px solid rgba(255,255,255,.07)`, flexShrink: 0 }}>
        {retailer.logo_url
          ? <img src={retailer.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <span style={{ fontSize: 20 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.textFaint, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' }}>{v.greeting}</div>
        </div>
        {streaming && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${i * .15}s infinite` }} />)}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={msgListRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column' }}>
        {messages.map((m, i) => {
          const isAI = m.role === 'assistant'
          const display = isAI ? stripRec(m.content) : m.content
          if (isAI && !display && !m.streaming) return null
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end', marginBottom: 16, animation: 'slideUp .2s ease' }}>
              <div style={{
                maxWidth: '86%',
                padding: '14px 18px',
                borderRadius: isAI ? '6px 20px 20px 20px' : '20px 6px 20px 20px',
                background: isAI ? t.surface : t.primary,
                color: isAI ? t.text : '#fff',
                fontSize: 16,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                border: isAI ? `1px solid rgba(255,255,255,.07)` : 'none',
                boxShadow: isAI ? 'none' : `0 4px 16px ${t.primary}40`,
              }}>
                {m.streaming && !display
                  ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '3px 0' }}>
                      {[0,1,2].map(j => <span key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${j*.2}s infinite`, display: 'inline-block' }} />)}
                    </span>
                  : display}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 20px', background: t.surface, borderTop: `1px solid rgba(255,255,255,.07)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 580, margin: '0 auto' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={v.placeholder}
            rows={1}
            disabled={streaming}
            style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 16, padding: '15px 18px', color: t.text, fontFamily: 'Georgia, serif', fontSize: 16, resize: 'none', outline: 'none', minHeight: 54, maxHeight: 120, opacity: streaming ? .5 : 1, lineHeight: 1.5, caretColor: t.primary, transition: 'border-color .15s' }}
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            style={{ background: input.trim() && !streaming ? t.primary : 'rgba(255,255,255,.07)', border: 'none', borderRadius: 16, width: 54, height: 54, color: input.trim() && !streaming ? '#fff' : 'rgba(255,255,255,.25)', cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s', boxShadow: input.trim() && !streaming ? `0 4px 16px ${t.primary}50` : 'none' }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}
