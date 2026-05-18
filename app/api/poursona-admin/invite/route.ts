import { NextRequest, NextResponse } from 'next/server'
import { grantRetailerAccessByEmail } from '@/lib/auth'
import { sendVendorInvite } from '@/lib/email'
import { adminUrl } from '@/lib/urls'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { retailerId, email, name, retailerName } = await req.json()
    if (!retailerId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await grantRetailerAccessByEmail(retailerId, email, 'owner')

    // Await so the caller learns whether the invite landed.
    // Access is already granted — email failure is non-fatal but must be visible.
    const inviteResult = await sendVendorInvite({
      to: email, name: name || null, retailerName: retailerName || 'your venue', adminUrl: adminUrl(),
    })
    if (!inviteResult.ok) {
      console.error('[poursona-admin/invite] sendVendorInvite failed:', inviteResult.error)
    }

    return NextResponse.json({ ok: true, inviteEmailSent: inviteResult.ok })
  } catch (err) {
    return apiError(err, 'Invite failed')
  }
}
