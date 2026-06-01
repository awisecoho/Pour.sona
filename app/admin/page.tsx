'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useActiveRetailer } from '@/lib/useActiveRetailer'
import type { Session } from '@/lib/types'

type Stats = { scans: number; convos: number; recs: number; orders: number }
type DailyPoint = { day: string; scans: number; convos: number; recs: number; orders: number }
type Range = { from: string | null; to: string | null; chartFrom: string; chartTo: string }

function DailyChart({ data }: { data: DailyPoint[] }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.map(d => d.convos), 1)
  const barW = Math.max(3, Math.min(20, Math.floor(580 / data.length) - 2))
  const svgW = data.length * (barW + 2)
  const labelEvery = data.length <= 14 ? 1 : data.length <= 31 ? 3 : 7

  return (
    <div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <svg width={svgW} height={72} style={{ display: 'block', overflow: 'visible' }}>
          {data.map((d, i) => {
            const convH = Math.max(d.convos > 0 ? 2 : 0, Math.round((d.convos / maxVal) * 64))
            const ordH  = Math.max(d.orders > 0 ? 2 : 0, Math.round((d.orders  / maxVal) * 64))
            const x = i * (barW + 2)
            return (
              <g key={d.day}>
                <rect x={x} y={72 - convH} width={barW} height={convH} fill="rgba(255,255,255,0.08)" rx={1} />
                {d.orders > 0 && (
                  <rect x={x} y={72 - ordH} width={barW} height={ordH} fill="rgba(63,198,212,0.65)" rx={1} />
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        {data.filter((_, i) => i === 0 || i === data.length - 1 || i % labelEvery === 0).map(d => (
          <span key={d.day} style={{ color: '#2A3242', fontSize: 9 }}>{d.day.slice(5)}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#3A4456', fontSize: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.08)', display: 'inline-block' }} />Sessions
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#3FC6D4', fontSize: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(63,198,212,0.65)', display: 'inline-block' }} />Orders
        </span>
      </div>
    </div>
  )
}

const CHECKLIST = [
  { id: 'catalog', label: 'Review your catalog', desc: 'Confirm the AI extracted your products correctly.', href: '/admin/catalog', cta: 'Go to Catalog →' },
  { id: 'preview', label: 'Preview your guest guide', desc: 'See exactly what your guests experience when they scan.', href: null, cta: null },
  { id: 'qr', label: 'Download your QR code', desc: 'Print it and place it on your menus and tables.', href: '/admin/qr', cta: 'Download QR →' },
]

function OnboardingChecklist({ retailerSlug, onDismiss }: { retailerSlug: string; onDismiss: () => void }) {
  const done: Record<string, boolean> = {}
  const completedCount = CHECKLIST.filter(s => done[s.id]).length

  return (
    <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.25)', borderRadius: 14, padding: '28px 28px 20px', marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 4 }}>Getting started</div>
          <div style={{ color: '#E8EDF2', fontSize: 18, fontWeight: 700 }}>You&apos;re almost live</div>
          <div style={{ color: '#3A4456', fontSize: 13, marginTop: 4 }}>3 quick steps to start guiding guests.</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#2A3242', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }} title="Dismiss">×</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {CHECKLIST.map((step, i) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid rgba(63,198,212,.08)' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(63,198,212,.1)', border: '1px solid rgba(63,198,212,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3FC6D4', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#E8EDF2', fontSize: 13, fontWeight: 700 }}>{step.label}</div>
              <div style={{ color: '#3A4456', fontSize: 12, marginTop: 2 }}>{step.desc}</div>
            </div>
            {step.href ? (
              <Link href={step.href} style={{ padding: '6px 14px', background: 'rgba(63,198,212,.1)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 8, color: '#3FC6D4', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {step.cta}
              </Link>
            ) : (
              <a href={`/r/${retailerSlug}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', background: 'rgba(63,198,212,.1)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 8, color: '#3FC6D4', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Preview Guide →
              </a>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(63,198,212,.1)', borderRadius: 2 }}>
          <div style={{ width: `${(completedCount / CHECKLIST.length) * 100}%`, height: '100%', background: '#3FC6D4', borderRadius: 2, transition: 'width .3s' }} />
        </div>
        <div style={{ color: '#3A4456', fontSize: 11, whiteSpace: 'nowrap' }}>{completedCount}/{CHECKLIST.length} done</div>
      </div>
    </div>
  )
}

const ICONS: Record<string, string> = { brewery: '🍺', winery: '🍷', distillery: '🥃', coffee: '☕' }

function Stat({ label, value, sub, color = '#3FC6D4' }: any) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, padding: '24px 20px' }}>
      <div style={{ color: '#3A4456', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#6B7588', fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { retailer, retailerId, loading: retailerLoading } = useActiveRetailer()
  const [stats, setStats] = useState<Stats>({ scans: 0, convos: 0, recs: 0, orders: 0 })
  const [aiUsage, setAiUsage] = useState<{ costUsd: number; budgetUsd: number; pct: number } | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [range, setRange] = useState<Range | null>(null)
  const [recent, setRecent] = useState<Pick<Session, 'id' | 'order_status' | 'created_at'>[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [showChecklist, setShowChecklist] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]   = useState('')

  useEffect(() => {
    if (!retailerId) return
    const dismissed = localStorage.getItem(`poursona_checklist_dismissed_${retailerId}`)
    if (!dismissed) setShowChecklist(true)
  }, [retailerId])

  function dismissChecklist() {
    if (retailerId) localStorage.setItem(`poursona_checklist_dismissed_${retailerId}`, '1')
    setShowChecklist(false)
  }

  async function loadDashboard(rId: string, from: string, to: string) {
    setLoading(true)
    try {
      const p = new URLSearchParams({ retailerId: rId })
      if (from) p.set('from', from)
      if (to)   p.set('to',   to)
      const res = await fetch('/api/admin/dashboard?' + p, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        console.error('[admin/dashboard] load failed:', json)
        setMessage('Dashboard data could not be loaded right now.')
        setLoading(false)
        return
      }
      setStats(json.stats  || { scans: 0, convos: 0, recs: 0, orders: 0 })
      setAiUsage(json.aiUsage || null)
      setDaily(json.daily  || [])
      setRange(json.range  || null)
      setRecent(json.recent || [])
      setMessage(null)
    } catch (error) {
      console.error('[admin/dashboard] load failed:', error)
      setMessage('Dashboard data could not be loaded right now.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (retailerLoading) return
    if (!retailerId) {
      setMessage('No retailer is linked to this admin account.')
      setLoading(false)
      return
    }
    loadDashboard(retailerId, '', '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retailerId, retailerLoading])

  function applyDateRange() {
    if (retailerId) loadDashboard(retailerId, fromDate, toDate)
  }

  function clearDateRange() {
    setFromDate(''); setToDate('')
    if (retailerId) loadDashboard(retailerId, '', '')
  }

  function exportCsv() {
    if (!retailerId) return
    const p = new URLSearchParams({ retailerId, format: 'csv' })
    if (fromDate) p.set('from', fromDate)
    if (toDate)   p.set('to',   toDate)
    window.location.href = '/api/admin/dashboard?' + p
  }

  if (retailerLoading || loading) return <div style={{ color: '#3FC6D4' }}>Loading…</div>
  if (message) return <div style={{ color: '#E8EDF2', fontFamily: "'Space Grotesk', sans-serif" }}>{message}</div>

  const rate     = stats.convos > 0 ? Math.round((stats.recs   / stats.convos) * 100) : 0
  const ordRate  = stats.convos > 0 ? Math.round((stats.orders / stats.convos) * 100) : 0
  const icon     = ICONS[retailer?.vertical ?? ''] || '✦'
  const hasRange = !!(fromDate || toDate)
  const rangeLabel = hasRange
    ? `${fromDate || '…'} → ${toDate || 'today'}`
    : 'All time'
  const inp: React.CSSProperties = { padding: '7px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 7, color: '#E8EDF2', fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, outline: 'none' }
  const btn = (v?: 'outline'): React.CSSProperties => ({ padding: '7px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700, background: v === 'outline' ? 'transparent' : 'linear-gradient(135deg,#3FC6D4,#2A9BA8)', color: v === 'outline' ? '#3FC6D4' : '#0C1018', ...(v === 'outline' ? { border: '1px solid rgba(63,198,212,.25)' } : {}) })

  return (
    <div>
      <style>{`
        .dash-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
        .dash-sessions-table { display: block; }
        .dash-sessions-cards { display: none; }
        .dash-date-row { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
        @media (max-width: 640px) {
          .dash-stats { grid-template-columns: repeat(2,1fr); gap: 12px; }
          .dash-sessions-table { display: none; }
          .dash-sessions-cards { display: flex; flex-direction: column; gap: 10px; }
          .dash-date-row { gap: 6px; }
          .dash-date-row input[type="date"] { flex: 1; min-width: 0; font-size: 13px !important; }
        }
      `}</style>

      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Dashboard</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {retailer?.logo_url
            ? <img src={retailer.logo_url} alt="" style={{ height: 36, objectFit: 'contain', borderRadius: 4 }} />
            : <span style={{ fontSize: 28 }}>{icon}</span>}
          <div style={{ color: '#E8EDF2', fontSize: 22, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{retailer?.name}</div>
        </div>
        <div style={{ color: '#3A4456', fontSize: 12, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ textTransform: 'capitalize' }}>{retailer?.vertical}</span>
          {retailer?.location && <span>{retailer.location}</span>}
          <a href={'/r/' + retailer?.slug} target="_blank" style={{ color: '#3FC6D4', textDecoration: 'none' }}>↗ /r/{retailer?.slug}</a>
        </div>
      </div>

      {showChecklist && stats.scans === 0 && retailer?.slug && (
        <OnboardingChecklist retailerSlug={retailer.slug} onDismiss={dismissChecklist} />
      )}

      {/* Date range controls */}
      <div className="dash-date-row">
        <span style={{ color: '#3A4456', fontSize: 11 }}>{rangeLabel}</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyDateRange()} style={inp} title="From" />
        <input type="date" value={toDate}   onChange={e => setToDate(e.target.value)}   onKeyDown={e => e.key === 'Enter' && applyDateRange()} style={inp} title="To" />
        <button onClick={applyDateRange} style={btn()}>Apply</button>
        {hasRange && <button onClick={clearDateRange} style={btn('outline')}>Clear</button>}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={exportCsv} style={btn('outline')}>↓ CSV</button>
        </div>
      </div>

      {/* Stats grid — 4-col desktop, 2-col mobile */}
      <div className="dash-stats">
        <Stat label="QR Scans" value={stats.scans} sub="Total visits" />
        <Stat label="Conversations" value={stats.convos} sub="Sessions started" />
        <Stat label="Recommendations" value={stats.recs} sub={rate + '% rec rate'} color="#5ecf8a" />
        <Stat label="Orders" value={stats.orders} sub={ordRate + '% conv rate'} color="#7ec8e3" />
      </div>

      {/* AI usage this month */}
      {aiUsage && (
        <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ color: '#E8EDF2', fontSize: 13, fontWeight: 700 }}>AI Usage This Month</div>
            <div style={{ color: aiUsage.pct >= 100 ? '#e07070' : aiUsage.pct >= 80 ? '#3FC6D4' : '#3A4456', fontSize: 12 }}>
              ${aiUsage.costUsd.toFixed(2)} / ${aiUsage.budgetUsd.toFixed(0)} · {aiUsage.pct}%
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: aiUsage.pct + '%', height: '100%', background: aiUsage.pct >= 100 ? '#e07070' : aiUsage.pct >= 80 ? '#3FC6D4' : '#5ecf8a', transition: 'width .3s' }} />
          </div>
          {aiUsage.pct >= 100 && (
            <div style={{ color: '#a07a3a', fontSize: 11, marginTop: 8 }}>
              AI cap reached — guests still get a curated pick. Usage resets next month.
            </div>
          )}
        </div>
      )}

      {/* Daily trend chart */}
      {daily.length > 1 && (
        <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, padding: '20px 20px', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 6 }}>
            <div style={{ color: '#E8EDF2', fontSize: 13, fontWeight: 700 }}>Daily Activity</div>
            <div style={{ color: '#2A3242', fontSize: 10 }}>{range?.chartFrom} → {range?.chartTo}</div>
          </div>
          <DailyChart data={daily} />
        </div>
      )}

      {/* Recent Sessions — table on desktop, cards on mobile */}
      <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(63,198,212,.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#E8EDF2', fontSize: 14, fontWeight: 700 }}>Recent Sessions</div>
          <div style={{ color: '#3A4456', fontSize: 11 }}>{retailer?.name}</div>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#3A4456', fontSize: 13 }}>
            No sessions yet — share your QR code to get started.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="dash-sessions-table">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(63,198,212,.08)' }}>
                    {['Session','Status','Date'].map(h => <th key={h} style={{ padding: '10px 20px', textAlign: 'left', color: '#3A4456', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s: any) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(63,198,212,.05)' }}>
                      <td style={{ padding: '12px 20px', color: '#6B7588', fontSize: 12 }}>{s.id.substring(0,8)}…</td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
                          background: s.order_status==='ordered'?'rgba(94,207,138,.15)':s.order_status==='recommended'?'rgba(63,198,212,.15)':'rgba(255,255,255,.05)',
                          color: s.order_status==='ordered'?'#5ecf8a':s.order_status==='recommended'?'#3FC6D4':'#6B7588'
                        }}>{s.order_status}</span>
                      </td>
                      <td style={{ padding: '12px 20px', color: '#6B7588', fontSize: 12 }}>
                        {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="dash-sessions-cards" style={{ padding: '12px' }}>
              {recent.map((s: any) => (
                <div key={s.id} style={{ padding: '14px 16px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(63,198,212,.07)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#6B7588', fontSize: 12 }}>{s.id.substring(0,8)}…</span>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
                      background: s.order_status==='ordered'?'rgba(94,207,138,.15)':s.order_status==='recommended'?'rgba(63,198,212,.15)':'rgba(255,255,255,.05)',
                      color: s.order_status==='ordered'?'#5ecf8a':s.order_status==='recommended'?'#3FC6D4':'#6B7588'
                    }}>{s.order_status}</span>
                  </div>
                  <div style={{ color: '#3A4456', fontSize: 11 }}>
                    {new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
