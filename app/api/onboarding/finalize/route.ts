import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
import { dbQuery } from '@/lib/db'
import { grantRetailerAccessByEmail, getAuthenticatedIdentity } from '@/lib/auth'
import { sendOnboardingConcierge } from '@/lib/email'
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

    // If the auto-scrape produced a thin catalog, reassure the venue that our
    // team is finishing setup (best-effort; never blocks success).
    try {
      const pc = await dbQuery<{ n: number }>('select count(*)::int as n from products where retailer_id = $1', [retailer.id])
      const productCount = pc.rows[0]?.n ?? 0
      if (productCount < 5 && retailer.owner_email) {
        sendOnboardingConcierge({
          to: retailer.owner_email,
          retailerName: retailer.name,
          productCount,
          adminUrl: adminUrl(),
        }).then(r => { if (!r.ok) console.error('[finalize] concierge email failed:', r.error) })
      }
    } catch (e) {
      console.error('[finalize] concierge check failed:', e)
    }

    return NextResponse.json({
      retailer,
      links: {
        storefront: storefrontUrl(retailer.slug),
        admin: adminUrl(),
      }
    })
  } catch (err: any) {
    console.error('[finalize] Full error:', err?.message, err?.stack)
    return NextResponse.json({ error: 'Onboarding finalize failed: ' + (err?.message || String(err)) }, { status: 500 })
  }
}
