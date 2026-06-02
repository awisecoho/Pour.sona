'use client'

/**
 * Demo guest guide — vendor sees their personalized AI guide before creating an account.
 * Same chat UI as /r/[slug] but reads from retailer_drafts and uses /api/demo/chat.
 * After engagement a "Claim Your Guide" banner/CTA lets them register.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Retailer, BlendRecommendation } from '@/lib/types'

interface Message { role: 'user' | 'assistant'; content: string; streaming?: boolean }

const VERTICAL_ICONS: Record<string, string> = { coffee: '☕', brewery: '🍺', winery: '🍷', distillery: '🥃' }
const VERTICAL_NOUN: Record<string, string>  = { coffee: 'Blend', brewery: 'Beer', distillery: 'Pour', winery: 'Wine' }
const VERTICAL_PLURAL: Record<string, string> = { coffee: 'coffees', brewery: 'beers', distillery: 'pours', winery: 'wines' }

const stripRec = (t: string) =>
  t.replace(/===REC===[\s\S]*?===END===/g, '').replace(/===CHIPS===[\s\S]*?===END===/g, '').replace(/===[\s\S]*$/, '').trim()

function hexToRgb(hex: string): [number,number,number] | null {
  const h = hex.replace('#',''); if (h.length !== 6) return null
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]
}
function useTheme(retailer: Retailer | null) {
  return useMemo(() => {
    const primary = retailer?.brand_color || '#3FC6D4'
    const rgb = hexToRgb(primary)
    const rgbStr = rgb ? `${rgb[0]},${rgb[1]},${rgb[2]}` : '63,198,212'
    const luminance = rgb ? (0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255 : 0.5
    return { primary, rgbStr, onPrimary: luminance > 0.55 ? '#0A0E15' : '#E8EDF2' }
  }, [retailer])
}
function useFont(retailer: Retailer | null) {
  useEffect(() => {
    if (!retailer?.brand_font_url) return
    const id = 'brand-font'; if (document.getElementById(id)) return
    const link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; link.href = retailer.brand_font_url
    document.head.appendChild(link)
  }, [retailer?.brand_font_url])
  return retailer?.brand_font_family || 'Space Grotesk'
}

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh',background:'#0A0E15',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14 }}>
      <div style={{ display:'flex',gap:7 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:'50%',background:'#3FC6D4',animation:`ldot 1.3s ease-in-out ${i*.18}s infinite` }}/>)}
      </div>
      <style>{`@keyframes ldot{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

/** Sticky banner shown after first AI response — gently nudges toward claiming. */
function ClaimBanner({ draftId, theme, font, visible }: { draftId: string; theme: ReturnType<typeof useTheme>; font: string; visible: boolean }) {
  function claim() {
    if (typeof window !== 'undefined') localStorage.setItem('pending_draft_id', draftId)
    window.location.href = '/admin/login'
  }
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: `linear-gradient(135deg, rgba(${theme.rgbStr},.12), rgba(${theme.rgbStr},.06))`,
      backdropFilter: 'blur(12px)',
      borderBottom: `1px solid rgba(${theme.rgbStr},.25)`,
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ color: '#C4CDD9', fontSize: 13, fontFamily: `'${font}', 'Space Grotesk', sans-serif`, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
        <span style={{ color: theme.primary, fontWeight: 700 }}>This is YOUR guide.</span>{' '}
        <span style={{ color: '#8A95A5' }}>Claim it free — 14-day trial.</span>
      </div>
      <button
        onClick={claim}
        style={{
          background: theme.primary, border: 'none', borderRadius: 20,
          padding: '9px 18px', cursor: 'pointer',
          color: theme.onPrimary, fontSize: 12, fontWeight: 700,
          fontFamily: `'${font}', 'Space Grotesk', sans-serif`, letterSpacing: '.08em',
          whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: `0 4px 16px rgba(${theme.rgbStr},.3)`,
        }}
      >
        Claim it →
      </button>
    </div>
  )
}

function WelcomeScreen({ retailer, onStart, theme, font, draftId }: { retailer: Retailer; onStart:()=>void; theme: ReturnType<typeof useTheme>; font: string; draftId: string }) {
  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'
  function claim() {
    if (typeof window !== 'undefined') localStorage.setItem('pending_draft_id', draftId)
    window.location.href = '/admin/login'
  }
  return (
    <div style={{ minHeight:'100vh',background:'linear-gradient(170deg,#0A0E15 0%,#101622 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'56px 28px',textAlign:'center',position:'relative',boxSizing:'border-box' }}>
      <div style={{ position:'fixed',top:'30%',left:'50%',transform:'translate(-50%,-50%)',width:320,height:320,borderRadius:'50%',background:`radial-gradient(circle,rgba(${theme.rgbStr},.08) 0%,transparent 70%)`,pointerEvents:'none' }} />

      {/* Demo badge */}
      <div style={{ position:'absolute',top:20,right:20,background:`rgba(${theme.rgbStr},.12)`,border:`1px solid rgba(${theme.rgbStr},.3)`,borderRadius:20,padding:'5px 12px',color:theme.primary,fontSize:11,fontFamily:`'${font}','Space Grotesk', sans-serif`,letterSpacing:'.1em' }}>
        ✦ Your Preview
      </div>

      <div style={{ marginBottom:24 }}>
        {retailer.logo_url ? (
          <div style={{ minWidth:88,height:100,maxWidth:260,borderRadius:20,overflow:'hidden',border:`1px solid rgba(${theme.rgbStr},.18)`,background:'rgba(255,255,255,.04)',display:'flex',alignItems:'center',justifyContent:'center',padding:'14px 20px' }}>
            <img src={retailer.logo_url} alt={retailer.name} style={{ maxWidth:'100%',maxHeight:'100%',objectFit:'contain' }} onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
          </div>
        ) : (
          <div style={{ width:72,height:72,borderRadius:'50%',border:`1.5px solid rgba(${theme.rgbStr},.2)`,display:'flex',alignItems:'center',justifyContent:'center',background:`rgba(${theme.rgbStr},.06)`,fontSize:32 }}>
            {VERTICAL_ICONS[retailer.vertical]||'✦'}
          </div>
        )}
      </div>

      <div style={{ color:'#E8EDF2',fontSize:34,fontWeight:700,fontFamily:`'${font}','Space Grotesk', sans-serif`,lineHeight:1.2,marginBottom:6,letterSpacing:'-.3px' }}>{retailer.name}</div>
      {retailer.location && <div style={{ color:`rgba(${theme.rgbStr},.6)`,fontSize:13,fontFamily:`'${font}','Space Grotesk', sans-serif`,marginBottom:4 }}>{retailer.location}</div>}
      {retailer.tagline && <div style={{ color:'#6B7588',fontSize:15,fontStyle:'italic',fontFamily:`'${font}','Space Grotesk', sans-serif` }}>{retailer.tagline}</div>}

      <div style={{ width:40,height:1,background:`rgba(${theme.rgbStr},.2)`,margin:'28px auto' }} />
      <div style={{ color:'#7B8598',fontSize:16,lineHeight:1.8,maxWidth:320,marginBottom:36,fontFamily:`'${font}','Space Grotesk', sans-serif` }}>
        I&apos;ll help you find the perfect {VERTICAL_PLURAL[retailer.vertical]||'selection'}. Just a question or two.
      </div>

      <button onClick={onStart} style={{ background:theme.primary,border:'none',borderRadius:50,padding:'15px 0',width:'100%',maxWidth:280,color:theme.onPrimary,fontSize:14,fontWeight:700,letterSpacing:'.15em',cursor:'pointer',fontFamily:`'${font}','Space Grotesk', sans-serif`,boxShadow:`0 8px 32px rgba(${theme.rgbStr},.25)`,marginBottom:14 }}>
        Try it — Find My {noun}
      </button>

      <button onClick={claim} style={{ background:'transparent',border:`1px solid rgba(${theme.rgbStr},.3)`,borderRadius:50,padding:'11px 0',width:'100%',maxWidth:280,color:theme.primary,fontSize:13,fontWeight:600,letterSpacing:'.1em',cursor:'pointer',fontFamily:`'${font}','Space Grotesk', sans-serif` }}>
        Claim this guide →
      </button>
      <div style={{ marginTop:10,color:'#2A3242',fontSize:11 }}>14-day free trial · no credit card</div>
    </div>
  )
}

function QuickChips({ chips,onSelect,theme,font }:{ chips:string[];onSelect:(c:string)=>void;theme:ReturnType<typeof useTheme>;font:string }) {
  return (
    <div style={{ overflowX:'auto',WebkitOverflowScrolling:'touch',paddingBottom:4,marginTop:8,maxWidth:'100%' }}>
      <div style={{ display:'flex',gap:8,paddingRight:4,width:'max-content' }}>
        {chips.map(chip=>(
          <button key={chip} onClick={()=>onSelect(chip)} style={{ background:`rgba(${theme.rgbStr},.06)`,border:`1px solid rgba(${theme.rgbStr},.28)`,borderRadius:24,padding:'9px 18px',color:theme.primary,fontSize:14,fontFamily:`'${font}','Space Grotesk', sans-serif`,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0 }}>{chip}</button>
        ))}
      </div>
    </div>
  )
}

/** Simplified rec card for demo — primary CTA claims the guide instead of ordering. */
function DemoRecommendationCard({ rec,retailer,ctas,onTryAnother,theme,font,draftId }:{ rec:BlendRecommendation;retailer:Retailer;ctas:{primary:string;secondary:string};onTryAnother:()=>void;theme:ReturnType<typeof useTheme>;font:string;draftId:string }) {
  const noun = VERTICAL_NOUN[retailer.vertical]||'Selection'
  const products = rec.selectedProducts||[]

  function claim() {
    if (typeof window !== 'undefined') localStorage.setItem('pending_draft_id', draftId)
    window.location.href = '/admin/login'
  }

  return (
    <div style={{ marginTop:20,background:'linear-gradient(155deg,#141925 0%,#10141D 100%)',border:`1px solid rgba(${theme.rgbStr},.22)`,borderRadius:20,overflow:'hidden',boxShadow:`0 0 60px rgba(${theme.rgbStr},.07),0 24px 48px rgba(0,0,0,.5)`,animation:'recReveal .45s cubic-bezier(.22,1,.36,1) both' }}>

      {/* Flavor chips */}
      {(rec.flavorProfile||[]).length>0 && (
        <div style={{ padding:'14px 20px 0',display:'flex',flexWrap:'wrap',gap:6 }}>
          {(rec.flavorProfile||[]).map(f=><span key={f} style={{ background:`rgba(${theme.rgbStr},.1)`,border:`1px solid rgba(${theme.rgbStr},.2)`,borderRadius:20,padding:'4px 13px',color:theme.primary,fontSize:12,fontFamily:`'${font}','Space Grotesk', sans-serif` }}>{f}</span>)}
        </div>
      )}

      {/* Name */}
      <div style={{ padding:'12px 20px 0' }}>
        <div style={{ color:`rgba(${theme.rgbStr},.5)`,fontSize:10,letterSpacing:'.28em',textTransform:'uppercase',marginBottom:6,fontFamily:`'${font}','Space Grotesk', sans-serif` }}>{retailer.name} · Your {noun}</div>
        <div style={{ color:'#E8EDF2',fontFamily:`'${font}','Space Grotesk', sans-serif`,fontSize:26,fontWeight:700,lineHeight:1.12,marginBottom:4 }}>{rec.recommendationName||rec.blendName}</div>
        {rec.tagline && <div style={{ color:theme.primary,fontFamily:`'${font}','Space Grotesk', sans-serif`,fontSize:14,fontStyle:'italic',opacity:.9 }}>{rec.tagline}</div>}
      </div>

      {/* Products */}
      {products.length>0 && (
        <div style={{ padding:'14px 20px 0' }}>
          {products.map((p,i)=>(
            <div key={i} style={{ padding:'10px 0',borderBottom:i<products.length-1?`1px solid rgba(${theme.rgbStr},.06)`:'none',display:'flex',alignItems:'flex-start',gap:10 }}>
              {i===0 && <span style={{ marginTop:5,width:6,height:6,borderRadius:'50%',background:theme.primary,flexShrink:0 }} />}
              <div style={{ flex:1 }}>
                <div style={{ color:'#DCE3EC',fontSize:15,fontFamily:`'${font}','Space Grotesk', sans-serif`,fontWeight:600 }}>{p.name}</div>
                {p.why && <div style={{ color:'#6B7588',fontSize:13,marginTop:3,fontFamily:`'${font}','Space Grotesk', sans-serif`,lineHeight:1.5 }}>{p.why}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {rec.whyItFitsYou && (
        <div style={{ margin:'14px 20px 0',background:`rgba(${theme.rgbStr},.05)`,border:`1px solid rgba(${theme.rgbStr},.12)`,borderRadius:12,padding:'12px 14px' }}>
          <div style={{ color:`rgba(${theme.rgbStr},.5)`,fontSize:9,letterSpacing:'.2em',textTransform:'uppercase',marginBottom:4,fontFamily:`'${font}','Space Grotesk', sans-serif` }}>Why this fits you</div>
          <div style={{ color:'#C4CDD9',fontSize:14,lineHeight:1.6,fontFamily:`'${font}','Space Grotesk', sans-serif` }}>{rec.whyItFitsYou}</div>
        </div>
      )}

      {/* CTAs — primary claims the guide, secondary tries another */}
      <div style={{ padding:'18px 20px 20px',display:'flex',flexDirection:'column',gap:10 }}>
        <button onClick={claim} style={{ width:'100%',padding:'16px 12px',borderRadius:14,background:theme.primary,border:'none',cursor:'pointer',color:theme.onPrimary,fontSize:14,fontWeight:700,letterSpacing:'.08em',fontFamily:`'${font}','Space Grotesk', sans-serif`,boxShadow:`0 8px 28px rgba(${theme.rgbStr},.35)` }}>
          ✦ Claim this guide — 14-day free trial
        </button>
        <button onClick={onTryAnother} style={{ padding:'12px',borderRadius:14,background:'transparent',border:`1px solid rgba(${theme.rgbStr},.28)`,cursor:'pointer',color:theme.primary,fontSize:12,fontWeight:600,letterSpacing:'.06em',fontFamily:`'${font}','Space Grotesk', sans-serif` }}>
          {ctas.secondary}
        </button>
        {retailer.source_url && (
          <a href={retailer.source_url} target="_blank" rel="noopener noreferrer"
            style={{ textAlign:'center',color:'#6B7588',fontSize:12,textDecoration:'none',fontFamily:`'${font}','Space Grotesk', sans-serif`,paddingTop:2 }}>
            Visit {retailer.name} ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DemoPage({ params }: { params: { draftId: string } }) {
  const router = useRouter()
  const { draftId } = params

  const [retailer, setRetailer] = useState<Retailer | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [rec, setRec] = useState<BlendRecommendation | null>(null)
  const [started, setStarted] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const [ctas, setCtas] = useState({ primary: 'Order this', secondary: 'Show me another' })
  const [showBanner, setShowBanner] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const theme = useTheme(retailer)
  const font = useFont(retailer)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/demo/bootstrap/${draftId}`, { cache: 'no-store' })
        if (res.status === 410) { router.replace('/signup?expired=1'); return }
        if (!res.ok) { setNotFound(true); setLoading(false); return }
        const data = await res.json()
        setRetailer(data.retailer)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    void init()
  }, [draftId, router])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, rec])

  const streamChat = async (msgs: Message[]) => {
    if (!retailer) return
    setStreaming(true); setChips([])
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    let full = ''
    try {
      const res = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, messages: msgs }),
      })
      if (!res.ok) {
        const msg = res.status === 410 ? 'This demo has expired.' : res.status === 429 ? 'One moment — please wait.' : 'Something went wrong.'
        setMessages(prev => { const u=[...prev]; u[u.length-1]={ role:'assistant',content:msg }; return u })
        setStreaming(false); return
      }
      const reader = res.body?.getReader()
      if (!reader) { setStreaming(false); return }
      const dec = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of dec.decode(value,{stream:true}).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const p = JSON.parse(line.slice(6))
            if (p.delta) { full+=p.delta; setMessages(prev=>{ const u=[...prev]; u[u.length-1]={ role:'assistant',content:stripRec(full),streaming:true }; return u }) }
            if (p.done) {
              if (p.recData) setRec(p.recData)
              if (Array.isArray(p.chips)) setChips(p.chips.filter((c:unknown)=>typeof c==='string').slice(0,4))
              if (p.ctas) setCtas(p.ctas)
              setMessages(prev=>{ const u=[...prev]; u[u.length-1]={ role:'assistant',content:stripRec(p.text||full),streaming:false }; return u })
              setShowBanner(true) // show claim banner after first AI response
            }
          } catch {}
        }
      }
    } catch {}
    setStreaming(false)
  }

  const start = () => { setStarted(true); void streamChat([{ role:'user',content:'START' }]) }
  const send = (override?: string) => {
    const text = override ?? input
    if (!text.trim()||streaming) return
    setChips([]); const msg: Message={ role:'user',content:text.trim() }
    const next=[...messages,msg]; setMessages(next); setInput('')
    void streamChat(next.map(m=>({ role:m.role,content:m.content })))
  }
  const tryAnother = () => {
    if (streaming) return; setRec(null); setChips([])
    const next: Message[] = [...messages,{ role:'user',content:"Show me a different option — what else fits, based on what I told you?" }]
    setMessages(next); void streamChat(next.map(m=>({ role:m.role,content:m.content })))
  }

  if (loading) return <LoadingScreen />
  if (notFound || !retailer) return (
    <div style={{ minHeight:'100vh',background:'#0A0E15',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10 }}>
      <div style={{ color:'#3FC6D4',fontSize:32 }}>✦</div>
      <div style={{ color:'#C4CDD9',fontFamily:"'Space Grotesk', sans-serif",fontSize:18 }}>Demo not found</div>
      <a href="/signup" style={{ color:'#3FC6D4',fontFamily:"'Space Grotesk', sans-serif",fontSize:14,marginTop:8 }}>Start a new signup →</a>
    </div>
  )

  const noun = VERTICAL_NOUN[retailer.vertical] || 'Selection'

  if (!started) return <WelcomeScreen retailer={retailer} onStart={start} theme={theme} font={font} draftId={draftId} />

  return (
    <div style={{ minHeight:'100vh',background:'#0A0E15',display:'flex',flexDirection:'column',fontFamily:`'${font}','Space Grotesk', sans-serif`,paddingTop: showBanner ? 52 : 0 }}>
      <ClaimBanner draftId={draftId} theme={theme} font={font} visible={showBanner} />

      <div style={{ flex:1,overflowY:'auto',padding:'20px 20px 0',maxWidth:520,margin:'0 auto',width:'100%' }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ marginBottom:16,display:'flex',flexDirection:'column',alignItems:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='user' ? (
              <div style={{ background:`rgba(${theme.rgbStr},.12)`,border:`1px solid rgba(${theme.rgbStr},.2)`,borderRadius:'18px 18px 4px 18px',padding:'12px 16px',maxWidth:'82%',color:'#E8EDF2',fontSize:15,lineHeight:1.55 }}>{m.content}</div>
            ) : (
              <div style={{ maxWidth:'92%' }}>
                {m.streaming ? (
                  <div style={{ color:'#C4CDD9',fontSize:15,lineHeight:1.7,whiteSpace:'pre-wrap' }}>{m.content}<span style={{ display:'inline-block',width:7,height:14,background:theme.primary,marginLeft:3,borderRadius:2,opacity:.7,animation:'blink .9s step-start infinite' }} /></div>
                ) : (
                  <div style={{ color:'#C4CDD9',fontSize:15,lineHeight:1.7,whiteSpace:'pre-wrap' }}>{m.content}</div>
                )}
              </div>
            )}
          </div>
        ))}

        {rec && !streaming && (
          <DemoRecommendationCard rec={rec} retailer={retailer} ctas={ctas} onTryAnother={tryAnother} theme={theme} font={font} draftId={draftId} />
        )}

        <div ref={bottomRef} style={{ height:8 }} />
      </div>

      {/* Input */}
      {!rec && (
        <div style={{ padding:'12px 20px 20px',maxWidth:520,margin:'0 auto',width:'100%',boxSizing:'border-box' }}>
          {chips.length>0 && <QuickChips chips={chips} onSelect={c=>send(c)} theme={theme} font={font} />}
          <div style={{ display:'flex',gap:8,alignItems:'flex-end',marginTop:chips.length>0?8:0 }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send() }}} placeholder="Type your answer…" rows={1} disabled={streaming}
              style={{ flex:1,background:'rgba(255,255,255,.04)',border:`1px solid rgba(${theme.rgbStr},.14)`,borderRadius:12,padding:'12px 15px',color:'#E8EDF2',fontSize:15,fontFamily:`'${font}','Space Grotesk', sans-serif`,resize:'none',outline:'none',lineHeight:1.5 }} />
            <button onClick={()=>send()} disabled={!input.trim()||streaming}
              style={{ background:input.trim()&&!streaming?theme.primary:'rgba(255,255,255,.04)',border:`1px solid rgba(${theme.rgbStr},.16)`,borderRadius:10,width:44,height:44,display:'flex',alignItems:'center',justifyContent:'center',color:input.trim()&&!streaming?theme.onPrimary:'#1E2531',cursor:input.trim()&&!streaming?'pointer':'default',fontSize:16,flexShrink:0 }}>
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink{0%,100%{opacity:0}50%{opacity:1}}
        @keyframes recReveal{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ldot{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  )
}
