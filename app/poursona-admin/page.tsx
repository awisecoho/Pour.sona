'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const ICONS: Record<string, string> = { brewery: '🍺', winery: '🍷', distillery: '🥃', coffee: '☕' }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ color: color || '#F5ECD7', fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

type Tab = 'dashboard' | 'vendors' | 'accounting' | 'promos' | 'customers'

export default function AppCommandCenter() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [retailers, setRetailers] = useState<any[]>([])
  const [accounting, setAccounting] = useState<any>(null)
  const [promos, setPromos] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percent', value: '', description: '', applies_to: 'all', max_uses: '' })
  const [promoSaving, setPromoSaving] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')

  useEffect(() => { loadRetailers() }, [])
  useEffect(() => {
    if (tab === 'accounting' && !accounting) loadAccounting()
    if (tab === 'promos' && !promos.length) loadPromos()
    if (tab === 'customers') loadCustomers()
  }, [tab])

  async function loadRetailers() {
    const res = await fetch('/api/poursona-admin/retailers')
    const json = await res.json()
    setRetailers(json.retailers || [])
    setLoading(false)
  }

  async function loadAccounting() {
    const res = await fetch('/api/poursona-admin/accounting').catch(() => null)
    if (res?.ok) {
      const json = await res.json()
      setAccounting(json)
    }
  }

  async function loadPromos() {
    const res = await fetch('/api/poursona-admin/promos').catch(() => null)
    if (res?.ok) {
      const json = await res.json()
      setPromos(json.promos || [])
    }
  }

  async function loadCustomers() {
    const q = customerSearch ? '?q=' + encodeURIComponent(customerSearch) : ''
    const res = await fetch('/api/poursona-admin/customers' + q).catch(() => null)
    if (res?.ok) {
      const json = await res.json()
      setCustomers(json.customers || [])
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setToggling(id)
    await fetch('/api/poursona-admin/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: id, active: !current }) })
    setRetailers(prev => prev.map(r => r.id === id ? { ...r, active: !current } : r))
    setToggling(null)
  }

  async function createPromo() {
    if (!promoForm.code || !promoForm.value) { setPromoMsg('Code and value required'); return }
    setPromoSaving(true); setPromoMsg('')
    const res = await fetch('/api/poursona-admin/promos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...promoForm, value: parseFloat(promoForm.value), max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null })
    })
    const json = await res.json()
    if (res.ok && json.ok) {
      setPromos(prev => [json.promo, ...prev])
      setPromoForm({ code: '', type: 'percent', value: '', description: '', applies_to: 'all', max_uses: '' })
      setPromoMsg('Promo created!')
    } else { setPromoMsg('Error: ' + (json.error || 'Failed')) }
    setPromoSaving(false)
  }

  async function togglePromo(id: string, active: boolean) {
    await fetch('/api/poursona-admin/promos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, active: !active }) })
    setPromos(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
  }

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>

  const now = new Date()
  const paid = retailers.filter(r => r.subscription_status === 'active')
  const trials = retailers.filter(r => r.subscription_status === 'trial')
  const expired = retailers.filter(r => r.subscription_status === 'trial' && r.trial_ends_at && new Date(r.trial_ends_at) < now)
  const totalSessions = retailers.reduce((s, r) => s + (r.stats?.total || 0), 0)
  const totalOrders = retailers.reduce((s, r) => s + (r.stats?.ordered || 0), 0)
  const convRate = totalSessions > 0 ? Math.round(totalOrders / totalSessions * 100) + '%' : '—'

  const card: React.CSSProperties = { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', marginBottom: 16 }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
  const label: React.CSSProperties = { color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }
  const btn = (v?: string): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, background: v === 'danger' ? 'rgba(255,100,100,.15)' : v === 'green' ? 'rgba(94,207,138,.15)' : v === 'outline' ? 'rgba(201,168,76,.08)' : 'linear-gradient(135deg,#C9A84C,#a07830)', color: v === 'danger' ? '#e07070' : v === 'green' ? '#5ecf8a' : v === 'outline' ? '#C9A84C' : '#060403', ...(v === 'outline' ? { border: '1px solid rgba(201,168,76,.25)' } : {}) })
  const tabBtn = (t: Tab): React.CSSProperties => ({ padding: '9px 16px', border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, background: tab === t ? 'rgba(201,168,76,.15)' : 'transparent', color: tab === t ? '#C9A84C' : '#4a3a1a', borderBottom: tab === t ? '2px solid #C9A84C' : '2px solid transparent', borderRadius: '8px 8px 0 0' })

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
          <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>App Command Center</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>{retailers.length} retailers · {totalSessions} sessions · {convRate} conversion</div>
        </div>
        <Link href="/poursona-admin/onboard" style={{ display: 'inline-block', padding: '11px 22px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          + Onboard Retailer
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(201,168,76,.1)', flexWrap: 'wrap' }}>
        <button style={tabBtn('dashboard')} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button style={tabBtn('vendors')} onClick={() => setTab('vendors')}>Vendors ({retailers.length})</button>
        <button style={tabBtn('accounting')} onClick={() => setTab('accounting')}>Accounting</button>
        <button style={tabBtn('promos')} onClick={() => setTab('promos')}>Promos</button>
        <button style={tabBtn('customers')} onClick={() => setTab('customers')}>Customers</button>
      </div>

      {tab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Vendors" value={retailers.length} sub={retailers.filter(r => r.active).length + ' active'} />
            <StatCard label="Paid" value={paid.length} color="#5ecf8a" sub="live subscriptions" />
            <StatCard label="On Trial" value={trials.length} color="#C9A84C" sub={expired.length > 0 ? expired.length + ' expired' : 'all current'} />
            <StatCard label="Total Sessions" value={totalSessions.toLocaleString()} sub={totalOrders + ' orders'} />
            <StatCard label="Expired Trials" value={expired.length} color={expired.length > 0 ? '#e07070' : '#4a3a1a'} sub="need follow-up" />
            <StatCard label="Conversion" value={convRate} sub="session → order" />
          </div>
          {expired.length > 0 && (
            <div style={{ background: 'rgba(255,100,100,.06)', border: '1px solid rgba(255,100,100,.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ color: '#e07070', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⚠ {expired.length} expired trial{nexpired.length !== 1 ? 's' : ''} need attention</div>
              {expired.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,100,100,.1)' }}>
                  <div><span style={{ color: '#F5ECD7', fontSize: 13 }}>{r.name}</span><span style={{ color: '#4a3a1a', fontSize: 11, marginLeft: 10 }}>expired {r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString() : ''}</span></div>
                  <Link href={'/poursona-admin/retailer/' + r.id} style={{ color: '#C9A84C', fontSize: 12, textDecoration: 'none' }}>Extend →</Link>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[{ label: 'Onboard', href: '/poursona-admin/onboard', icon: '+' }, { label: 'Team', href: '/poursona-admin/team', icon: '👥' }, { label: 'System Check', href: '/poursona-admin/system-check', icon: '⚙' }].map(({ label, href, icon }) => (
              <Link key={href} href={href} style={{ padding: '16px 12px', background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 12, color: '#C9A84C', textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {tab === 'vendors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {retailers.map(r => {
            const tExp = r.trial_ends_at && new Date(r.trial_ends_at) < now
            return (
              <div key={r.id} style={{ ...card, marginBottom: 0, opacity: r.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: r.brand_color || '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{ICONS[r.vertical] || '✦v'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{r.vertical} · /r/{r.slug}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: r.subscription_status === 'active' ? 'rgba(94,207,138,.12)' : tExp ? 'rgba(255,100,100,.12)' : 'rgba(201,168,76,.12)', color: r.subscription_status === 'active' ? '#5ecf8a' : tExp ? '#e07070' : '#C9A84C', border: '1px solid ' + (r.subscription_status === 'active' ? 'rgba(94,207,138,.3)' : tExp ? 'rgba(255,100,100,.3)' : 'rgba(201,168,76,.25)') }}>{r.subscription_status || 'trial'}{tExp ? ' ⚠' : ''}</span>
                      <span style={{ color: '#4a3a1a', fontSize: 12 }}>{r.stats?.total || 0} sessions</span>
                      {r.trial_ends_at && <span style={{ color: tExp ? '#e07070' : '#4a3a1a', fontSize: 11 }}>{tExp ? 'expired' : 'ends'} {new Date(r.trial_ends_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <a href={'/r/' + r.slug} target="_blank" style={{ padding: '9px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>Preview</a>
                  <Link href={'/poursona-admin/retailer/' + r.id} style={{ padding: '9px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>Manage</Link>
                  <button onClick={() => toggleActive(r.id, r.active)} disabled={toggling === r.id} style={{ padding: '9px 0', background: r.active ? 'rgba(255,100,100,.08)' : 'rgba(94,207,138,.08)', border: '1px solid ' + (r.active ? 'rgba(255,100,100,.2)' : 'rgba(94,207,138,.2)'), borderRadius: 8, color: r.active ? '#e07070' : '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600 }}>{toggling === r.id ? '…' : r.active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'accounting' && (
        <div>
          {!accounting ? (
            <div style={{ color: '#4a3a1a', textAlign: 'center', padding: '40px 0' }}>
              <div style={{ color: '#C9A84C', marginBottom: 8 }}>Loading accounting data…This requires auth.</div>
              <button onClick={loadAccounting} style={btn()}>Retry</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard label="MRR" value={'$' + (accounting.mrr || 0).toLocaleString()} color="#5ecf8a" sub="monthly recurring" />
                <StatCard label="ARR" value={'$' + ((accounting.mrr || 0) * 12).toLocaleString()} sub="annualized" />
                <StatCard label="Paid Vendors" value={accounting.paid_count || 0} color="#5ecf8a" />
                <StatCard label="Credits Issued" value={'$' + (accounting.total_credits || 0)} sub="account credits" />
              </div>
              <div style={card}>
                <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Vendor Billing</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: '1px solid rgba(201,168,76,.15)' }}>{['Vendor', 'Plan', 'Status', 'MRR', 'Credits', 'Since'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#4a3a1a', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700 }}>{h</th>)}</tr></thead>
                    <tbody>{(accounting.vendors || []).map((v: any) => ( <tr key={v.id} style={{ borderBottom: '1px solid rgba(201,168,76,.06)' }}><td style={{ padding: '10px', color: '#F5ECD7' }}>{v.name}</td><td style={{ padding: '10px', color: '#6a5a3a', textTransform: 'capitalize' }}>v.subscription_tier || '—'}</td><td style={{ padding: '10px' }}><span style={{ color: v.subscription_status === 'active' ? '#5ecf8a' : '#C9A84C', textTransform: 'capitalize' }}>{v.subscription_status || 'trial'}</span></td><td style={{ padding: '10px', color: v.mrr ? '#5ecf8a' : '#4a3a1a' }}>{v.mrr ? '$' + v.mrr : '—'}</td><td style={{ padding: '10px', color: '#4a3a1a' }}>{v.credit_balance ? '$' + v.credit_balance : '—'}</td><td style={{ padding: '10px', color: '#4a3a1a' }}>{v.created_at ? new Date(v.created_at).toLocaleDateString() : '—'}</td></tr> ))}</tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'promos' && (
        <div>
          <div style={card}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Create Promo Code</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={label}>Code</label><input value={promoForm.code} onChange={e => setPromoForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" style={inp} /></div>
              <div><label style={label}>Type</label><select value={promoForm.type} onChange={e => setPromoForm(p => ({ ...p, type: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}><option value="percent">Percent Off (%)</option><option value="fixed">Fixed Amount ($)</option><option value="trial_days">Free Trial Days</option><option value="credit">Account Credit ($)</option></select></div>
              <div><label style={label}>Value</label><input value={promoForm.value} onChange={e => setPromoForm(p => ({ ...p, value: e.target.value }))} placeholder={promoForm.type === 'percent' ? '20' : '50'} type="number" style={inp} /></div>
              <div><label style={label}>Applies To</label><select value={promoForm.applies_to} onChange={e => setPromoForm(p => ({ ...p, applies_to: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}><option value="all">All Plans</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="pro">Pro</option></select></div>
              <div><label style={label}>Max Uses</label><input value={promoForm.max_uses} onChange={e => setPromoForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="100" type="number" style={inp} /></div>
              <div><label style={label}>Description</label><input value={promoForm.description} onChange={e => setPromoForm(p => ({ ...p, description: e.target.value }))} placeholder="Warm discount for new vendors" style={inp} /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={createPromo} disabled={promoSaving} style={{ ...btn(), opacity: promoSaving ? .6 : 1 }}>{promoSaving ? 'Creating…'� : 'Create Promo'</button>
              {promoMsg && <span style={{ fontSize: 13, color: promoMsg.startsWith('Error') ? '#e07070' : '#5ecf8a' }}>{promoMsg}</span>}
            </div>
          </div>
          <div style={card}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>All Promos ({promos.length})</div>
            {promos.length === 0 ? <div style={{ color: '#4a3a1a', fontSize: 13 }}>No promo codes yet.</div> : promos.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, letterSpacing: '.05em' }}>{p.code}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: p.active ? 'rgba(94,207,138,.12)' : 'rgba(255,100,100,.08)', color: p.active ? '#5ecf8a' : '#e07070', border: '1px solid ' + (p.active ? 'rgba(94,207,138,.3)' : 'rgba(255,100,100,.2)') }}>{p.active ? 'active' : 'inactive'}</span>
                  </div>
                  <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 4 }}>{p.type === 'percent' ? p.value + '% off' : p.type === 'fixed' ? '$' + p.value + ' off' : p.type === 'trial_days' ? p.value + ' free days' : '$' + p.value + ' credit'}{p.max_uses ? ' · ' + (p.uses_count || 0) + '/' + p.max_uses : p.uses_count ? ' · ' + p.uses_count + ' uses' : ''}{p.description ? ' · ' + p.description : ''}</div>
                </div>
                <button onClick={() => togglePromo(p.id, p.active)} style={btn(p.active ? 'danger' : 'green')}>{p.active ? 'Disable' : 'Enable'}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'customers' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadCustomers()} placeholder="Search by name or email…" style={{ ...inp, flex: 1 }} />
            <button onClick={loadCustomers} style={btn()}>Search</button>
          </div>
          <div style={card}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Customer Profiles ({customers.length})</div>
            {customers.length === 0 ? <div style={{ color: '#4a3a1a', fontSize: 13 }}>No customer profiles found.</div> : customers.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                <div>
                  <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700 }}>{c.name || '(no name)'}</div>
                  <div style={{ color: '#6a5a3a', fontSize: 12, marginTop: 2 }}>{c.email}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    {c.opted_in_promos && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'rgba(201,168,76,.1)', color: '#C9A84C', border: '1px solid rgba(201,168,76,.2)' }}>promo</span>}
                    {c.opted_in_marketing && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'rgba(94,207,138,.08)', color: '#5ecf8a', border: '1px solid rgba(94,207,138,.2)' }}>marketing</span>}
                    {c.total_visits > 0 && <span style={{ color: '#4a3a1a', fontSize: 11 }}>{c.total_visits} visit{c.total_visits !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <div style={{ color: '#4a3a1a', fontSize: 11, textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
