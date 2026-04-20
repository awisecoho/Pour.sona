'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const VERTICAL_ICONS: Record<string, string> = { brewery: '🍺', winery: '🍷', distillery: '🥃', coffee: '☕' }

export default function InternalDashboard() {
  const [retailers, setRetailers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>

  const active = retailers.filter(r => r.active).length

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>All Retailers</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>{active} active · {retailers.length} total</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Link href="/poursona-admin/onboard" style={{ display: 'inline-block', padding: '12px 24px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', textDecoration: 'none', fontSize: 13, fontWeight: 700, letterSpacing: '.08em' }}>
          + Onboard New Retailer
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {retailers.map(r => (
          <div key={r.id} style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', opacity: r.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
              {/* Color swatch + icon */}
              <div style={{ width: 44, height: 44, borderRadius: 10, background: r.brand_color || '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {VERTICAL_ICONS[r.vertical] || '✦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F5ECD7', fontSize: 16, fontWeight: 700 }}>{r.name}</div>
                <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{r.vertical} · /r/{r.slug}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
                    background: r.subscription_status === 'active' ? 'rgba(94,207,138,.12)' : 'rgba(201,168,76,.12)',
                    color: r.subscription_status === 'active' ? '#5ecf8a' : '#C9A84C',
                    border: '1px solid ' + (r.subscription_status === 'active' ? 'rgba(94,207,138,.3)' : 'rgba(201,168,76,.25)')
                  }}>{r.subscription_status || 'trial'}</span>
                  <span style={{ color: '#4a3a1a', fontSize: 12 }}>{r.stats?.total || 0} sessions</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <a
                href={'/r/' + r.slug}
                target="_blank"
                style={{ padding: '10px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}
              >
                Preview
              </a>
              <Link
                href={'/poursona-admin/retailer/' + r.id}
                style={{ padding: '10px 0', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', textDecoration: 'none', fontSize: 12, textAlign: 'center', fontWeight: 600 }}
              >
                Manage
              </Link>
              <button
                onClick={() => toggleActive(r.id, r.active)}
                disabled={toggling === r.id}
                style={{ padding: '10px 0', background: r.active ? 'rgba(255,100,100,.08)' : 'rgba(94,207,138,.08)', border: '1px solid ' + (r.active ? 'rgba(255,100,100,.2)' : 'rgba(94,207,138,.2)'), borderRadius: 8, color: r.active ? '#e07070' : '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 600 }}
              >
                {toggling === r.id ? '…' : r.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
