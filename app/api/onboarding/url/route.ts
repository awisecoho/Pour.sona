import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
import { getAuthenticatedIdentity } from '@/lib/auth'
import { verifyOnboardSecret, validateScrapeUrl } from '@/lib/security'
import { dbQuery } from '@/lib/db'
import { sendScrapeAlert } from '@/lib/email'
export const dynamic = 'force-dynamic'

const SPARSE_PRODUCT_THRESHOLD = 5

// CuvAi admin recipients for onboarding alerts. Falls back to the team table.
async function getAdminEmails(): Promise<string[]> {
  const envAdmin = process.env.POURSONA_ADMIN_EMAIL
  if (envAdmin) return envAdmin.split(',').map(e => e.trim()).filter(Boolean)
  try {
    const res = await dbQuery<{ email: string }>('select email from poursona_team order by created_at', [])
    const emails = res.rows.map(r => r.email).filter(Boolean)
    return emails.length ? emails : ['hello@pour-sona.com']
  } catch {
    return ['hello@pour-sona.com']
  }
}

export async function POST(req: NextRequest) {
  let attemptedUrl = 'unknown'
  try {
    // Accept either a Clerk-authenticated team member or the server-side onboard secret
    const identity = await getAuthenticatedIdentity()
    if (identity) {
      const teamCheck = await dbQuery('select 1 from poursona_team where email = $1 limit 1', [identity.email])
      if (teamCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (!verifyOnboardSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (typeof url === 'string') attemptedUrl = url

    // SSRF guard: block non-HTTP(S), credentials, and private/loopback/link-local targets.
    const safe = validateScrapeUrl(url)
    if (!safe.ok) return NextResponse.json({ error: safe.error }, { status: 400 })

    const draft = await createDraftFromUrl(url)

    // Self-serve safety net: if the scrape came back thin, alert the admin team
    // so they can finish setup (concierge). Best-effort; never blocks the response.
    try {
      const products: any[] = Array.isArray(draft?.menu_json) ? draft.menu_json : []
      const issues: string[] = []
      if (products.length < SPARSE_PRODUCT_THRESHOLD) issues.push(`Only ${products.length} product(s) extracted`)
      if (!draft?.logo_url) issues.push('No logo detected')
      if (!draft?.brand_color || draft.brand_color === '#3FC6D4') issues.push('No brand color detected (using default)')
      if (products.length > 0 && products.every((p: any) => p.price == null)) issues.push('No prices on any product')

      if (issues.length > 0) {
        const admins = await getAdminEmails()
        sendScrapeAlert({
          to: admins,
          url,
          status: 'sparse',
          productCount: products.length,
          issues,
          draftId: draft?.id || null,
          venueName: draft?.name || null,
        }).then(r => { if (!r.ok) console.error('[onboarding/url] scrape alert failed:', r.error) })
      }
    } catch (alertErr) {
      console.error('[onboarding/url] sparse-scrape check failed:', alertErr)
    }

    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    // Hard failure (e.g. no products at all) — notify the admin team so a human
    // can rescue the signup, then surface the error to the caller.
    try {
      const admins = await getAdminEmails()
      await sendScrapeAlert({
        to: admins,
        url: attemptedUrl,
        status: 'failed',
        productCount: 0,
        issues: [err?.message || 'Unknown scrape error'],
      })
    } catch (alertErr) {
      console.error('[onboarding/url] failure alert failed:', alertErr)
    }
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
