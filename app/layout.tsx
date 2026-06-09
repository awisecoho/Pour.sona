// app/layout.tsx
import type { Metadata } from 'next'
import { Sora, Inter, Outfit } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { cssVars } from '@/lib/theme'

// Poursona v2 typography — loaded via next/font/google for optimal performance
// (self-hosted, preloaded, no FOUT). Each exposes a CSS variable consumed by
// inline styles and lib/brand.ts FONT tokens.
//   - Sora: brand headlines, big numbers, marketing hero
//   - Inter: admin UI body, forms, tables, dashboards
//   - Outfit: marketing site body, long-form copy
// Per-vendor brand_font_family on /r/[slug] continues to win on guest pages.
const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://pour-sona.com'),
  title: {
    default: 'Poursona — Guided Beverage Discovery',
    template: '%s · Poursona',
  },
  description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
  applicationName: 'Poursona',
  openGraph: {
    title: 'Poursona — Guided Beverage Discovery',
    description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
    siteName: 'Poursona',
    type: 'website',
    // Image auto-added from app/opengraph-image.* once dropped in public/
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Poursona — Guided Beverage Discovery',
    description: 'AI-guided beverage discovery for breweries, wineries, distilleries, and coffee shops.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hasClerkEnv =
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY)

  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${outfit.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      </head>
      <body style={{ margin: 0, padding: 0, background: 'var(--slate)', fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
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
