import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function ensureRetailerAccess(retailerId: string) {
  const identity = await getAuthenticatedIdentity()
  if (!identity) return { error: 'unauthorized', status: 401 as const }

  const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
  if (!accessRows.some((row) => row.retailer_id === retailerId)) {
    return { error: 'forbidden', status: 403 as const }
  }

  return { ok: true as const }
}

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      `select *
       from flights
       where retailer_id = $1
       order by sort_order`,
      [retailerId]
    )

    return NextResponse.json({ ok: true, flights: result.rows })
  } catch (error) {
    console.error('[api/admin/flights] get failed:', error)
    return NextResponse.json({ ok: false, error: 'flights lookup failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { retailerId, ...flight } = await req.json()
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      `insert into flights (retailer_id, name, description, count, pour_size, price, active, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        retailerId,
        flight.name,
        flight.description || null,
        flight.count ?? 4,
        flight.pour_size || '4oz',
        flight.price ?? 0,
        flight.active ?? true,
        flight.sort_order ?? 0,
      ]
    )

    return NextResponse.json({ ok: true, flight: result.rows[0] || null })
  } catch (error) {
    console.error('[api/admin/flights] create failed:', error)
    return NextResponse.json({ ok: false, error: 'flight create failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { retailerId, id, ...updates } = await req.json()
    if (!retailerId || !id) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId or id' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const fields = ['name', 'description', 'count', 'pour_size', 'price', 'active', 'sort_order'] as const
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

    values.push(id, retailerId)
    const result = await dbQuery(
      `update flights
       set ${assignments.join(', ')}
       where id = $${values.length - 1} and retailer_id = $${values.length}
       returning *`,
      values
    )

    return NextResponse.json({ ok: true, flight: result.rows[0] || null })
  } catch (error) {
    console.error('[api/admin/flights] update failed:', error)
    return NextResponse.json({ ok: false, error: 'flight update failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    const id = req.nextUrl.searchParams.get('id')
    if (!retailerId || !id) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId or id' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    await dbQuery('delete from flights where id = $1 and retailer_id = $2', [id, retailerId])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/admin/flights] delete failed:', error)
    return NextResponse.json({ ok: false, error: 'flight delete failed' }, { status: 500 })
  }
}
