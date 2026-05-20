'use client'
import { useState, useEffect, useRef } from 'react'

// Loading messages cycle while the vendor builder agent works
const LOADING_STAGES = [
  { pct: 5,  msg: 'Visiting the website…' },
  { pct: 18, msg: 'Crawling menu pages…' },
  { pct: 32, msg: 'Reading the story and vibe…' },
  { pct: 48, msg: 'Extracting brand colors and identity…' },
  { pct: 62, msg: 'Scanning for take-home items…' },
  { pct: 74, msg: 'Writing custom personality…' },
  { pct: 85, msg: 'Calibrating tone and voice…' },
  { pct: 93, msg: 'Almost there — finalizing your agent…' },
  { pct: 97, msg: 'Building draft…' },
]

function AgentLoadingScreen({ url }: { url: string }) {
  const [stageIdx, setStageIdx] = useState(0)
  const [displayPct, setDisplayPct] = useState(0)
  const targetPct = LOADING_STAGES[stageIdx]?.pct ?? 97

  // Advance stages every ~4s
  useEffect(() => {
    if (stageIdx >= LOADING_STAGES.length - 1) return
    const t = setTimeout(() => setStageIdx(i => Math.min(i + 1, LOADING_STAGES.length - 1)), 4200)
    return () => clearTimeout(t)
  }, [stageIdx])

  // Smoothly animate progress bar toward target
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayPct(prev => {
        if (prev >= targetPct) return prev
        return Math.min(prev + 0.5, targetPct)
      })
    }, 80)
    return () => clearInterval(interval)
  }, [targetPct])

  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '32px 28px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 28 }}>✦</div>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 2 }}>AI Agent Active</div>
          <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif' }}>Your Personal Agent is Learning</div>
        </div>
      </div>

      <div style={{ color: '#8a7a5a', fontSize: 13, fontFamily: 'Georgia, serif', marginBottom: 20 }}>
        Reading <span style={{ color: '#C9A84C' }}>{hostname}</span> to build a fully custom experience…
      </div>

      {/* Progress bar */}
      <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 8, height: 6, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          borderRadius: 8,
          background: 'linear-gradient(90deg,#C9A84C,#a07830)',
          width: `${displayPct}%`,
          transition: 'width .2s ease',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ color: '#6a5a2a', fontSize: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
          {LOADING_STAGES[stageIdx]?.msg}
        </div>
        <div style={{ color: '#4a3a1a', fontSize: 11 }}>{Math.round(displayPct)}%</div>
      </div>

      {/* Spinning indicator */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#C9A84C',
            animation: `agentPulse 1.6s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes agentPulse {
          0%,100% { opacity:.2; transform:scale(.7) }
          50% { opacity:1; transform:scale(1) }
        }
      `}</style>
    </div>
  )
}

function PersonalityPreview({
  draft,
  onContinue,
  onReject,
}: {
  draft: any
  onContinue: () => void
  onReject: () => void
}) {
  const vb = draft?.intelligence_json?.vendorBuilder || {}
  const confidence: number = vb.scan_confidence ?? 0.5
  const preview: string = vb.personality_preview || ''
  const hasPreview = preview.length > 10

  const confidenceLabel = confidence >= 0.85
    ? { text: 'High confidence', color: '#5ecf8a' }
    : confidence >= 0.6
    ? { text: 'Good confidence', color: '#C9A84C' }
    : { text: 'Low confidence — consider manual review', color: '#e07070' }

  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 14, padding: '28px 24px', marginBottom: 20 }}>
      <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 4 }}>Agent Ready</div>
      <div style={{ color: '#F5ECD7', fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 20 }}>Your agent sounds like…</div>

      {hasPreview && (
        <div style={{ background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ color: '#F5ECD7', fontSize: 16, lineHeight: 1.7, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
            &ldquo;{preview}&rdquo;
          </div>
        </div>
      )}

      {/* Detected brand data summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {vb.brand_font_family && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Font</div>
            <div style={{ color: '#C9A84C', fontSize: 13, fontFamily: 'Georgia, serif' }}>{vb.brand_font_family}</div>
          </div>
        )}
        {vb.brand_secondary_color && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Palette</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[draft.brand_color, vb.brand_secondary_color, vb.brand_accent_color].filter(Boolean).map((c: string, i: number) => (
                <span key={i} style={{ width: 16, height: 16, borderRadius: 4, background: c, display: 'inline-block', border: '1px solid rgba(255,255,255,.15)' }} title={c} />
              ))}
            </div>
          </div>
        )}
        {vb.has_take_home && (
          <div style={{ padding: '10px 12px', background: 'rgba(94,207,138,.04)', borderRadius: 8, border: '1px solid rgba(94,207,138,.12)' }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Take-Home</div>
            <div style={{ color: '#5ecf8a', fontSize: 13 }}>✓ {(vb.take_home_items || []).length} items detected</div>
          </div>
        )}
        {(vb.featured_items || []).length > 0 && (
          <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)' }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 4 }}>Featured</div>
            <div style={{ color: '#C9A84C', fontSize: 13 }}>{(vb.featured_items || []).length} highlighted items</div>
          </div>
        )}
      </div>

      {/* Confidence score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 6, background: confidenceLabel.color, width: `${Math.round(confidence * 100)}%` }} />
        </div>
        <div style={{ color: confidenceLabel.color, fontSize: 11, whiteSpace: 'nowrap' }}>{confidenceLabel.text}</div>
      </div>

      {confidence < 0.6 && (
        <div style={{ background: 'rgba(224,112,112,.07)', border: '1px solid rgba(224,112,112,.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, color: '#e07070', fontSize: 13, fontFamily: 'Georgia, serif' }}>
          The site had limited content — some details may need manual review after publishing.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
        <button
          onClick={onContinue}
          style={{ padding: '13px 24px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg,#C9A84C,#a07830)', color: '#060403', fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: '.08em' }}
        >
          Looks Good → Review Draft
        </button>
        <button
          onClick={onReject}
          style={{ padding: '13px 24px', border: '1px solid rgba(201,168,76,.2)', borderRadius: 10, background: 'transparent', color: '#6a5a3a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 13 }}
        >
          Try a Different URL
        </button>
      </div>
    </div>
  )
}

export default function OnboardPage() {
  const [url, setUrl] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<any>(null)
  const [showPersonality, setShowPersonality] = useState(false)
  const [published, setPublished] = useState<any>(null)
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState<any>(null)

  async function buildDraft() {
    if (!url.trim()) return
    setLoading(true); setError(''); setDraft(null); setShowPersonality(false)
    try {
      const res = await fetch('/api/onboarding/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setDraft(json.draft)
      setShowPersonality(true) // Show personality preview first
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function publish() {
    if (!draft?.id) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/onboarding/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, ownerEmail: ownerEmail || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setPublished(json)
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }

  async function sendInvite() {
    if (!published?.retailer?.id || !ownerEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/poursona-admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: published.retailer.id, email: ownerEmail, name: ownerName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setInvited(json)
    } catch (err: any) { setError(err.message) }
    setInviting(false)
  }

  function reset() {
    setDraft(null); setShowPersonality(false); setError(''); setUrl('')
    setOwnerEmail(''); setOwnerName(''); setInvited(null)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '14px 16px',
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(201,168,76,.25)',
    borderRadius: 10, color: '#F5ECD7',
    fontFamily: 'Georgia, serif', fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
    WebkitAppearance: 'none', appearance: 'none',
  }
  const labelStyle: React.CSSProperties = {
    color: '#C9A84C', fontSize: 11, letterSpacing: '.15em',
    textTransform: 'uppercase', display: 'block', marginBottom: 8,
  }
  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg,#0e0b06,#0a0805)',
    border: '1px solid rgba(201,168,76,.15)',
    borderRadius: 14, padding: '24px 20px', marginBottom: 20,
  }
  const btnStyle: React.CSSProperties = {
    padding: '14px 24px', border: 'none', borderRadius: 10,
    background: 'linear-gradient(135deg,#C9A84C,#a07830)',
    color: '#060403', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: '.08em',
  }

  // Published screen
  if (published) return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Published!</div>
      </div>
      <div style={{ maxWidth: 540 }}>
        <div style={{ ...cardStyle, border: '1px solid rgba(94,207,138,.25)' }}>
          <div style={{ color: '#5ecf8a', fontSize: 12, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 8 }}>Live</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{published.retailer?.name}</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 24 }}>/r/{published.retailer?.slug}</div>
          <a href={'/r/' + published.retailer?.slug} target="_blank" style={{ display: 'inline-block', padding: '10px 18px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 13, marginBottom: 20 }}>
            Preview Experience ↗
          </a>
          {ownerEmail && !invited && (
            <div style={{ borderTop: '1px solid rgba(201,168,76,.1)', paddingTop: 20 }}>
              <div style={{ color: '#F5ECD7', fontSize: 14, marginBottom: 14 }}>Send admin access to <strong style={{ color: '#C9A84C' }}>{ownerEmail}</strong>?</div>
              {error && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button onClick={sendInvite} disabled={inviting} style={{ ...btnStyle, opacity: inviting ? .5 : 1 }}>{inviting ? 'Sending…' : 'Send Invite'}</button>
            </div>
          )}
          {invited && <div style={{ color: '#5ecf8a', fontSize: 14, marginTop: 16 }}>✓ Invite sent to {ownerEmail}</div>}
        </div>
        <button onClick={reset} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>
          Onboard Another
        </button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Onboard New Retailer</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>AI reads the site, extracts branding, builds a custom guest personality.</div>
      </div>

      <div style={{ maxWidth: 640 }}>

        {/* Step 1 — URL input */}
        {!loading && !draft && (
          <div style={cardStyle}>
            <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 1 — Website</div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Business Website URL *</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void buildDraft() }}
                placeholder="https://theirbrewery.com"
                style={inputStyle}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Owner Email</label>
                <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@place.com" style={inputStyle} autoCapitalize="none" />
              </div>
              <div>
                <label style={labelStyle}>Owner Name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
              </div>
            </div>

            {error && (
              <div style={{ color: '#e07070', fontSize: 13, marginBottom: 14, padding: '10px 12px', background: 'rgba(255,100,100,.08)', borderRadius: 8 }}>{error}</div>
            )}

            <button onClick={buildDraft} disabled={!url.trim()} style={{ ...btnStyle, opacity: !url.trim() ? .5 : 1, cursor: !url.trim() ? 'default' : 'pointer' }}>
              Build Draft →
            </button>
          </div>
        )}

        {/* Loading — agent at work */}
        {loading && <AgentLoadingScreen url={url} />}

        {/* Personality preview — shown immediately after scan */}
        {!loading && draft && showPersonality && (
          <PersonalityPreview
            draft={draft}
            onContinue={() => setShowPersonality(false)}
            onReject={reset}
          />
        )}

        {/* Step 2 — Review & Publish */}
        {!loading && draft && !showPersonality && (
          <div style={cardStyle}>
            <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 2 — Review & Publish</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Detected</div>
                {([
                  ['Name', draft.name],
                  ['Slug', '/r/' + draft.slug],
                  ['Vertical', draft.vertical],
                  ['Location', draft.location],
                  ['Color', draft.brand_color],
                ] as [string, string][]).map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(201,168,76,.07)' }}>
                    <span style={{ color: '#4a3a1a', fontSize: 12 }}>{k}</span>
                    <span style={{ color: '#C9A84C', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {k === 'Color' && <span style={{ width: 14, height: 14, borderRadius: 3, background: v, display: 'inline-block', border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />}
                      {v}
                    </span>
                  </div>
                ) : null)}

                {/* Agent summary row */}
                {draft.intelligence_json?.vendorBuilder?.personality_preview && (
                  <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(201,168,76,.05)', borderRadius: 8 }}>
                    <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>Agent Voice</div>
                    <div style={{ color: '#8a7a5a', fontSize: 12, fontStyle: 'italic', fontFamily: 'Georgia, serif', lineHeight: 1.5 }}>
                      {draft.intelligence_json.vendorBuilder.personality_preview}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Menu ({(draft.menu_json || []).length})</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(draft.menu_json || []).slice(0, 20).map((p: any, i: number) => (
                    <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                      <div style={{ color: '#F5ECD7', fontSize: 12 }}>{p.name}</div>
                      <div style={{ color: '#4a3a1a', fontSize: 10 }}>{[p.category, p.price != null ? '$' + p.price : null].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {error && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button onClick={publish} disabled={loading} style={{ ...btnStyle, opacity: loading ? .5 : 1 }}>{loading ? 'Publishing…' : 'Publish Retailer'}</button>
              <button onClick={reset} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>Try New URL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
