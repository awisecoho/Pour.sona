import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Privacy Policy — Poursona',
  description: 'How Poursona handles data for venues and their guests.',
}

const EFFECTIVE = 'May 20, 2026'

const SECTIONS: Array<{ h: string; body: string[] }> = [
  {
    h: '1. Overview',
    body: [
      'Poursona provides an AI-powered guest recommendation experience for beverage venues (breweries, wineries, distilleries, and coffee shops). This policy explains what we collect and how we use it. We have designed the guest experience to be anonymous by default.',
    ],
  },
  {
    h: '2. Guest data (people who scan a venue QR code)',
    body: [
      'Guests do not create an account and are not asked to identify themselves to use the recommendation chat. We process the messages exchanged during a session and the recommendation generated in order to provide the experience.',
      'If a guest chooses to place an order and voluntarily enters a name or email to receive a confirmation, we use that information only to send the order confirmation and to let the venue prepare and fulfill the order. We do not sell guest data or use it for advertising.',
      'Like most web services, our infrastructure providers may incidentally log technical data such as IP address and device/browser type for security and reliability. We do not use this to build guest profiles.',
    ],
  },
  {
    h: '3. Venue (customer) data',
    body: [
      'When a venue signs up, we collect business details (such as venue name, website, owner email) and information extracted from the venue’s public website (menu, branding, story) to configure the guide. We process billing through Stripe; we do not store full card numbers.',
    ],
  },
  {
    h: '4. How we use data',
    body: [
      'To generate guest recommendations, operate and secure the service, process orders and payments, provide analytics to the venue, and communicate with venue account holders about their account.',
    ],
  },
  {
    h: '5. Sharing',
    body: [
      'We share data with service providers that help us run Poursona — including Anthropic (AI model), Stripe (payments), Resend (email), and our hosting/database providers — only as needed to deliver the service. We do not sell personal information.',
    ],
  },
  {
    h: '6. Retention',
    body: [
      'Session and order data are retained to provide venue analytics and order history. A venue may request deletion of its account data by contacting us. Because the guest experience is anonymous, we generally hold no information that identifies an individual guest unless they voluntarily provided an email for an order.',
    ],
  },
  {
    h: '7. Your choices',
    body: [
      'Guests can use the experience without providing any personal information. If you provided an email for an order receipt and want it removed, contact us and we will delete it. Venues can update or delete their account data by contacting us.',
    ],
  },
  {
    h: '8. Contact',
    body: [
      'Questions about this policy? Email hello@pour-sona.com.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ background: BRAND.darkBg, minHeight: '100vh', fontFamily: FONT.marketing, color: BRAND.textPrimary }}>
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid rgba(${BRAND_RGB.plum},.15)` }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 36, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, fontSize: 18, fontWeight: 700, letterSpacing: '.02em', color: BRAND.textPrimary }}>Poursona</span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ color: BRAND.textSecondary, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui }}>Home</Link>
          <Link href="/pricing" style={{ color: BRAND.textSecondary, fontSize: 13, textDecoration: 'none', fontFamily: FONT.ui }}>Pricing</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 100px' }}>
        <h1 style={{ fontFamily: FONT.brand, fontSize: 'clamp(28px,5vw,40px)', fontWeight: 800, margin: '0 0 8px', letterSpacing: '-.02em' }}>Privacy Policy</h1>
        <div style={{ color: BRAND.textMuted, fontSize: 13, marginBottom: 40, fontFamily: FONT.ui }}>Effective {EFFECTIVE}</div>

        {SECTIONS.map(s => (
          <section key={s.h} style={{ marginBottom: 28 }}>
            <h2 style={{ color: BRAND.copperAmber, fontSize: 18, fontWeight: 700, margin: '0 0 10px', fontFamily: FONT.brand }}>{s.h}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ color: BRAND.textPrimary, fontSize: 15, lineHeight: 1.75, margin: '0 0 12px', fontFamily: FONT.marketing }}>{p}</p>
            ))}
          </section>
        ))}

        <p style={{ color: BRAND.textFaint, fontSize: 12, lineHeight: 1.7, marginTop: 40, borderTop: `1px solid rgba(${BRAND_RGB.plum},.15)`, paddingTop: 20, fontFamily: FONT.ui }}>
          This page is provided for transparency and is not legal advice. Poursona will update this policy as the product evolves.
        </p>
      </main>

      <footer style={{ borderTop: `1px solid rgba(${BRAND_RGB.plum},.12)`, padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 26, width: 'auto', display: 'block' }} />
          <span style={{ fontFamily: FONT.brand, color: BRAND.textPrimary, fontWeight: 700, fontSize: 14 }}>Poursona</span>
        </Link>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/pricing" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Pricing</Link>
          <Link href="/terms" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Terms</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>Contact</a>
        </div>
        <div style={{ color: BRAND.textMuted, fontSize: 12, fontFamily: FONT.ui }}>© 2026 Poursona</div>
      </footer>
    </div>
  )
}
