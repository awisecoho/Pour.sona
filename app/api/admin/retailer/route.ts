import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { authorizeRetailer } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    // Any role tied to the venue may view it (owner-only fields redacted below).
    const authz = await authorizeRetailer(retailerId, 'staff')
    if (!authz.ok) {
      return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery('select * from retailers where id = $1 limit 1', [retailerId])
    const retailer = result.rows[0] || null
    if (retailer && authz.role !== 'owner') {
      delete retailer.owner_email
      delete retailer.stripe_customer_id
      delete retailer.subscription_status
      delete retailer.trial_ends_at
    }
    return NextResponse.json({ ok: true, retailer })
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

    // Editing venue settings requires manager or owner.
    const authz = await authorizeRetailer(retailerId, 'manager')
    if (!authz.ok) {
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
