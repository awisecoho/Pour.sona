import { NextRequest, NextResponse } from 'next/server'
import { grantRetailerAccessByEmail } from '@/lib/auth'
import { sendVendorInvite } from '@/lib/email'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { retailerId, email, name, retailerName } = await req.json()
    if (!retailerId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    await grantRetailerAccessByEmail(retailerId, email, 'owner')

    const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin`
    sendVendorInvite({ to: email, name: name || null, retailerName: retailerName || 'your venue', adminUrl })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
