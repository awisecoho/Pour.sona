import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

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

    const url = `https://pour-sona.vercel.app/r/${slug}`
    const brandColor = retailer.brand_color || '#C9A84C'

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: brandColor, light: '#00000000' },
      errorCorrectionLevel: 'H',
    })

    if (format === 'svg') {
      const svgStr = await QRCode.toString(url, {
        type: 'svg',
        width: 400,
        margin: 2,
        color: { dark: brandColor, light: '#00000000' },
        errorCorrectionLevel: 'H',
      })

      return new NextResponse(svgStr, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Content-Disposition': `attachment; filename="${slug}-qr.svg"`,
        },
      })
    }

    return NextResponse.json({
      qrDataUrl,
      brandColor,
      logoUrl: retailer.logo_url,
      retailerName: retailer.name,
      slug,
      guideUrl: url,
    })
  } catch (error) {
    console.error('[api/qr] get failed:', error)
    return NextResponse.json({ error: 'qr generation failed' }, { status: 500 })
  }
}
