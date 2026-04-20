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
    if (!url) return
    setLoading(true); setError(''); setDraft(null)
    try {
      const res = await fetch('/api/onboarding/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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

  const s = {
    label: { color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 7 },
    inp: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
    btn: { padding: '13px 22px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#C9A84C,#a07830)', color: '#060403', fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: '.1em' },
    card: { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '28px 24px', marginBottom: 20 },
  }

  if (published) return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Retailer Published</div>
      </div>
      <div style={{ maxWidth: 540 }}>
        <div style={{ ...s.card, border: '1px solid rgba(94,207,138,.25)' }}>
          <div style={{ color: '#5ecf8a', fontSize: 13, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 8 }}>Published</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{published.retailer?.name}</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 24 }}>/r/{published.retailer?.slug}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 24 }}>
            <a href={'/r/' + published.retailer?.slug} target="_blank" style={{ padding: '9px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 7, color: '#C9A84C', textDecoration: 'none', fontSize: 12 }}>Preview Experience</a>
          </div>
          {ownerEmail && !invited && (
            <div style={{ borderTop: '1px solid rgba(201,168,76,.1)', paddingTop: 20 }}>
              <div style={{ color: '#F5ECD7', fontSize: 13, marginBottom: 12 }}>Send admin access to <strong style={{ color: '#C9A84C' }}>{ownerEmail}</strong>?</div>
              {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 10 }}>{error}</div>}
              <button onClick={sendInvite} disabled={inviting} style={{ ...s.btn, opacity: inviting ? .5 : 1 }}>{inviting ? 'Sending…' : 'Send Invite'}</button>
            </div>
          )}
          {invited && <div style={{ color: '#5ecf8a', fontSize: 13, marginTop: 16 }}>Invite sent to {ownerEmail}</div>}
        </div>
        <button onClick={() => { setPublished(null); setDraft(null); setUrl(''); setOwnerEmail(''); setOwnerName(''); setInvited(null) }} style={{ ...s.btn, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>Onboard Another</button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Onboard New Retailer</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>Paste the establishment website. AI builds their catalog and branding automatically.</div>
      </div>
      <div style={{ maxWidth: 680 }}>
        {/* Step 1 */}
        <div style={s.card}>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 1 — Website</div>
          <div style={{ marginBottom: 16 }}>
            <label style={s.label}>Business Website URL *</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onInput={e => setUrl((e.target as HTMLInputElement).value)}
              placeholder="https://theirbrewery.com"
              style={s.inp}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <div>
              <label style={s.label}>Owner Email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={e => setOwnerEmail(e.target.value)}
                placeholder="owner@theirbrewery.com"
                style={s.inp}
              />
            </div>
            <div>
              <label style={s.label}>Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Jane Smith"
                style={s.inp}
              />
            </div>
          </div>
          {error && !draft && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 14 }}>{error}</div>}
          <button
            onClick={buildDraft}
            disabled={!url || loading}
            style={{ ...s.btn, opacity: !url || loading ? .5 : 1 }}
          >
            {loading ? 'Reading site + extracting brand colors…' : 'Build Draft →'}
          </button>
        </div>

        {/* Step 2 — Draft review */}
        {draft && (
          <div style={s.card}>
            <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Step 2 — Review & Publish</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Detected Info</div>
                {([['Name', draft.name], ['Slug', '/r/' + draft.slug], ['Vertical', draft.vertical], ['Location', draft.location], ['Color', draft.brand_color]] as [string, string][]).map(([k, v]) => v ? (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(201,168,76,.07)' }}>
                    <span style={{ color: '#4a3a1a', fontSize: 12 }}>{k}</span>
                    <span style={{ color: '#C9A84C', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {k === 'Color' && <span style={{ width: 14, height: 14, borderRadius: 3, background: v, display: 'inline-block', border: '1px solid rgba(255,255,255,.2)' }} />}
                      {v}
                    </span>
                  </div>
                ) : null)}
                {draft.logo_url && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ color: '#4a3a1a', fontSize: 11, marginBottom: 6 }}>Logo</div>
                    <img src={draft.logo_url} alt="Logo" style={{ height: 40, objectFit: 'contain', background: '#111', padding: 4, borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Menu ({(draft.menu_json || []).length} items)</div>
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  {(draft.menu_json || []).slice(0, 20).map((p: any, i: number) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                      <div style={{ color: '#F5ECD7', fontSize: 12 }}>{p.name}</div>
                      <div style={{ color: '#4a3a1a', fontSize: 10 }}>{[p.category, p.price != null ? '$' + p.price : null].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                  {(draft.menu_json || []).length > 20 && <div style={{ color: '#4a3a1a', fontSize: 11, paddingTop: 6 }}>+{draft.menu_json.length - 20} more</div>}
                </div>
              </div>
            </div>
            {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 14 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={publish} disabled={loading} style={{ ...s.btn, opacity: loading ? .5 : 1 }}>{loading ? 'Publishing…' : 'Publish Retailer'}</button>
              <button onClick={() => { setDraft(null); setError('') }} style={{ ...s.btn, background: 'transparent', border: '1px solid rgba(201,168,76,.2)', color: '#6a5a3a' }}>Try New URL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
