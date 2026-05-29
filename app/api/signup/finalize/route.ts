import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { sendVendorInvite } from '@/lib/email'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
import { adminUrl } from '@/lib/urls'
import { apiError } from '@/lib/api'
import { grantRetailerAccessByEmail } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { success } = await onboardLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { draftId, email, name, personalEmail } = await req.json()
    if (!draftId || !email) {
      return NextResponse.json({ error: 'Missing draftId or email' }, { status: 400 })
    }

    const businessEmail = email.toLowerCase().trim()
    const retailer = await publishDraft(draftId, businessEmail)

    // If the vendor provided a personal email (e.g. Gmail), grant them access
    // with that address too. Clerk login with either email will then resolve
    // to the correct retailer via the admin_users lookup.
    const altEmail = typeof personalEmail === 'string' ? personalEmail.toLowerCase().trim() : ''
    if (altEmail && altEmail !== businessEmail) {
      try {
        await grantRetailerAccessByEmail(retailer.id, altEmail, 'owner')
      } catch (err) {
        console.warn('[signup/finalize] personal email access grant failed (non-fatal):', err instanceof Error ? err.message : String(err))
      }
    }

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
