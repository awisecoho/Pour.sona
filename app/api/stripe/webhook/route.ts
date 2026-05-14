import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

async function updateRetailer(retailerId: string, fields: Record<string, any>) {
  if (!retailerId) return
  const keys = Object.keys(fields)
  const values: any[] = Object.values(fields)
  const assignments = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
  await dbQuery(`update retailers set ${assignments} where id = $1`, [retailerId, ...values])
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const retailerId = session.metadata?.retailer_id
      if (retailerId && session.subscription) {
        await updateRetailer(retailerId, {
          subscription_status: 'active',
          stripe_customer_id: session.customer as string,
        })
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const retailerId = sub.metadata?.retailer_id
      if (retailerId) {
        const status =
          sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'cancelled'
          : 'trial'
        await updateRetailer(retailerId, { subscription_status: status })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const retailerId = sub.metadata?.retailer_id
      if (retailerId) {
        await updateRetailer(retailerId, { subscription_status: 'cancelled', active: false })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
