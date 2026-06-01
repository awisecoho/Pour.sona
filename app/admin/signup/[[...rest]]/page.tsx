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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0A0E15,#0F1B26)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
          <div style={{ color: '#3FC6D4', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase' }}><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></div>
          <div style={{ color: '#E8EDF2', fontSize: 22, fontWeight: 700, marginTop: 4 }}>Create Your Account</div>
          {initialEmail && (
            <div style={{ color: '#8A95A5', fontSize: 12, marginTop: 14, fontStyle: 'italic' }}>
              Setting up access for <strong style={{ color: '#3FC6D4', fontStyle: 'normal' }}>{initialEmail}</strong>
            </div>
          )}
        </div>
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 16, padding: '28px 24px' }}>
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
            <div style={{ color: '#E8EDF2', fontSize: 14, lineHeight: 1.6 }}>
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
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0A0E15' }} />}>
      <AdminSignUpInner />
    </Suspense>
  )
}
