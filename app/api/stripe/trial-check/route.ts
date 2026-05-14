import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const retailerId = new URL(req.url).searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ ok: false })
  const result = await dbQuery(
    'select subscription_status, trial_ends_at, active from retailers where id = $1 limit 1',
    [retailerId]
  )
  const retailer = result.rows[0]
  if (!retailer) return NextResponse.json({ ok: false })
  if (!retailer.active) return NextResponse.json({ ok: false, reason: 'inactive' })
  if (retailer.subscription_status === 'active') return NextResponse.json({ ok: true })
  if (retailer.subscription_status === 'trial') {
    const expired = retailer.trial_ends_at && new Date(retailer.trial_ends_at) < new Date()
    return NextResponse.json({ ok: !expired, reason: expired ? 'trial_expired' : 'trial' })
  }
  return NextResponse.json({ ok: false, reason: retailer.subscription_status })
}
