import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'

export const metadata: Metadata = {
  title: { absolute: 'Poursona — Your AI-Powered Guest Guide' },
  description: 'Turn every QR scan into a personalized recommendation. AI-guided discovery for breweries, wineries, distilleries, and coffee shops.',
}

const VERTICALS = [
  { icon: '🍺', label: 'Breweries', desc: 'Guide guests to their perfect pint' },
  { icon: '🍷', label: 'Wineries', desc: 'Match guests to the right varietal' },
  { icon: '🥃', label: 'Distilleries', desc: 'Navigate expressions and cocktails' },
  { icon: '☕', label: 'Coffee Shops', desc: 'From origin to roast profile' },
]

const HOW = [
  { n: '01', title: 'Guest scans QR', body: 'A branded QR code on your menu or table drops them into a tailored chat experience — no app, no signup.' },
  { n: '02', title: 'AI asks the right questions', body: 'Two or three natural questions about mood and preference. The AI reads your full catalog and brand story behind the scenes.' },
  { n: '03', title: 'Perfect recommendation, every time', body: 'The guest gets a specific pick with tasting notes and the story behind it. One tap to order.' },
]

// Card surfaces — derived from the v2 darkBg with subtle gradient depth.
const CARD_BG = 'linear-gradient(145deg,#1C1A2A,#161423)'

export default function HomePage() {
  return (
    <div style={{ background: BRAND.darkBg, minHeight: '100vh', fontFamily: FONT.marketing, color: BRAND.textPrimary }}>

      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${BRAND_RGB.plum},.15)` }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 38, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, fontSize: 19, fontWeight: 700, letterSpacing: '.02em', color: BRAND.textPrimary }}>
            Poursona
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#how-it-works" style={{ color: BRAND.textSecondary, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui }}>How it works</a>
          <Link href="/pricing" style={{ color: BRAND.textSecondary, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui }}>Pricing</Link>
          <Link href="/admin/login" style={{ color: BRAND.copperAmber, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui, fontWeight: 600 }}>Vendor login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '80px 40px 80px', textAlign: 'center' }}>
        {/* Logo mark — featured as the brand moment */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-source.png"
          alt="Poursona — Guided Beverage Discovery"
          style={{ height: 160, width: 'auto', display: 'block', margin: '0 auto 28px' }}
        />
        <div style={{ display: 'inline-block', padding: '5px 16px', background: `rgba(${BRAND_RGB.copperAmber},.12)`, border: `1px solid rgba(${BRAND_RGB.copperAmber},.28)`, borderRadius: 20, color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 28, fontFamily: FONT.ui }}>
          AI-Powered Guest Discovery
        </div>
        <h1 style={{ fontFamily: FONT.brand, fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px', color: BRAND.textPrimary, letterSpacing: '-.02em' }}>
          Every guest finds<br />
          <span style={{ background: `linear-gradient(115deg, ${BRAND.copperAmber} 0%, ${BRAND.cabernetMagenta} 55%, ${BRAND.plum} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
            their perfect pour.
          </span>
        </h1>
        <p style={{ fontSize: 18, color: BRAND.textSecondary, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px', fontFamily: FONT.marketing }}>
          Replace the overwhelm of a 30-item menu with a 2-minute AI conversation. Guests scan, chat, and order — confident in their choice.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/signup"
            style={{ padding: '16px 32px', background: BRAND.ctaGradient, borderRadius: 10, color: BRAND.darkBg, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: `0 8px 28px rgba(${BRAND_RGB.copperAmber},.32)`, fontFamily: FONT.ui }}
          >
            Start Free Trial →
          </a>
          <a
            href="#how-it-works"
            style={{ padding: '16px 32px', background: 'transparent', border: `1px solid rgba(${BRAND_RGB.plum},.35)`, borderRadius: 10, color: BRAND.copperAmber, fontSize: 15, textDecoration: 'none', fontFamily: FONT.ui, fontWeight: 600 }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Social proof strip */}
      <section style={{ borderTop: `1px solid rgba(${BRAND_RGB.plum},.12)`, borderBottom: `1px solid rgba(${BRAND_RGB.plum},.12)`, padding: '20px 40px', textAlign: 'center' }}>
        <p style={{ color: BRAND.textSecondary, fontSize: 13, margin: 0, letterSpacing: '.05em', fontFamily: FONT.marketing }}>
          Built for craft breweries — wineries, distilleries &amp; coffee roasters coming soon
        </p>
      </section>

      {/* Verticals */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT.ui }}>Who it&apos;s for</div>
          <h2 style={{ fontFamily: FONT.brand, fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-.01em' }}>Built for every type of beverage venue</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {VERTICALS.map(v => (
            <div key={v.label} style={{ background: CARD_BG, border: `1px solid rgba(${BRAND_RGB.plum},.18)`, borderRadius: 14, padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{v.icon}</div>
              <div style={{ color: BRAND.textPrimary, fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: FONT.brand }}>{v.label}</div>
              <div style={{ color: BRAND.textSecondary, fontSize: 13, lineHeight: 1.6, fontFamily: FONT.marketing }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 860, margin: '0 auto', padding: '0 40px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12, fontFamily: FONT.ui }}>How it works</div>
          <h2 style={{ fontFamily: FONT.brand, fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-.01em' }}>From scan to recommendation in under 2 minutes</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {HOW.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 32, alignItems: 'flex-start', padding: '32px', background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 12 }}>
              <div style={{ color: BRAND.copperAmber, fontSize: 28, fontWeight: 700, opacity: .5, flexShrink: 0, width: 40, fontFamily: FONT.brand }}>{step.n}</div>
              <div>
                <div style={{ color: BRAND.textPrimary, fontSize: 18, fontWeight: 700, marginBottom: 10, fontFamily: FONT.brand }}>{step.title}</div>
                <div style={{ color: BRAND.textSecondary, fontSize: 14, lineHeight: 1.7, fontFamily: FONT.marketing }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature callouts */}
      <section style={{ background: CARD_BG, borderTop: `1px solid rgba(${BRAND_RGB.plum},.15)`, borderBottom: `1px solid rgba(${BRAND_RGB.plum},.15)`, padding: '80px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: FONT.brand, fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-.01em' }}>Everything a venue needs</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {[
              { icon: '🤖', title: 'AI catalog extraction', body: 'Paste your website URL. We read your menu, extract products, brand colors, and story automatically.' },
              { icon: '📊', title: 'Analytics dashboard', body: 'See scan counts, recommendation conversions, and top-selling items in real time.' },
              { icon: '📱', title: 'QR-native experience', body: 'No app download. No friction. One scan and guests are in.' },
              { icon: '🎨', title: 'Fully branded', body: "Your colors, your logo, your voice. Guests never feel like they've left your venue." },
              { icon: '🛒', title: 'Order flow built in', body: 'Recommendations connect directly to orders. The AI closes the loop.' },
              { icon: '✏️', title: 'Easy catalog management', body: 'Toggle items in and out of stock, add new products, manage tasting flights.' },
            ].map(f => (
              <div key={f.title} style={{ padding: '24px', border: `1px solid rgba(${BRAND_RGB.plum},.15)`, borderRadius: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ color: BRAND.textPrimary, fontWeight: 700, fontSize: 15, marginBottom: 8, fontFamily: FONT.brand }}>{f.title}</div>
                <div style={{ color: BRAND.textSecondary, fontSize: 13, lineHeight: 1.6, fontFamily: FONT.marketing }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '100px 40px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: FONT.brand, fontSize: 36, fontWeight: 800, margin: '0 0 20px', lineHeight: 1.15, letterSpacing: '-.02em' }}>
          Ready to guide every guest<br />to their perfect pour?
        </h2>
        <p style={{ color: BRAND.textSecondary, fontSize: 15, lineHeight: 1.7, marginBottom: 36, fontFamily: FONT.marketing }}>
          Paste your venue website and we&apos;ll extract your menu, branding, and story automatically — live in minutes.
        </p>
        <a
          href="/signup"
          style={{ display: 'inline-block', padding: '18px 40px', background: BRAND.ctaGradient, borderRadius: 10, color: BRAND.darkBg, fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: `0 10px 32px rgba(${BRAND_RGB.copperAmber},.34)`, fontFamily: FONT.ui }}
        >
          Start Free Trial →
        </a>
        <div style={{ marginTop: 20, color: BRAND.textMuted, fontSize: 12, fontFamily: FONT.ui }}>14-day free trial · No credit card required</div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid rgba(${BRAND_RGB.plum},.12)`, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 28, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, color: BRAND.textPrimary, fontWeight: 700, fontSize: 15 }}>Poursona</span>
        </Link>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Pricing</Link>
          <Link href="/admin/login" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Vendor Login</Link>
          <Link href="/poursona-admin/login" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Poursona Team</Link>
          <Link href="/privacy" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Privacy</Link>
          <Link href="/terms" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Terms</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Contact</a>
        </div>
        <div style={{ color: BRAND.textMuted, fontSize: 12, fontFamily: FONT.ui }}>© 2026 Poursona</div>
      </footer>

    </div>
  )
}
