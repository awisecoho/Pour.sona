// app/api/qr/route.ts
// ─── QR Code Generator ────────────────────────────────────────────────────────
// GET /api/qr?slug=ember-oak&format=png
// Returns a QR code image pointing to the retailer's Poursona URL

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(req: NextRequest) {
  const slug   = req.nextUrl.searchParams.get('slug')
  const format = req.nextUrl.searchParams.get('format') || 'svg'

  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://poursona.app'
  const targetUrl = `${appUrl}/r/${slug}`

  try {
    if (format === 'png') {
      // Returns base64 PNG — good for downloading
      const png = await QRCode.toDataURL(targetUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#0a0806', light: '#F5ECD7' },
        errorCorrectionLevel: 'H',
      })
      // Strip data:image/png;base64, prefix and return raw PNG
      const base64 = png.replace('data:image/png;base64,', '')
      const buffer = Buffer.from(base64, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="poursona-qr-${slug}.png"`,
        },
      })
    } else {
      // SVG — good for embedding in pages
      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 2,
        color: { dark: '#C9A84C', light: '#0a0806' },
        errorCorrectionLevel: 'H',
      })
      return new NextResponse(svg, {
        headers: { 'Content-Type': 'image/svg+xml' },
      })
    }
  } catch (err) {
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
