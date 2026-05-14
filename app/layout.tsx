// app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { cssVars } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'Poursona — Guided Discovery',
  description: 'Your personal coffee, beer, and wine guide',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasClerkEnv =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY)

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'var(--black-soft)' }}>
        {hasClerkEnv ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  )
}
