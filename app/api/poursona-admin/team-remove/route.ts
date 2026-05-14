import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    await dbQuery(
      "delete from poursona_team where lower(email) = $1 and role <> 'owner'",
      [email?.toLowerCase().trim()]
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}
