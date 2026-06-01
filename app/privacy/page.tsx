import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — CuvAi',
  description: 'How CuvAi handles data for venues and their guests.',
}

const EFFECTIVE = 'May 20, 2026'

const SECTIONS: Array<{ h: string; body: string[] }> = [
  {
    h: '1. Overview',
    body: [
      'CuvAi provides an AI-powered guest recommendation experience for beverage venues (breweries, wineries, distilleries, and coffee shops). This policy explains what we collect and how we use it. We have designed the guest experience to be anonymous by default.',
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
      'We share data with service providers that help us run CuvAi — including Anthropic (AI model), Stripe (payments), Resend (email), and our hosting/database providers — only as needed to deliver the service. We do not sell personal information.',
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
    <div style={{ background: '#0C1018', minHeight: '100vh', fontFamily: "'Space Grotesk', sans-serif", color: '#E8EDF2' }}>
      <nav style={{ padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(63,198,212,.1)' }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.05em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ color: '#3FC6D4' }}>✦</span><span><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></span></Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/" style={{ color: '#3A4456', fontSize: 13, textDecoration: 'none' }}>Home</Link>
          <Link href="/pricing" style={{ color: '#3A4456', fontSize: 13, textDecoration: 'none' }}>Pricing</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 100px' }}>
        <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', fontWeight: 700, margin: '0 0 8px' }}>Privacy Policy</h1>
        <div style={{ color: '#3A4456', fontSize: 13, marginBottom: 40 }}>Effective {EFFECTIVE}</div>

        {SECTIONS.map(s => (
          <section key={s.h} style={{ marginBottom: 28 }}>
            <h2 style={{ color: '#3FC6D4', fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{s.h}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ color: '#c8bfa8', fontSize: 15, lineHeight: 1.75, margin: '0 0 12px' }}>{p}</p>
            ))}
          </section>
        ))}

        <p style={{ color: '#2A3242', fontSize: 12, lineHeight: 1.7, marginTop: 40, borderTop: '1px solid rgba(63,198,212,.1)', paddingTop: 20 }}>
          This page is provided for transparency and is not legal advice. CuvAi will update this policy as the product evolves.
        </p>
      </main>

      <footer style={{ borderTop: '1px solid rgba(63,198,212,.08)', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Link href="/" style={{ fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: '#3FC6D4' }}>✦</span><span><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></span></Link>
        <div style={{ display: 'flex', gap: 24 }}>
          <Link href="/pricing" style={{ color: '#2A3242', fontSize: 12, textDecoration: 'none' }}>Pricing</Link>
          <Link href="/terms" style={{ color: '#2A3242', fontSize: 12, textDecoration: 'none' }}>Terms</Link>
          <a href="mailto:hello@pour-sona.com" style={{ color: '#2A3242', fontSize: 12, textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ color: '#2A3242', fontSize: 12 }}>© 2026 CuvAi</div>
      </footer>
    </div>
  )
}
