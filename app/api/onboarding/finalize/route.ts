import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { draftId, ownerEmail } = await req.json()
    if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })

    const retailer = await publishDraft(draftId, ownerEmail)

    // Auto-link all poursona team members to the new retailer
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: team } = await supabase.from('poursona_team').select('email')
    if (team?.length) {
      const { data: users } = await supabase.auth.admin.listUsers()
      for (const member of team) {
        const user = users?.users?.find((u: any) => u.email === member.email)
        if (user) {
          await supabase.from('admin_users').upsert(
            { user_id: user.id, retailer_id: retailer.id, role: 'owner' },
            { onConflict: 'user_id,retailer_id' }
          )
        }
      }
    }

    return NextResponse.json({
      retailer,
      links: {
        storefront: `https://pour-sona.vercel.app/r/${retailer.slug}`,
        admin: `https://pour-sona.vercel.app/admin`,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
