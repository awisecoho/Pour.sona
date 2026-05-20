import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const retailerId = session.metadata?.retailerId
        const plan = session.metadata?.plan || 'starter'
        if (!retailerId) break
        const mrr: Record<string, number> = { starter: 49, growth: 99, pro: 199 }
        await dbQuery(
          `UPDATE retailers SET subscription_status = 'active', subscription_tier = $2, mrr = $3, plan_price = $3, trial_ends_at = NULL WHERE id = $1`,
          [retailerId, plan, mrr[plan] ?? 49]
        )
        await dbQuery(
          `INSERT INTO billing_events (retailer_id, event_type, amount, stripe_event_id, description) VALUES ($1, 'subscription_started', $2, $3, $4)`,
          [retailerId, mrr[plan] ?? 49, event.id, `Subscribed to ${plan} plan`]
        )
        console.log(`[Stripe] Retailer ${retailerId} activated on ${plan} plan`)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const retailerId = sub.metadata?.retailerId
        if (!retailerId) break
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'canceled' ? 'cancelled' : sub.status === 'unpaid' ? 'expired' : 'trial'
        const plan = sub.metadata?.plan || 'starter'
        const mrr: Record<string, number> = { starter: 49, growth: 99, pro: 199 }
        await dbQuery(`UPDATE retailers SET subscription_status = $2, subscription_tier = $3, mrr = $4 WHERE id = $1`, [retailerId, status, plan, status === 'active' ? (mrr[plan] ?? 49) : 0])
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const retailerId = sub.metadata?.retailerId
        if (!retailerId) break
        await dbQuery(`UPDATE retailers SET subscription_status = 'cancelled', mrr = 0 WHERE id = $1`, [retailerId])
        await dbQuery(`INSERT INTO billing_events (retailer_id, event_type, amount, stripe_event_id, description) VALUES ($1, 'subscription_cancelled', 0, $2, 'Subscription cancelled')`, [retailerId, event.id])
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        await dbQuery(`UPDATE retailers SET subscription_status = 'past_due' WHERE stripe_customer_id = $1`, [customerId])
        break
      }
      default:
        console.log(`[Stripe] Unhandled event: ${event.type}`)
    }
  } catch (err: any) {
    console.error('[Stripe] Webhook handler error:', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
