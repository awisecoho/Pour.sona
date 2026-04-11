'use client'
import { useState } from 'react'
export default function OnboardPage() {
  const [url, setUrl] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<any>(null)
  const [inviting, setInviting] = useState(false)
  const [invited, setInvited] = useState<any>(null)
  const [published, setPublished] = useState<any>(null)
  async function buildDraft(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setDraft(null)
    try {
      const res = await fetch('/api/onboarding/url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setDraft(json.draft)
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }
  async function publish() {
    if (!draft?.id) return; setLoading(true); setError('')
    try {
      const res = await fetch('/api/onboarding/finalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftId: draft.id, ownerEmail: ownerEmail || undefined }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setPublished(json)
    } catch (err: any) { setError(err.message) }
    setLoading(false)
  }
  async function sendInvite() {
    if (!published?.retailer?.id || !ownerEmail) return; setInviting(true)
    try {
      const res = await fetch('/api/poursona-admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: published.retailer.id, email: ownerEmail, name: ownerName }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      setInvited(json)
    } catch (err: any) { setError(err.message) }
    setInviting(false)
  }
  const inp = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }
  const btn = { padding: '12px 20px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg,#C9A84C,#a07830)', color: '#060403', fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, letterSpacing: '.1em' }
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Onboard New Retailer</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>Paste the establishment website. AI builds their catalog and branding automatically.</div>
      </div>
      {!published ? (
        <div style={{ maxWidth: 700 }}>
          <form onSubmit={buildDraft}>
            <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 14, padding: '28px 24px', marginBottom: 20 }}>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Step 1 — Website Ingestion</div>
              <div style={{ marginBottom: 14 }}><label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Business Website URL *</label><input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://theirbrewery.com" style={inp} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div><label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Owner Email</label><input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="owner@theirbrewery.com" style={inp} /></div>
                <div><label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>Owner Name</label><input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Jane Smith" style={inp} /></div>
              </div>
              {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 14 }}>{error}</div>}
              <button type="submit" disabled={!url || loading} style={{ ...btn, opacity: !url || loading ? .5 : 1 }}>{loading ? 'Reading website…' : 'Build Draft →'}</button>
            </div>
          </form>
          {draft && (
            <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '28px 24px' }}>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Step 2 — Review & Publish</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <div>
                  <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Detected Info</div>
                  {[['Name', draft.name], ['Slug', '/r/' + draft.slug], ['Vertical', draft.vertical], ['Location', draft.location], ['Tagline', draft.tagline], ['Color', draft.brand_color]].map(([k, v]) => v ? (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                      <span style={{ color: '#4a3a1a', fontSize: 12 }}>{k}</span>
                      <span style={{ color: '#C9A84C', fontSize: 12 }}>{v}</span>
                    </div>
                  ) : null)}
                </div>
                <div>
                  <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 10 }}>Menu ({(draft.menu_json || []).length} items)</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {(draft.menu_json || []).slice(0, 15).map((p: any, i: number) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                        <div style={{ color: '#F5ECD7', fontSize: 12 }}>{p.name}</div>
                        <div style={{ color: '#4a3a1a', fontSize: 10 }}>{[p.category, p.price != null ? '$' + p.price : null].filter(Boolean).join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 14 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={publish} disabled={loading} style={{ ...btn, opacity: loading ? .5 : 1 }}>{loading ? 'Publishing…' : '✦ Publish Retailer'}</button>
                <button onClick={() => setDraft(null)} style={{ padding: '12px 18px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#6a5a3a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12 }}>← New URL</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(94,207,138,.25)', borderRadius: 14, padding: '32px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>✦</div>
            <div style={{ color: '#5ecf8a', fontSize: 13, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>Published</div>
            <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{published.retailer?.name}</div>
            <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 24 }}>/r/{published.retailer?.slug}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 24 }}>
              <a href={published.links?.storefront} target="_blank" style={{ padding: '9px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 7, color: '#C9A84C', textDecoration: 'none', fontSize: 12 }}>Preview Experience</a>
              <a href={published.links?.qr} download style={{ padding: '9px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 7, color: '#C9A84C', textDecoration: 'none', fontSize: 12 }}>Download QR</a>
            </div>
            {ownerEmail && !invited && (
              <div style={{ borderTop: '1px solid rgba(201,168,76,.1)', paddingTop: 20 }}>
                <div style={{ color: '#F5ECD7', fontSize: 13, marginBottom: 12 }}>Send admin access to <strong style={{ color: '#C9A84C' }}>{ownerEmail}</strong>?</div>
                {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 10 }}>{error}</div>}
                <button onClick={sendInvite} disabled={inviting} style={{ ...btn, opacity: inviting ? .5 : 1 }}>{inviting ? 'Sending…' : '📧 Send Magic Link Invite'}</button>
              </div>
            )}
            {invited && (
              <div style={{ borderTop: '1px solid rgba(201,168,76,.1)', paddingTop: 20 }}>
                <div style={{ color: '#5ecf8a', fontSize: 13 }}>✓ Invite sent to {ownerEmail}</div>
                {invited.magicLink && <div style={{ marginTop: 8 }}><div style={{ color: '#4a3a1a', fontSize: 10, marginBottom: 4 }}>OR COPY LINK DIRECTLY:</div><input readOnly value={invited.magicLink} style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 6, color: '#C9A84C', fontSize: 11, outline: 'none', boxSizing: 'border-box' as const }} onClick={e => (e.target as HTMLInputElement).select()} /></div>}
              </div>
            )}
          </div>
          <a href="/poursona-admin" style={{ color: '#6a5a3a', fontSize: 13, textDecoration: 'none' }}>← Back to all retailers</a>
        </div>
      )}
    </div>
  )
}