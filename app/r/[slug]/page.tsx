'use client'
import { useEffect, useState, useRef } from 'react'
import { deriveTheme, getVerticalVoice } from '@/lib/theme'

interface Message { role: 'user' | 'assistant'; content: string; streaming?: boolean }
interface RecData {
  format: 'single' | 'flight'
  recommendationName: string; tagline: string
  selectedProducts: Array<{ name: string; why: string; price: number }>
  flightDetails: { flightName: string; price: number; pourSize: string; count: number } | null
  flavorProfile: string[]; story: string; whyItFitsYou: string; serveNote: string
}

function stripRec(t: string) { return t.replace(/===REC===[\s\S]*?===END===/g, '').trim() }

function getMoodChips(vertical: string, hasFlight: boolean): string[][] {
  const base: Record<string, string[][]> = {
    brewery: [['🌿 Crisp & Light','🔥 Bold & Dark','🍋 Hoppy & Bright','✨ Surprise Me'],['First time here','I know what I like','Let\'s explore','Just something cold']],
    winery: [['🍓 Fruity & Sweet','🍷 Dry & Bold','🫧 Light & Crisp','✨ Surprise Me'],['Celebrating tonight','Just relaxing','New to wine','Regular here']],
    distillery: [['🥃 Neat & Sipping','🍹 Cocktail','🔥 Bold & Smoky','✨ Surprise Me'],['First time here','I know spirits','Show me your best','Something unique']],
    coffee: [['☀️ Light & Bright','🌑 Dark & Rich','🍦 Sweet & Smooth','✨ Surprise Me'],['Morning fuel','Afternoon treat','New to specialty','I love espresso']],
  }
  return base[vertical] || base.brewery
}

export default function CustomerPage({ params }: { params: { slug: string } }) {
  const [retailer, setRetailer] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
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
  const [screen, setScreen] = useState<'welcome'|'chips'|'chat'|'rec'|'order'>('welcome')
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [chipStep, setChipStep] = useState(0)
  const [guestEmail, setGuestEmail] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
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
        setRetailer(data.retailer)
        setProducts(data.products || [])
        setSessionId(data.sessionId)
        setLoading(false)
      } catch { setNotFound(true); setLoading(false) }
    }
    init()
  }, [params.slug])

  useEffect(() => {
    if (messages.length === 1 && msgListRef.current) msgListRef.current.scrollTop = 0
    else if (messages.length > 1) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  useEffect(() => { if (rec) setScreen('rec') }, [rec])

  async function chat(msgs: Message[], chipContext?: string) {
    if (!retailer || !sessionId) return
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, retailerSlug: params.slug, messages: msgs, chipContext }) })
      const data = await res.json()
      const text = data.text || ''
      if (data.recData) setRec(data.recData)
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: text, streaming: false }; return u })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: 'Something went wrong. Try again.', streaming: false }; return u })
    }
    setStreaming(false)
  }

  async function handleChipSelect(chip: string) {
    const chips = getMoodChips(retailer.vertical, products.length > 0)
    const newSelected = [...selectedChips, chip]
    setSelectedChips(newSelected)
    if (chipStep < chips.length - 1) {
      setChipStep(chipStep + 1)
    } else {
      setScreen('chat')
      const context = newSelected.join(', ')
      const userMsg: Message = { role: 'user', content: context }
      setMessages([userMsg])
      await chat([userMsg], context)
    }
  }

  async function send() {
    if (!input.trim() || streaming) return
    const newMsgs = [...messages, { role: 'user' as const, content: input.trim() }]
    setMessages(newMsgs); setInput('')
    await chat(newMsgs.map(m => ({ role: m.role, content: m.content })))
  }

  async function saveEmail() {
    if (!guestEmail || !sessionId) return
    await fetch('/api/session/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, email: guestEmail }) })
    setEmailSaved(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100dvh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#fff', fontFamily: 'system-ui', fontSize: 18 }}>Guide not found</div>
      <div style={{ color: 'rgba(255,255,255,.4)', fontFamily: 'system-ui', fontSize: 14 }}>This QR code may be inactive.</div>
    </div>
  )

  const t = deriveTheme(retailer.brand_color, retailer.bg_color)
  const v = getVerticalVoice(retailer.vertical, products.map((p: any) => p.category).filter(Boolean))
  const chips = getMoodChips(retailer.vertical, products.length > 0)

  // ── WELCOME ───────────────────────────────────────────────────────────────
  if (screen === 'welcome') return (
    <div style={{ minHeight: '100dvh', background: t.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', overflow: 'hidden', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '55%', background: `radial-gradient(ellipse at 50% 0%, ${t.primary}35 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 28px 40px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ animation: 'fadeUp .45s ease both', width: '100%', maxWidth: 340 }}>
          {retailer.logo_url
            ? <img src={retailer.logo_url} alt={retailer.name} style={{ height: 80, maxWidth: 220, objectFit: 'contain', marginBottom: 24 }} onError={e => { (e.target as any).style.display='none' }} />
            : <div style={{ fontSize: 68, marginBottom: 18, lineHeight: 1 }}>{v.icon}</div>}
          <h1 style={{ color: t.text, fontSize: 34, fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px', letterSpacing: '-.01em' }}>{retailer.name}</h1>
          {retailer.location && <div style={{ color: t.textFaint, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{retailer.location}</div>}
          {retailer.tagline && <div style={{ color: t.textMuted, fontSize: 16, fontStyle: 'italic', lineHeight: 1.6, marginTop: 8 }}>{retailer.tagline}</div>}
          <div style={{ width: 44, height: 2, background: t.primary, borderRadius: 2, margin: '22px auto' }} />
          <p style={{ color: t.textMuted, fontSize: 16, lineHeight: 1.75, margin: '0 0 36px', maxWidth: 280 }}>
            Your personal {v.greeting} — scan to find the perfect {retailer.vertical === 'coffee' ? 'cup' : 'pour'} for tonight.
          </p>
        </div>
        <div style={{ animation: 'fadeUp .45s ease both .2s', width: '100%', maxWidth: 320 }}>
          <button
            onClick={() => setScreen('chips')}
            style={{ width: '100%', padding: '20px 0', background: t.primary, border: 'none', borderRadius: 16, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', boxShadow: `0 8px 28px ${t.primary}55`, letterSpacing: '.04em' }}
          >{v.cta}</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `pulse 1.6s ease-in-out ${i*.3}s infinite` }} />)}
          </div>
        </div>
      </div>
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${t.primary}80, transparent)` }} />
    </div>
  )

  // ── MOOD CHIPS ────────────────────────────────────────────────────────────
  if (screen === 'chips') return (
    <div style={{ minHeight: '100dvh', background: t.bg, display: 'flex', flexDirection: 'column', fontFamily: 'Georgia, serif', position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes chipIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}` }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: `radial-gradient(ellipse at 50% 0%, ${t.primary}20 0%, transparent 65%)`, pointerEvents: 'none' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ animation: 'fadeUp .3s ease', marginBottom: 40, textAlign: 'center' }}>
          {retailer.logo_url && <img src={retailer.logo_url} alt="" style={{ height: 36, objectFit: 'contain', marginBottom: 16 }} onError={e => { (e.target as any).style.display='none' }} />}
          <div style={{ color: t.textFaint, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 10 }}>Step {chipStep + 1} of {chips.length}</div>
          <div style={{ color: t.text, fontSize: 24, fontWeight: 700, lineHeight: 1.3 }}>
            {chipStep === 0 ? `What sounds good tonight?` : `Tell us a bit more`}
          </div>
          {chipStep === 0 && retailer.culture && (
            <div style={{ color: t.textMuted, fontSize: 14, marginTop: 10, lineHeight: 1.6, maxWidth: 300, marginLeft: 'auto', marginRight: 'auto' }}>
              {retailer.culture.split('.')[0]}.
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 400, margin: '0 auto', width: '100%' }}>
          {chips[chipStep].map((chip, i) => (
            <button
              key={chip}
              onClick={() => handleChipSelect(chip)}
              style={{ padding: '18px 14px', background: t.surface, border: `2px solid ${t.border}`, borderRadius: 16, color: t.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Georgia, serif', textAlign: 'center', lineHeight: 1.4, animation: `chipIn .25s ease both ${i * .06}s`, transition: 'all .15s' }}
              onMouseDown={e => { (e.currentTarget.style.background = t.primary + '30'); (e.currentTarget.style.borderColor = t.primary) }}
              onMouseUp={e => { (e.currentTarget.style.background = t.surface); (e.currentTarget.style.borderColor = t.border) }}
              onTouchStart={e => { (e.currentTarget.style.background = t.primary + '30'); (e.currentTarget.style.borderColor = t.primary) }}
              onTouchEnd={e => { (e.currentTarget.style.background = t.surface); (e.currentTarget.style.borderColor = t.border) }}
            >{chip}</button>
          ))}
        </div>
        {chipStep > 0 && (
          <button onClick={() => setChipStep(0)} style={{ marginTop: 24, color: t.textFaint, fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textAlign: 'center', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>← Back</button>
        )}
        <button onClick={() => { setScreen('chat'); chat([{ role: 'user', content: 'START_SESSION' }]) }} style={{ marginTop: 20, color: t.textFaint, fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', textAlign: 'center', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}>
          Skip — I'll describe what I want
        </button>
      </div>
    </div>
  )

  // ── RECOMMENDATION ────────────────────────────────────────────────────────
  if (screen === 'rec' && rec) return (
    <div style={{ minHeight: '100dvh', background: t.bg, fontFamily: 'Georgia, serif', overflowY: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: `*{box-sizing:border-box}::-webkit-scrollbar{width:0}@keyframes revealUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}` }} />
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface + 'f0', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid rgba(255,255,255,.06)` }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 28, objectFit: 'contain' }} onError={e=>{(e.target as any).style.display='none'}} /> : <span style={{ fontSize: 20 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.primary, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your Recommendation</div>
        </div>
        <button onClick={() => setScreen('chat')} style={{ color: t.textFaint, fontSize: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>← Chat</button>
      </div>
      <div style={{ padding: '24px 20px 48px', maxWidth: 540, margin: '0 auto' }}>
        <div style={{ animation: 'revealUp .4s ease', background: t.surface, border: `1px solid rgba(255,255,255,.09)`, borderRadius: 24, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: 4, background: t.primary }} />
          <div style={{ padding: '24px 22px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: t.primary + '20', border: `1px solid ${t.primary}50`, borderRadius: 20, padding: '5px 14px', marginBottom: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.primary }} />
              <span style={{ color: t.primary, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' as const }}>
                {rec.format === 'flight' && rec.flightDetails ? `${rec.flightDetails.count} × ${rec.flightDetails.pourSize} Flight` : v.singleLabel}
              </span>
            </div>
            <h2 style={{ color: t.text, fontSize: 28, fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px' }}>{rec.recommendationName}</h2>
            <p style={{ color: t.primary, fontStyle: 'italic', fontSize: 16, margin: '0 0 18px', lineHeight: 1.5 }}>{rec.tagline}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {rec.flavorProfile.map(f => <span key={f} style={{ background: t.primary + '18', border: `1px solid ${t.primary}40`, borderRadius: 20, padding: '5px 13px', color: t.primary, fontSize: 13 }}>{f}</span>)}
            </div>
            <div style={{ marginBottom: 18 }}>
              {rec.selectedProducts.map((p, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid rgba(255,255,255,.06)` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ color: t.text, fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                    {p.price > 0 && <div style={{ color: t.primary, fontSize: 15, fontWeight: 700 }}>${p.price}</div>}
                  </div>
                  {p.why && <div style={{ color: t.textMuted, fontSize: 14, marginTop: 4, lineHeight: 1.55 }}>{p.why}</div>}
                </div>
              ))}
            </div>
            {rec.format === 'flight' && rec.flightDetails && (
              <div style={{ background: t.primary + '15', borderRadius: 12, padding: '14px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>{rec.flightDetails.flightName}</div>
                  <div style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{rec.flightDetails.count} pours · {rec.flightDetails.pourSize}</div>
                </div>
                <div style={{ color: t.primary, fontSize: 22, fontWeight: 700 }}>${rec.flightDetails.price}</div>
              </div>
            )}
            <p style={{ color: t.textMuted, fontSize: 15, lineHeight: 1.75, margin: '0 0 14px' }}>{rec.story}</p>
            <div style={{ background: `rgba(255,255,255,.04)`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ color: t.textFaint, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>Why this for you</div>
              <div style={{ color: t.text, fontSize: 15, lineHeight: 1.6 }}>{rec.whyItFitsYou}</div>
            </div>
            {rec.serveNote && <p style={{ color: t.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, margin: 0 }}>{rec.serveNote}</p>}
          </div>
        </div>
        <button onClick={() => setScreen('order')} style={{ width: '100%', padding: '20px', borderRadius: 16, background: t.primary, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 17, fontWeight: 700, fontFamily: 'Georgia, serif', boxShadow: `0 6px 24px ${t.primary}50`, marginBottom: 12 }}>
          Show Order Card →
        </button>
        <button onClick={() => setScreen('chat')} style={{ width: '100%', padding: '14px', background: 'transparent', border: `1px solid rgba(255,255,255,.12)`, borderRadius: 14, color: t.textMuted, fontSize: 15, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
          ← Back to conversation
        </button>
      </div>
    </div>
  )

  // ── ORDER CARD (show to bartender) ────────────────────────────────────────
  if (screen === 'order' && rec) return (
    <div style={{ minHeight: '100dvh', background: t.bg, fontFamily: 'Georgia, serif', display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: `*{box-sizing:border-box}@keyframes revealUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}` }} />
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderBottom: `1px solid rgba(255,255,255,.06)` }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 26, objectFit: 'contain' }} onError={e=>{(e.target as any).style.display='none'}} /> : <span style={{ fontSize: 18 }}>{v.icon}</span>}
        <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{retailer.name}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        {/* The order card — show this to your bartender */}
        <div style={{ animation: 'revealUp .35s ease', width: '100%', maxWidth: 380, background: t.surface, border: `2px solid ${t.primary}`, borderRadius: 24, overflow: 'hidden', boxShadow: `0 12px 40px ${t.primary}30` }}>
          <div style={{ background: t.primary, padding: '20px 24px', textAlign: 'center' }}>
            {retailer.logo_url && <img src={retailer.logo_url} alt="" style={{ height: 40, objectFit: 'contain', marginBottom: 10, opacity: .9 }} onError={e=>{(e.target as any).style.display='none'}} />}
            <div style={{ color: '#fff', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .8 }}>My Order</div>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ color: t.text, fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginBottom: 6 }}>{rec.recommendationName}</div>
            <div style={{ color: t.primary, fontStyle: 'italic', fontSize: 15, marginBottom: 20, lineHeight: 1.5 }}>{rec.tagline}</div>
            {rec.selectedProducts.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,.06)` }}>
                <div style={{ color: t.text, fontSize: 15 }}>{p.name}</div>
                {p.price > 0 && <div style={{ color: t.primary, fontSize: 15, fontWeight: 700 }}>${p.price}</div>}
              </div>
            ))}
            {rec.format === 'flight' && rec.flightDetails && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid rgba(255,255,255,.06)` }}>
                <div style={{ color: t.text, fontSize: 15 }}>{rec.flightDetails.flightName} ({rec.flightDetails.count} pours)</div>
                <div style={{ color: t.primary, fontSize: 16, fontWeight: 700 }}>${rec.flightDetails.price}</div>
              </div>
            )}
            <div style={{ marginTop: 20, padding: '14px 16px', background: t.primary + '15', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ color: t.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Show this to your bartender</div>
              <div style={{ color: t.textMuted, fontSize: 12 }}>Powered by Poursona</div>
            </div>
          </div>
        </div>
        {/* Guest email capture */}
        {!emailSaved && (
          <div style={{ marginTop: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ color: t.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 12 }}>Remember my taste for next time?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="your@email.com" style={{ flex: 1, padding: '12px 16px', background: t.surface, border: `1px solid rgba(255,255,255,.12)`, borderRadius: 12, color: t.text, fontFamily: 'Georgia, serif', fontSize: 15, outline: 'none' }} />
              <button onClick={saveEmail} disabled={!guestEmail} style={{ padding: '12px 18px', background: t.primary, border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', opacity: guestEmail ? 1 : .4 }}>Save</button>
            </div>
          </div>
        )}
        {emailSaved && <div style={{ marginTop: 16, color: t.primary, fontSize: 14, textAlign: 'center' }}>✓ Saved! We'll remember your taste.</div>}
        <button onClick={() => setScreen('rec')} style={{ marginTop: 20, color: t.textFaint, fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif' }}>← Back to recommendation</button>
      </div>
    </div>
  )

  // ── CHAT ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: t.bg, fontFamily: 'Georgia, serif', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `*{box-sizing:border-box}@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}::-webkit-scrollbar{width:0}textarea{-webkit-appearance:none;appearance:none}` }} />
      <div style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, background: t.surface, borderBottom: `1px solid rgba(255,255,255,.07)`, flexShrink: 0 }}>
        {retailer.logo_url ? <img src={retailer.logo_url} alt="" style={{ height: 26, objectFit: 'contain' }} onError={e=>{(e.target as any).style.display='none'}} /> : <span style={{ fontSize: 20 }}>{v.icon}</span>}
        <div style={{ flex: 1 }}>
          <div style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{retailer.name}</div>
          <div style={{ color: t.textFaint, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}>{v.greeting}</div>
        </div>
        {streaming && <div style={{ display: 'flex', gap: 4 }}>{[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${i*.15}s infinite` }} />)}</div>}
      </div>
      <div ref={msgListRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column' }}>
        {messages.map((m, i) => {
          const isAI = m.role === 'assistant'
          const display = isAI ? stripRec(m.content) : m.content
          if (isAI && !display && !m.streaming) return null
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isAI ? 'flex-start' : 'flex-end', marginBottom: 14, animation: 'slideUp .2s ease' }}>
              <div style={{ maxWidth: '86%', padding: '13px 17px', borderRadius: isAI ? '6px 20px 20px 20px' : '20px 6px 20px 20px', background: isAI ? t.surface : t.primary, color: isAI ? t.text : '#fff', fontSize: 16, lineHeight: 1.68, whiteSpace: 'pre-wrap', border: isAI ? `1px solid rgba(255,255,255,.07)` : 'none', boxShadow: isAI ? 'none' : `0 3px 14px ${t.primary}40` }}>
                {m.streaming && !display ? <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>{[0,1,2].map(j => <span key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: t.primary, animation: `blink 1.2s ease-in-out ${j*.2}s infinite`, display: 'inline-block' }} />)}</span> : display}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} style={{ height: 4 }} />
      </div>
      <div style={{ padding: '11px 15px 18px', background: t.surface, borderTop: `1px solid rgba(255,255,255,.07)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', maxWidth: 560, margin: '0 auto' }}>
          <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px' }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} placeholder={v.placeholder} rows={1} disabled={streaming} style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: `1px solid rgba(255,255,255,.1)`, borderRadius: 16, padding: '14px 17px', color: t.text, fontFamily: 'Georgia, serif', fontSize: 16, resize: 'none', outline: 'none', minHeight: 52, maxHeight: 110, opacity: streaming ? .5 : 1, lineHeight: 1.5, caretColor: t.primary }} />
          <button onClick={send} disabled={streaming || !input.trim()} style={{ background: input.trim() && !streaming ? t.primary : 'rgba(255,255,255,.07)', border: 'none', borderRadius: 15, width: 52, height: 52, color: input.trim() && !streaming ? '#fff' : 'rgba(255,255,255,.25)', cursor: input.trim() && !streaming ? 'pointer' : 'default', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: input.trim() && !streaming ? `0 3px 14px ${t.primary}45` : 'none' }}>↑</button>
        </div>
      </div>
    </div>
  )
}