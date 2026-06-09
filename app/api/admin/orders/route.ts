import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { adminError } from '@/lib/api'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100
const CSV_MAX_ROWS = 5_000

async function ensureRetailerAccess(retailerId: string) {
  const identity = await getAuthenticatedIdentity()
  if (!identity) return { error: 'unauthorized', status: 401 as const }

  const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
  if (!accessRows.some((row) => row.retailer_id === retailerId)) {
    return { error: 'forbidden', status: 403 as const }
  }

  return { ok: true as const }
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function escCsv(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function csvRow(cells: unknown[]): string { return cells.map(escCsv).join(',') }

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const retailerId = sp.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const tab    = sp.get('tab') === 'sessions' ? 'sessions' : 'orders'
    const format = sp.get('format') === 'csv' ? 'csv' : 'json'
    const page   = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const limit  = Math.min(Math.max(1, parseInt(sp.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT), MAX_LIMIT)
    const offset = (page - 1) * limit
    const status = sp.get('status')?.trim() || ''
    const search = sp.get('search')?.trim() || ''
    const from   = sp.get('from')?.trim() || ''
    const to     = sp.get('to')?.trim() || ''
    const pat    = search ? `%${search}%` : ''

    // ── Orders tab ─────────────────────────────────────────────────────────
    if (tab === 'orders') {
      const queryLimit  = format === 'csv' ? CSV_MAX_ROWS : limit
      const queryOffset = format === 'csv' ? 0 : offset

      const result = await dbQuery<Record<string, unknown>>(
        `SELECT *, COUNT(*) OVER() AS total_count
         FROM orders
         WHERE retailer_id = $1
           AND ($2::text = '' OR status    = $2)
           AND ($3::text = '' OR created_at >= $3::timestamptz)
           AND ($4::text = '' OR created_at <  ($4::timestamptz + interval '1 day'))
           AND ($5::text = '' OR customer_name  ILIKE $6
                              OR customer_email ILIKE $6
                              OR blend_name     ILIKE $6)
         ORDER BY created_at DESC
         LIMIT $7 OFFSET $8`,
        [retailerId, status, from, to, search, pat, queryLimit, queryOffset]
      )

      if (format === 'csv') {
        const header = csvRow(['Date', 'Order ID', 'Guest Name', 'Guest Email', 'Selection', 'Items', 'Total', 'Status'])
        const rows = result.rows.map((o) => {
          const items = Array.isArray(o.items)
            ? (o.items as Array<{ name?: string; qty?: number }>)
                .map(i => (i.qty && i.qty > 1 ? `x${i.qty} ` : '') + (i.name ?? '')).join('; ')
            : ''
          return csvRow([
            o.created_at ? new Date(String(o.created_at)).toISOString() : '',
            o.id, o.customer_name, o.customer_email, o.blend_name, items,
            o.subtotal != null ? Number(o.subtotal).toFixed(2) : '',
            o.status,
          ])
        })
        return new NextResponse([header, ...rows].join('\r\n'), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="orders.csv"',
          },
        })
      }

      const totalCount = result.rows[0] ? parseInt(String(result.rows[0].total_count), 10) : 0
      const orders = result.rows.map(({ total_count, ...o }) => o)

      const sessCountResult = await dbQuery<{ count: string }>(
        'SELECT COUNT(*)::int AS count FROM sessions WHERE retailer_id = $1',
        [retailerId]
      )
      const sessionCount = parseInt(String(sessCountResult.rows[0]?.count ?? '0'), 10)

      return NextResponse.json({
        ok: true,
        orders,
        sessions: [],
        sessionCount,
        pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
      })
    }

    // ── Sessions tab ────────────────────────────────────────────────────────
    const queryLimit  = format === 'csv' ? CSV_MAX_ROWS : limit
    const queryOffset = format === 'csv' ? 0 : offset

    const sessResult = await dbQuery<Record<string, unknown>>(
      `SELECT id, created_at, order_status, blend_name, messages, customer_name, customer_email,
              COUNT(*) OVER() AS total_count
       FROM sessions
       WHERE retailer_id = $1
         AND ($2::text = '' OR created_at >= $2::timestamptz)
         AND ($3::text = '' OR created_at <  ($3::timestamptz + interval '1 day'))
       ORDER BY created_at DESC
       LIMIT $4 OFFSET $5`,
      [retailerId, from, to, queryLimit, queryOffset]
    )

    if (format === 'csv') {
      const header = csvRow(['Date', 'Session ID', 'Outcome', 'Recommendation', 'Messages', 'Guest Name', 'Guest Email'])
      const rows = sessResult.rows.map(s => csvRow([
        s.created_at ? new Date(String(s.created_at)).toISOString() : '',
        s.id, s.order_status, s.blend_name,
        Array.isArray(s.messages) ? (s.messages as unknown[]).length : 0,
        s.customer_name, s.customer_email,
      ]))
      return new NextResponse([header, ...rows].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sessions.csv"',
        },
      })
    }

    const totalCount = sessResult.rows[0] ? parseInt(String(sessResult.rows[0].total_count), 10) : 0
    const sessions = sessResult.rows.map(({ total_count, ...s }) => s)

    const ordCountResult = await dbQuery<{ count: string }>(
      'SELECT COUNT(*)::int AS count FROM orders WHERE retailer_id = $1',
      [retailerId]
    )
    const orderCount = parseInt(String(ordCountResult.rows[0]?.count ?? '0'), 10)

    return NextResponse.json({
      ok: true,
      orders: [],
      sessions,
      orderCount,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    })
  } catch (error) {
    return adminError('orders get', error, 'orders lookup failed')
  }
}

// ── PUT (unchanged) ───────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  try {
    const { retailerId, id, status } = await req.json()
    if (!retailerId || !id || !status) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId, id, or status' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      `UPDATE orders SET status = $1 WHERE id = $2 AND retailer_id = $3 RETURNING *`,
      [status, id, retailerId]
    )

    return NextResponse.json({ ok: true, order: result.rows[0] || null })
  } catch (error) {
    return adminError('orders update', error, 'order update failed')
  }
}
