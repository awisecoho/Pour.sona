import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: member } = await supabase.from('poursona_team').select('role').eq('email', email).single()
    if (!member || member.role !== 'owner') return NextResponse.json({ team: [] })
    const { data: team } = await supabase.from('poursona_team').select('*').order('created_at')
    return NextResponse.json({ team: team || [] })
  } catch { return NextResponse.json({ team: [] }) }
}