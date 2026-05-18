import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { dbQuery } from '@/lib/db'
import { grantRetailerAccessByEmail, getAuthenticatedIdentity } from '@/lib/auth'
import { storefrontUrl, adminUrl } from '@/lib/urls'
import { verifyOnboardSecret } from '@/lib/security'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (identity) {
      const teamCheck = await dbQuery('select 1 from poursona_team where email = $1 limit 1', [identity.email])
      if (teamCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (!verifyOnboardSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
        storefront: storefrontUrl(retailer.slug),
        admin: adminUrl(),
      }
    })
  } catch (err) {
    return apiError(err, 'Onboarding finalize failed')
  }
}
