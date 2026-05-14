import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — Poursona',
  description: 'Simple, transparent pricing for breweries, wineries, distilleries, and coffee shops.',
}

const FEATURES = [
  'AI-powered catalog extraction from your website',
  'Unlimited guest scans and conversations',
  'Branded QR code for menus and tables',
  'Real-time analytics dashboard',
  'Tasting flight management',
  'Order capture and staff notifications',
  'Catalog management with in/out of stock toggles',
  '14-day free trial, no credit card required',
]

const FAQ = [
  {
    q: 'What happens after the 14-day trial?',
    a: 'Your guide stays live as long as your subscription is active. If you choose not to subscribe, your guest experience pauses — no data is deleted.',
  },
  {
    q: 'Do I need a website to get started?',
    a: 'Yes — Poursona reads your existing menu and brand from your website to set up your guide automatically. If you don\'t have one, contact us and we\'ll help.',
  },
  {
    q: 'Can I update my menu after setup?',
    a: 'Yes. You can add, edit, or remove products anytime from your dashboard. Toggle items in and out of stock in seconds.',
  },
  {
    q: 'Is there a per-location fee?',
    a: 'The current plan covers one venue. Multi-location pricing is available — contact us.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards via Stripe. No contracts, cancel anytime.',
  },
]

export default function PricingPage() {
  const s: Record<string, React.CSSProperties> = {
    page: { background: '#060403', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#F5ECD7' },
    nav: { padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(201,168,76,.1)' },
    section: { maxWidth: 860, margin: '0 auto', padding: '80px 24px' },
    card: { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 20, padding: '48px 40px', maxWidth: 480, margin: '0 auto', position: 'relative' },
    badge: { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 20, padding: '4px 18px', color: '#060403', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
    price: { fontSize: 64, fontWeight: 700, color: '#F5ECD7', lineHeight: 1 },
    per: { color: '#4a3a1a', fontSize: 15, marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 10 },
    feature: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,.07)', fontSize: 14, color: '#c8bfa8' },
    check: { color: '#5ecf8a', flexShrink: 0, marginTop: 1 },
    btn: { display: 'block', width: '100%', padding: '18px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 10, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 32 },
    trial: { textAlign: 'center', color: '#3a2a0a', fontSize: 12, marginTop: 12 },
    faqItem: { borderBottom: '1px solid rgba(201,168,76,.1)', padding: '24px 0' },
    faqQ: { color: '#F5ECD7', fontSize: 16, fontWeight: 700, marginBottom: 10 },
    faqA: { color: '#4a3a1a', fontSize: 14, lineHeight: 1.7 },
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <Link href="/" style={{ color: '#C9A84C', fontSize: 18, fontWeight: 700, letterSpacing: '.05em', textDecoration: 'none' }}>✦ Poursona</Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ color: '#4a3a1a', fontSize: 13, textDecoration: 'none' }}>Home</Link>
          <Link href="/admin/login" style={{ color: '#C9A84C', fontSize: 13, textDecoration: 'none' }}>Vendor login</Link>
        </div>
      </nav>

      <section style={s.section}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</div>
          <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>One plan. Everything included.</h1>
          <p style={{ color: '#4a3a1a', fontSize: 16, lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
            No feature tiers. No per-seat fees. Everything Poursona offers, for one flat monthly rate.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.badge as React.CSSProperties}>Most popular</div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 16 }}>Venue Plan</div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={s.price}>$49</span>
              <span style={s.per}>/month</span>
            </div>
            <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>per venue · billed monthly · cancel anytime</div>
          </div>

          <div style={{ margin: '32px 0 8px' }}>
            {FEATURES.map(f => (
              <div key={f} style={s.feature}>
                <span style={s.check}>✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>

          <Link href="/signup" style={s.btn}>Start Free Trial →</Link>
          <div style={s.trial}>14-day free trial · No credit card required</div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, color: '#4a3a1a', fontSize: 13 }}>
          Multi-location or enterprise? <a href="mailto:hello@pour-sona.com" style={{ color: '#C9A84C', textDecoration: 'none' }}>Contact us →</a>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>FAQ</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Common questions</h2>
        </div>
        {FAQ.map(item => (
          <div key={item.q} style={s.faqItem}>
            <div style={s.faqQ}>{item.q}</div>
            <div style={s.faqA}>{item.a}</div>
          </div>
        ))}
      </section>

      <footer style={{ borderTop: '1px solid rgba(201,168,76,.08)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ color: '#C9A84C', fontWeight: 700 }}>✦ Poursona</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/" style={{ color: '#3a2a0a', fontSize: 12, textDecoration: 'none' }}>Home</Link>
          <Link href="/admin/login" style={{ color: '#3a2a0a', fontSize: 12, textDecoration: 'none' }}>Vendor Login</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: '#3a2a0a', fontSize: 12, textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ color: '#3a2a0a', fontSize: 12 }}>© 2026 Poursona</div>
      </footer>
    </div>
  )
}
