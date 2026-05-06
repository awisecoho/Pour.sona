import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedEmail, getInternalMemberByEmail } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireInternalMember() {
  const email = await getAuthenticatedEmail()
  if (!email) {
    return { error: 'unauthorized', status: 401 as const }
  }

  const member = await getInternalMemberByEmail(email)
  if (!member) {
    return { error: 'forbidden', status: 403 as const }
  }

  return { member }
}

type RouteContext = {
  params: {
    id: string
  }
}

export async function GET(_: NextRequest, { params }: RouteContext) {
  try {
    const authz = await requireInternalMember()
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const retailerId = params.id

    const [retailerResult, productsResult, flightsResult, sessionsResult] = await Promise.all([
      dbQuery('select * from retailers where id = $1 limit 1', [retailerId]),
      dbQuery('select * from products where retailer_id = $1 order by sort_order limit 50', [retailerId]),
      dbQuery('select * from flights where retailer_id = $1 order by sort_order', [retailerId]),
      dbQuery(
        `select id, order_status, created_at
         from sessions
         where retailer_id = $1
         order by created_at desc
         limit 10`,
        [retailerId]
      ),
    ])

    const retailer = retailerResult.rows[0] || null
    if (!retailer) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      retailer,
      products: productsResult.rows || [],
      flights: flightsResult.rows || [],
      sessions: sessionsResult.rows || [],
    })
  } catch (error) {
    console.error('[api/poursona-admin/retailer/[id]] get failed:', error)
    return NextResponse.json({ ok: false, error: 'retailer detail failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const authz = await requireInternalMember()
    if ('error' in authz) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const retailerId = params.id
    const updates = await req.json()
    const fields = ['name', 'location', 'tagline', 'brand_color', 'logo_url', 'story', 'culture', 'region'] as const
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
    console.error('[api/poursona-admin/retailer/[id]] update failed:', error)
    return NextResponse.json({ ok: false, error: 'retailer update failed' }, { status: 500 })
  }
}
