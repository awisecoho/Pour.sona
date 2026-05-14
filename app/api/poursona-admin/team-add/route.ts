import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, name, role } = await req.json()
    await dbQuery(
      `insert into poursona_team (email, name, role)
       values ($1, $2, $3)
       on conflict (email) do update set name = excluded.name, role = excluded.role`,
      [email.toLowerCase().trim(), name || null, role || 'staff']
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
