// app/api/order/route.ts
// ─── Order creation ───────────────────────────────────────────────────────────
// POST /api/order
// Body: { sessionId, retailerId, items, customerEmail, customerName, blendName }
// Creates order in Supabase, marks session as ordered, fires webhook if configured

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, logEvent } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const {
      sessionId,
      retailerId,
      items,           // [{ name, size, price, qty }]
      customerEmail,
      customerName,
      blendName,
    } = await req.json()

    if (!retailerId || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Calculate total
    const subtotal = items.reduce(
      (sum: number, item: { price: number; qty: number }) =>
        sum + item.price * item.qty,
      0
    )

    // 1. Create order record
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        session_id:     sessionId,
        retailer_id:    retailerId,
        customer_email: customerEmail,
        customer_name:  customerName,
        blend_name:     blendName,
        items,
        subtotal,
        status: 'pending',
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // 2. Update session status
    if (sessionId) {
      await supabaseAdmin
        .from('sessions')
        .update({
          order_status: 'ordered',
          order_id:     order.id,
          order_total:  subtotal,
          ordered_at:   new Date().toISOString(),
          customer_email: customerEmail,
          customer_name:  customerName,
        })
        .eq('id', sessionId)
    }

    // 3. Log analytics event
    await logEvent(retailerId, sessionId, 'order', {
      order_id:   order.id,
      blend_name: blendName,
      subtotal,
      items: items.map((i: { name: string }) => i.name),
    })

    // 4. TODO: Fire POS webhook (Square / Shopify)
    // Uncomment when you add POS integration:
    //
    // const retailer = await supabaseAdmin
    //   .from('retailers')
    //   .select('pos_webhook_url, pos_type')
    //   .eq('id', retailerId)
    //   .single()
    //
    // if (retailer.data?.pos_webhook_url) {
    //   await fetch(retailer.data.pos_webhook_url, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ order_id: order.id, items, subtotal, customer: customerName }),
    //   })
    // }

    // 5. TODO: Send confirmation email
    // Uncomment when you add Resend integration:
    //
    // if (customerEmail) {
    //   const resend = new Resend(process.env.RESEND_API_KEY)
    //   await resend.emails.send({
    //     from: 'Poursona <hello@poursona.app>',
    //     to: customerEmail,
    //     subject: `Your ${blendName} order is confirmed`,
    //     html: buildOrderEmail(order, items),
    //   })
    // }

    return NextResponse.json({
      success:  true,
      orderId:  order.id,
      subtotal,
    })
  } catch (err) {
    console.error('Order API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — fetch orders for a retailer (admin use)
export async function GET(req: NextRequest) {
  const retailerId = req.nextUrl.searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('retailer_id', retailerId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
