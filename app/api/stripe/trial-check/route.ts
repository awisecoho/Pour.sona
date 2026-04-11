import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const retailerId = new URL(req.url).searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ ok: false })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: retailer } = await supabase.from('retailers').select('subscription_status, trial_ends_at, active').eq('id', retailerId).single()
  if (!retailer) return NextResponse.json({ ok: false })
  if (!retailer.active) return NextResponse.json({ ok: false, reason: 'inactive' })
  if (retailer.subscription_status === 'active') return NextResponse.json({ ok: true })
  if (retailer.subscription_status === 'trial') {
    const expired = retailer.trial_ends_at && new Date(retailer.trial_ends_at) < new Date()
    return NextResponse.json({ ok: !expired, reason: expired ? 'trial_expired' : 'trial' })
  }
  return NextResponse.json({ ok: false, reason: retailer.subscription_status })
}