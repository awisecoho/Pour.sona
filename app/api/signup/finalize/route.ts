import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { sendVendorInvite } from '@/lib/email'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
import { adminUrl } from '@/lib/urls'
import { apiError } from '@/lib/api'
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

    // Await the invite so we can report delivery status to the caller.
    // Retailer is already created — email failure is non-fatal but logged and surfaced.
    const inviteResult = await sendVendorInvite({
      to: email, name: name || null, retailerName: retailer.name, adminUrl: adminUrl(),
    })
    if (!inviteResult.ok) {
      console.error('[signup/finalize] sendVendorInvite failed:', inviteResult.error)
    }

    return NextResponse.json({ ok: true, retailer, inviteEmailSent: inviteResult.ok })
  } catch (err) {
    return apiError(err, 'Account creation failed')
  }
}
