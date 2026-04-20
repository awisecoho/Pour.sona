'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function RetailerDetail() {
  const { id } = useParams<{ id: string }>()
  const [retailer, setRetailer] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [flights, setFlights] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'overview' | 'products' | 'rescan' | 'invite'>('overview')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')
  const [rescanUrl, setRescanUrl] = useState('')
  const [rescanning, setRescanning] = useState(false)
  const [rescanResult, setRescanResult] = useState<any>(null)
  const [rescanError, setRescanError] = useState('')

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    const [rRes, pRes, fRes, sRes] = await Promise.all([
      sb.from('retailers').select('*').eq('id', id).single(),
      sb.from('products').select('*').eq('retailer_id', id).order('sort_order').limit(50),
      sb.from('flights').select('*').eq('retailer_id', id).order('sort_order'),
      sb.from('sessions').select('id,order_status,created_at').eq('retailer_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setRetailer(rRes.data)
    setProducts(pRes.data || [])
    setFlights(fRes.data || [])
    setSessions(sRes.data || [])
    if (rRes.data?.source_url) setRescanUrl(rRes.data.source_url)
    setLoading(false)
  }

  async function saveField(field: string, value: any) {
    setSaving(true)
    await sb.from('retailers').update({ [field]: value }).eq('id', id)
    setRetailer((prev: any) => ({ ...prev, [field]: value }))
    setSaving(false)
  }

  async function runRescan(mode: 'catalog' | 'branding' | 'full') {
    if (!rescanUrl.trim()) return
    setRescanning(true); setRescanResult(null); setRescanError('')
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
    } catch (err: any) { setRescanError(err.message) }
    setRescanning(false)
  }

  async function sendInvite() {
    if (!inviteEmail) return
    setInviting(true); setInviteResult('')
    const res = await fetch('/api/poursona-admin/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: id, email: inviteEmail, name: '' }) })
    const json = await res.json()
    setInviteResult(json.ok ? 'Invite sent to ' + inviteEmail : 'Error: ' + json.error)
    setInviting(false)
  }

  function openVendorAdmin() {
    if (!retailer) return
    sessionStorage.setItem('active_retailer', JSON.stringify(retailer))
    localStorage.setItem('poursona_active_retailer', retailer.id)
    window.open('/admin', '_blank')
  }

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  if (!retailer) return <div style={{ color: '#e07070' }}>Retailer not found.</div>

  const s = {
    card: { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', marginBottom: 16 } as React.CSSProperties,
    label: { color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 6 },
    inp: { width: '100%', padding: '11px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const },
    tabBtn: (active: boolean) => ({ padding: '9px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, background: active ? 'rgba(201,168,76,.15)' : 'transparent', color: active ? '#C9A84C' : '#4a3a1a', borderBottom: active ? '2px solid #C9A84C' : '2px solid transparent' } as React.CSSProperties),
    rescanBtn: (color: string) => ({ padding: '12px 18px', border: 'none', borderRadius: 8, background: color, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, cursor: rescanning ? 'wait' : 'pointer', opacity: rescanning ? .5 : 1, flex: 1 } as React.CSSProperties),
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Link href="/poursona-admin" style={{ color: '#4a3a1a', fontSize: 12, textDecoration: 'none', display: 'inline-block', marginBottom: 12 }}>← All Retailers</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: retailer.brand_color || '#C9A84C', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700 }}>{retailer.name}</div>
            <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{retailer.vertical} · /r/{retailer.slug}</div>
          </div>
          {saving && <div style={{ color: '#C9A84C', fontSize: 11 }}>Saving…</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <a href={'/r/' + retailer.slug} target="_blank" style={{ padding: '10px 16px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 8, color: '#060403', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>↗ Preview</a>
        <button onClick={openVendorAdmin} style={{ padding: '10px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>⊞ Vendor Admin</button>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 0, borderBottom: '1px solid rgba(201,168,76,.1)' }}>
        {(['overview', 'products', 'rescan', 'invite'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={s.tabBtn(tab === t)}>{t === 'rescan' ? '↻ Re-scan' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      <div style={{ paddingTop: 16 }}>
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div>
            <div style={s.card}>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Details</div>
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
                    {field === 'brand_color' && <div style={{ width: 32, height: 32, borderRadius: 6, background: retailer.brand_color || '#C9A84C', flexShrink: 0, border: '1px solid rgba(255,255,255,.1)' }} />}
                    <input defaultValue={value} onBlur={e => saveField(field, e.target.value)} style={s.inp} />
                  </div>
                </div>
              ))}
            </div>
            {(retailer.story || retailer.culture || retailer.region) && (
              <div style={s.card}>
                <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Brand Story</div>
                {retailer.story && <div style={{ marginBottom: 14 }}><label style={s.label}>Story</label><textarea defaultValue={retailer.story} onBlur={e => saveField('story', e.target.value)} rows={3} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
                {retailer.culture && <div style={{ marginBottom: 14 }}><label style={s.label}>Culture / Vibe</label><textarea defaultValue={retailer.culture} onBlur={e => saveField('culture', e.target.value)} rows={3} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
                {retailer.region && <div style={{ marginBottom: 14 }}><label style={s.label}>Region</label><textarea defaultValue={retailer.region} onBlur={e => saveField('region', e.target.value)} rows={2} style={{ ...s.inp, resize: 'vertical' as const }} /></div>}
              </div>
            )}
            <div style={s.card}>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Recent Sessions</div>
              {sessions.length === 0 ? <div style={{ color: '#4a3a1a', fontSize: 13 }}>No sessions yet.</div> : sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                  <span style={{ color: '#6a5a3a', fontSize: 12 }}>{s.id.substring(0,8)}…</span>
                  <span style={{ color: s.order_status==='ordered'?'#5ecf8a':s.order_status==='recommended'?'#C9A84C':'#4a3a1a', fontSize: 12 }}>{s.order_status}</span>
                  <span style={{ color: '#4a3a1a', fontSize: 11 }}>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <div style={s.card}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Products ({products.length})</div>
            {products.map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                <div style={{ color: '#F5ECD7', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>{[p.category, p.style, p.abv ? p.abv+' ABV' : null, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
            {flights.length > 0 && <>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, margin: '20px 0 14px' }}>Flights ({flights.length})</div>
              {flights.map(f => (
                <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                  <div style={{ color: '#F5ECD7', fontSize: 14 }}>{f.name}</div>
                  <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>{f.count} × {f.pour_size} · ${f.price}</div>
                </div>
              ))}
            </>}
          </div>
        )}

        {/* RE-SCAN */}
        {tab === 'rescan' && (
          <div>
            <div style={s.card}>
              <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Re-scan Website</div>
              <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>Update this retailer's data by re-reading their website. Choose what to update.</div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Website URL</label>
                <input
                  type="url"
                  value={rescanUrl}
                  onChange={e => setRescanUrl(e.target.value)}
                  placeholder="https://theirwebsite.com"
                  style={s.inp}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <button onClick={() => runRescan('catalog')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('rgba(201,168,76,.3)')}>
                  {rescanning ? '…' : '☰ Catalog Only'}
                </button>
                <button onClick={() => runRescan('branding')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('rgba(201,168,76,.3)')}>
                  {rescanning ? '…' : '◈ Branding Only'}
                </button>
                <button onClick={() => runRescan('full')} disabled={!rescanUrl.trim() || rescanning} style={s.rescanBtn('linear-gradient(135deg,#C9A84C,#a07830)')}>
                  {rescanning ? 'Scanning…' : '✦ Full Rescan'}
                </button>
              </div>
              <div style={{ color: '#4a3a1a', fontSize: 11, lineHeight: 1.7 }}>
                <strong style={{ color: '#6a5a3a' }}>Catalog Only</strong> — adds new products, keeps manual edits<br />
                <strong style={{ color: '#6a5a3a' }}>Branding Only</strong> — updates colors, logo, story, and tagline<br />
                <strong style={{ color: '#6a5a3a' }}>Full Rescan</strong> — replaces all products, updates all branding and story
              </div>
            </div>
            {rescanning && (
              <div style={{ ...s.card, textAlign: 'center', padding: '32px' }}>
                <div style={{ color: '#C9A84C', fontSize: 14, marginBottom: 8 }}>Reading website…</div>
                <div style={{ color: '#4a3a1a', fontSize: 12 }}>This takes 20-40 seconds. AI is extracting colors, story, and products.</div>
              </div>
            )}
            {rescanResult && (
              <div style={{ ...s.card, border: '1px solid rgba(94,207,138,.25)' }}>
                <div style={{ color: '#5ecf8a', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>✓ Rescan Complete</div>
                <div style={{ color: '#F5ECD7', fontSize: 13, marginBottom: 8 }}>Mode: <span style={{ color: '#C9A84C' }}>{rescanResult.mode}</span></div>
                {rescanResult.retailer?.brand_color && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: rescanResult.retailer.brand_color, border: '1px solid rgba(255,255,255,.1)' }} />
                    <span style={{ color: '#C9A84C', fontSize: 12 }}>{rescanResult.retailer.brand_color}</span>
                  </div>
                )}
                {rescanResult.newProducts > 0 && <div style={{ color: '#F5ECD7', fontSize: 13 }}>{rescanResult.newProducts} new products added</div>}
                {rescanResult.retailer?.story && <div style={{ color: '#6a5a3a', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>{rescanResult.retailer.story}</div>}
              </div>
            )}
            {rescanError && <div style={{ color: '#e07070', fontSize: 13, padding: '12px', background: 'rgba(255,100,100,.08)', borderRadius: 8 }}>{rescanError}</div>}
          </div>
        )}

        {/* INVITE */}
        {tab === 'invite' && (
          <div style={s.card}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Send Admin Access</div>
            <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 20 }}>Send a login link so the vendor can access their portal.</div>
            <label style={s.label}>Vendor Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="owner@theirplace.com" style={{ ...s.inp, marginBottom: 14 }} />
            <button onClick={sendInvite} disabled={!inviteEmail || inviting} style={{ padding: '12px 22px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 8, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !inviteEmail || inviting ? .5 : 1 }}>
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
            {inviteResult && <div style={{ color: inviteResult.startsWith('Error') ? '#e07070' : '#5ecf8a', fontSize: 13, marginTop: 12 }}>{inviteResult}</div>}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(201,168,76,.1)' }}>
              <div style={{ color: '#4a3a1a', fontSize: 11, marginBottom: 6 }}>Customer link</div>
              <div style={{ color: '#C9A84C', fontSize: 13 }}>pour-sona.vercel.app/r/{retailer.slug}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
