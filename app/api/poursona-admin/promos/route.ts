import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity } from '@/lib/auth'
export const dynamic = 'force-dynamic'

async function isAdmin(identity: any) {
  const r = await dbQuery('select role from poursona_team where lower(email) = lower($1) limit 1', [identity.email || ''])
  return r.rows.length > 0
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity || !(await isAdmin(identity))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const res = await dbQuery(`select pc.*, count(pr.id)::int as uses_count from promo_codes pc left join promo_redemptions pr on pr.promo_code_id = pc.id group by pc.id order by pc.created_at desc`, [])
    return NextResponse.json({ ok: true, promos: res.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity || !(await isAdmin(identity))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const body = await req.json()
    const { code, type, value, description, applies_to, max_uses, retailer_id } = body
    if (!code || !type || value === undefined) return NextResponse.json({ error: 'code, type, value required' }, { status: 400 })
    const res = await dbQuery(`insert into promo_codes (code, type, value, description, applies_to, max_uses, retailer_id, active) values (upper($1), $2, $3, $4, $5, $6, $7, true) returning *`, [code, type, value, description || null, applies_to || 'all', max_uses || null, retailer_id || null])
    return NextResponse.json({ ok: true, promo: res.rows[0] })
  } catch (err: any) {
    if (err.message?.includes('unique')) return NextResponse.json({ error: 'Promo code already exists' }, { status: 409 })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity || !(await isAdmin(identity))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { id, active } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await dbQuery('update promo_codes set active = $2 where id = $1', [id, active])
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
