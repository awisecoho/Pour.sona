import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'CuvAi — Your AI-Powered Guest Guide' },
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
    <div style={{ background: '#0C1018', minHeight: '100vh', fontFamily: "'Space Grotesk', sans-serif", color: '#E8EDF2' }}>

      {/* Nav */}
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(63,198,212,.1)' }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#3FC6D4' }}>✦</span>
          <span><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></span>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#how-it-works" style={{ color: '#8A95A5', fontSize: 13, textDecoration: 'none' }}>How it works</a>
          <Link href="/pricing" style={{ color: '#8A95A5', fontSize: 13, textDecoration: 'none' }}>Pricing</Link>
          <Link href="/admin/login" style={{ color: '#3FC6D4', fontSize: 13, textDecoration: 'none' }}>Vendor login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '100px 40px 80px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '5px 16px', background: 'rgba(63,198,212,.1)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 20, color: '#3FC6D4', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 28 }}>
          AI-Powered Guest Discovery
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, lineHeight: 1.15, margin: '0 0 24px', color: '#E8EDF2', letterSpacing: '-.02em' }}>
          Every guest finds<br />
          <span style={{ background: 'linear-gradient(115deg,#3FC6D4 0%,#5FD9E6 35%,#B0537E 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>their perfect pour.</span>
        </h1>
        <p style={{ fontSize: 18, color: '#8A95A5', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
          Replace the overwhelm of a 30-item menu with a 2-minute AI conversation. Guests scan, chat, and order — confident in their choice.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/signup"
            style={{ padding: '16px 32px', background: 'linear-gradient(135deg,#3FC6D4 0%,#45B0C8 55%,#B0537E 130%)', borderRadius: 10, color: '#0C1018', fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 8px 28px rgba(63,198,212,.28)' }}
          >
            Start Free Trial →
          </a>
          <a
            href="#how-it-works"
            style={{ padding: '16px 32px', background: 'transparent', border: '1px solid rgba(63,198,212,.25)', borderRadius: 10, color: '#3FC6D4', fontSize: 15, textDecoration: 'none' }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Social proof strip */}
      <section style={{ borderTop: '1px solid rgba(63,198,212,.08)', borderBottom: '1px solid rgba(63,198,212,.08)', padding: '20px 40px', textAlign: 'center' }}>
        <p style={{ color: '#8A95A5', fontSize: 13, margin: 0, letterSpacing: '.05em' }}>
          Built for craft breweries — wineries, distilleries &amp; coffee roasters coming soon
        </p>
      </section>

      {/* Verticals */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ color: '#3FC6D4', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>Who it&apos;s for</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Built for every type of beverage venue</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
          {VERTICALS.map(v => (
            <div key={v.label} style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.12)', borderRadius: 14, padding: '28px 24px' }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{v.icon}</div>
              <div style={{ color: '#E8EDF2', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{v.label}</div>
              <div style={{ color: '#8A95A5', fontSize: 13, lineHeight: 1.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ maxWidth: 860, margin: '0 auto', padding: '0 40px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ color: '#3FC6D4', fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 12 }}>How it works</div>
          <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>From scan to recommendation in under 2 minutes</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {HOW.map((step, i) => (
            <div key={step.n} style={{ display: 'flex', gap: 32, alignItems: 'flex-start', padding: '32px', background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent', borderRadius: 12 }}>
              <div style={{ color: '#3FC6D4', fontSize: 28, fontWeight: 700, opacity: .4, flexShrink: 0, width: 40 }}>{step.n}</div>
              <div>
                <div style={{ color: '#E8EDF2', fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{step.title}</div>
                <div style={{ color: '#8A95A5', fontSize: 14, lineHeight: 1.7 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature callouts */}
      <section style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', borderTop: '1px solid rgba(63,198,212,.1)', borderBottom: '1px solid rgba(63,198,212,.1)', padding: '80px 40px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>Everything a venue needs</h2>
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
              <div key={f.title} style={{ padding: '24px', border: '1px solid rgba(63,198,212,.1)', borderRadius: 12 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ color: '#E8EDF2', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{f.title}</div>
                <div style={{ color: '#8A95A5', fontSize: 13, lineHeight: 1.6 }}>{f.body}</div>
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
        <p style={{ color: '#8A95A5', fontSize: 15, lineHeight: 1.7, marginBottom: 36 }}>
          Paste your venue website and we&apos;ll extract your menu, branding, and story automatically — live in minutes.
        </p>
        <a
          href="/signup"
          style={{ display: 'inline-block', padding: '18px 40px', background: 'linear-gradient(135deg,#3FC6D4 0%,#45B0C8 55%,#B0537E 130%)', borderRadius: 10, color: '#0C1018', fontWeight: 700, fontSize: 16, textDecoration: 'none', boxShadow: '0 10px 32px rgba(63,198,212,.3)' }}
        >
          Start Free Trial →
        </a>
        <div style={{ marginTop: 20, color: '#6B7588', fontSize: 12 }}>14-day free trial · No credit card required</div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(63,198,212,.08)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: '#3FC6D4' }}>✦</span>
          <span><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>Pricing</Link>
          <Link href="/admin/login" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>Vendor Login</Link>
          <Link href="/poursona-admin/login" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>CuvAi Team</Link>
          <Link href="/privacy" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>Terms</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: '#6B7588', fontSize: 12, textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ color: '#6B7588', fontSize: 12 }}>© 2026 CuvAi</div>
      </footer>

    </div>
  )
}
