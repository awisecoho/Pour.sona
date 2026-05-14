import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Poursona — Your AI-Powered Guest Guide',
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

export default function HomePage() {
  return (
    <div style={{ background: '#060403', minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#F5ECD7' }}>

      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
        <div style={{ color: '#C9A84C', fontSize: 18, fontWeight: 700, letterSpacing: '.05em' }}>✦ Poursona</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#how-it-works" style={{ color: '#4a3a1a', fontSize: 13, textDecoration: 'none' }}>How it works</a>
          <Link href="/admin/login" style={{ color: '#C9A84C', fontSize: 13, textDecoration: 'none' }}>Vendor login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '100px 40px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '5px 16px', background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 20, color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 28 }}>
          AI-Powered Guest Discovery
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 24px', color: '#F5ECD7' }}>
          Every guest finds<br />
          <span style={{ color: '#C9A84C' }}>their perfect pour.</span>
        </h1>
        <p style={{ fontSize: 18, color: '#4a3a1a', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
          Replace the overwhelm of a 30-item menu with a 2-minute AI conversation. Guests scan, chat, and order — confident in their choice.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/signup"
            style={{ padding: '16px 32px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}
          >
            Get Early Access →
          </a>
          <a
            href="#how-it-works"
            style={{ padding: '16px 32px', background: 'transparent', border: '1px solid rgba(201,168,76,.25)', borderRadius: 10, color: '#C9A84C', fontSize: 15, textDecoration: 'none' }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Social proof strip */}
      <section style={{ borderTop: '1px solid rgba(201,168,76,.08)', borderBottom: '1px solid rgba(201,168,76,.08)', padding: '20px 40px', textAlign: 'center' }}>
        <p style={{ color: '#4a3a1a', fontSize: 13, margin: 0, letterSpacing: '.05em' }}>
          Built for breweries · wineries · distilleries · coffee roasters
        </p>
      </section>

      {/* Verticals */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>Who it's for</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Built for every type of beverage venue</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {VERTICALS.map(v => (
            <div key={v.label} style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 14, padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{v.icon}</div>
              <div style={{ color: '#F5ECD7', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{v.label}</div>
              <div style={{ color: '#4a3a1a', fontSize: 13, lineHeight: 1.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 860, margin: '0 auto', padding: '0 40px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>From scan to recommendation in under 2 minutes</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {HOW.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 32, alignItems: 'flex-start', padding: '32px', background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 12 }}>
              <div style={{ color: '#C9A84C', fontSize: 28, fontWeight: 700, opacity: .4, flexShrink: 0, width: 40 }}>{step.n}</div>
              <div>
                <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{step.title}</div>
                <div style={{ color: '#4a3a1a', fontSize: 14, lineHeight: 1.7 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature callouts */}
      <section style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', borderTop: '1px solid rgba(201,168,76,.1)', borderBottom: '1px solid rgba(201,168,76,.1)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Everything a venue needs</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>
            {[
              { icon: '🤖', title: 'AI catalog extraction', body: 'Paste your website URL. We read your menu, extract products, brand colors, and story automatically.' },
              { icon: '📊', title: 'Analytics dashboard', body: 'See scan counts, recommendation conversions, and top-selling items in real time.' },
              { icon: '📱', title: 'QR-native experience', body: 'No app download. No friction. One scan and guests are in.' },
              { icon: '🎨', title: 'Fully branded', body: 'Your colors, your logo, your voice. Guests never feel like they've left your venue.' },
              { icon: '🛒', title: 'Order flow built in', body: 'Recommendations connect directly to orders. The AI closes the loop.' },
              { icon: '✏️', title: 'Easy catalog management', body: 'Toggle items in and out of stock, add new products, manage tasting flights.' },
            ].map(f => (
              <div key={f.title} style={{ padding: '24px', border: '1px solid rgba(201,168,76,.1)', borderRadius: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ color: '#F5ECD7', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
                <div style={{ color: '#4a3a1a', fontSize: 13, lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '100px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, margin: '0 0 20px', lineHeight: 1.2 }}>
          Ready to guide every guest<br />to their perfect pour?
        </h2>
        <p style={{ color: '#4a3a1a', fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
          Paste your venue website and we'll extract your menu, branding, and story automatically — live in minutes.
        </p>
        <a
          href="/signup"
          style={{ display: 'inline-block', padding: '18px 40px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}
        >
          Get Early Access →
        </a>
        <div style={{ marginTop: 20, color: '#3a2a0a', fontSize: 12 }}>14-day free trial · No credit card required</div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(201,168,76,.08)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ color: '#C9A84C', fontWeight: 700 }}>✦ Poursona</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/admin/login" style={{ color: '#3a2a0a', fontSize: 12, textDecoration: 'none' }}>Vendor Login</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: '#3a2a0a', fontSize: 12, textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ color: '#3a2a0a', fontSize: 12 }}>© 2026 Poursona</div>
      </footer>

    </div>
  )
}
