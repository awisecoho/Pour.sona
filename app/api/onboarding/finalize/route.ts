import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { dbQuery } from '@/lib/db'
import { grantRetailerAccessByEmail } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { draftId, ownerEmail } = await req.json()
    if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })

    const retailer = await publishDraft(draftId, ownerEmail)

    // Auto-link all poursona team members to the new retailer (best-effort, never blocks success)
    try {
      const teamResult = await dbQuery('select email from poursona_team order by created_at', [])
      for (const member of teamResult.rows) {
        await grantRetailerAccessByEmail(retailer.id, member.email, 'owner')
      }
    } catch {
      // team-linking is non-critical; retailer is already published
    }

    return NextResponse.json({
      retailer,
      links: {
        storefront: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/r/${retailer.slug}`,
        admin: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin`,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
