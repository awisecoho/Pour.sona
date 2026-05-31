'use client'

import { SignUp } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AdminSignUpInner() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  const searchParams = useSearchParams()
  const emailParam = searchParams?.get('email')?.trim().slice(0, 254) || ''
  const initialEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam) ? emailParam : ''

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase' }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginTop: 4 }}>Create Your Account</div>
          {initialEmail && (
            <div style={{ color: '#9a8a64', fontSize: 12, marginTop: 14, fontStyle: 'italic' }}>
              Setting up access for <strong style={{ color: '#C9A84C', fontStyle: 'normal' }}>{initialEmail}</strong>
            </div>
          )}
        </div>
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 16, padding: '28px 24px' }}>
          {hasClerkEnv ? (
            <SignUp
              path="/admin/signup"
              routing="path"
              signInUrl="/admin/login"
              forceRedirectUrl="/admin"
              fallbackRedirectUrl="/admin"
              initialValues={initialEmail ? { emailAddress: initialEmail } : undefined}
            />
          ) : (
            <div style={{ color: '#F5ECD7', fontSize: 14, lineHeight: 1.6 }}>
              Admin authentication is temporarily unavailable.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminSignUp() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0603' }} />}>
      <AdminSignUpInner />
    </Suspense>
  )
}
