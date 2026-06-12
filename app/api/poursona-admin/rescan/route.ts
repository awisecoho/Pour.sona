import { NextRequest, NextResponse } from 'next/server'
import { rescanRetailer } from '@/lib/onboarding'
import { requireTeamMember } from '@/lib/auth'
import { validateScrapeUrl } from '@/lib/security'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Rescan triggers AI scraping and overwrites venue data — team members only.
    if (!(await requireTeamMember())) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { retailerId, url, mode } = await req.json()
    if (!retailerId || !url || !mode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!['catalog', 'branding', 'full'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    const urlCheck = validateScrapeUrl(url)
    if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 })
    const result = await rescanRetailer(retailerId, url, mode)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
