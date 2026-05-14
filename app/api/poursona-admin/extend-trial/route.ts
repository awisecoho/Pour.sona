import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const { retailerId, days } = body
    if (!retailerId || typeof days !== 'number' || days < 1 || days > 365) {
      return NextResponse.json({ error: 'retailerId and days (1-365) required' }, { status: 400 })
    }

    // Allow poursona team OR verified retailer owner
    const teamCheck = await dbQuery(
      'select role from poursona_team where lower(email) = lower($1) limit 1',
      [identity.email || '']
    )
    const isAdmin = teamCheck.rows.length > 0

    if (!isAdmin) {
      const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
      const hasAccess = accessRows.some((r: any) => r.retailer_id === retailerId)
      if (!hasAccess) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const daysStr = days.toString()
    const result = await dbQuery(
      `update retailers
       set
         subscription_status = 'trial',
         trial_ends_at = greatest(now(), coalesce(trial_ends_at, now())) + ($2 || ' days')::interval
       where id = $1
       returning id, name, subscription_status, trial_ends_at`,
      [retailerId, daysStr]
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Retailer not found' }, { status: 404 })
    return NextResponse.json({ ok: true, retailer: result.rows[0] })
  } catch (err) {
    return apiError(err, 'Trial extension failed')
  }
}
