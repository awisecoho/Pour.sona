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
    sendVendorInvite({ to: email, name: name || null, retailerName: retailerName || 'your venue', adminUrl: adminUrl() }).then(r => {
      if (!r.ok) console.error('[poursona-admin/invite] sendVendorInvite failed:', r.error)
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 'Invite failed')
  }
}
