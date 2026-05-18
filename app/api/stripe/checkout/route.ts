import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { adminUrl, billingUrl } from '@/lib/urls'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { retailerId } = await req.json()
    if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    if (!accessRows.some(r => r.retailer_id === retailerId)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const result = await dbQuery('select * from retailers where id = $1 limit 1', [retailerId])
    const retailer = result.rows[0]
    if (!retailer) return NextResponse.json({ error: 'Retailer not found' }, { status: 404 })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

    let customerId = retailer.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: retailer.owner_email,
        name: retailer.name,
        metadata: { retailer_id: retailerId },
      })
      customerId = customer.id
      await dbQuery('update retailers set stripe_customer_id = $2 where id = $1', [retailerId, customerId])
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: adminUrl('?upgraded=1'),
      cancel_url: billingUrl() + '?cancelled=1',
      metadata: { retailer_id: retailerId },
      subscription_data: { metadata: { retailer_id: retailerId } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    return apiError(err, 'Checkout session creation failed')
  }
}
