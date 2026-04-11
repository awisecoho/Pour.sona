import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const { retailerId, email, name } = await req.json()
    if (!retailerId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    // Create auth user if not exists
    let userId: string
    const { data: existing } = await supabase.auth.admin.listUsers()
    const found = existing?.users?.find((u: any) => u.email === email)
    if (found) {
      userId = found.id
    } else {
      const { data: newUser, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })
      if (error) throw error
      userId = newUser.user.id
    }
    // Link to retailer
    await supabase.from('admin_users').upsert({ user_id: userId, retailer_id: retailerId, role: 'owner' }, { onConflict: 'user_id,retailer_id' })
    // Send magic link
    const { data: link } = await supabase.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: (process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.vercel.app') + '/admin/auth/callback' } })
    return NextResponse.json({ ok: true, userId, magicLink: link?.properties?.action_link || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}