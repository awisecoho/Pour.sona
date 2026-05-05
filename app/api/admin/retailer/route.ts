import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function getAuthorizedRetailer(retailerId: string) {
  const identity = await getAuthenticatedIdentity()
  if (!identity) return { error: 'unauthorized', status: 401 as const }

  const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
  const access = accessRows.find((row) => row.retailer_id === retailerId)
  if (!access) return { error: 'forbidden', status: 403 as const }

  return { access }
}

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await getAuthorizedRetailer(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery('select * from retailers where id = $1 limit 1', [retailerId])
    return NextResponse.json({ ok: true, retailer: result.rows[0] || null })
  } catch (error) {
    console.error('[api/admin/retailer] get failed:', error)
    return NextResponse.json({ ok: false, error: 'retailer lookup failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { retailerId, ...updates } = await req.json()
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await getAuthorizedRetailer(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const fields = ['name', 'tagline', 'location', 'brand_color'] as const
    const assignments: string[] = []
    const values: unknown[] = []

    for (const field of fields) {
      if (field in updates) {
        values.push(updates[field] ?? null)
        assignments.push(`${field} = $${values.length}`)
      }
    }

    if (!assignments.length) {
      return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 })
    }

    values.push(retailerId)
    const result = await dbQuery(
      `update retailers
       set ${assignments.join(', ')}
       where id = $${values.length}
       returning *`,
      values
    )

    return NextResponse.json({ ok: true, retailer: result.rows[0] || null })
  } catch (error) {
    console.error('[api/admin/retailer] update failed:', error)
    return NextResponse.json({ ok: false, error: 'retailer update failed' }, { status: 500 })
  }
}
