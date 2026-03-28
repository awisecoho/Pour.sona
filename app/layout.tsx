// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Poursona — Guided Discovery',
  description: 'Your personal coffee, beer, and wine guide',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0806' }}>
        {children}
      </body>
    </html>
  )
}
