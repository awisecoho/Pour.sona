import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  let event: Stripe.Event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: 'Webhook signature failed' }, { status: 400 })
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  async function updateRetailer(retailerId: string, update: any) {
    if (!retailerId) return
    await supabase.from('retailers').update(update).eq('id', retailerId)
  }
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const retailerId = session.metadata?.retailer_id
      if (retailerId && session.subscription) {
        await updateRetailer(retailerId, { subscription_status: 'active', stripe_customer_id: session.customer as string })
      }
      break
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const retailerId = sub.metadata?.retailer_id
      if (retailerId) {
        const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'canceled' ? 'cancelled' : 'trial'
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