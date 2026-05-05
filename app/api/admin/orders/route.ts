import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function ensureRetailerAccess(retailerId: string) {
  const identity = await getAuthenticatedIdentity()
  if (!identity) return { error: 'unauthorized', status: 401 as const }

  const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
  if (!accessRows.some((row) => row.retailer_id === retailerId)) {
    return { error: 'forbidden', status: 403 as const }
  }

  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const [ordersResult, sessionsResult] = await Promise.all([
      dbQuery(
        `select *
         from orders
         where retailer_id = $1
         order by created_at desc`,
        [retailerId]
      ),
      dbQuery(
        `select id, created_at, order_status, blend_name, messages
         from sessions
         where retailer_id = $1
         order by created_at desc
         limit 50`,
        [retailerId]
      ),
    ])

    return NextResponse.json({
      ok: true,
      orders: ordersResult.rows,
      sessions: sessionsResult.rows,
    })
  } catch (error) {
    console.error('[api/admin/orders] get failed:', error)
    return NextResponse.json({ ok: false, error: 'orders lookup failed' }, { status: 500 })
  }
}

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
      `update orders
       set status = $1
       where id = $2 and retailer_id = $3
       returning *`,
      [status, id, retailerId]
    )

    return NextResponse.json({ ok: true, order: result.rows[0] || null })
  } catch (error) {
    console.error('[api/admin/orders] update failed:', error)
    return NextResponse.json({ ok: false, error: 'order update failed' }, { status: 500 })
  }
}
