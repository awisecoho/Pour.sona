'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useActiveRetailer } from '@/lib/useActiveRetailer'

const CHECKLIST = [
  { id: 'catalog', label: 'Review your catalog', desc: 'Confirm the AI extracted your products correctly.', href: '/admin/catalog', cta: 'Go to Catalog →' },
  { id: 'preview', label: 'Preview your guest guide', desc: 'See exactly what your guests experience when they scan.', href: null, cta: null },
  { id: 'qr', label: 'Download your QR code', desc: 'Print it and place it on your menus and tables.', href: '/admin/qr', cta: 'Download QR →' },
]

function OnboardingChecklist({ retailerSlug, onDismiss }: { retailerSlug: string; onDismiss: () => void }) {
  const done: Record<string, boolean> = {}
  const completedCount = CHECKLIST.filter(s => done[s.id]).length

  return (
    <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 14, padding: '28px 28px 20px', marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 4 }}>Getting started</div>
          <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700 }}>You&apos;re almost live</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>3 quick steps to start guiding guests.</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#3a2a0a', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }} title="Dismiss">×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {CHECKLIST.map((step, i) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(201,168,76,.08)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F5ECD7', fontSize: 13, fontWeight: 700 }}>{step.label}</div>
              <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 2 }}>{step.desc}</div>
            </div>
            {step.href ? (
              <Link href={step.href} style={{ padding: '6px 14px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {step.cta}
              </Link>
            ) : (
              <a href={`/r/${retailerSlug}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Preview Guide →
              </a>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(201,168,76,.1)', borderRadius: 2 }}>
          <div style={{ width: `${(completedCount / CHECKLIST.length) * 100}%`, height: '100%', background: '#C9A84C', borderRadius: 2, transition: 'width .3s' }} />
        </div>
        <div style={{ color: '#4a3a1a', fontSize: 11, whiteSpace: 'nowrap' }}>{completedCount}/{CHECKLIST.length} done</div>
      </div>
    </div>
  )
}

const ICONS: Record<string, string> = { brewery: '🍺', winery: '🍷', distillery: '🥃', coffee: '☕' }

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
  const { retailer, retailerId, loading: retailerLoading } = useActiveRetailer()
  const [stats, setStats] = useState({ scans: 0, convos: 0, recs: 0, orders: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [showChecklist, setShowChecklist] = useState(false)

  useEffect(() => {
    if (!retailerId) return
    const dismissed = localStorage.getItem(`poursona_checklist_dismissed_${retailerId}`)
    if (!dismissed) setShowChecklist(true)
  }, [retailerId])

  function dismissChecklist() {
    if (retailerId) localStorage.setItem(`poursona_checklist_dismissed_${retailerId}`, '1')
    setShowChecklist(false)
  }

  useEffect(() => {
    if (retailerLoading) return
    if (!retailerId) {
      setMessage('No retailer is linked to this admin account.')
      setLoading(false)
      return
    }
    const activeRetailerId = retailerId
    setLoading(true)
    async function load() {
      try {
        const res = await fetch(`/api/admin/dashboard?retailerId=${encodeURIComponent(activeRetailerId)}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        if (!res.ok || !json?.ok) {
          console.error('[admin/dashboard] load failed:', json)
          setMessage('Dashboard data could not be loaded right now.')
          setLoading(false)
          return
        }
        const sessions = json.recent || []
        setStats(json.stats || { scans: 0, convos: 0, recs: 0, orders: 0 })
        setRecent(sessions)
        setMessage(null)
        setLoading(false)
      } catch (error) {
        console.error('[admin/dashboard] load failed:', error)
        setMessage('Dashboard data could not be loaded right now.')
        setLoading(false)
      }
    }
    load()
  }, [retailerId, retailerLoading])

  if (retailerLoading || loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  if (message) return <div style={{ color: '#F5ECD7', fontFamily: 'Georgia, serif' }}>{message}</div>

  const rate = stats.convos > 0 ? Math.round((stats.recs / stats.convos) * 100) : 0
  const icon = ICONS[retailer?.vertical] || '✦'

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Dashboard</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {retailer?.logo_url
            ? <img src={retailer.logo_url} alt="" style={{ height: 36, objectFit: 'contain', borderRadius: 4 }} />
            : <span style={{ fontSize: 28 }}>{icon}</span>}
          <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>{retailer?.name}</div>
        </div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6, display: 'flex', gap: 16 }}>
          <span style={{ textTransform: 'capitalize' }}>{retailer?.vertical}</span>
          {retailer?.location && <span>{retailer.location}</span>}
          <a href={'/r/' + retailer?.slug} target="_blank" style={{ color: '#C9A84C', textDecoration: 'none' }}>↗ /r/{retailer?.slug}</a>
        </div>
      </div>

      {showChecklist && stats.scans === 0 && retailer?.slug && (
        <OnboardingChecklist retailerSlug={retailer.slug} onDismiss={dismissChecklist} />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 32 }}>
        <Stat label="QR Scans" value={stats.scans} sub="Total visits" />
        <Stat label="Conversations" value={stats.convos} sub="Sessions started" />
        <Stat label="Recommendations" value={stats.recs} sub={rate + '% conversion'} color="#5ecf8a" />
        <Stat label="Orders" value={stats.orders} sub="Placed" color="#7ec8e3" />
      </div>

      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700 }}>Recent Sessions</div>
          <div style={{ color: '#4a3a1a', fontSize: 11 }}>{retailer?.name}</div>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>
            No sessions yet — share your QR code to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(201,168,76,.08)' }}>
                {['Session','Status','Date'].map(h => <th key={h} style={{ padding: '10px 24px', textAlign: 'left', color: '#4a3a1a', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recent.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                  <td style={{ padding: '12px 24px', color: '#6a5a3a', fontSize: 12 }}>{s.id.substring(0,8)}…</td>
                  <td style={{ padding: '12px 24px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      background: s.order_status==='ordered'?'rgba(94,207,138,.15)':s.order_status==='recommended'?'rgba(201,168,76,.15)':'rgba(255,255,255,.05)',
                      color: s.order_status==='ordered'?'#5ecf8a':s.order_status==='recommended'?'#C9A84C':'#6a5a3a'
                    }}>{s.order_status}</span>
                  </td>
                  <td style={{ padding: '12px 24px', color: '#6a5a3a', fontSize: 12 }}>
                    {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
