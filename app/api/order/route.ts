export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { sendOrderConfirmation, sendOrderAlert } from '@/lib/email'
import { ordersUrl } from '@/lib/urls'
import { apiError } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    // ── Idempotency key ────────────────────────────────────────────────────────
    // Clients must supply a stable key per order attempt so retries are safe.
    // The key is scoped to (session_id, idempotency_key) at the DB level via a
    // partial unique index, so a duplicate request returns the original order
    // without re-triggering emails or session updates.
    const idempotencyKey = req.headers.get('x-idempotency-key')
    if (!idempotencyKey || idempotencyKey.trim().length === 0 || idempotencyKey.length > 128) {
      return NextResponse.json(
        { error: 'X-Idempotency-Key header is required (non-empty, max 128 chars)' },
        { status: 400 }
      )
    }

    const { sessionId, retailerId, items, customerEmail, customerName, blendName } = await req.json()
    const subtotal = (items || []).reduce((s: number, i: any) => s + (i.price || 0) * (i.qty || 1), 0)

    // ── Idempotent insert ──────────────────────────────────────────────────────
    // ON CONFLICT targets the partial unique index:
    //   UNIQUE (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL
    //
    // If two concurrent requests race, only one INSERT wins and returns a row.
    // The other gets zero rows, falls through to the SELECT, and returns the
    // same order that the first request created — no duplicate, no error.
    const insertResult = await dbQuery<{ id: string; subtotal: string }>(
      `INSERT INTO orders
         (session_id, retailer_id, customer_email, customer_name, blend_name, items, subtotal, status, idempotency_key)
       VALUES
         ($1, $2, $3, $4, $5, $6::jsonb, $7, 'pending', $8)
       ON CONFLICT (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL
       DO NOTHING
       RETURNING id, subtotal`,
      [
        sessionId || null,
        retailerId,
        customerEmail || null,
        customerName || null,
        blendName || null,
        JSON.stringify(items || []),
        subtotal,
        idempotencyKey,
      ]
    )

    // ── Duplicate detected ─────────────────────────────────────────────────────
    if (insertResult.rows.length === 0) {
      // The conflict guard fired — an order for this session+key already exists.
      // Return the original order without any side effects (no email, no events).
      const existing = await dbQuery<{ id: string; subtotal: string }>(
        `SELECT id, subtotal FROM orders
         WHERE session_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [sessionId, idempotencyKey]
      )
      const existingOrder = existing.rows[0]
      if (!existingOrder) {
        // Should not happen: conflict means the row exists — surface as 500 if it somehow doesn't.
        return apiError(new Error('Idempotency conflict but existing order not found'), 'Order creation failed')
      }
      return NextResponse.json({ success: true, orderId: existingOrder.id, subtotal: Number(existingOrder.subtotal) })
    }

    // ── New order created ──────────────────────────────────────────────────────
    const order = insertResult.rows[0]

    if (sessionId) {
      await dbQuery(
        `UPDATE sessions
         SET order_status = 'ordered', order_id = $2, order_total = $3, ordered_at = now()
         WHERE id = $1`,
        [sessionId, order.id, subtotal]
      )
    }

    await dbQuery(
      `INSERT INTO events (retailer_id, session_id, event_type, payload)
       VALUES ($1, $2, 'order', $3::jsonb)`,
      [retailerId, sessionId || null, JSON.stringify({ order_id: order.id, blend_name: blendName, subtotal })]
    )

    const retailerResult = await dbQuery<{ name: string; owner_email: string | null }>(
      'SELECT name, owner_email FROM retailers WHERE id = $1 LIMIT 1',
      [retailerId]
    )
    const retailerName = retailerResult.rows[0]?.name || 'your venue'
    const ownerEmail   = retailerResult.rows[0]?.owner_email

    if (customerEmail) {
      sendOrderConfirmation({
        to: customerEmail,
        retailerName,
        blendName: blendName || 'Your Selection',
        items: items || [],
        subtotal,
      })
    }

    if (ownerEmail) {
      sendOrderAlert({
        to: ownerEmail,
        retailerName,
        blendName: blendName || 'New Order',
        customerName: customerName || null,
        customerEmail: customerEmail || null,
        items: items || [],
        subtotal,
        orderId: order.id,
        dashboardUrl: ordersUrl(),
      })
    }

    return NextResponse.json({ success: true, orderId: order.id, subtotal: Number(order.subtotal) })
  } catch (err) {
    return apiError(err, 'Order creation failed')
  }
}
