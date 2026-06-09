import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'

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

const CARD_BG = 'linear-gradient(145deg,#1C1A2A,#161423)'

export default function PricingPage() {
  const s: Record<string, React.CSSProperties> = {
    page: { background: BRAND.darkBg, minHeight: '100vh', fontFamily: FONT.marketing, color: BRAND.textPrimary },
    nav: { padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${BRAND_RGB.plum},.15)` },
    section: { maxWidth: 860, margin: '0 auto', padding: '80px 24px' },
    card: { background: CARD_BG, border: `1px solid rgba(${BRAND_RGB.copperAmber},.32)`, borderRadius: 20, padding: '48px 40px', maxWidth: 480, margin: '0 auto', position: 'relative' },
    badge: { position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: BRAND.ctaGradient, borderRadius: 20, padding: '4px 18px', color: BRAND.darkBg, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: FONT.ui },
    price: { fontSize: 64, fontWeight: 800, color: BRAND.textPrimary, lineHeight: 1, fontFamily: FONT.brand },
    per: { color: BRAND.textSecondary, fontSize: 15, marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 10, fontFamily: FONT.ui },
    feature: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: `1px solid rgba(${BRAND_RGB.plum},.1)`, fontSize: 14, color: BRAND.textPrimary, fontFamily: FONT.marketing },
    check: { color: BRAND.discoveryTeal, flexShrink: 0, marginTop: 1, fontWeight: 700 },
    btn: { display: 'block', width: '100%', padding: '18px', background: BRAND.ctaGradient, border: 'none', borderRadius: 10, color: BRAND.darkBg, fontFamily: FONT.ui, fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 32, boxShadow: `0 10px 28px rgba(${BRAND_RGB.copperAmber},.28)` },
    trial: { textAlign: 'center', color: BRAND.textMuted, fontSize: 12, marginTop: 12, fontFamily: FONT.ui },
    faqItem: { borderBottom: `1px solid rgba(${BRAND_RGB.plum},.15)`, padding: '24px 0' },
    faqQ: { color: BRAND.textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 10, fontFamily: FONT.brand },
    faqA: { color: BRAND.textSecondary, fontSize: 14, lineHeight: 1.7, fontFamily: FONT.marketing },
  }

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 36, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, fontSize: 18, fontWeight: 700, letterSpacing: '.02em', color: BRAND.textPrimary }}>Poursona</span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ color: BRAND.textSecondary, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui }}>Home</Link>
          <Link href="/admin/login" style={{ color: BRAND.copperAmber, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui, fontWeight: 600 }}>Vendor login</Link>
        </div>
      </nav>

      <section style={s.section}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT.ui }}>Pricing</div>
          <h1 style={{ fontFamily: FONT.brand, fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-.02em' }}>One plan. Everything included.</h1>
          <p style={{ color: BRAND.textSecondary, fontSize: 16, lineHeight: 1.7, maxWidth: 480, margin: '0 auto', fontFamily: FONT.marketing }}>
            No feature tiers. No per-seat fees. Everything Poursona offers, for one flat monthly rate.
          </p>
        </div>

        <div style={s.card}>
          <div style={s.badge as React.CSSProperties}>Most popular</div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 16, fontFamily: FONT.ui }}>Venue Plan</div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={s.price}>$79</span>
              <span style={s.per}>/month</span>
            </div>
            <div style={{ color: BRAND.textSecondary, fontSize: 13, marginTop: 6, fontFamily: FONT.marketing }}>per venue · billed monthly · cancel anytime</div>
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

        <div style={{ textAlign: 'center', marginTop: 40, color: BRAND.textSecondary, fontSize: 13, fontFamily: FONT.marketing }}>
          Multi-location or enterprise? <a href="mailto:hello@pour-sona.com" style={{ color: BRAND.copperAmber, textDecoration: 'none', fontWeight: 600 }}>Contact us →</a>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT.ui }}>FAQ</div>
          <h2 style={{ fontFamily: FONT.brand, fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-.01em' }}>Common questions</h2>
        </div>
        {FAQ.map(item => (
          <div key={item.q} style={s.faqItem}>
            <div style={s.faqQ}>{item.q}</div>
            <div style={s.faqA}>{item.a}</div>
          </div>
        ))}
      </section>

      <footer style={{ borderTop: `1px solid rgba(${BRAND_RGB.plum},.12)`, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 26, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, color: BRAND.textPrimary, fontWeight: 700, fontSize: 14 }}>Poursona</span>
        </Link>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Home</Link>
          <Link href="/admin/login" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Vendor Login</Link>
          <Link href="/privacy" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Privacy</Link>
          <Link href="/terms" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Terms</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Contact</a>
        </div>
        <div style={{ color: BRAND.textMuted, fontSize: 12, fontFamily: FONT.ui }}>© 2026 Poursona</div>
      </footer>
    </div>
  )
}
