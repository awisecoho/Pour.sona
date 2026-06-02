'use client'

import { useClerk } from '@clerk/nextjs'
import { useEffect } from 'react'

// The embedded <SignUp> component redirects to sign-in on this Clerk instance
// (confirmed across path/hash routing). Clerk's HOSTED sign-up works, so we send
// vendors there via redirectToSignUp with a forced return to /admin — which lets
// the pending demo-draft claim run after the account is created.
export default function AdminSignUpRedirect() {
  const clerk = useClerk()

  useEffect(() => {
    if (!clerk?.loaded) return
    clerk.redirectToSignUp({
      signUpForceRedirectUrl: '/admin',
      signUpFallbackRedirectUrl: '/admin',
    })
  }, [clerk, clerk?.loaded])

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A95A5', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 28, color: '#3FC6D4' }}>✦</div>
        <div>Taking you to sign-up…</div>
      </div>
    </div>
  )
}
