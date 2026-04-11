import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
const APP_URL = 'https://pour-sona.vercel.app'
export async function POST(req: NextRequest) {
  try {
    const { retailerId } = await req.json()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: retailer } = await supabase.from('retailers').select('stripe_customer_id').eq('id', retailerId).single()
    if (!retailer?.stripe_customer_id) return NextResponse.json({ error: 'No billing account' }, { status: 404 })
    const session = await stripe.billingPortal.sessions.create({ customer: retailer.stripe_customer_id, return_url: APP_URL + '/admin/billing' })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}