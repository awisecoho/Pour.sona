import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { retailerId } = await req.json()
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
    const result = await dbQuery('select stripe_customer_id from retailers where id = $1 limit 1', [retailerId])
    const retailer = result.rows[0]
    if (!retailer?.stripe_customer_id) return NextResponse.json({ error: 'No billing account' }, { status: 404 })
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin/billing`
    const session = await stripe.billingPortal.sessions.create({ customer: retailer.stripe_customer_id, return_url: returnUrl })
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
