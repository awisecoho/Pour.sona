import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const memberResult = await dbQuery(
      'select role from poursona_team where lower(email) = $1 limit 1',
      [email?.toLowerCase().trim()]
    )
    const member = memberResult.rows[0]
    if (!member || member.role !== 'owner') return NextResponse.json({ team: [] })
    const teamResult = await dbQuery('select * from poursona_team order by created_at', [])
    return NextResponse.json({ team: teamResult.rows })
  } catch { return NextResponse.json({ team: [] }) }
}
