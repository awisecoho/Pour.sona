'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
function Stat({ label, value, sub, color = '#C9A84C' }: any) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '24px 20px' }}>
      <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#6a5a3a', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}
export default function Dashboard() {
  const [stats, setStats] = useState({ scans: 0, convos: 0, recs: 0, orders: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [retailer, setRetailer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data: au } = await sb.from('admin_users').select('retailer_id, retailers(*)').eq('user_id', session.user.id).single()
      if (!au) { setLoading(false); return }
      setRetailer(au.retailers)
      const rid = au.retailer_id
      const [s, e] = await Promise.all([
        sb.from('sessions').select('id,order_status,created_at').eq('retailer_id', rid).order('created_at', { ascending: false }).limit(50),
        sb.from('events').select('event_type').eq('retailer_id', rid),
      ])
      const sessions = s.data || [], events = e.data || []
      setStats({ scans: events.filter((x: any) => x.event_type === 'scan').length, convos: sessions.length, recs: sessions.filter((x: any) => ['recommended','ordered'].includes(x.order_status)).length, orders: sessions.filter((x: any) => x.order_status === 'ordered').length })
      setRecent(sessions.slice(0, 10))
      setLoading(false)
    })()
  }, [])
  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  const rate = stats.convos > 0 ? Math.round((stats.recs / stats.convos) * 100) : 0
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Dashboard</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Welcome back{retailer?.name ? ', ' + retailer.name : ''}</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>Guide live at <a href={'/r/' + retailer?.slug} target="_blank" style={{ color: '#C9A84C' }}>/r/{retailer?.slug}</a></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        <Stat label="QR Scans" value={stats.scans} sub="Total visits" />
        <Stat label="Conversations" value={stats.convos} sub="Sessions started" />
        <Stat label="Recommendations" value={stats.recs} sub={rate + '% conversion'} color="#5ecf8a" />
        <Stat label="Orders" value={stats.orders} sub="Placed" color="#7ec8e3" />
      </div>
      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(201,168,76,.1)' }}><div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700 }}>Recent Sessions</div></div>
        {recent.length === 0 ? <div style={{ padding: '32px 24px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No sessions yet — share your QR code to get started.</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(201,168,76,.08)' }}>{['Session','Status','Date'].map(h => <th key={h} style={{ padding: '10px 24px', textAlign: 'left', color: '#4a3a1a', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>)}</tr></thead>
            <tbody>{recent.map((s: any) => (
              <tr key={s.id} style={{ borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                <td style={{ padding: '12px 24px', color: '#6a5a3a', fontSize: 12 }}>{s.id.substring(0,8)}…</td>
                <td style={{ padding: '12px 24px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, background: s.order_status==='ordered'?'rgba(94,207,138,.15)':s.order_status==='recommended'?'rgba(201,168,76,.15)':'rgba(255,255,255,.05)', color: s.order_status==='ordered'?'#5ecf8a':s.order_status==='recommended'?'#C9A84C':'#6a5a3a' }}>{s.order_status}</span></td>
                <td style={{ padding: '12px 24px', color: '#6a5a3a', fontSize: 12 }}>{new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}