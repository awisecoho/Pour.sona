'use client'
import { useEffect, useRef, useState } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'

type Order = {
  id: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
  blend_name: string | null
  items: Array<{ name: string; qty?: number; price?: number }>
  subtotal: number
  status: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending:   { bg: 'rgba(201,168,76,.12)', color: '#C9A84C', border: 'rgba(201,168,76,.3)' },
  fulfilled: { bg: 'rgba(94,207,138,.12)', color: '#5ecf8a', border: 'rgba(94,207,138,.3)' },
  cancelled: { bg: 'rgba(224,112,112,.1)', color: '#e07070', border: 'rgba(224,112,112,.3)' },
}

const POLL_INTERVAL = 20_000

function useSecondsSince(ts: number | null) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (ts === null) return
    setSecs(Math.floor((Date.now() - ts) / 1000))
    const t = setInterval(() => setSecs(Math.floor((Date.now() - ts) / 1000)), 5000)
    return () => clearInterval(t)
  }, [ts])
  return secs
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'orders' | 'sessions'>('orders')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [retailerId, setRetailerId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())
  const secsSince = useSecondsSince(lastFetched)

  async function fetchOrders(rId: string, isInitial = false) {
    try {
      const res = await fetch(`/api/admin/orders?retailerId=${encodeURIComponent(rId)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json.error || 'Failed to load')
      const fetched: Order[] = json.orders || []

      if (!isInitial) {
        const fresh = fetched.filter(o => !knownIds.current.has(o.id)).map(o => o.id)
        if (fresh.length > 0) {
          setNewIds(prev => new Set([...prev, ...fresh]))
          setTimeout(() => setNewIds(prev => {
            const next = new Set(prev)
            fresh.forEach(id => next.delete(id))
            return next
          }), 3000)
        }
      }

      fetched.forEach(o => knownIds.current.add(o.id))
      setOrders(fetched)
      setSessions(json.sessions || [])
      setLastFetched(Date.now())
      setError('')
    } catch (err: any) {
      setError(err.message)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const access = await loadAdminAccess()
        const retailers = access.retailers || []
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('poursona_active_retailer') : null
        const r = retailers.find((x: any) => x.id === storedId) || retailers[0] || null
        if (!r) { setLoading(false); return }
        setRetailerId(r.id)
        await fetchOrders(r.id, true)
      } catch (err: any) {
        setError(err.message)
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!retailerId || tab !== 'orders') return
    const t = setInterval(() => fetchOrders(retailerId), POLL_INTERVAL)
    return () => clearInterval(t)
  }, [retailerId, tab])

  async function updateStatus(orderId: string, status: string) {
    if (!retailerId) return
    setUpdatingId(orderId)
    setError('')
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId, id: orderId, status }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json.error || 'Update failed')
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch (err: any) {
      setError(err.message)
    }
    setUpdatingId(null)
  }

  const th: React.CSSProperties = { padding: '12px 20px', textAlign: 'left', color: '#4a3a1a', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400, borderBottom: '1px solid rgba(201,168,76,.1)' }
  const td: React.CSSProperties = { padding: '14px 20px', fontSize: 13, borderBottom: '1px solid rgba(201,168,76,.05)', verticalAlign: 'top' }

  if (loading) return <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif' }}>Loading…</div>

  const lastUpdatedLabel = lastFetched === null ? null
    : secsSince < 10 ? 'just now'
    : `${secsSince}s ago`

  return (
    <div>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Activity</div>
          <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Orders & Sessions</div>
        </div>
        {lastUpdatedLabel && (
          <div style={{ color: '#3a2a0a', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', opacity: 0.5, display: 'inline-block' }} />
            Updated {lastUpdatedLabel}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10, padding: '12px 16px', color: '#e07070', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['orders', 'sessions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: tab === t ? 'rgba(201,168,76,.15)' : 'transparent', color: tab === t ? '#C9A84C' : '#4a3a1a', fontFamily: 'Georgia, serif', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
            {t} ({t === 'orders' ? orders.length : sessions.length})
          </button>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, overflow: 'hidden' }}>
        {tab === 'orders' && (
          orders.length === 0
            ? <div style={{ padding: '48px 24px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No orders yet. They'll appear here when guests place them.</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Date', 'Selection', 'Guest', 'Items', 'Total', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const sc = STATUS_COLORS[o.status] || STATUS_COLORS.pending
                    const isNew = newIds.has(o.id)
                    return (
                      <tr key={o.id} style={{ transition: 'background .6s', background: isNew ? 'rgba(201,168,76,.07)' : 'transparent' }}>
                        <td style={td}>
                          <div style={{ color: '#F5ECD7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isNew && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', display: 'inline-block', flexShrink: 0 }} />}
                            {new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>{new Date(o.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                        </td>
                        <td style={{ ...td, color: '#F5ECD7' }}>{o.blend_name || '—'}</td>
                        <td style={{ ...td, color: '#c8bfa8' }}>
                          <div>{o.customer_name || '—'}</div>
                          {o.customer_email && <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>{o.customer_email}</div>}
                        </td>
                        <td style={{ ...td, color: '#6a5a3a' }}>
                          {(o.items || []).map((item: any, i: number) => (
                            <div key={i} style={{ fontSize: 12 }}>{item.qty && item.qty > 1 ? `×${item.qty} ` : ''}{item.name}</div>
                          ))}
                        </td>
                        <td style={{ ...td, color: '#C9A84C', fontWeight: 600 }}>${(o.subtotal || 0).toFixed(2)}</td>
                        <td style={td}>
                          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={td}>
                          <select
                            value={o.status}
                            disabled={updatingId === o.id}
                            onChange={e => updateStatus(o.id, e.target.value)}
                            style={{ background: '#0e0b06', border: '1px solid rgba(201,168,76,.2)', borderRadius: 6, color: '#C9A84C', padding: '5px 8px', fontFamily: 'Georgia, serif', fontSize: 11, cursor: 'pointer' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="fulfilled">Fulfilled</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
        )}

        {tab === 'sessions' && (
          sessions.length === 0
            ? <div style={{ padding: '48px 24px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No sessions yet.</div>
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Date', 'Outcome', 'Recommendation', 'Messages'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td style={{ ...td, color: '#6a5a3a' }}>
                        {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={td}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, ...(STATUS_COLORS[s.order_status] || STATUS_COLORS.pending) }}>
                          {s.order_status || 'browsing'}
                        </span>
                      </td>
                      <td style={{ ...td, color: '#C9A84C' }}>{s.blend_name || '—'}</td>
                      <td style={{ ...td, color: '#6a5a3a' }}>{Array.isArray(s.messages) ? s.messages.length : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}
      </div>
    </div>
  )
}
