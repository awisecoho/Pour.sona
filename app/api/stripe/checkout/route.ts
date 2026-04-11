import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
const APP_URL = 'https://pour-sona.vercel.app'
export async function POST(req: NextRequest) {
  try {
    const { retailerId } = await req.json()
    if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: retailer } = await supabase.from('retailers').select('*').eq('id', retailerId).single()
    if (!retailer) return NextResponse.json({ error: 'Retailer not found' }, { status: 404 })
    // Create or reuse Stripe customer
    let customerId = retailer.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email: retailer.owner_email, name: retailer.name, metadata: { retailer_id: retailerId } })
      customerId = customer.id
      await supabase.from('retailers').update({ stripe_customer_id: customerId }).eq('id', retailerId)
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: APP_URL + '/admin?upgraded=1',
      cancel_url: APP_URL + '/admin/billing?cancelled=1',
      metadata: { retailer_id: retailerId },
      subscription_data: { metadata: { retailer_id: retailerId } },
    })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}