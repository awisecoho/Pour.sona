import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const retailerId = new URL(req.url).searchParams.get('retailerId')
    if (!retailerId) return NextResponse.json({ error: 'retailerId required' }, { status: 400 })

    const access = await getRetailersForIdentity(identity.userId, identity.email)
    const hasAccess = access.some((r: any) => r.retailer_id === retailerId)
    if (!hasAccess) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const res = await dbQuery(
      `SELECT subscription_status, subscription_tier, trial_ends_at, mrr, plan_price, stripe_customer_id FROM retailers WHERE id = $1`,
      [retailerId]
    )
    const r = res.rows[0]
    if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const trialEnds = r.trial_ends_at ? new Date(r.trial_ends_at) : null
    const trialExpired = trialEnds ? trialEnds < new Date() : false
    const daysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86400000) : null

    return NextResponse.json({
      ok: true,
      subscription_status: r.subscription_status,
      subscription_tier: r.subscription_tier,
      trial_ends_at: r.trial_ends_at,
      trial_expired: trialExpired,
      days_left: daysLeft,
      mrr: r.mrr,
      has_stripe: !!r.stripe_customer_id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
