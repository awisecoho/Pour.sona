import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { dbQuery } from '@/lib/db'
import { planToMrr, subStatusFromStripe } from '@/lib/billing'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
export const dynamic = 'force-dynamic'

const stripe = getStripe()

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, getWebhookSecret()!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Idempotency / replay safety ─────────────────────────────────────────────
  // Stripe may deliver the same event more than once. Record each event id and
  // skip if we've already processed it. If the table doesn't exist yet (pre-
  // migration) we log and continue rather than dropping the event.
  try {
    const dedupe = await dbQuery(
      `INSERT INTO stripe_webhook_events (id, type) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type]
    )
    if (dedupe.rows.length === 0) {
      return NextResponse.json({ received: true, deduped: true })
    }
  } catch (e: any) {
    console.error('[Stripe] webhook dedupe insert failed (continuing):', e?.message)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const retailerId = session.metadata?.retailerId
        const plan = session.metadata?.plan || 'starter'
        if (!retailerId) break
        const amount = planToMrr(plan)
        await dbQuery(
          `UPDATE retailers SET subscription_status = 'active', subscription_tier = $2, mrr = $3, plan_price = $3, trial_ends_at = NULL WHERE id = $1`,
          [retailerId, plan, amount]
        )
        await dbQuery(
          `INSERT INTO billing_events (retailer_id, event_type, amount, stripe_event_id, description) VALUES ($1, 'subscription_started', $2, $3, $4)`,
          [retailerId, amount, event.id, `Subscribed to ${plan} plan`]
        )
        console.log(`[Stripe] Retailer ${retailerId} activated on ${plan} plan`)
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const retailerId = sub.metadata?.retailerId
        if (!retailerId) break
        const status = subStatusFromStripe(sub.status)
        const plan = sub.metadata?.plan || 'starter'
        await dbQuery(`UPDATE retailers SET subscription_status = $2, subscription_tier = $3, mrr = $4 WHERE id = $1`, [retailerId, status, plan, status === 'active' ? planToMrr(plan) : 0])
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
