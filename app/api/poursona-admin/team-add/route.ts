import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
import { validateEmailFormat } from '@/lib/security'
export const dynamic = 'force-dynamic'

const VALID_ROLES = new Set(['owner', 'staff'])

export async function POST(req: NextRequest) {
  try {
    // Only internal owners may change team membership.
    if (!(await requireTeamMember('owner'))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { email, name, role } = await req.json()
    if (!validateEmailFormat(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }
    if (role && !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 })
    }
    await dbQuery(
      `insert into poursona_team (email, name, role)
       values ($1, $2, $3)
       on conflict (email) do update set name = excluded.name, role = excluded.role`,
      [email.toLowerCase().trim(), name || null, role || 'staff']
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
