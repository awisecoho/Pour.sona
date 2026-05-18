import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { checkOrigin, validateEmailFormat } from '@/lib/security'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const { sessionId, email, name } = await req.json()
    if (!sessionId || !email) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email
    if (!validateEmailFormat(trimmedEmail)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 })
    }

    await dbQuery(
      `update sessions set customer_email = $2, customer_name = $3 where id = $1`,
      [sessionId, trimmedEmail, name ? String(name).trim() : null]
    )
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return apiError(err, 'session update failed')
  }
}
