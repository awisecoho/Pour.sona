export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { sendOrderConfirmation, sendOrderAlert } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, retailerId, items, customerEmail, customerName, blendName } = await req.json()
    const subtotal = (items || []).reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0)

    const orderResult = await dbQuery(
      `insert into orders (session_id, retailer_id, customer_email, customer_name, blend_name, items, subtotal, status)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending')
       returning id`,
      [sessionId || null, retailerId, customerEmail || null, customerName || null, blendName || null, JSON.stringify(items || []), subtotal]
    )
    const order = orderResult.rows[0]
    if (!order) return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })

    if (sessionId) {
      await dbQuery(
        `update sessions set order_status = 'ordered', order_id = $2, order_total = $3, ordered_at = now() where id = $1`,
        [sessionId, order.id, subtotal]
      )
    }

    await dbQuery(
      `insert into events (retailer_id, session_id, event_type, payload)
       values ($1, $2, 'order', $3::jsonb)`,
      [retailerId, sessionId || null, JSON.stringify({ order_id: order.id, blend_name: blendName, subtotal })]
    )

    const retailerResult = await dbQuery('select name, owner_email from retailers where id = $1 limit 1', [retailerId])
    const retailerName = retailerResult.rows[0]?.name || 'your venue'
    const ownerEmail = retailerResult.rows[0]?.owner_email

    if (customerEmail) {
      sendOrderConfirmation({ to: customerEmail, retailerName, blendName: blendName || 'Your Selection', items: items || [], subtotal })
    }

    if (ownerEmail) {
      const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin/orders`
      sendOrderAlert({ to: ownerEmail, retailerName, blendName: blendName || 'New Order', customerName: customerName || null, customerEmail: customerEmail || null, items: items || [], subtotal, orderId: order.id, dashboardUrl })
    }

    return NextResponse.json({ success: true, orderId: order.id, subtotal })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
