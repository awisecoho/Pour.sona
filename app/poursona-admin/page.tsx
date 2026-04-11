'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
export default function InternalDashboard() {
  const [retailers, setRetailers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)
  useEffect(() => { load() }, [])
  async function load() {
    const res = await fetch('/api/poursona-admin/retailers')
    const json = await res.json()
    setRetailers(json.retailers || [])
    setLoading(false)
  }
  async function toggleActive(id: string, current: boolean) {
    setToggling(id)
    await fetch('/api/poursona-admin/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: id, active: !current }) })
    setRetailers(prev => prev.map(r => r.id === id ? { ...r, active: !current } : r))
    setToggling(null)
  }
  const filtered = retailers.filter(r => !filter || r.name?.toLowerCase().includes(filter.toLowerCase()) || r.slug?.includes(filter.toLowerCase()) || r.vertical?.includes(filter.toLowerCase()))
  const active = retailers.filter(r => r.active).length
  const trial = retailers.filter(r => r.subscription_status === 'trial').length
  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>All Retailers</div>
      </div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total', value: retailers.length, color: '#F5ECD7' },
          { label: 'Active', value: active, color: '#5ecf8a' },
          { label: 'Trial', value: trial, color: '#C9A84C' },
          { label: 'Inactive', value: retailers.length - active, color: '#e07070' },
        ].map(s => (
          <div key={s.label} style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 12, padding: '18px 16px' }}>
            <div style={{ color: '#4a3a1a', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 30, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* Filter + Add */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter by name, slug, or vertical…" style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 13, outline: 'none' }} />
        <Link href="/poursona-admin/onboard" style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 8, color: '#060403', textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', display: 'flex', alignItems: 'center' }}>+ Onboard New</Link>
      </div>
      {/* Table */}
      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>{['Retailer','Vertical','Plan','Sessions','Recs','Status','Actions'].map(h => <th key={h} style={{ padding: '12px 18px', textAlign: 'left', color: '#4a3a1a', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid rgba(201,168,76,.05)', opacity: r.active ? 1 : 0.45 }}>
              <td style={{ padding: '14px 18px' }}>
                <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 1 }}>/r/{r.slug}</div>
              </td>
              <td style={{ padding: '14px 18px', color: '#6a5a3a', fontSize: 12, textTransform: 'capitalize' }}>{r.vertical}</td>
              <td style={{ padding: '14px 18px' }}>
                <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, background: r.subscription_status === 'active' ? 'rgba(94,207,138,.12)' : 'rgba(201,168,76,.12)', color: r.subscription_status === 'active' ? '#5ecf8a' : '#C9A84C', border: '1px solid ' + (r.subscription_status === 'active' ? 'rgba(94,207,138,.3)' : 'rgba(201,168,76,.25)') }}>{r.subscription_tier} · {r.subscription_status}</span>
              </td>
              <td style={{ padding: '14px 18px', color: '#C9A84C', fontSize: 13 }}>{r.stats?.total || 0}</td>
              <td style={{ padding: '14px 18px', color: '#5ecf8a', fontSize: 13 }}>{r.stats?.recommended || 0}</td>
              <td style={{ padding: '14px 18px' }}>
                <button onClick={() => toggleActive(r.id, r.active)} disabled={toggling === r.id} style={{ padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer', background: r.active ? 'rgba(94,207,138,.12)' : 'rgba(255,100,100,.1)', color: r.active ? '#5ecf8a' : '#e07070', fontSize: 10, fontFamily: 'Georgia, serif' }}>{toggling === r.id ? '…' : r.active ? '● Active' : '○ Inactive'}</button>
              </td>
              <td style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={'/r/' + r.slug} target="_blank" style={{ padding: '5px 11px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 6, color: '#C9A84C', textDecoration: 'none', fontSize: 11 }}>Preview</a>
                  <Link href={'/poursona-admin/retailer/' + r.id} style={{ padding: '5px 11px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 6, color: '#C9A84C', textDecoration: 'none', fontSize: 11 }}>Manage</Link>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No retailers found.</div>}
      </div>
    </div>
  )
}