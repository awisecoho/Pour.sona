import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { authorizeRetailer } from '@/lib/authz'
import { dbQuery } from '@/lib/db'
import { PLAN_BY_ID } from '@/lib/billing'
export const dynamic = 'force-dynamic'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
}

export async function POST(req: NextRequest) {
  try {
    const { retailerId, plan } = await req.json()
    if (!retailerId || !plan) return NextResponse.json({ error: 'retailerId and plan required' }, { status: 400 })

    // Billing changes are owner-only.
    const authz = await authorizeRetailer(retailerId, 'owner')
    if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status })

    const tier = PLAN_BY_ID[plan]
    if (!tier) return NextResponse.json({ error: 'invalid plan' }, { status: 400 })

    const stripe = getStripe()

    // Resolve the live Stripe Price by its lookup_key rather than a hardcoded
    // price-ID env var. Changing a price in Stripe (create a new Price with
    // transfer_lookup_key: true) then takes effect with no redeploy or env edit.
    const prices = await stripe.prices.list({ lookup_keys: [tier.lookupKey], active: true, limit: 1 })
    const price = prices.data[0]
    if (!price) return NextResponse.json({ error: 'plan price not configured' }, { status: 500 })

    const retailerRes = await dbQuery(
      'SELECT name, owner_email, stripe_customer_id FROM retailers WHERE id = $1',
      [retailerId]
    )
    const retailer = retailerRes.rows[0]
    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    let customerId = retailer.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: retailer.owner_email,
        name: retailer.name,
        metadata: { retailerId, poursona: 'true' },
      })
      customerId = customer.id
      await dbQuery('UPDATE retailers SET stripe_customer_id = $2 WHERE id = $1', [retailerId, customerId])
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${appUrl}/admin/billing?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/billing?upgrade_cancelled=1`,
      metadata: { retailerId, plan },
      subscription_data: { metadata: { retailerId, plan } },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
