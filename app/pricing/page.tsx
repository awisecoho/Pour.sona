import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'
import { PLAN_TIERS } from '@/lib/billing'

export const metadata: Metadata = {
  title: 'Pricing — Poursona',
  description: 'Simple, transparent pricing for breweries, wineries, distilleries, and coffee shops.',
}

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
    q: 'Can I change plans later?',
    a: 'Anytime. Upgrade or downgrade from your dashboard — billing is prorated automatically through Stripe.',
  },
  {
    q: 'Is there a per-location fee?',
    a: 'Starter and Growth cover a single venue. Pro supports multiple locations. Running a larger group? Contact us about enterprise pricing.',
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
    section: { maxWidth: 1080, margin: '0 auto', padding: '80px 24px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'stretch' },
    price: { fontSize: 52, fontWeight: 800, color: BRAND.textPrimary, lineHeight: 1, fontFamily: FONT.brand },
    per: { color: BRAND.textSecondary, fontSize: 15, marginLeft: 4, alignSelf: 'flex-end', paddingBottom: 8, fontFamily: FONT.ui },
    feature: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: `1px solid rgba(${BRAND_RGB.plum},.1)`, fontSize: 14, color: BRAND.textPrimary, fontFamily: FONT.marketing },
    check: { color: BRAND.discoveryTeal, flexShrink: 0, marginTop: 1, fontWeight: 700 },
    btn: { display: 'block', width: '100%', padding: '15px', background: BRAND.ctaGradient, border: 'none', borderRadius: 10, color: BRAND.darkBg, fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 24, boxShadow: `0 10px 28px rgba(${BRAND_RGB.copperAmber},.28)` },
    btnOutline: { display: 'block', width: '100%', padding: '15px', background: `rgba(${BRAND_RGB.copperAmber},.08)`, border: `1px solid rgba(${BRAND_RGB.copperAmber},.3)`, borderRadius: 10, color: BRAND.copperAmber, fontFamily: FONT.ui, fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 24 },
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
          <h1 style={{ fontFamily: FONT.brand, fontSize: 'clamp(28px,5vw,48px)', fontWeight: 800, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-.02em' }}>Pick the plan that fits your venue</h1>
          <p style={{ color: BRAND.textSecondary, fontSize: 16, lineHeight: 1.7, maxWidth: 520, margin: '0 auto', fontFamily: FONT.marketing }}>
            Every plan includes AI guided discovery, unlimited guest sessions, and your branded QR. Start with a 14-day free trial — no credit card required.
          </p>
        </div>

        <div style={s.grid}>
          {PLAN_TIERS.map(tier => (
            <div
              key={tier.id}
              style={{
                background: CARD_BG,
                border: tier.popular ? `1px solid rgba(${BRAND_RGB.copperAmber},.5)` : `1px solid rgba(${BRAND_RGB.plum},.2)`,
                borderRadius: 20,
                padding: '40px 32px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: tier.popular ? `0 16px 48px rgba(${BRAND_RGB.copperAmber},.12)` : 'none',
              }}
            >
              {tier.popular && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: BRAND.ctaGradient, borderRadius: 20, padding: '4px 18px', color: BRAND.darkBg, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: FONT.ui }}>
                  Most popular
                </div>
              )}
              <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14, fontFamily: FONT.ui }}>{tier.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={s.price}>${tier.price}</span>
                <span style={s.per}>/month</span>
              </div>
              <div style={{ color: BRAND.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 1.5, minHeight: 38, fontFamily: FONT.marketing }}>{tier.description}</div>

              <div style={{ margin: '24px 0 8px' }}>
                {tier.features.map(f => (
                  <div key={f} style={s.feature}>
                    <span style={s.check}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1 }} />
              <Link href="/signup" style={tier.popular ? s.btn : s.btnOutline}>Start Free Trial →</Link>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, color: BRAND.textMuted, fontSize: 12, fontFamily: FONT.ui }}>
          14-day free trial · No credit card required · Cancel anytime
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, color: BRAND.textSecondary, fontSize: 13, fontFamily: FONT.marketing }}>
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
