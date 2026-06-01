'use client'

import { SignIn } from '@clerk/nextjs'

export default function InternalLogin() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0C1018,#0a0704)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'⬡'}</div>
          <div style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4 }}><span style={{ color: '#E8EDF2' }}>Cuv</span><span style={{ color: '#3FC6D4' }}>Ai</span></div>
          <div style={{ color: '#E8EDF2', fontSize: 20, fontWeight: 700 }}>Internal Portal</div>
          <div style={{ color: '#3A4456', fontSize: 12, marginTop: 4 }}>Team access only</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(63,198,212,.12)', borderRadius: 16, padding: '28px 24px' }}>
          {hasClerkEnv ? (
            <SignIn
              path="/poursona-admin/login"
              routing="path"
              forceRedirectUrl="/poursona-admin"
              fallbackRedirectUrl="/poursona-admin"
            />
          ) : (
            <div style={{ color: '#E8EDF2', fontSize: 14, lineHeight: 1.6 }}>
              Internal authentication is temporarily unavailable. Add
              {' '}`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
              {' '}in Vercel to restore sign-in.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
