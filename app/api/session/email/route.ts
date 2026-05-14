import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, email, name } = await req.json()
    if (!sessionId || !email) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    await dbQuery(
      `update sessions set customer_email = $2, customer_name = $3 where id = $1`,
      [sessionId, email, name || null]
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
