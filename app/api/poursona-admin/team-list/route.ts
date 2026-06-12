import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// POST (not GET) is kept for compatibility with the team page, but the caller
// identity now comes from the Clerk session — the request body is ignored so
// membership can't be probed by claiming someone else's email.
export async function POST() {
  try {
    const caller = await requireTeamMember()
    if (!caller) return NextResponse.json({ team: [] }, { status: 403 })
    // Full roster is owner-only; non-owners see an empty list (matches the
    // previous behavior the team page renders for staff).
    if (caller.member.role !== 'owner') return NextResponse.json({ team: [] })
    const teamResult = await dbQuery('select * from poursona_team order by created_at', [])
    return NextResponse.json({ team: teamResult.rows })
  } catch { return NextResponse.json({ team: [] }) }
}
