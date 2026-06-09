'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { BRAND, BRAND_RGB, FONT } from '@/lib/brand'

function AdminLoginInner() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  // Pre-fill the email field when arriving from /signup → "Go to Dashboard".
  // Otherwise the vendor sees a blank Clerk form right after just typing their
  // address one step earlier. Sanitised + bounded so a malicious ?email= can't
  // inject anything weird into the form.
  const searchParams = useSearchParams()
  const emailParam = searchParams?.get('email')?.trim().slice(0, 254) || ''
  const initialEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam) ? emailParam : ''

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(160deg, ${BRAND.darkBg} 0%, #1A1530 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT.ui,
    }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: 18, textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-source.png" alt="Poursona" style={{ height: 88, width: 'auto', display: 'block' }} />
          </Link>
          <div style={{ color: BRAND.copperAmber, fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase', fontFamily: FONT.ui, fontWeight: 600 }}>
            Poursona
          </div>
          <div style={{ color: BRAND.textPrimary, fontSize: 22, fontWeight: 700, marginTop: 6, fontFamily: FONT.brand, letterSpacing: '-.01em' }}>
            Vendor Portal
          </div>
          {initialEmail && (
            <div style={{ color: BRAND.textSecondary, fontSize: 12, marginTop: 14, fontStyle: 'italic', fontFamily: FONT.marketing }}>
              Signing in as <strong style={{ color: BRAND.copperAmber, fontStyle: 'normal' }}>{initialEmail}</strong>
            </div>
          )}
        </div>
        <div style={{
          background: 'rgba(255,255,255,.025)',
          border: `1px solid rgba(${BRAND_RGB.plum},.22)`,
          borderRadius: 16, padding: '28px 24px',
          boxShadow: `0 16px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(${BRAND_RGB.copperAmber},.04)`,
        }}>
          {hasClerkEnv ? (
            <SignIn
              path="/admin/login"
              routing="path"
              signUpUrl="/admin/signup"
              forceRedirectUrl="/admin"
              fallbackRedirectUrl="/admin"
              signUpForceRedirectUrl="/admin"
              initialValues={initialEmail ? { emailAddress: initialEmail } : undefined}
            />
          ) : (
            <div style={{ color: BRAND.textPrimary, fontSize: 14, lineHeight: 1.6, fontFamily: FONT.marketing }}>
              Admin authentication is temporarily unavailable. Add
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

// useSearchParams requires a Suspense boundary in Next 14 app router.
export default function AdminLogin() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: BRAND.darkBg }} />}>
      <AdminLoginInner />
    </Suspense>
  )
}
