// app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'

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
      <body style={{ margin: 0, padding: 0, background: '#0a0806' }}>
        {hasClerkEnv ? <ClerkProvider>{children}</ClerkProvider> : children}
      </body>
    </html>
  )
}
