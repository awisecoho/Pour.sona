export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

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
  const retailerId = req.nextUrl.searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

  try {
    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      'select * from products where retailer_id = $1 order by sort_order',
      [retailerId]
    )
    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('[api/catalog] get failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { retailerId, ...product } = await req.json()
    if (!retailerId) {
      return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const result = await dbQuery(
      `insert into products
        (retailer_id, name, description, category, flavor_notes, price, sizes, pairing, sku, in_stock, origin, process, altitude, roast_date, abv, ibu, style, tap_handle, vintage, appellation, varietal, cellar_note, sort_order)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, true), $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, coalesce($23, 0))
       returning *`,
      [
        retailerId,
        product.name,
        product.description || null,
        product.category || null,
        product.flavor_notes || null,
        product.price ?? null,
        product.sizes || null,
        product.pairing || null,
        product.sku || null,
        product.in_stock,
        product.origin || null,
        product.process || null,
        product.altitude || null,
        product.roast_date || null,
        product.abv || null,
        product.ibu || null,
        product.style || null,
        product.tap_handle || null,
        product.vintage || null,
        product.appellation || null,
        product.varietal || null,
        product.cellar_note || null,
        product.sort_order,
      ]
    )
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('[api/catalog] create failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, retailerId: requestedRetailerId, ...updates } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    let retailerId = requestedRetailerId as string | undefined
    if (!retailerId) {
      const productResult = await dbQuery<{ retailer_id: string }>(
        'select retailer_id from products where id = $1 limit 1',
        [id]
      )
      retailerId = productResult.rows[0]?.retailer_id
    }

    if (!retailerId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const fields = [
      'name',
      'description',
      'category',
      'flavor_notes',
      'price',
      'sizes',
      'pairing',
      'sku',
      'in_stock',
      'origin',
      'process',
      'altitude',
      'roast_date',
      'abv',
      'ibu',
      'style',
      'tap_handle',
      'vintage',
      'appellation',
      'varietal',
      'cellar_note',
      'sort_order',
    ] as const
    const assignments: string[] = []
    const values: unknown[] = []
    for (const field of fields) {
      if (field in updates) {
        values.push(updates[field] ?? null)
        assignments.push(`${field} = $${values.length}`)
      }
    }
    if (!assignments.length) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    values.push(id, retailerId)
    const result = await dbQuery(
      `update products
       set ${assignments.join(', ')}
       where id = $${values.length - 1} and retailer_id = $${values.length}
       returning *`,
      values
    )
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('[api/catalog] update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  try {
    let retailerId = req.nextUrl.searchParams.get('retailerId')
    if (!retailerId) {
      const productResult = await dbQuery<{ retailer_id: string }>(
        'select retailer_id from products where id = $1 limit 1',
        [id]
      )
      retailerId = productResult.rows[0]?.retailer_id
    }

    if (!retailerId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    await dbQuery('delete from products where id = $1 and retailer_id = $2', [id, retailerId])
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[api/catalog] delete failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
