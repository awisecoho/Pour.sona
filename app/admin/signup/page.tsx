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
    <div style={{ minHeight: '100vh', background: '#12111A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A89FB8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ fontSize: 28, color: '#D67A31' }}>✦</div>
        <div>Taking you to sign-up…</div>
      </div>
    </div>
  )
}
