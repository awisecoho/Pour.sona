import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ ok: false })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data } = await supabase.from('poursona_team').select('email, name, role').eq('email', email.toLowerCase().trim()).single()
    return NextResponse.json({ ok: !!data, member: data || null })
  } catch {
    return NextResponse.json({ ok: false })
  }
}