import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const format = searchParams.get('format') || 'png' // png | svg
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: retailer } = await supabase.from('retailers').select('name, brand_color, logo_url, slug').eq('slug', slug).single()
  if (!retailer) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const url = `https://pour-sona.vercel.app/r/${slug}`
  const brandColor = retailer.brand_color || '#C9A84C'

  // Generate QR as data URL with brand color
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: { dark: brandColor, light: '#00000000' },
    errorCorrectionLevel: 'H', // High — needed for logo overlay
  })

  if (format === 'svg') {
    const svgStr = await QRCode.toString(url, {
      type: 'svg',
      width: 400,
      margin: 2,
      color: { dark: brandColor, light: '#00000000' },
      errorCorrectionLevel: 'H',
    })
    return new NextResponse(svgStr, { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="${slug}-qr.svg"` } })
  }

  // For PNG: compose QR + logo using Canvas API if logo exists
  // Since we can't use canvas server-side easily, return the QR data URL info
  // Client-side will compose with logo via canvas
  return NextResponse.json({
    qrDataUrl,
    brandColor,
    logoUrl: retailer.logo_url,
    retailerName: retailer.name,
    slug,
    guideUrl: url,
  })
}