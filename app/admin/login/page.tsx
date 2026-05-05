'use client'

import { SignIn } from '@clerk/nextjs'

export default function AdminLogin() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>âœ¦</div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase' }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginTop: 4 }}>Admin Portal</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 16, padding: '28px 24px' }}>
          {hasClerkEnv ? (
            <SignIn
              path="/admin/login"
              routing="path"
              forceRedirectUrl="/admin"
              fallbackRedirectUrl="/admin"
            />
          ) : (
            <div style={{ color: '#F5ECD7', fontSize: 14, lineHeight: 1.6 }}>
              Admin authentication is temporarily unavailable. Add
              {' '}`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
              {' '}in Vercel to restore sign-in.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
