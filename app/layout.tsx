// app/layout.tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { cssVars } from '@/lib/theme'

export const metadata: Metadata = {
  metadataBase: new URL('https://pour-sona.com'),
  title: {
    default: 'CuvAi — Guided Beverage Discovery',
    template: '%s · CuvAi',
  },
  description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
  applicationName: 'CuvAi',
  openGraph: {
    title: 'CuvAi — Guided Beverage Discovery',
    description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
    siteName: 'CuvAi',
    type: 'website',
    // Image auto-added from app/opengraph-image.jpg
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CuvAi — Guided Beverage Discovery',
    description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
    // Image auto-added from app/twitter-image.jpg
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasClerkEnv =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY)

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'var(--black-soft)', fontFamily: "'Space Grotesk', sans-serif" }}>
        {hasClerkEnv ? (
          // Bare provider: lets Clerk resolve sign-up to its working hosted
          // Account Portal (the embedded <SignUp> redirects on this instance).
          // /admin/signup calls redirectToSignUp({forceRedirect:/admin}) to send
          // vendors to the hosted form and bring them back to claim their draft.
          <ClerkProvider>{children}</ClerkProvider>
        ) : children}
      </body>
    </html>
  )
}
