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

    // Use the tier's test-mode Price ID from PLAN_TIERS, overridable per tier by
    // a STRIPE_PRICE_<TIER> env var (set these to the live Price IDs at go-live —
    // price IDs differ between test and live mode).
    const priceId = process.env[`STRIPE_PRICE_${tier.id.toUpperCase()}`] || tier.priceId
    if (!priceId) return NextResponse.json({ error: 'plan price not configured' }, { status: 500 })

    const stripe = getStripe()

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
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/admin/billing?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/billing?upgrade_cancelled=1`,
      metadata: { retailerId, plan },
      subscription_data: { metadata: { retailerId, plan } },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    // Surface the Stripe error explicitly (message + code + type) so failures
    // like a mode/account mismatch ("No such price ... a test mode key was used
    // ... in live mode") are obvious in the logs instead of a generic dump.
    console.error('Stripe checkout error:', err?.message || String(err), err?.code ? `[${err.code}]` : '', err?.type ? `(${err.type})` : '')
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
