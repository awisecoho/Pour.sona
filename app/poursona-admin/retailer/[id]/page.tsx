'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { storefrontUrl } from '@/lib/urls'

export default function RetailerDetail() {
  const { id } = useParams<{ id: string }>()
  const [retailer, setRetailer] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [flights, setFlights] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [tab, setTab] = useState<'overview' | 'products' | 'billing' | 'rescan' | 'invite' | 'danger'>('overview')
  // Archive / delete (lifecycle)
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dangerMsg, setDangerMsg] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')
  const [rescanUrl, setRescanUrl] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rescanResult, setRescanResult] = useState<any>(null)
  const [rescanError, setRescanError] = useState('')
  const [loadError, setLoadError] = useState('')
  // Billing / trial
  const [extendDays, setExtendDays] = useState(30)
  const [extending, setExtending] = useState(false)
  const [billingMsg, setBillingMsg] = useState('')

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    try {
      setLoadError('')
      const res = await fetch('/api/poursona-admin/retailer/' + encodeURIComponent(id), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        setLoadError(json?.error || 'Load failed')
        setLoading(false)
        return
      }
      setRetailer(json.retailer || null)
      setProducts(json.products || [])
      setFlights(json.flights || [])
      setSessions(json.sessions || [])
      if (json.retailer?.website_url) setRescanUrl(json.retailer.website_url)
      setLoading(false)
    } catch {
      setLoadError('Could not load retailer.')
      setLoading(false)
    }
  }

  async function saveField(field: string, value: any) {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/poursona-admin/retailer/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await res.json()
      if (res.ok && json?.ok) setRetailer(json.retailer || null)
      else setSaveError(json?.error || 'Save failed — please try again.')
    } catch { setSaveError('Could not connect. Please try again.') }
    setSaving(false)
  }

  async function runRescan(mode: 'catalog' | 'branding' | 'full') {
    if (!rescanUrl.trim()) return
    setRescanning(true)
    setRescanResult(null)
    setRescanError('')
    try {
      const res = await fetch('/api/poursona-admin/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: id, url: rescanUrl.trim(), mode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Rescan failed')
      setRescanResult({ mode, ...json })
      setRetailer(json.retailer)
      if (mode === 'catalog' || mode === 'full') load()
    } catch (err: any) {
      setRescanError(err.message)
    }
    setRescanning(false)
  }

  async function sendInvite() {
    if (!inviteEmail) return
    setInviting(true)
    setInviteResult('')
    const res = await fetch('/api/poursona-admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retailerId: id, email: inviteEmail, name: '' }),
    })
    const json = await res.json()
    setInviteResult(
      !json.ok ? 'Error: ' + json.error :
      json.inviteEmailSent === false ? '⚠ Access granted but invite email failed to send — ask vendor to log in at /admin/login' :
      '✓ Invite sent to ' + inviteEmail
    )
    setInviting(false)
  }

  async function extendTrial() {
    if (!retailer) return
    setExtending(true)
    setBillingMsg('')
    try {
      const res = await fetch('/api/poursona-admin/extend-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: id, days: extendDays }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json.error || 'Failed')
      setRetailer((prev: any) => ({
        ...prev,
        subscription_status: json.retailer.subscription_status,
        trial_ends_at: json.retailer.trial_ends_at,
      }))
      setBillingMsg('Trial extended. New expiry: ' + new Date(json.retailer.trial_ends_at).toLocaleDateString())
    } catch (err: any) {
      setBillingMsg('Error: ' + err.message)
    }
    setExtending(false)
  }

  async function setStatus(status: string) {
    setBillingMsg('')
    await saveField('subscription_status', status)
    setBillingMsg('Status set to ' + status)
  }

  async function toggleArchive() {
    if (!retailer) return
    setArchiving(true)
    setDangerMsg('')
    const action = retailer.archived_at ? 'unarchive' : 'archive'
    try {
      const res = await fetch('/api/poursona-admin/retailer/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed')
      setRetailer((prev: any) => ({ ...prev, archived_at: json.archived ? new Date().toISOString() : null, active: !json.archived }))
      setDangerMsg(json.archived ? 'Venue archived — hidden from the list and disabled for guests.' : 'Venue restored.')
    } catch (err: any) {
      setDangerMsg('Error: ' + err.message)
    }
    setArchiving(false)
  }

  async function hardDelete() {
    if (!retailer) return
    setDeleting(true)
    setDangerMsg('')
    try {
      const res = await fetch('/api/poursona-admin/retailer/' + encodeURIComponent(id), { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed')
      // Row is gone — return to the list.
      window.location.href = '/poursona-admin'
    } catch (err: any) {
      setDangerMsg('Error: ' + err.message)
      setDeleting(false)
    }
  }

  function openVendorAdmin() {
    if (!retailer) return
    sessionStorage.setItem('active_retailer', JSON.stringify(retailer))
    localStorage.setItem('poursona_active_retailer', retailer.id)
    window.open('/admin', '_blank')
  }

  if (loading) return <div style={{ color: '#D67A31' }}>Loading...</div>
  if (loadError) return <div style={{ color: '#F5F2E8' }}>{loadError}</div>
  if (!retailer) return <div style={{ color: '#e07070' }}>Retailer not found.</div>

  const trialEnds = retailer.trial_ends_at ? new Date(retailer.trial_ends_at) : null
  const trialExpired = trialEnds && trialEnds < new Date()
  const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86400000) : null

  const s = {
    card: {
      background: 'linear-gradient(145deg,#1C1A2A,#161423)',
      border: '1px solid rgba(97,42,134,.15)',
      borderRadius: 14,
      padding: '20px',
      marginBottom: 16,
    } as React.CSSProperties,
    label: {
      color: '#D67A31',
      fontSize: 10,
      letterSpacing: '.15em',
      textTransform: 'uppercase' as const,
      display: 'block',
      marginBottom: 6,
    },
    inp: {
      width: '100%',
      padding: '11px 12px',
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(97,42,134,.2)',
      borderRadius: 8,
      color: '#F5F2E8',
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    tabBtn: (active: boolean) => ({
      padding: '9px 16px',
      borderRadius: '8px 8px 0 0',
      border: 'none',
      cursor: 'pointer',
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      fontSize: 12,
      fontWeight: 700,
      background: active ? 'rgba(97,42,134,.15)' : 'transparent',
      color: active ? '#D67A31' : '#3A3450',
      borderBottom: active ? '2px solid #D67A31' : '2px solid transparent',
    } as React.CSSProperties),
    rescanBtn: (color: string) => ({
      padding: '12px 18px',
      border: 'none',
      borderRadius: 8,
      background: color,
      color: '#12111A',
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      fontSize: 12,
      fontWeight: 700,
      cursor: rescanning ? 'wait' : 'pointer',
      opacity: rescanning ? .5 : 1,
      flex: 1,
    } as React.CSSProperties),
    btn: (v?: string) => ({
      padding: '11px 20px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontFamily: "var(--font-inter), system-ui, sans-serif",
      fontSize: 12,
      fontWeight: 700,
      background: v === 'danger' ? 'rgba(255,100,100,.15)' : v === 'green' ? 'rgba(94,207,138,.15)' : 'linear-gradient(135deg,#D67A31,#612A86)',
      color: v === 'danger' ? '#e07070' : v === 'green' ? '#5ecf8a' : '#12111A',
    } as React.CSSProperties),
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/poursona-admin" style={{ color: '#3A3450', fontSize: 12, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>← Back</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: retailer.brand_color || '#D67A31', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#F5F2E8', fontSize: 22, fontWeight: 700 }}>{retailer.name}</div>
            <div style={{ color: '#3A3450', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{retailer.vertical} · /r/{retailer.slug}</div>
          </div>
          {saving && <div style={{ color: '#D67A31', fontSize: 11 }}>Saving...</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <a href={'/r/' + retailer.slug} target="_blank" style={{ padding: '10px 16px', background: 'linear-gradient(135deg,#D67A31,#612A86)', borderRadius: 8, color: '#12111A', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>Preview</a>
        <button onClick={openVendorAdmin} style={{ padding: '10px 16px', background: 'rgba(97,42,134,.1)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#D67A31', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Vendor Admin</button>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 0, borderBottom: '1px solid rgba(97,42,134,.1)', flexWrap: 'wrap' }}>
        {(['overview', 'products', 'billing', 'rescan', 'invite', 'danger'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={s.tabBtn(tab === t)}>
            {t === 'rescan' ? 'Re-scan' : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'billing' && trialExpired ? ' ⚠' : ''}
            {t === 'danger' && retailer.archived_at ? ' · archived' : ''}
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 16 }}>

        {tab === 'overview' && (
          <div>
            {saveError && (
              <div style={{ background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10, padding: '12px 16px', color: '#e07070', fontSize: 13, marginBottom: 16 }}>
                {saveError}
              </div>
            )}
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Details</div>
              {[
                { label: 'Name', field: 'name', value: retailer.name },
                { label: 'Location', field: 'location', value: retailer.location || '' },
                { label: 'Tagline', field: 'tagline', value: retailer.tagline || '' },
                { label: 'Brand Color', field: 'brand_color', value: retailer.brand_color || '' },
                { label: 'Logo URL', field: 'logo_url', value: retailer.logo_url || '' },
              ].map(({ label, field, value }) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <label style={s.label}>{label}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {field === 'brand_color' && (
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: retailer.brand_color || '#D67A31', flexShrink: 0, border: '1px solid rgba(255,255,255,.1)' }} />
                    )}
                    <input defaultValue={value} onBlur={e => saveField(field, e.target.value)} style={s.inp} />
                  </div>
                </div>
              ))}
            </div>
            {(retailer.story || retailer.culture || retailer.region) && (
              <div style={s.card}>
                <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Brand Story</div>
                {retailer.story && <div style={{ marginBottom: 14 }}><label style={s.label}>Story</label><textarea defaultValue={retailer.story} onBlur={e => saveField('story', e.target.value)} rows={3} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
                {retailer.culture && <div style={{ marginBottom: 14 }}><label style={s.label}>Culture / Vibe</label><textarea defaultValue={retailer.culture} onBlur={e => saveField('culture', e.target.value)} rows={3} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
                {retailer.region && <div style={{ marginBottom: 14 }}><label style={s.label}>Region</label><textarea defaultValue={retailer.region} onBlur={e => saveField('region', e.target.value)} rows={2} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
              </div>
            )}
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Recent Sessions</div>
              {sessions.length === 0
                ? <div style={{ color: '#3A3450', fontSize: 13 }}>No sessions yet.</div>
                : sessions.map(sess => (
                  <div key={sess.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(97,42,134,.06)' }}>
                    <span style={{ color: '#6A6080', fontSize: 12 }}>{sess.id.substring(0, 8)}...</span>
                    <span style={{ color: sess.order_status === 'ordered' ? '#5ecf8a' : sess.order_status === 'recommended' ? '#D67A31' : '#3A3450', fontSize: 12 }}>{sess.order_status}</span>
                    <span style={{ color: '#3A3450', fontSize: 11 }}>{new Date(sess.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div style={s.card}>
            <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Products ({products.length})</div>
            {products.map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(97,42,134,.06)' }}>
                <div style={{ color: '#F5F2E8', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#3A3450', fontSize: 11, marginTop: 2 }}>
                  {[p.category, p.style, p.abv ? p.abv + ' ABV' : null, p.price ? '$' + p.price : null].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
            {flights.length > 0 && (
              <>
                <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, margin: '20px 0 14px' }}>Flights ({flights.length})</div>
                {flights.map(f => (
                  <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(97,42,134,.06)' }}>
                    <div style={{ color: '#F5F2E8', fontSize: 14 }}>{f.name}</div>
                    <div style={{ color: '#3A3450', fontSize: 11, marginTop: 2 }}>{f.count} × {f.pour_size} · ${f.price}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'billing' && (
          <div>
            {/* Current status card */}
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Subscription Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <span style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  background: retailer.subscription_status === 'active' ? 'rgba(94,207,138,.15)' : trialExpired ? 'rgba(255,100,100,.12)' : 'rgba(97,42,134,.12)',
                  color: retailer.subscription_status === 'active' ? '#5ecf8a' : trialExpired ? '#e07070' : '#D67A31',
                  border: '1px solid ' + (retailer.subscription_status === 'active' ? 'rgba(94,207,138,.3)' : trialExpired ? 'rgba(255,100,100,.3)' : 'rgba(97,42,134,.25)'),
                }}>
                  {retailer.subscription_status || 'trial'}
                </span>
                {trialEnds && (
                  <span style={{ color: trialExpired ? '#e07070' : '#3A3450', fontSize: 13 }}>
                    {trialExpired
                      ? 'Expired ' + trialEnds.toLocaleDateString()
                      : daysLeft + ' days left · ' + trialEnds.toLocaleDateString()}
                  </span>
                )}
              </div>
              <label style={s.label}>Override Status</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['trial', 'active', 'cancelled', 'expired'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatus(status)}
                    style={{
                      ...s.btn(status === 'active' ? 'green' : status === 'cancelled' || status === 'expired' ? 'danger' : undefined),
                      opacity: retailer.subscription_status === status ? 1 : 0.55,
                      textTransform: 'capitalize',
                    }}>
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Extend trial card */}
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Extend Trial</div>
              <div style={{ color: '#3A3450', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
                Adds days from today (or from current expiry if not yet expired). Resets status to trial.
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {[7, 14, 30, 60, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => setExtendDays(d)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(97,42,134,' + (extendDays === d ? '.6' : '.2') + ')',
                      background: extendDays === d ? 'rgba(97,42,134,.15)' : 'transparent',
                      color: extendDays === d ? '#D67A31' : '#3A3450',
                      cursor: 'pointer',
                      fontFamily: "var(--font-inter), system-ui, sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}>
                    {d}d
                  </button>
                ))}
              </div>
              <button
                onClick={extendTrial}
                disabled={extending}
                style={{ ...s.btn(), opacity: extending ? .6 : 1 }}>
                {extending ? 'Extending...' : 'Extend +' + extendDays + ' days'}
              </button>
              {billingMsg && (
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: billingMsg.startsWith('Error') ? 'rgba(255,100,100,.08)' : 'rgba(94,207,138,.08)',
                  border: '1px solid ' + (billingMsg.startsWith('Error') ? 'rgba(255,100,100,.2)' : 'rgba(94,207,138,.2)'),
                  color: billingMsg.startsWith('Error') ? '#e07070' : '#5ecf8a',
                  fontSize: 13,
                }}>
                  {billingMsg}
                </div>
              )}
            </div>

            {/* Stripe placeholder */}
            <div style={{ ...s.card, opacity: .45 }}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Stripe (coming soon)</div>
              <div style={{ color: '#3A3450', fontSize: 13 }}>Customer ID: {retailer.stripe_customer_id || 'Not connected'}</div>
            </div>
          </div>
        )}

        {tab === 'rescan' && (
          <div>
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Re-scan Website</div>
              <div style={{ color: '#3A3450', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Update this retailer&apos;s data by re-reading their website.
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Website URL</label>
                <input type="url" value={rescanUrl} onChange={e => setRescanUrl(e.target.value)} placeholder="https://theirwebsite.com" style={s.inp} autoCapitalize="none" autoCorrect="off" />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button onClick={() => runRescan('catalog')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('rgba(97,42,134,.3)')}>{rescanning ? '...' : 'Catalog Only'}</button>
                <button onClick={() => runRescan('branding')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('rgba(97,42,134,.3)')}>{rescanning ? '...' : 'Branding Only'}</button>
                <button onClick={() => runRescan('full')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('linear-gradient(135deg,#D67A31,#612A86)')}>{rescanning ? 'Scanning...' : 'Full Rescan'}</button>
              </div>
              <div style={{ color: '#3A3450', fontSize: 11, lineHeight: 1.7 }}>
                <strong style={{ color: '#6A6080' }}>Catalog Only</strong> — adds new products, keeps manual edits<br />
                <strong style={{ color: '#6A6080' }}>Branding Only</strong> — updates colors, logo, story, tagline<br />
                <strong style={{ color: '#6A6080' }}>Full Rescan</strong> — replaces all products, updates all branding
              </div>
            </div>
            {rescanning && (
              <div style={{ ...s.card, textAlign: 'center', padding: '32px' }}>
                <div style={{ color: '#D67A31', fontSize: 14, marginBottom: 8 }}>Reading website...</div>
                <div style={{ color: '#3A3450', fontSize: 12 }}>20-40 seconds. AI is extracting colors, story, and products.</div>
              </div>
            )}
            {rescanResult && (
              <div style={{ ...s.card, border: '1px solid rgba(94,207,138,.25)' }}>
                <div style={{ color: '#5ecf8a', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Rescan Complete</div>
                <div style={{ color: '#F5F2E8', fontSize: 13, marginBottom: 8 }}>Mode: <span style={{ color: '#D67A31' }}>{rescanResult.mode}</span></div>
                {rescanResult.newProducts > 0 && <div style={{ color: '#F5F2E8', fontSize: 13 }}>{rescanResult.newProducts} new products added</div>}
              </div>
            )}
            {rescanError && <div style={{ color: '#e07070', fontSize: 13, padding: '12px', background: 'rgba(255,100,100,.08)', borderRadius: 8 }}>{rescanError}</div>}
          </div>
        )}

        {tab === 'invite' && (
          <div style={s.card}>
            <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Send Admin Access</div>
            <div style={{ color: '#3A3450', fontSize: 13, marginBottom: 20 }}>Send a login link so the vendor can access their portal.</div>
            <label style={s.label}>Vendor Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="owner@theirplace.com" style={{ ...s.inp, marginBottom: 14 }} />
            <button onClick={sendInvite} disabled={!inviteEmail || inviting} style={{ padding: '12px 22px', background: 'linear-gradient(135deg,#D67A31,#612A86)', border: 'none', borderRadius: 8, color: '#12111A', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !inviteEmail || inviting ? .5 : 1 }}>
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
            {inviteResult && <div style={{ color: inviteResult.startsWith('Error') ? '#e07070' : '#5ecf8a', fontSize: 13, marginTop: 12 }}>{inviteResult}</div>}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(97,42,134,.1)' }}>
              <div style={{ color: '#3A3450', fontSize: 11, marginBottom: 6 }}>Customer link</div>
              <div style={{ color: '#D67A31', fontSize: 13 }}>{storefrontUrl(retailer.slug)}</div>
            </div>
          </div>
        )}

        {tab === 'danger' && (
          <div>
            {dangerMsg && (
              <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, fontSize: 13,
                background: dangerMsg.startsWith('Error') ? 'rgba(224,112,112,.1)' : 'rgba(94,207,138,.1)',
                border: '1px solid ' + (dangerMsg.startsWith('Error') ? 'rgba(224,112,112,.3)' : 'rgba(94,207,138,.3)'),
                color: dangerMsg.startsWith('Error') ? '#e07070' : '#5ecf8a' }}>
                {dangerMsg}
              </div>
            )}

            {/* Archive — reversible */}
            <div style={s.card}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                {retailer.archived_at ? 'Restore venue' : 'Archive venue'}
              </div>
              <div style={{ color: '#3A3450', fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
                {retailer.archived_at
                  ? 'This venue is archived — hidden from the vendor list and disabled for guests. Restoring brings it back and re-enables its guest page.'
                  : 'Hides this venue from the vendor list and disables its guest page. Nothing is deleted — you can restore it anytime.'}
              </div>
              <button onClick={toggleArchive} disabled={archiving} style={{ ...s.btn(retailer.archived_at ? 'green' : undefined), opacity: archiving ? .6 : 1 }}>
                {archiving ? 'Working…' : retailer.archived_at ? 'Restore venue' : 'Archive venue'}
              </button>
            </div>

            {/* Hard delete — permanent, owner-only */}
            <div style={{ ...s.card, border: '1px solid rgba(224,112,112,.3)' }}>
              <div style={{ color: '#e07070', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Permanently delete</div>
              <div style={{ color: '#3A3450', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                Irreversibly removes <strong style={{ color: '#F5F2E8' }}>{retailer.name}</strong> and all of its products, sessions, orders, billing events, and analytics. This cannot be undone. Owner role required.
              </div>
              <label style={s.label}>Type the venue name to confirm</label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={retailer.name} style={{ ...s.inp, marginBottom: 14 }} />
              <button
                onClick={hardDelete}
                disabled={deleting || deleteConfirm.trim() !== retailer.name}
                style={{ ...s.btn('danger'), opacity: deleting || deleteConfirm.trim() !== retailer.name ? .45 : 1, cursor: deleting || deleteConfirm.trim() !== retailer.name ? 'not-allowed' : 'pointer' }}>
                {deleting ? 'Deleting…' : 'Delete this venue forever'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
