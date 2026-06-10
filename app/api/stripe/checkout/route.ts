import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { authorizeRetailer } from '@/lib/authz'
import { dbQuery } from '@/lib/db'
import { PLAN_BY_ID } from '@/lib/billing'
import { APP_ORIGIN } from '@/lib/urls'
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
    // a STRIPE_PRICE_<TIER> env var at go-live — but ONLY when that env value is a
    // real Price ID. A prior Stripe "connect" left these env vars set to Product
    // IDs (prod_...), which silently overrode the correct Price and broke checkout
    // with "No such price". Ignore anything that isn't a price_ id.
    const envPrice = process.env[`STRIPE_PRICE_${tier.id.toUpperCase()}`]
    const priceId = envPrice?.startsWith('price_') ? envPrice : tier.priceId
    if (!priceId) return NextResponse.json({ error: 'plan price not configured' }, { status: 500 })

    const stripe = getStripe()

    const retailerRes = await dbQuery(
      'SELECT name, owner_email, stripe_customer_id FROM retailers WHERE id = $1',
      [retailerId]
    )
    const retailer = retailerRes.rows[0]
    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    let customerId = retailer.stripe_customer_id
    // A stored customer ID can be stale — created under a different Stripe
    // account, or a test-mode customer after the key is switched to live. Verify
    // it still exists in the current account/mode; if not, drop it and recreate
    // so checkout self-heals instead of failing with "No such customer".
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId)
        if ((existing as { deleted?: boolean }).deleted) customerId = null
      } catch {
        customerId = null
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: retailer.owner_email,
        name: retailer.name,
        metadata: { retailerId, poursona: 'true' },
      })
      customerId = customer.id
      await dbQuery('UPDATE retailers SET stripe_customer_id = $2 WHERE id = $1', [retailerId, customerId])
    }

    const appUrl = APP_ORIGIN
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
