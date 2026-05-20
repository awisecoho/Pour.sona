import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const PLANS: Record<string, { priceId: string; name: string; mrr: number }> = {
  starter: { priceId: process.env.STRIPE_PRICE_STARTER name: 'Starter', mrr: 49 },
  growth:  { priceId: process.env.STRIPE_PRICE_GROWTH!,  name: 'Growth',  mrr: 99 },
  pro:     { priceId: process.env.STRIPE_PRICE_PRO!,     name: 'Pro',     mrr: 199 },
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { retailerId, plan } = await req.json()
    if (!retailerId || !plan) return NextResponse.json({ error: 'retailerId and plan required' }, { status: 400 })

    const access = await getRetailersForIdentity(identity.userId, identity.email)
    const hasAccess = access.some((r: any) => r.retailer_id === retailerId)
    if (!hasAccess) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const planConfig = PLANS[plan]
    if (!planConfig) return NextResponse.json({ error: 'invalid plan' }, { status: 400 })

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.vercel.app'
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/admin/billing?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin/billing?upgrade_cancelled=1`,
      metadata: { retailerId, plan },
      subscription_data: { metadata: { retailerId, plan } },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ ok: true, url: session.url })
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
