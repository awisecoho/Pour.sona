'use client'
import { useState } from 'react'

export default function OnboardPage() {
  const [url, setUrl] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<any>(null)
  const [published, setPublished] = useState<any>(null)
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState<any>(null)

  async function buildDraft() {
    if (!url.trim()) return
    setLoading(true); setError(''); setDraft(null)
    try {
      const res = await fetch('/api/onboarding/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setDraft(json.draft)
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,.07)',
    border: '1px solid rgba(201,168,76,.25)',
    borderRadius: 10,
    color: '#F5ECD7',
    fontFamily: 'Georgia, serif',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
    WebkitAppearance: 'none',
    appearance: 'none',
  }

  const labelStyle: React.CSSProperties = {
    color: '#C9A84C',
    fontSize: 11,
    letterSpacing: '.15em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 8,
  }

  const cardStyle: React.CSSProperties = {
    background: 'linear-gradient(145deg,#0e0b06,#0a0805)',
    border: '1px solid rgba(201,168,76,.15)',
    borderRadius: 14,
    padding: '24px 20px',
    marginBottom: 20,
  }

  const btnStyle: React.CSSProperties = {
    padding: '14px 24px',
    border: 'none',
    borderRadius: 10,
    background: 'linear-gradient(135deg,#C9A84C,#a07830)',
    color: '#060403',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    fontSize: 13,
    letterSpacing: '.08em',
  }

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
        <button onClick={() => { setPublished(null); setDraft(null); setUrl(''); setOwnerEmail(''); setOwnerName(''); setInvited(null); setError('') }} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>
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
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>AI reads the site, extracts branding and menu automatically.</div>
      </div>

      <div style={{ maxWidth: 640 }}>
        <div style={cardStyle}>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 1 — Website</div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Business Website URL *</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
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
              <input
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                placeholder="owner@place.com"
                style={inputStyle}
                autoCapitalize="none"
              />
            </div>
            <div>
              <label style={labelStyle}>Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Jane Smith"
                style={inputStyle}
              />
            </div>
          </div>

          {error && !draft && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 14, padding: '10px 12px', background: 'rgba(255,100,100,.08)', borderRadius: 8 }}>{error}</div>}

          <button
            onClick={buildDraft}
            disabled={!url.trim() || loading}
            style={{ ...btnStyle, opacity: !url.trim() || loading ? .5 : 1, cursor: !url.trim() || loading ? 'default' : 'pointer' }}
          >
            {loading ? 'Reading site + extracting brand colors…' : 'Build Draft →'}
          </button>
        </div>

        {draft && (
          <div style={cardStyle}>
            <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 2 — Review & Publish</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Detected</div>
                {([['Name', draft.name], ['Slug', '/r/' + draft.slug], ['Vertical', draft.vertical], ['Location', draft.location], ['Color', draft.brand_color]] as [string, string][]).map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(201,168,76,.07)' }}>
                    <span style={{ color: '#4a3a1a', fontSize: 12 }}>{k}</span>
                    <span style={{ color: '#C9A84C', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {k === 'Color' && <span style={{ width: 14, height: 14, borderRadius: 3, background: v, display: 'inline-block', border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }} />}
                      {v}
                    </span>
                  </div>
                ) : null)}
              </div>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Menu ({(draft.menu_json || []).length})</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {(draft.menu_json || []).slice(0, 20).map((p: any, i: number) => (
                    <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                      <div style={{ color: '#F5ECD7', fontSize: 12 }}>{p.name}</div>
                      <div style={{ color: '#4a3a1a', fontSize: 10 }}>{[p.category, p.price != null ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {error && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button onClick={publish} disabled={loading} style={{ ...btnStyle, opacity: loading ? .5 : 1 }}>{loading ? 'Publishing…' : 'Publish Retailer'}</button>
              <button onClick={() => { setDraft(null); setError('') }} style={{ ...btnStyle, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>Try New URL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
