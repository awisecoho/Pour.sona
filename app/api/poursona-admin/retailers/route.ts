import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}
export async function GET(req: NextRequest) {
  try {
    const supabase = getAdmin()
    const { data: retailers } = await supabase.from('retailers').select('*').order('created_at', { ascending: false })
    const { data: sessions } = await supabase.from('sessions').select('retailer_id, order_status')
    const { data: orders } = await supabase.from('orders').select('retailer_id, status')
    const sessionMap: Record<string, any> = {}
    for (const s of sessions || []) {
      if (!sessionMap[s.retailer_id]) sessionMap[s.retailer_id] = { total: 0, recommended: 0, ordered: 0 }
      sessionMap[s.retailer_id].total++
      if (s.order_status === 'recommended') sessionMap[s.retailer_id].recommended++
      if (s.order_status === 'ordered') sessionMap[s.retailer_id].ordered++
    }
    const enriched = (retailers || []).map(r => ({ ...r, stats: sessionMap[r.id] || { total: 0, recommended: 0, ordered: 0 } }))
    return NextResponse.json({ retailers: enriched })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}