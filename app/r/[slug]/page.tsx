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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesTopRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const msgListRef = useRef<HTMLDivElement>(null)

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

  // Scroll to TOP when first message arrives, then bottom for subsequent
  useEffect(() => {
    if (messages.length === 1) {
      // First message - scroll to top of message list so greeting is visible
      if (msgListRef.current) msgListRef.current.scrollTop = 0
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

  async function start() {
    setStarted(true)
    await chat([{ role: 'user', content: 'START_SESSION' }])
    setTimeout(() => inputRef.current?.focus(), 400)
  }

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
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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

  // WELCOME SCREEN
  if (!started) return (
    <div style={{ minHeight: '100dvh', background: t.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes pulse{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}' }} />
      <div style={{ animation: 'fadeIn .4s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 340 }}>
        {retailer.logo_url
          ? <img src={retailer.logo_url} alt={retailer.name} style={{ height: 80, maxWidth: 240, objectFit: 'contain', marginBottom: 28 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          : <div style={{ fontSize: 64, marginBottom: 20 }}>{v.icon}</div>}
        <div style={{ color: t.textFaint, fontSize: 11, letterSpacing: '.35em', textTransform: 'uppercase', marginBottom: 10 }}>Welcome to</div>
        <h1 style={{ color: t.text, fontSize: 30, fontWeight: 700, lineHeight: 1.2, margin: '0 0 8px' }}>{retailer.name}</h1>
        {retailer.location && <div style={{ color: t.textMuted, fontSize: 14, marginBottom: 6 }}>{retailer.location}</div>}
        {retailer.tagline && <div style={{ color: t.textMuted, fontSize: 15, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 0 }}>{retailer.tagline}</div>}
        <div style={{ width: 40, height: 2, background: t.primary, borderRadius: 2, margin: '20px auto' }} />
        <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 280 }}>
          Your personal {v.greeting} will find the perfect selection for you.
        </p>
        <button onClick={start} style={{ background: t.primary, border: 'none', borderRadius: 14, padding: '18px 0', width: '100%', maxWidth: 280, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', boxShadow: `0 4px 20px ${t.primary}60` }}>
          {v.cta}
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 24, justifyContent: 'center' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `pulse 1.6s ease-in-out ${i * 0.25}s infinite` }} />)}
        </div>
      </div>
    </div>
  )

  // RECOMMENDATION REVEAL
  if (rec) return (
    <div style={{ minHeight: '100dvh', background: t.bg, fontFamily: 'Georgia, serif', overflowY: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: '*{box-sizing:border-box}::-webkit-scrollbar{width:0}' }} />
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderBottom: `1px solid rgba(255,255,255,.08)`, position: 'sticky', top: 0, zIndex: 10 }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 30, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <span style={{ fontSize: 22 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.primary, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 1 }}>{rec.format === 'flight' ? v.flightLabel : v.singleLabel}</div>
        </div>
      </div>
      <div style={{ padding: '24px 20px 40px', maxWidth: 540, margin: '0 auto' }}>
        <div style={{ background: t.surface, border: `1px solid rgba(255,255,255,.1)`, borderRadius: 20, padding: '24px 20px', marginBottom: 16 }}>
          <div style={{ display: 'inline-block', background: t.primary, borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#fff', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            {rec.format === 'flight' && rec.flightDetails ? `${rec.flightDetails.count} x ${rec.flightDetails.pourSize} Flight` : v.singleLabel}
          </div>
          <h2 style={{ color: t.text, fontSize: 26, fontWeight: 700, lineHeight: 1.2, margin: '0 0 6px' }}>{rec.recommendationName}</h2>
          <p style={{ color: t.primary, fontStyle: 'italic', fontSize: 15, margin: '0 0 18px', lineHeight: 1.5 }}>{rec.tagline}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {rec.flavorProfile.map(f => <span key={f} style={{ background: `${t.primary}20`, border: `1px solid ${t.primary}50`, borderRadius: 20, padding: '5px 14px', color: t.primary, fontSize: 13 }}>{f}</span>)}
          </div>
          <div style={{ marginBottom: 18 }}>
            {rec.selectedProducts.map((p, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,.07)` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ color: t.text, fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                  {p.price > 0 && <div style={{ color: t.primary, fontSize: 15, fontWeight: 700 }}>${p.price}</div>}
                </div>
                {p.why && <div style={{ color: t.textMuted, fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{p.why}</div>}
              </div>
            ))}
          </div>
          {rec.format === 'flight' && rec.flightDetails && (
            <div style={{ background: `${t.primary}18`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{rec.flightDetails.flightName}</div>
              <div style={{ color: t.primary, fontSize: 18, fontWeight: 700 }}>${rec.flightDetails.price}</div>
            </div>
          )}
          <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.7, margin: '0 0 14px' }}>{rec.story}</p>
          <div style={{ background: `rgba(255,255,255,.05)`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ color: t.textFaint, fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Why this for you</div>
            <div style={{ color: t.text, fontSize: 15, lineHeight: 1.6 }}>{rec.whyItFitsYou}</div>
          </div>
          {rec.serveNote && <div style={{ color: t.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5 }}>{rec.serveNote}</div>}
        </div>
        {ordered ? (
          <div style={{ background: 'rgba(60,200,100,.1)', border: '1px solid rgba(60,200,100,.3)', borderRadius: 16, padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ color: '#4ade80', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Order placed!</div>
            <div style={{ color: t.textMuted, fontSize: 14 }}>{retailer.name} will have it ready.</div>
          </div>
        ) : (
          <>
            <button onClick={placeOrder} disabled={ordering} style={{ width: '100%', padding: '18px', borderRadius: 14, background: t.primary, border: 'none', cursor: ordering ? 'wait' : 'pointer', color: '#fff', fontSize: 17, fontWeight: 700, fontFamily: 'Georgia, serif', boxShadow: `0 4px 20px ${t.primary}50`, opacity: ordering ? 0.7 : 1, marginBottom: 12 }}>
              {ordering ? 'Placing Order...' : `Order from ${retailer.name}`}
            </button>
            <button onClick={() => setRec(null)} style={{ width: '100%', padding: '16px', background: 'transparent', border: `1px solid rgba(255,255,255,.15)`, borderRadius: 14, color: t.textMuted, fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              Back to conversation
            </button>
          </>
        )}
      </div>
    </div>
  )

  // CONVERSATION SCREEN
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: '*{box-sizing:border-box}@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:0}textarea{-webkit-appearance:none;appearance:none}' }} />
      {/* Header */}
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderBottom: `1px solid rgba(255,255,255,.08)`, flexShrink: 0 }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <span style={{ fontSize: 20 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.textFaint, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>{v.greeting}</div>
        </div>
        {streaming && <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}</div>}
      </div>
      {/* Messages - starts at TOP so first greeting is visible */}
      <div ref={msgListRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div ref={messagesTopRef} />
        {messages.map((m, i) => {
          const isAI = m.role === 'assistant'
          const display = isAI ? stripRec(m.content) : m.content
          if (isAI && !display && !m.streaming) return null
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end', marginBottom: 14, animation: 'slideUp .2s ease' }}>
              <div style={{ maxWidth: '85%', padding: '14px 18px', borderRadius: isAI ? '4px 20px 20px 20px' : '20px 4px 20px 20px', background: isAI ? t.surface : t.primary, color: isAI ? t.text : '#fff', fontSize: 16, lineHeight: 1.65, whiteSpace: 'pre-wrap', border: isAI ? `1px solid rgba(255,255,255,.08)` : 'none', boxShadow: isAI ? 'none' : `0 2px 12px ${t.primary}40` }}>
                {m.streaming && !display
                  ? <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>{[0,1,2].map(j => <span key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${j * 0.2}s infinite`, display: 'inline-block' }} />)}</span>
                  : display}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>
      {/* Input */}
      <div style={{ padding: '12px 16px 16px', background: t.surface, borderTop: `1px solid rgba(255,255,255,.08)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 580, margin: '0 auto' }}>
          <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={v.placeholder} rows={1} disabled={streaming} style={{ flex: 1, background: 'rgba(255,255,255,.08)', border: `1px solid rgba(255,255,255,.12)`, borderRadius: 14, padding: '14px 16px', color: t.text, fontFamily: 'Georgia, serif', fontSize: 16, resize: 'none', outline: 'none', minHeight: 52, maxHeight: 120, opacity: streaming ? 0.5 : 1, lineHeight: 1.5, caretColor: t.primary }} />
          <button onClick={send} disabled={streaming || !input.trim()} style={{ background: input.trim() && !streaming ? t.primary : 'rgba(255,255,255,.08)', border: 'none', borderRadius: 14, width: 52, height: 52, color: input.trim() && !streaming ? '#fff' : 'rgba(255,255,255,.3)', cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>↑</button>
        </div>
      </div>
    </div>
  )
}
