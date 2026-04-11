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

function stripRec(t: string) {
  return t.replace(/===REC===[sS]*?===END===/g, '').trim()
}

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
  const bottomRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, rec])

  const chat = async (msgs: Message[]) => {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs })
      })
      const data = await res.json()
      const text = data.text || ''
      if (data.recData) setRec(data.recData)
      setMessages(prev => { const u = [...prev]; u[u.length-1] = { role: 'assistant', content: text, streaming: false }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length-1] = { role: 'assistant', content: 'Something went wrong. Try again.', streaming: false }; return u })
    }
    setStreaming(false)
  }

  const start = async () => {
    setStarted(true)
    await chat([{ role: 'user', content: 'START_SESSION' }])
    setTimeout(() => inputRef.current?.focus(), 400)
  }

  const send = async () => {
    if (!input.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs); setInput('')
    await chat(newMsgs.map(m => ({ role: m.role, content: m.content })))
  }

  const placeOrder = async () => {
    if (!rec || !retailer || !sessionId) return
    setOrdering(true)
    await fetch('/api/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, retailerId: retailer.id, items: rec.selectedProducts.map(p => ({ name: p.name, size: rec.flightDetails?.pourSize || 'Standard', price: p.price || 0, qty: 1 })), blendName: rec.recommendationName })
    })
    setOrdering(false); setOrdered(true)
  }

  if (loading || !theme || !voice) return (
    <div style={{ minHeight: '100vh', background: '#0a0603', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 36 }}>{'✦'}</div>
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 16 }}>Loading...</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#0a0603', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 36 }}>{'✦'}</div>
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 18 }}>Not found</div>
    </div>
  )

  const t = theme, v = voice

  if (!started) {
    const bgStyle = 'linear-gradient(170deg,' + t.bg + ',' + t.surface + ')'
    const btnStyle = 'linear-gradient(135deg,' + t.primary + ',' + t.primaryDim + ')'
    return (
      <div style={{ minHeight: '100vh', background: bgStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
        <style>{'@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}'}</style>
        {retailer.logo_url
          ? <img src={retailer.logo_url} alt={retailer.name} style={{ height: 72, maxWidth: 220, objectFit: 'contain', marginBottom: 24, borderRadius: 8 }} />
          : <div style={{ fontSize: 60, marginBottom: 20 }}>{v.icon}</div>}
        <div style={{ color: t.primary, fontSize: 10, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 10 }}>Welcome to</div>
        <div style={{ color: t.text, fontSize: 34, fontWeight: 700, lineHeight: 1.15, marginBottom: 8, maxWidth: 320 }}>{retailer.name}</div>
        {retailer.location && <div style={{ color: t.textFaint, fontSize: 14, marginBottom: 6 }}>{retailer.location}</div>}
        {retailer.tagline && <div style={{ color: t.textMuted, fontSize: 16, fontStyle: 'italic', marginBottom: 36 }}>{retailer.tagline}</div>}
        <div style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.75, maxWidth: 300, marginBottom: 44 }}>
          Your personal {v.greeting} is here to find you the perfect selection.
        </div>
        <button onClick={start} style={{ background: btnStyle, border: 'none', borderRadius: 50, padding: '18px 52px', color: t.bg, fontSize: 14, fontWeight: 700, letterSpacing: '.15em', cursor: 'pointer', fontFamily: 'Georgia, serif', boxShadow: '0 8px 32px ' + t.primary + '40' }}>
          {v.cta}
        </button>
        <div style={{ display: 'flex', gap: 6, marginTop: 32 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, animation: 'pulse 1.4s ease-in-out ' + (i * 0.2) + 's infinite' }} />)}
        </div>
      </div>
    )
  }

  if (rec) {
    const recBg = 'linear-gradient(170deg,' + t.bg + ',' + t.surface + ')'
    const cardBg = 'linear-gradient(145deg,' + t.surface + ',' + t.bg + ')'
    const orderBtn = 'linear-gradient(135deg,' + t.primary + ',' + t.primaryDim + ')'
    return (
      <div style={{ minHeight: '100vh', background: recBg, fontFamily: 'Georgia, serif' }}>
        <style>{'*{box-sizing:border-box}::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:' + t.border + '}'}</style>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid ' + t.border, background: t.bg + 'ee', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
          {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} /> : <span style={{ fontSize: 20 }}>{v.icon}</span>}
          <div>
            <div style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{retailer.name}</div>
            <div style={{ color: t.textFaint, fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase' }}>
              {rec.format === 'flight' ? v.flightLabel : v.singleLabel}
            </div>
          </div>
        </div>
        <div style={{ padding: '28px 20px', maxWidth: 520, margin: '0 auto' }}>
          <div style={{ background: cardBg, border: '1px solid ' + t.borderStrong, borderRadius: 20, padding: '28px 22px', marginBottom: 20 }}>
            <div style={{ color: t.primary, fontSize: 9, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 6 }}>
              {rec.format === 'flight' && rec.flightDetails ? rec.flightDetails.count + ' x ' + rec.flightDetails.pourSize + ' Tasting Flight' : v.singleLabel}
            </div>
            <div style={{ color: t.text, fontSize: 28, fontWeight: 700, lineHeight: 1.15, marginBottom: 6 }}>{rec.recommendationName}</div>
            <div style={{ color: t.primary, fontStyle: 'italic', fontSize: 15, marginBottom: 20 }}>{rec.tagline}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
              {rec.flavorProfile.map(f => <span key={f} style={{ background: t.primary + '18', border: '1px solid ' + t.border, borderRadius: 20, padding: '5px 13px', color: t.primary, fontSize: 12 }}>{f}</span>)}
            </div>
            <div style={{ marginBottom: 18 }}>
              {rec.selectedProducts.map((p, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid ' + t.border }}>
                  <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{p.name}{p.price ? ' — $' + p.price : ''}</div>
                  {p.why && <div style={{ color: t.textMuted, fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>{p.why}</div>}
                </div>
              ))}
            </div>
            {rec.format === 'flight' && rec.flightDetails && (
              <div style={{ background: t.primary + '10', border: '1px solid ' + t.border, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <div style={{ color: t.primary, fontSize: 13, fontWeight: 700 }}>{rec.flightDetails.flightName} — {rec.flightDetails.price{'}'}</div>
                <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{rec.flightDetails.count} pours x {rec.flightDetails.pourSize}</div>
              </div>
            )}
            <div style={{ color: t.textMuted, fontSize: 14, lineHeight: 1.75, marginBottom: 16 }}>{rec.story}</div>
            <div style={{ background: t.primary + '0d', border: '1px solid ' + t.border, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ color: t.textFaint, fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>Why this for you</div>
              <div style={{ color: t.text, fontSize: 13, lineHeight: 1.65 }}>{rec.whyItFitsYou}</div>
            </div>
            {rec.serveNote && <div style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>{'✦'} {rec.serveNote}</div>}
          </div>
          {ordered ? (
            <div style={{ background: 'rgba(94,207,138,.08)', border: '1px solid rgba(94,207,138,.25)', borderRadius: 14, padding: '22px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{'✓'}</div>
              <div style={{ color: '#5ecf8a', fontSize: 16, marginBottom: 4 }}>Order placed!</div>
              <div style={{ color: t.textMuted, fontSize: 13 }}>{retailer.name} will have it ready for you.</div>
            </div>
          ) : (
            <button onClick={placeOrder} disabled={ordering} style={{ width: '100%', padding: '18px', borderRadius: 14, background: orderBtn, border: 'none', cursor: ordering ? 'wait' : 'pointer', color: t.bg, fontSize: 14, fontWeight: 700, letterSpacing: '.12em', fontFamily: 'Georgia, serif', boxShadow: '0 6px 24px ' + t.primary + '40', opacity: ordering ? 0.7 : 1 }}>
              {ordering ? 'Placing Order...' : 'Order from ' + retailer.name}
            </button>
          )}
          {!ordered && (
            <button onClick={() => setRec(null)} style={{ width: '100%', marginTop: 12, padding: '12px', background: 'transparent', border: '1px solid ' + t.border, borderRadius: 12, color: t.textFaint, fontSize: 13, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
              Back to conversation
            </button>
          )}
        </div>
      </div>
    )
  }

  const convBg = 'linear-gradient(170deg,' + t.bg + ',' + t.surface + ')'
  const sendBtn = input.trim() && !streaming ? 'linear-gradient(135deg,' + t.primary + ',' + t.primaryDim + ')' : t.surface
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: convBg, fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style>{'*{box-sizing:border-box}@keyframes blink{0%,100%{opacity:.25;transform:scale(.75)}50%{opacity:1;transform:scale(1)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:' + t.border + '}textarea{-webkit-appearance:none}'}</style>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid ' + t.border, background: t.bg + 'ee', backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 10 }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 26, objectFit: 'contain' }} /> : <span style={{ fontSize: 18 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.textFaint, fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase' }}>{v.greeting}</div>
        </div>
        {streaming && <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: t.primary, animation: 'blink 1.2s ease-in-out ' + (i * 0.15) + 's infinite' }} />)}</div>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {messages.map((m, i) => {
          const isAI = m.role === 'assistant'
          const display = isAI ? stripRec(m.content) : m.content
          if (isAI && !display && !m.streaming) return null
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isAI ? 'flex-start' : 'flex-end', marginBottom: 12, animation: 'fadeUp .25s ease' }}>
              <div style={{ maxWidth: '82%', padding: isAI ? '14px 16px' : '12px 16px', borderRadius: isAI ? '4px 18px 18px 18px' : '18px 4px 18px 18px', background: isAI ? t.surfaceHover : t.primary + '22', border: '1px solid ' + (isAI ? t.border : t.borderStrong), color: isAI ? t.text : t.primary, fontSize: 16, lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>
                {m.streaming && !display
                  ? <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{[0,1,2].map(j => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, animation: 'blink 1.2s ease-in-out ' + (j * 0.2) + 's infinite', display: 'inline-block' }} />)}</span>
                  : display}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>
      <div style={{ borderTop: '1px solid ' + t.border, padding: '12px 14px', background: t.bg + 'ee', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', maxWidth: 560, margin: '0 auto' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={v.placeholder}
            rows={1}
            disabled={streaming}
            style={{ flex: 1, background: t.surfaceHover, border: '1px solid ' + t.border, borderRadius: 14, padding: '13px 16px', color: t.text, fontFamily: 'Georgia, serif', fontSize: 16, resize: 'none', outline: 'none', minHeight: 48, maxHeight: 120, opacity: streaming ? 0.6 : 1, lineHeight: 1.5, caretColor: t.primary }}
          />
          <button onClick={send} disabled={streaming || !input.trim()} style={{ background: sendBtn, border: '1px solid ' + t.border, borderRadius: 12, padding: '13px 16px', color: input.trim() && !streaming ? t.bg : t.textFaint, cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 18, height: 48, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {'↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
}