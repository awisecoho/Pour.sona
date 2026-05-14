import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const identity = await getAuthenticatedIdentity()
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    if (!accessRows.some((row) => row.retailer_id === retailerId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const [scanResult, sessionStatsResult, recentResult] = await Promise.all([
      dbQuery(
        `select count(*) as scans from events where retailer_id = $1 and event_type = 'scan'`,
        [retailerId]
      ),
      dbQuery(
        `select
           count(*)                                                          as convos,
           count(*) filter (where order_status in ('recommended','ordered')) as recs,
           count(*) filter (where order_status = 'ordered')                  as orders
         from sessions
         where retailer_id = $1`,
        [retailerId]
      ),
      dbQuery(
        `select id, order_status, created_at
         from sessions
         where retailer_id = $1
         order by created_at desc
         limit 10`,
        [retailerId]
      ),
    ])

    const s = sessionStatsResult.rows[0] ?? {}
    return NextResponse.json({
      ok: true,
      stats: {
        scans:  Number(scanResult.rows[0]?.scans ?? 0),
        convos: Number(s.convos ?? 0),
        recs:   Number(s.recs   ?? 0),
        orders: Number(s.orders ?? 0),
      },
      recent: recentResult.rows,
    })
  } catch (error) {
    console.error('[api/admin/dashboard] load failed:', error)
    return NextResponse.json({ ok: false, error: 'dashboard lookup failed' }, { status: 500 })
  }
}
