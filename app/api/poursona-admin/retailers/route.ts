import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: retailers, error } = await supabase
    .from('retailers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = await Promise.all((retailers || []).map(async (r) => {
    const { count } = await supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('retailer_id', r.id)
    const { count: ordCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('retailer_id', r.id).eq('order_status', 'ordered')
    return { ...r, stats: { total: count || 0, recommended: 0, ordered: ordCount || 0 } }
  }))

  return NextResponse.json({ retailers: result })
}