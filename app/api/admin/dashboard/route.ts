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
    const hasAccess = accessRows.some((row) => row.retailer_id === retailerId)
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const [sessionsResult, eventsResult] = await Promise.all([
      dbQuery(
        `select id, order_status, created_at
         from sessions
         where retailer_id = $1
         order by created_at desc
         limit 50`,
        [retailerId]
      ),
      dbQuery(
        `select event_type
         from events
         where retailer_id = $1`,
        [retailerId]
      ),
    ])

    const sessions = sessionsResult.rows
    const events = eventsResult.rows

    return NextResponse.json({
      ok: true,
      stats: {
        scans: events.filter((x: any) => x.event_type === 'scan').length,
        convos: sessions.length,
        recs: sessions.filter((x: any) => ['recommended', 'ordered'].includes(x.order_status)).length,
        orders: sessions.filter((x: any) => x.order_status === 'ordered').length,
      },
      recent: sessions.slice(0, 10),
    })
  } catch (error) {
    console.error('[api/admin/dashboard] load failed:', error)
    return NextResponse.json({ ok: false, error: 'dashboard lookup failed' }, { status: 500 })
  }
}
