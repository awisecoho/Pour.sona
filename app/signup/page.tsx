'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Retailer, Product } from '@/lib/types'

type Step = 'url' | 'extracting' | 'preview' | 'finalizing' | 'done'

interface RetailerDraft {
  id: string
  name: string
  slug: string
  vertical?: string
  location?: string
  tagline?: string
  menu_json?: Product[]
}

const EXTRACTING_MESSAGES = [
  'Fetching your menu…',
  'Reading your products…',
  'Analyzing tasting notes…',
  'Building your catalog…',
  'Almost there…',
]

const VERTICAL_LABEL: Record<string, string> = {
  brewery: '🍺 Brewery',
  winery: '🍷 Winery',
  distillery: '🥃 Distillery',
  coffee: '☕ Coffee',
}

export default function SignupPage() {
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [draft, setDraft] = useState<RetailerDraft | null>(null)
  const [retailer, setRetailer] = useState<Pick<Retailer, 'name' | 'owner_email'> | null>(null)
  const [error, setError] = useState('')
  const [extractMsg, setExtractMsg] = useState(EXTRACTING_MESSAGES[0])

  useEffect(() => {
    if (step !== 'extracting') return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % EXTRACTING_MESSAGES.length
      setExtractMsg(EXTRACTING_MESSAGES[i])
    }, 2800)
    return () => clearInterval(interval)
  }, [step])

  async function analyze() {
    if (!url.trim()) return
    setError('')
    setStep('extracting')
    try {
      const res = await fetch('/api/signup/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Analysis failed')
      setDraft(json.draft)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
      setStep('url')
    }
  }

  async function finalize() {
    if (!email.trim() || !draft?.id) return
    setError('')
    setStep('finalizing')
    try {
      const res = await fetch('/api/signup/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, email: email.trim(), name: name.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Account creation failed')
      setRetailer(json.retailer)
      setStep('done')
    } catch (err: any) {
      setError(err.message)
      setStep('preview')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px 16px',
    background: 'rgba(255,255,255,.06)', border: '1px solid rgba(201,168,76,.25)',
    borderRadius: 10, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
  }
  const btn: React.CSSProperties = {
    width: '100%', padding: '16px',
    background: 'linear-gradient(135deg,#C9A84C,#a07830)',
    border: 'none', borderRadius: 10, color: '#060403',
    fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', letterSpacing: '.05em',
  }

  const products: Product[] = Array.isArray(draft?.menu_json) ? draft.menu_json : []
  const stepNum = step === 'url' || step === 'extracting' ? 1 : step === 'preview' || step === 'finalizing' ? 2 : 3

  return (
    <div style={{ minHeight: '100vh', background: '#060403', fontFamily: 'Georgia, serif', color: '#F5ECD7', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
        <Link href="/" style={{ color: '#C9A84C', fontSize: 18, fontWeight: 700, letterSpacing: '.05em', textDecoration: 'none' }}>✦ Poursona</Link>
        <Link href="/admin/login" style={{ color: '#4a3a1a', fontSize: 13, textDecoration: 'none' }}>Already have an account →</Link>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: 560 }}>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, justifyContent: 'center' }}>
            {[['1', 'Your website'], ['2', 'Your details'], ['3', 'You\'re in']].map(([n, label], i) => {
              const num = i + 1
              const active = stepNum === num
              const done = stepNum > num
              return (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: done ? '#C9A84C' : active ? 'rgba(201,168,76,.2)' : 'rgba(255,255,255,.05)', color: done ? '#060403' : active ? '#C9A84C' : '#3a2a0a', border: active ? '1px solid rgba(201,168,76,.5)' : '1px solid transparent' }}>
                      {done ? '✓' : n}
                    </div>
                    <span style={{ fontSize: 12, color: active ? '#C9A84C' : done ? '#6a5a3a' : '#3a2a0a' }}>{label}</span>
                  </div>
                  {i < 2 && <div style={{ width: 32, height: 1, background: 'rgba(201,168,76,.15)' }} />}
                </div>
              )
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10, padding: '14px 16px', color: '#e07070', fontSize: 14, marginBottom: 24 }}>
              {error}
            </div>
          )}

          {/* Step 1 — URL */}
          {(step === 'url' || step === 'extracting') && (
            <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 18, padding: '40px 36px' }}>
              <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>Step 1 of 3</div>
              <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
                {step === 'extracting' ? 'Reading your menu…' : 'Add your venue website'}
              </h1>
              <p style={{ color: '#4a3a1a', fontSize: 14, lineHeight: 1.7, margin: '0 0 28px' }}>
                {step === 'extracting'
                  ? extractMsg
                  : 'Paste your website URL and we\'ll extract your menu, branding, and story automatically.'}
              </p>

              {step === 'extracting' ? (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '20px 0' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A84C', opacity: 0.4 + i * 0.3, animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              ) : (
                <>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && analyze()}
                    placeholder="https://yourvenue.com"
                    type="url"
                    style={{ ...inp, marginBottom: 16 }}
                    autoFocus
                  />
                  <button onClick={analyze} style={btn}>
                    Analyze My Menu →
                  </button>
                  <div style={{ textAlign: 'center', color: '#3a2a0a', fontSize: 12, marginTop: 16 }}>
                    Works best with public menus and tap lists
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 2 — Preview + details */}
          {(step === 'preview' || step === 'finalizing') && draft && (
            <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 18, padding: '40px 36px' }}>
              <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>Step 2 of 3</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 6px' }}>Does this look right?</h2>

              {/* Extracted summary */}
              <div style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 12, padding: '20px', margin: '20px 0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700 }}>{draft.name}</div>
                    {draft.location && <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 2 }}>{draft.location}</div>}
                  </div>
                  {draft.vertical && (
                    <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontSize: 11 }}>
                      {VERTICAL_LABEL[draft.vertical] || draft.vertical}
                    </span>
                  )}
                </div>
                {draft.tagline && (
                  <div style={{ color: '#6a5a3a', fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>&ldquo;{draft.tagline}&rdquo;</div>
                )}
                <div style={{ color: '#4a3a1a', fontSize: 12, marginBottom: 8 }}>
                  {products.length} product{products.length !== 1 ? 's' : ''} extracted
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {products.slice(0, 6).map((p: any, i: number) => (
                    <span key={i} style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.1)', color: '#c8bfa8', fontSize: 11 }}>
                      {p.name}
                    </span>
                  ))}
                  {products.length > 6 && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, color: '#4a3a1a', fontSize: 11 }}>
                      +{products.length - 6} more
                    </span>
                  )}
                </div>
              </div>

              <div style={{ color: '#4a3a1a', fontSize: 12, marginBottom: 4 }}>Not quite right? <button onClick={() => { setStep('url'); setDraft(null) }} style={{ background: 'none', border: 'none', color: '#C9A84C', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'Georgia, serif' }}>Re-enter your URL</button></div>

              {/* Email + name */}
              <div style={{ marginTop: 24 }}>
                <label style={{ display: 'block', color: '#C9A84C', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Your Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourvenue.com" type="email" style={{ ...inp, marginBottom: 12 }} />
                <label style={{ display: 'block', color: '#C9A84C', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Your Name <span style={{ color: '#3a2a0a', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Alex" type="text" style={{ ...inp, marginBottom: 20 }} />

                <button onClick={finalize} disabled={!email.trim() || step === 'finalizing'} style={{ ...btn, opacity: (!email.trim() || step === 'finalizing') ? 0.6 : 1, cursor: (!email.trim() || step === 'finalizing') ? 'not-allowed' : 'pointer' }}>
                  {step === 'finalizing' ? 'Creating your account…' : 'Create My Guide — Free Trial →'}
                </button>
                <div style={{ textAlign: 'center', color: '#3a2a0a', fontSize: 12, marginTop: 14 }}>
                  14-day free trial · then $79/mo · No credit card required ·{' '}
                  <a href="/pricing" target="_blank" style={{ color: '#4a3a1a', textDecoration: 'underline' }}>See what&apos;s included</a>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Done */}
          {step === 'done' && retailer && (
            <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(94,207,138,.2)', borderRadius: 18, padding: '48px 36px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
              <div style={{ color: '#5ecf8a', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>You&rsquo;re in</div>
              <h2 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 12px' }}>{retailer.name} is live</h2>
              <p style={{ color: '#4a3a1a', fontSize: 14, lineHeight: 1.7, margin: '0 0 32px' }}>
                We sent a login link to <strong style={{ color: '#C9A84C' }}>{retailer.owner_email}</strong>. Click it to access your dashboard, grab your QR code, and start guiding guests.
              </p>
              <Link href="/admin/login" style={{ display: 'inline-block', padding: '16px 36px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                Go to Dashboard →
              </Link>
              <div style={{ marginTop: 16, color: '#3a2a0a', fontSize: 12 }}>
                Sign in with <strong style={{ color: '#4a3a1a' }}>{retailer.owner_email}</strong>
              </div>
            </div>
          )}

        </div>
      </div>

      <footer style={{ borderTop: '1px solid rgba(201,168,76,.08)', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ color: '#3a2a0a', fontSize: 12 }}>© 2026 Poursona · <a href="mailto:hello@pour-sona.com" style={{ color: '#3a2a0a', textDecoration: 'none' }}>Contact</a></div>
      </footer>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:.3; transform: scale(.9) } 50% { opacity:1; transform: scale(1.1) } }
      `}</style>
    </div>
  )
}
