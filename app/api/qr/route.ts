import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { dbQuery } from '@/lib/db'
import { storefrontUrl } from '@/lib/urls'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { apiError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')
    const format = searchParams.get('format') || 'png'

    if (!slug) {
      return NextResponse.json({ error: 'slug required' }, { status: 400 })
    }

    const identity = await getAuthenticatedIdentity()
    if (!identity) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const retailerResult = await dbQuery<{
      id: string
      name: string
      brand_color: string | null
      logo_url: string | null
      slug: string
    }>('select id, name, brand_color, logo_url, slug from retailers where slug = $1 limit 1', [slug])

    const retailer = retailerResult.rows[0]
    if (!retailer) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    if (!accessRows.some((row) => row.retailer_id === retailer.id)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const url = storefrontUrl(slug)
    const brandColor = retailer.brand_color || '#C9A84C'

    if (format === 'svg') {
      const svgStr = await QRCode.toString(url, {
        type: 'svg',
        width: 400,
        margin: 2,
        color: { dark: brandColor, light: '#ffffff' },
        errorCorrectionLevel: 'H',
      })
      return new NextResponse(svgStr, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${slug}-qr.svg"`,
        },
      })
    }

    // Generate QR as PNG buffer (errorCorrectionLevel H leaves room for logo)
    const SIZE = 600
    const qrBuffer = await QRCode.toBuffer(url, {
      width: SIZE,
      margin: 2,
      color: { dark: brandColor, light: '#ffffff' },
      errorCorrectionLevel: 'H',
    })

    let finalBuffer: Buffer

    if (retailer.logo_url) {
      try {
        const logoResp = await fetch(retailer.logo_url, { signal: AbortSignal.timeout(5000) })
        if (logoResp.ok) {
          const logoArrayBuffer = await logoResp.arrayBuffer()
          const logoInput = Buffer.from(logoArrayBuffer)

          // Logo takes up ~22% of QR width, centered
          const logoSize = Math.round(SIZE * 0.22)
          const pad = Math.round(logoSize * 0.18)
          const circleDiam = logoSize + pad * 2

          // Resize logo, add white circle background, composite onto QR
          const logoResized = await sharp(logoInput)
            .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer()

          const circleOverlay = Buffer.from(
            `<svg width="${circleDiam}" height="${circleDiam}">
               <circle cx="${circleDiam / 2}" cy="${circleDiam / 2}" r="${circleDiam / 2}" fill="white"/>
             </svg>`
          )

          const offset = Math.round((SIZE - circleDiam) / 2)

          finalBuffer = await sharp(qrBuffer)
            .composite([
              { input: circleOverlay, top: offset, left: offset },
              { input: logoResized, top: offset + pad, left: offset + pad },
            ])
            .png()
            .toBuffer()
        } else {
          finalBuffer = qrBuffer
        }
      } catch {
        // Logo fetch failed — return QR without logo rather than erroring
        finalBuffer = qrBuffer
      }
    } else {
      finalBuffer = qrBuffer
    }

    return new NextResponse(finalBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${slug}-qr.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return apiError(err, 'qr generation failed')
  }
}
