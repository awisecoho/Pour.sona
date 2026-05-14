import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { retailerId, active } = await req.json()
    await dbQuery('update retailers set active = $2 where id = $1', [retailerId, active])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
