'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const VERTICAL_ICONS: Record<string, string> = { brewery: '🍺', winery: '🍷', distillery: '🥃', coffee: '☕' }

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ color: color || '#F5ECD7', fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function InternalDashboard() {
  const [retailers, setRetailers] = useState<any[]>([])
  const [sysStatus, setSysStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [view, setView] = useState<'dashboard' | 'retailers'>('dashboard')

  useEffect(() => { load() }, [])

  async function load() {
    const [retRes, sysRes] = await Promise.all([
      fetch('/api/poursona-admin/retailers'),
      fetch('/api/poursona-admin/system-check').catch(() => null),
    ])
    const retJson = await retRes.json()
    const sysJson = sysRes ? await sysRes.json().catch(() => null) : null
    setRetailers(retJson.retailers || [])
    setSysStatus(sysJson)
    setLoading(false)
  }

  async function toggleActive(id: string, current: boolean) {
    setToggling(id)
    await fetch('/api/poursona-admin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retailerId: id, active: !current }),
    })
    setRetailers(prev => prev.map(r => r.id === id ? { ...r, active: !current } : r))
    setToggling(null)
  }

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>

  const now = new Date()
  const active = retailers.filter(r => r.active)
  const paid = retailers.filter(r => r.subscription_status === 'active')
  const trials = retailers.filter(r => r.subscription_status === 'trial')
  const expired = retailers.filter(r => {
    if (r.subscription_status !== 'trial' || !r.trial_ends_at) return false
    return new Date(r.trial_ends_at) < now
  })
  const totalSessions = retailers.reduce((s, r) => s + (r.stats?.total || 0), 0)
  const totalOrders = retailers.reduce((s, r) => s + (r.stats?.ordered || 0), 0)
  const convRate = totalSessions > 0 ? Math.round(totalOrders / totalSessions * 100) + '%' : '—'

  const tabBtn = (t: string): React.CSSProperties => ({
    padding: '9px 18px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    fontSize: 12,
    fontWeight: 700,
    background: view === t ? 'rgba(201,168,76,.15)' : 'transparent',
    color: view === t ? '#C9A84C' : '#4a3a1a',
    borderBottom: view === t ? '2px solid #C9A84C' : '2px solid transparent',
    borderRadius: '8px 8px 0 0',
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
          <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>App Command Center</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>{retailers.length} retailers · {totalSessions} sessions · {convRate} conversion</div>
        </div>
        <Link href="/poursona-admin/onboard" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          + Onboard Retailer
        </Link>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid rgba(201,168,76,.1)' }}>
        <button style={tabBtn('dashboard')} onClick={() => setView('dashboard')}>Dashboard</button>
        <button style={tabBtn('retailers')} onClick={() => setView('retailers')}>All Retailers ({retailers.length})</button>
      </div>

      {view === 'dashboard' && (
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Retailers" value={retailers.length} sub={active.length + ' active'} />
            <StatCard label="Paid" value={paid.length} color="#5ecf8a" sub="live subscriptions" />
            <StatCard label="On Trial" value={trials.length} color="#C9A84C" sub={expired.length > 0 ? expired.length + ' expired' : 'all current'} />
            <StatCard label="Total Sessions" value={totalSessions.toLocaleString()} sub={totalOrders + ' orders'} />
            <StatCard label="Expired Trials" value={expired.length} color={expired.length > 0 ? '#e07070' : '#4a3a1a'} sub="need follow-up" />
            <StatCard label="Conversion" value={convRate} sub="session → order" />
          </div>

          {/* Expired trials alert */}
          {expired.length > 0 && (
            <div style={{ background: 'rgba(255,100,100,.06)', border: '1px solid rgba(255,100,100,.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ color: '#e07070', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                ⚠ {expired.length} expired trial{expired.length > 1 ? 's' : ''} need attention
              </div>
              {expired.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,100,100,.1)' }}>
                  <div>
                    <span style={{ color: '#F5ECD7', fontSize: 13 }}>{r.name}</span>
                    <span style={{ color: '#4a3a1a', fontSize: 11, marginLeft: 10 }}>
                      expired {r.trial_ends_at ? new Date(r.trial_ends_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <Link href={'/poursona-admin/retailer/' + r.id + '#billing'} style={{ color: '#C9A84C', fontSize: 12, textDecoration: 'none' }}>
                    Extend →
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* System health */}
          <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', marginBottom: 20 }}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>System Health</div>
            {[
              { label: 'Database (Neon)', ok: sysStatus?.db !== false },
              { label: 'Auth (Clerk)', ok: sysStatus?.auth !== false },
              { label: 'AI (Anthropic)', ok: sysStatus?.ai !== false },
              { label: 'Brand Extraction', ok: sysStatus?.brand_extraction !== false },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
                <span style={{ color: '#6a5a3a', fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 12, color: ok ? '#5ecf8a' : '#e07070', fontWeight: 700 }}>
                  {ok ? '✔ OK' : '✖ Issue'}
                </span>
              </div>
            ))}
            {!sysStatus && <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 8 }}>Run system check for live status</div>}
          </div>

          {/* Quick nav */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Team', href: '/poursona-admin/team', icon: '👥' },
              { label: 'System Check', href: '/poursona-admin/system-check', icon: '⚙' },
              { label: 'Onboard', href: '/poursona-admin/onboard', icon: '+' },
            ].map(({ label, href, icon }) => (
              <Link key={href} href={href} style={{ padding: '16px 12px', background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 12, color: '#C9A84C', textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {view === 'retailers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {retailers.map(r => {
            const tExpired = r.trial_ends_at && new Date(r.trial_ends_at) < now
            return (
              <div key={r.id} style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', opacity: r.active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: r.brand_color || '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {VERTICAL_ICONS[r.vertical] || '✦'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#F5ECD7', fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                    <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{r.vertical} · /r/{r.slug}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11,
                        background: r.subscription_status === 'active' ? 'rgba(94,207,138,.12)' : tExpired ? 'rgba(255,100,100,.12)' : 'rgba(201,168,76,.12)',
                        color: r.subscription_status === 'active' ? '#5ecf8a' : tExpired ? '#e07070' : '#C9A84C',
                        border: '1px solid ' + (r.subscription_status === 'active' ? 'rgba(94,207,138,.3)' : tExpired ? 'rgba(255,100,100,.3)' : 'rgba(201,168,76,.25)'),
                      }}>{r.subscription_status || 'trial'}{tExpired ? ' ⚠' : ''}</span>
                      <span style={{ color: '#4a3a1a', fontSize: 12 }}>{r.stats?.total || 0} sessions</span>
                      {r.trial_ends_at && (
                        <span style={{ color: tExpired ? '#e07070' : '#4a3a1a', fontSize: 11 }}>
                          {tExpired ? 'expired' : 'trial ends'} {new Date(r.trial_ends_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <a href={'/r/' + r.slug} target="_blank" style={{ padding: '10px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>Preview</a>
                  <Link href={'/poursona-admin/retailer/' + r.id} style={{ padding: '10px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>Manage</Link>
                  <button onClick={() => toggleActive(r.id, r.active)} disabled={toggling === r.id} style={{ padding: '10px 0', background: r.active ? 'rgba(255,100,100,.08)' : 'rgba(94,207,138,.08)', border: '1px solid ' + (r.active ? 'rgba(255,100,100,.2)' : 'rgba(94,207,138,.2)'), borderRadius: 8, color: r.active ? '#e07070' : '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600 }}>
                    {toggling === r.id ? '…' : r.active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
