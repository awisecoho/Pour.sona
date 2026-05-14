import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ ok: false })
    const result = await dbQuery(
      'select email, name, role from poursona_team where lower(email) = $1 limit 1',
      [email.toLowerCase().trim()]
    )
    const member = result.rows[0] || null
    return NextResponse.json({ ok: !!member, member })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
