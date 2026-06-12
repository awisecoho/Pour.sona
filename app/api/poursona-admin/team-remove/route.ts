import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Only internal owners may change team membership.
    if (!(await requireTeamMember('owner'))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { email } = await req.json()
    await dbQuery(
      "delete from poursona_team where lower(email) = $1 and role <> 'owner'",
      [email?.toLowerCase().trim()]
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
