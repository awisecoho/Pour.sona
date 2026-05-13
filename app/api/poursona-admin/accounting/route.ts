import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const teamCheck = await dbQuery('select role from poursona_team where lower(email) = lower($1) limit 1', [identity.email || ''])
    if (!teamCheck.rows.length) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const vendorsRes = await dbQuery(
      `select id, name, subscription_status, subscription_tier, credit_balance, mrr, plan_price, created_at
       from retailers order by created_at desc`, []
    )
    const mrrRes = await dbQuery(`select coalesce(sum(mrr), 0) as mrr from retailers where subscription_status = 'active'`, [])
    const mrr = parseFloat(mrrRes.rows[0]?.mrr || '0')
    const creditsRes = await dbQuery(`select coalesce(sum(amount), 0) as total from account_credits`, []).catch(() => ({ rows: [{ total: 0 }] }))
    const total_credits = parseFloat(creditsRes.rows[0]?.total || '0')
    const eventsRes = await dbQuery(`select be.*, r.name as retailer_name from billing_events be left join retailers r on r.id = be.retailer_id order by be.created_at desc limit 20`, []).catch(() => ({ rows: [] }))
    const promosRes = await dbQuery(`select pr.*, pc.code as promo_code from promo_redemptions pr left join promo_codes pc on pc.id = pr.promo_code_id order by pr.created_at desc limit 20`, []).catch(() => ({ rows: [] }))
    return NextResponse.json({ ok: true, mrr, total_credits, paid_count: vendorsRes.rows.filter((r: any) => r.subscription_status === 'active').length, vendors: vendorsRes.rows, billing_events: eventsRes.rows, promo_redemptions: promosRes.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
