'use client'
import { useEffect, useState } from 'react'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    description: 'Perfect for a single location getting started',
    features: ['AI guided discovery', 'Unlimited sessions', 'QR code generator', 'Catalog management', 'Basic analytics'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 99,
    description: 'For venues ready to grow their customer experience',
    features: ['Everything in Starter', 'Customer profiles', 'Promo codes', 'Priority support', 'Advanced analytics'],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    description: 'For multi-location or high-volume venues',
    features: ['Everything in Growth', 'Multiple locations', 'Custom branding', 'API access', 'Dedicated support'],
  },
]

export default function BillingPage() {
  const [retailer, setRetailer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/access', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const storedId = localStorage.getItem('poursona_active_retailer')
        const found = (storedId ? d.retailers?.find((r: any) => r.id === storedId) : null) || d.retailers?.[0]
        setRetailer(found || null)
        setLoading(false)
      })
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') === '1') setMsg('Subscription activated! Welcome to Poursona.')
    if (params.get('upgrade_cancelled') === '1') setMsg('Checkout cancelled -- no changes made.')
  }, [])

  async function handleUpgrade(plan: string) {
    if (!retailer) return
    setUpgrading(plan)
    setMsg('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id, plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMsg('Error: ' + (data.error || 'Could not start checkout'))
        setUpgrading(null)
      }
    } catch {
      setMsg('Error: Could not connect to billing')
      setUpgrading(null)
    }
  }

  async function handlePortal() {
    if (!retailer) return
    setPortalLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setMsg('Error: ' + (data.error || 'Could not open billing portal'))
        setPortalLoading(false)
      }
    } catch {
      setMsg('Error: Could not connect to billing')
      setPortalLoading(false)
    }
  }

  const isActive = retailer?.subscription_status === 'active'
  const currentTier = retailer?.subscription_tier || 'starter'
  const trialEnds = retailer?.trial_ends_at ? new Date(retailer.trial_ends_at) : null
  const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86400000) : null
  const trialExpired = trialEnds ? trialEnds < new Date() : false

  const card: React.CSSProperties = { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '24px', marginBottom: 16 }
  const btn = (v?: string): React.CSSProperties => ({ padding: '12px 24px', borderRadius: 10, border: v === 'outline' ? '1px solid rgba(201,168,76,.3)' : 'none', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, background: v === 'outline' ? 'rgba(201,168,76,.08)' : 'linear-gradient(135deg,#C9A84C,#a07830)', color: v === 'outline' ? '#C9A84C' : '#060403' })

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading...</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Subscription</div>
        <div style={{ color: '#F5ECD7', fontSize: 24, fontWeight: 700 }}>Billing & Plans</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>Manage your Poursona subscription</div>
      </div>

      {msg && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 14, fontWeight: 600, background: msg.startsWith('Error') ? 'rgba(255,100,100,.08)' : 'rgba(94,207,138,.08)', border: '1px solid ' + (msg.startsWith('Error') ? 'rgba(255,100,100,.2)' : 'rgba(94,207,138,.2)'), color: msg.startsWith('Error') ? '#e07070' : '#5ecf8a' }}>
          {msg}
        </div>
      )}

      <div style={card}>
        <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Current Status</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: isActive ? 'rgba(94,207,138,.15)' : trialExpired ? 'rgba(255,100,100,.12)' : 'rgba(201,168,76,.12)', color: isActive ? '#5ecf8a' : trialExpired ? '#e07070' : '#C9A84C', border: '1px solid ' + (isActive ? 'rgba(94,207,138,.3)' : trialExpired ? 'rgba(255,100,100,.3)' : 'rgba(201,168,76,.25)') }}>
            {isActive ? `${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} - Active` : trialExpired ? 'Trial Expired' : 'Free Trial'}
          </span>
          {!isActive && trialEnds && (
            <span style={{ color: trialExpired ? '#e07070' : '#6a5a3a', fontSize: 13 }}>
              {trialExpired ? `Expired ${trialEnds.toLocaleDateString()}` : `${daysLeft} days remaining - expires ${trialEnds.toLocaleDateString()}`}
            </span>
          )}
          {isActive && <span style={{ color: '#4a3a1a', fontSize: 13 }}>${retailer?.mrr || 0}/month</span>}
        </div>
        {isActive ? (
          <button onClick={handlePortal} disabled={portalLoading} style={{ ...btn('outline'), opacity: portalLoading ? .6 : 1 }}>
            {portalLoading ? 'Opening portal...' : 'Manage Billing & Invoices'}
          </button>
        ) : (
          <div style={{ color: '#4a3a1a', fontSize: 13 }}>
            {trialExpired ? 'Your trial has expired. Subscribe below to continue using Poursona.' : 'Choose a plan below to unlock your full subscription after the trial.'}
          </div>
        )}
      </div>

      {!isActive && (
        <>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Choose Your Plan</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            {PLANS.map(plan => (
              <div key={plan.id} style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: plan.popular ? '1px solid rgba(201,168,76,.5)' : '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '24px', position: 'relative' }}>
                {plan.popular && <div style={{ position: 'absolute', top: -10, left: 24, background: 'linear-gradient(135deg,#C9A84C,#a07830)', color: '#060403', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, letterSpacing: '.1em', textTransform: 'uppercase' }}>Most Popular</div>}
                <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ color: '#C9A84C', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>${plan.price}<span style={{ fontSize: 14, color: '#4a3a1a', fontWeight: 400 }}>/mo</span></div>
                <div style={{ color: '#4a3a1a', fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>{plan.description}</div>
                <div style={{ marginBottom: 24 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#C9A84C', fontSize: 12 }}>**</span>
                      <span style={{ color: '#6a5a3a', fontSize: 13 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleUpgrade(plan.id)} disabled={!!upgrading} style={{ ...btn(plan.popular ? undefined : 'outline'), width: '100%', opacity: upgrading && upgrading !== plan.id ? .4 : 1 }}>
                  {upgrading === plan.id ? 'Redirecting...' : `Subscribe - $${plan.price}/mo`}
                </button>
              </div>
            ))}
          </div>
          <div style={{ color: '#4a3a1a', fontSize: 12, textAlign: 'center', lineHeight: 1.7 }}>Powered by Stripe - Secure checkout - Cancel anytime - No setup fees</div>
        </>
      )}
    </div>
  )
}
