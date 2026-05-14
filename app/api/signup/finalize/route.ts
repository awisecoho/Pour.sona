import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { sendVendorInvite } from '@/lib/email'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { success } = await onboardLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { draftId, email, name } = await req.json()
    if (!draftId || !email) {
      return NextResponse.json({ error: 'Missing draftId or email' }, { status: 400 })
    }

    const retailer = await publishDraft(draftId, email.toLowerCase().trim())

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin`
    sendVendorInvite({ to: email, name: name || null, retailerName: retailer.name, adminUrl })

    return NextResponse.json({ ok: true, retailer })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create your account.' }, { status: 500 })
  }
}
