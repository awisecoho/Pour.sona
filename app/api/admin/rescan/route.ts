import { NextRequest, NextResponse } from 'next/server'
import { rescanRetailer } from '@/lib/onboarding'
import { authorizeRetailer } from '@/lib/authz'
import { validateScrapeUrl } from '@/lib/security'
import { adminError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Vendor-facing rescan: same underlying rescanRetailer() the internal CRM
// uses, but scoped to the caller's own retailer via authorizeRetailer instead
// of poursona_team membership. Manager+ (matches /api/catalog's edit bar,
// since a rescan can rewrite the same data a manager could edit by hand).
export async function POST(req: NextRequest) {
  try {
    const { retailerId, url, mode } = await req.json()
    if (!retailerId || !url || !mode) {
      return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })
    }
    if (!['catalog', 'branding', 'full'].includes(mode)) {
      return NextResponse.json({ ok: false, error: 'Invalid mode' }, { status: 400 })
    }

    const authz = await authorizeRetailer(retailerId, 'manager')
    if (!authz.ok) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const urlCheck = validateScrapeUrl(url)
    if (!urlCheck.ok) {
      return NextResponse.json({ ok: false, error: urlCheck.error }, { status: 400 })
    }

    const result = await rescanRetailer(retailerId, url, mode)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return adminError('rescan', err, 'Rescan failed')
  }
}
