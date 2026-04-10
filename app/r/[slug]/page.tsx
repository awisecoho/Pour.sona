// app/r/[slug]/page.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { Retailer, BlendRecommendation } from '@/lib/supabase'

interface Message { role: 'user' | 'assistant'; content: string; streaming?: boolean }

const VERTICAL_ICONS: Record<string, string> = { coffee: '☕', brewery: '🍺', winery: '🍷' }
const stripRec = (t: string) => t.replace(/===REC===([\s\S]*?)===END===/g, '').trim()

function LoadingScreen({ retailer }: { retailer: Retailer | null }) {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>{retailer ? VERTICAL_ICONS[retailer.vertical] : '✦'}</div>
      <div style={{ fontFamily: 'Georgia, serif', color: '#C9A84C', fontSize: 18 }}>
        {retailer ? `Welcome to ${retailer.name}` : 'Loading…'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A84C', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
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
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 20 }}>Retailer not found</div>
      <div style={{ color: '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 15 }}>This QR code may be inactive or expired.</div>
    </div>
  )
}

function RecommendationCard({ rec, retailer, sessionId, onOrder }: {
  rec: BlendRecommendation; retailer: Retailer; sessionId: string; onOrder: () => void
}) {
  const [ordering, setOrdering] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const products = rec.selectedProducts || []

  const handleOrder = async () => {
    setOrdering(true)
    const items = products.map((p: { name: string }) => ({ name: p.name, size: 'Standard', price: 0, qty: 1 }))
    await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, retailerId: retailer.id, items, blendName: rec.recommendationName }),
    })
    setOrdering(false)
    setOrdered(true)
    onOrder()
  }

  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0803,#0a1408)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 18, padding: '24px 20px', marginTop: 20 }}>
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>{retailer.name} · Your Selection</div>
      <div style={{ color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{rec.recommendationName}</div>
      <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 15, fontStyle: 'italic', marginBottom: 20 }}>{rec.tagline}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {(rec.flavorProfile || []).map(f => (
          <span key={f} style={{ background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 20, padding: '4px 12px', color: '#C9A84C', fontSize: 13 }}>{f}</span>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        {products.map((p: { name: string; why?: string; ratio?: number }, i: number) => (
          <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,.07)' }}>
            <div style={{ color: '#F5ECD7', fontSize: 15 }}>{p.name}{p.ratio ? ` — ${p.ratio}%` : ''}</div>
            {p.why && <div style={{ color: '#8a7a5a', fontSize: 13, marginTop: 2 }}>{p.why}</div>}
          </div>
        ))}
      </div>
      <div style={{ color: '#c8bfa8', fontSize: 15, lineHeight: 1.75, marginBottom: 16 }}>{rec.story}</div>
      <div style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ color: '#6a5a2a', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>Why This Fits You</div>
        <div style={{ color: '#F5ECD7', fontSize: 14, lineHeight: 1.7 }}>{rec.whyItFitsYou}</div>
      </div>
      {ordered ? (
        <div style={{ background: 'rgba(94,207,138,.1)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>✓</div>
          <div style={{ color: '#5ecf8a', fontSize: 15 }}>Order placed! {retailer.name} will have it ready for you.</div>
        </div>
      ) : (
        <button onClick={handleOrder} disabled={ordering} style={{ width: '100%', padding: 17, borderRadius: 12, background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', cursor: ordering ? 'wait' : 'pointer', color: '#0a0603', fontSize: 13, fontWeight: 700, letterSpacing: '.15em' }}>
          {ordering ? 'Placing Order…' : `ORDER FROM ${retailer.name.toUpperCase()}`}
        </button>
      )}
    </div>
  )
}

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
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/retailer?slug=${params.slug}`)
        if (!res.ok) { setNotFound(true); setLoading(false); return }
        const data = await res.json()
        if (!data.retailer) { setNotFound(true); setLoading(false); return }
        setRetailer(data.retailer)
        setSessionId(data.sessionId)
        setLoading(false)
      } catch { setNotFound(true); setLoading(false) }
    }
    init()
  }, [params.slug])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, rec])

  const streamChat = async (msgs: Message[]) => {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs }),
      })
      const data = await res.json()
      const text = stripRec(data.text || '')
      if (data.recData) setRec(data.recData)
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: text, streaming: false }
        return u
      })
    } catch {
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Please try again.', streaming: false }
        return u
      })
    }
    setStreaming(false)
  }

  const start = async () => {
    setStarted(true)
    const initMsg: Message = { role: 'user', content: 'Begin. Greet me warmly with a welcome to the retailer, introduce yourself briefly, and ask your first discovery question.' }
    await streamChat([initMsg])
  }

  const send = async () => {
    if (!input.trim() || streaming) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    await streamChat(newMsgs.map(m => ({ role: m.role, content: m.content })))
  }

  if (loading) return <LoadingScreen retailer={retailer} />
  if (notFound) return <NotFound />

  const icon = VERTICAL_ICONS[retailer!.vertical]

  if (!started) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Georgia, serif' }}>Welcome to</div>
      <div style={{ color: '#F5ECD7', fontSize: 36, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>{retailer!.name}</div>
      {retailer!.location && <div style={{ color: '#6a5a3a', fontSize: 15, marginBottom: 6, fontFamily: 'Georgia, serif' }}>{retailer!.location}</div>}
      {retailer!.tagline && <div style={{ color: '#8a7a5a', fontSize: 16, fontStyle: 'italic', marginBottom: 32, fontFamily: 'Georgia, serif' }}>{retailer!.tagline}</div>}
      <div style={{ color: '#a09070', fontSize: 17, lineHeight: 1.7, maxWidth: 400, marginBottom: 40, fontFamily: 'Georgia, serif' }}>
        Let me help you find the perfect selection from our catalog — just answer a few quick questions.
      </div>
      <button onClick={start} style={{ background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 40, padding: '16px 44px', color: '#0a0603', fontSize: 13, fontWeight: 700, letterSpacing: '.2em', cursor: 'pointer' }}>
        Find My Perfect {retailer!.vertical === 'coffee' ? 'Blend' : retailer!.vertical === 'brewery' ? 'Beer' : 'Wine'}
      </button>
    </div>
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', fontFamily: 'Georgia, serif' }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(201,168,76,.2)}
      `}</style>
      <div style={{ borderBottom: '1px solid rgba(201,168,76,.18)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700 }}>{retailer!.name}</div>
          <div style={{ color: '#3a2a0a', fontSize: 10, letterSpacing: '.15em' }}>POURSONA GUIDE</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 14px', maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && <div style={{ color: '#3a2a0a', fontSize: 9, letterSpacing: '.18em', marginBottom: 4 }}>POURSONA</div>}
            <div style={{ maxWidth: '85%', padding: '12px 16px', fontSize: 16, lineHeight: 1.78, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'rgba(201,168,76,.12)' : 'rgba(255,255,255,.04)', border: m.role === 'user' ? '1px solid rgba(201,168,76,.25)' : '1px solid rgba(255,255,255,.06)', borderRadius: m.role === 'user' ? '17px 17px 4px 17px' : '4px 17px 17px 17px', color: m.role === 'user' ? '#C9A84C' : '#c8bfa8' }}>
              {m.content === '' && m.streaming
                ? <span style={{ display: 'inline-flex', gap: 4 }}>{[0,1,2].map(j => <span key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#C9A84C', animation: `blink 1.2s ease-in-out ${j*.2}s infinite`, display: 'inline-block' }}/>)}</span>
                : m.content
              }
            </div>
          </div>
        ))}
        {rec && !ordered && <RecommendationCard rec={rec} retailer={retailer!} sessionId={sessionId!} onOrder={() => setOrdered(true)} />}
        {ordered && <div style={{ textAlign: 'center', marginTop: 24, color: '#5ecf8a', fontSize: 16 }}>Thank you! We hope you enjoy your selection. ✦</div>}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>
      {messages.filter(m => m.role === 'user').length >= 2 && !rec && (
        <div style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: '0 14px 5px', alignSelf: 'stretch' }}>
          <button onClick={() => { setInput('I think you have enough — give me your recommendation.'); setTimeout(send, 50) }} disabled={streaming} style={{ background: 'transparent', border: '1px solid rgba(201,168,76,.22)', borderRadius: 18, padding: '6px 16px', color: '#6a5020', fontSize: 11, letterSpacing: '.12em', cursor: streaming ? 'default' : 'pointer', opacity: streaming ? .4 : 1 }}>
            ✦ Just give me a recommendation
          </button>
        </div>
      )}
      {!rec && (
        <div style={{ borderTop: '1px solid rgba(201,168,76,.1)', padding: '11px 14px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(10px)', flexShrink: 0, maxWidth: 640, width: '100%', margin: '0 auto', alignSelf: 'stretch' }}>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder="Share your thoughts…" rows={1} disabled={streaming} style={{ flex: 1, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 11, padding: '11px 14px', color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 16, resize: 'none', outline: 'none', minHeight: 44, opacity: streaming ? .6 : 1 }} />
            <button onClick={send} disabled={streaming || !input.trim()} style={{ background: input.trim() && !streaming ? 'linear-gradient(135deg,#C9A84C,#a07830)' : 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.22)', borderRadius: 9, padding: '11px 16px', color: input.trim() && !streaming ? '#0a0603' : '#3a2a0a', cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 14, height: 44 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  )
}
