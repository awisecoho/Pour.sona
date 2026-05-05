'use client'

import { SignIn } from '@clerk/nextjs'

export default function InternalLogin() {
  const hasClerkEnv = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#060403,#0a0704)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 460, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'Ã¢Â¬Â¡'}</div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 20, fontWeight: 700 }}>Internal Portal</div>
          <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 4 }}>Team access only</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 16, padding: '28px 24px' }}>
          {hasClerkEnv ? (
            <SignIn
              path="/poursona-admin/login"
              routing="path"
              forceRedirectUrl="/poursona-admin"
              fallbackRedirectUrl="/poursona-admin"
            />
          ) : (
            <div style={{ color: '#F5ECD7', fontSize: 14, lineHeight: 1.6 }}>
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
