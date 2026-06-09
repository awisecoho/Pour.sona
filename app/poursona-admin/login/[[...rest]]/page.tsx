'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'

export default function InternalLogin() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <div style={{
      minHeight: '100vh',
      // Slightly darker / more plum-shifted than the vendor login so the
      // internal team has a subtle visual cue they're on the right portal.
      background: `linear-gradient(160deg, ${BRAND.darkBg} 0%, #181232 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.ui,
    }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: 18, textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 80, width: 'auto', display: 'block' }} />
          </Link>
          <div style={{ color: BRAND.copperAmber, fontSize: 10, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4, fontFamily: FONT.ui, fontWeight: 600 }}>
            Poursona
          </div>
          <div style={{ color: BRAND.textPrimary, fontSize: 20, fontWeight: 700, fontFamily: FONT.brand, letterSpacing: '-.01em' }}>
            Internal Portal
          </div>
          <div style={{ color: BRAND.textMuted, fontSize: 12, marginTop: 4, fontFamily: FONT.ui }}>
            Team access only
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,.025)',
          border: `1px solid rgba(${BRAND_RGB.plum},.22)`,
          borderRadius: 16, padding: '28px 24px',
          boxShadow: `0 16px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(${BRAND_RGB.copperAmber},.04)`,
        }}>
          {hasClerkEnv ? (
            <SignIn
              path="/poursona-admin/login"
              routing="path"
              forceRedirectUrl="/poursona-admin"
              fallbackRedirectUrl="/poursona-admin"
            />
          ) : (
            <div style={{ color: BRAND.textPrimary, fontSize: 14, lineHeight: 1.6, fontFamily: FONT.marketing }}>
              Internal authentication is temporarily unavailable. Add
              {' '}<code style={{ color: BRAND.copperAmber }}>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and
              {' '}<code style={{ color: BRAND.copperAmber }}>CLERK_SECRET_KEY</code>
              {' '}in Vercel to restore sign-in.
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link href="/" style={{ color: BRAND.textMuted, fontSize: 12, textDecoration: 'none', fontFamily: FONT.ui }}>
            ← Back to poursona.com
          </Link>
        </div>
      </div>
    </div>
  )
}
