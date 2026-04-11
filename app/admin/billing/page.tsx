'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
function BillingContent() {
  const [retailer, setRetailer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const params = useSearchParams()
  const upgraded = params.get('upgraded')
  const cancelled = params.get('cancelled')
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) return
      const { data: au } = await sb.from('admin_users').select('retailer_id, retailers(*)').eq('user_id', session.user.id).single()
      if (au?.retailers) setRetailer(au.retailers)
      setLoading(false)
    })()
  }, [])
  async function startCheckout() {
    if (!retailer) return
    setCheckoutLoading(true)
    const res = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: retailer.id }) })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else setCheckoutLoading(false)
  }
  async function openPortal() {
    if (!retailer) return
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retailerId: retailer.id }) })
    const json = await res.json()
    if (json.url) window.location.href = json.url
    else setPortalLoading(false)
  }
  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  const isActive = retailer?.subscription_status === 'active'
  const isTrial = retailer?.subscription_status === 'trial'
  const isCancelled = retailer?.subscription_status === 'cancelled'
  const isPastDue = retailer?.subscription_status === 'past_due'
  const trialEnds = retailer?.trial_ends_at ? new Date(retailer.trial_ends_at) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : 0
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Account</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Billing</div>
      </div>
      {upgraded && <div style={{ background: 'rgba(94,207,138,.1)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, color: '#5ecf8a', fontSize: 14 }}>✓ Subscription activated — welcome to Poursona!</div>}
      {cancelled && <div style={{ background: 'rgba(255,100,100,.08)', border: '1px solid rgba(255,100,100,.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, color: '#e07070', fontSize: 14 }}>Checkout cancelled — no charge was made.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 800 }}>
        {/* Status card */}
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '28px 24px' }}>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Current Plan</div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>Plan</div>
            <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700, textTransform: 'capitalize' }}>{retailer?.subscription_tier || 'Starter'}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#4a3a1a', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
            <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
              background: isActive ? 'rgba(94,207,138,.12)' : isTrial ? 'rgba(201,168,76,.12)' : isPastDue ? 'rgba(255,180,0,.12)' : 'rgba(255,100,100,.1)',
              color: isActive ? '#5ecf8a' : isTrial ? '#C9A84C' : isPastDue ? '#ffb400' : '#e07070',
              border: `1px solid ${isActive ? 'rgba(94,207,138,.3)' : isTrial ? 'rgba(201,168,76,.3)' : isPastDue ? 'rgba(255,180,0,.3)' : 'rgba(255,100,100,.2)'}`
            }}>{retailer?.subscription_status || 'trial'}</span>
          </div>
          {isTrial && trialEnds && (
            <div style={{ background: daysLeft <= 3 ? 'rgba(255,100,100,.08)' : 'rgba(201,168,76,.06)', border: `1px solid ${daysLeft <= 3 ? 'rgba(255,100,100,.2)' : 'rgba(201,168,76,.15)'}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: daysLeft <= 3 ? '#e07070' : '#C9A84C', fontSize: 13 }}>
                {daysLeft > 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining in trial` : 'Trial expired'}
              </div>
              <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>Ends {trialEnds.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          )}
          {isPastDue && (
            <div style={{ background: 'rgba(255,180,0,.08)', border: '1px solid rgba(255,180,0,.25)', borderRadius: 10, padding: '12px 14px', color: '#ffb400', fontSize: 13 }}>
              Payment failed — please update your billing info.
            </div>
          )}
        </div>
        {/* Action card */}
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '28px 24px' }}>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Poursona Starter</div>
          <div style={{ color: '#C9A84C', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>$49<span style={{ fontSize: 16, color: '#6a5a3a', fontWeight: 400 }}>/month</span></div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>Everything you need to run your AI-powered tasting guide.</div>
          <div style={{ marginBottom: 20 }}>
            {['Unlimited QR scans','AI discovery conversations','Recommendation engine','Order tracking dashboard','Catalog + flight management','QR code generation'].map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', color: '#c8bfa8', fontSize: 13 }}>
                <span style={{ color: '#5ecf8a', fontSize: 12 }}>✓</span>{f}
              </div>
            ))}
          </div>
          {(isTrial || isCancelled) && (
            <button onClick={startCheckout} disabled={checkoutLoading} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 10, color: '#0a0603', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', cursor: checkoutLoading ? 'wait' : 'pointer', opacity: checkoutLoading ? .7 : 1 }}>
              {checkoutLoading ? 'Redirecting…' : isCancelled ? 'Reactivate — $49/mo' : 'Subscribe — $49/mo'}
            </button>
          )}
          {(isActive || isPastDue) && (
            <button onClick={openPortal} disabled={portalLoading} style={{ width: '100%', padding: '14px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', borderRadius: 10, color: '#C9A84C', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, cursor: portalLoading ? 'wait' : 'pointer', opacity: portalLoading ? .7 : 1 }}>
              {portalLoading ? 'Opening…' : 'Manage Billing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
export default function BillingPage() {
  return <Suspense fallback={<div style={{ color: '#C9A84C' }}>Loading…</div>}><BillingContent /></Suspense>
}