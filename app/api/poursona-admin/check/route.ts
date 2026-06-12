import { NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// Membership check for the signed-in caller only. The previous version
// accepted an arbitrary email in the body, which made it an unauthenticated
// oracle for probing who is on the internal team.
export async function POST() {
  try {
    const caller = await requireTeamMember()
    if (!caller) return NextResponse.json({ ok: false })
    return NextResponse.json({ ok: true, member: caller.member })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
