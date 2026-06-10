import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
import { APP_ORIGIN } from '@/lib/urls'
import { getStripe } from '@/lib/stripe'
export const dynamic = 'force-dynamic'

const stripe = getStripe()

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { retailerId } = await req.json()
    const access = await getRetailersForIdentity(identity.userId, identity.email)
    const hasAccess = access.some((r: any) => r.retailer_id === retailerId)
    if (!hasAccess) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const res = await dbQuery('SELECT stripe_customer_id FROM retailers WHERE id = $1', [retailerId])
    const customerId = res.rows[0]?.stripe_customer_id
    if (!customerId) return NextResponse.json({ error: 'No billing account found. Please subscribe first.' }, { status: 404 })

    const appUrl = APP_ORIGIN
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/admin/billing`,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
