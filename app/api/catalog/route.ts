export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { validateLogoUrl } from '@/lib/security'
import { apiError } from '@/lib/api'

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
  const sp = req.nextUrl.searchParams
  const retailerId = sp.get('retailerId')
  if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

  try {
    const authz = await ensureRetailerAccess(retailerId)
    if ('error' in authz) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }

    const search = sp.get('search')?.trim() || ''
    const pat    = search ? `%${search}%` : ''
    // Default limit is intentionally large to preserve existing behaviour
    // (in-stock / off-menu split happens client-side on the returned page).
    const page   = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const limit  = Math.min(Math.max(1, parseInt(sp.get('limit') || '200', 10) || 200), 200)
    const offset = (page - 1) * limit

    const result = await dbQuery<Record<string, unknown>>(
      `SELECT *, COUNT(*) OVER() AS total_count
       FROM products
       WHERE retailer_id = $1
         AND ($2::text = '' OR name        ILIKE $3
                            OR category    ILIKE $3
                            OR style       ILIKE $3
                            OR flavor_notes ILIKE $3
                            OR description ILIKE $3)
       ORDER BY sort_order, name
       LIMIT $4 OFFSET $5`,
      [retailerId, search, pat, limit, offset]
    )

    const totalCount = result.rows[0] ? parseInt(String(result.rows[0].total_count), 10) : 0
    const products = result.rows.map(({ total_count, ...p }) => p)

    return NextResponse.json({
      ok: true,
      products,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    })
  } catch (error: unknown) {
    console.error('[api/catalog] get failed:', error)
    return apiError(error, 'Catalog operation failed')
  }
}

/**
 * Product image URLs render in the guest <img>; require https on a public
 * host (same SSRF/safety bar as retailer logos). Empty/absent clears to null.
 */
function cleanImageUrl(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw == null || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false }
  const check = validateLogoUrl(raw.trim())
  return check.ok ? { ok: true, value: check.url.toString() } : { ok: false }
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

    const imageUrl = cleanImageUrl(product.image_url)
    if (!imageUrl.ok) {
      return NextResponse.json({ error: 'Image URL must be a public https URL' }, { status: 400 })
    }

    const result = await dbQuery(
      `insert into products
        (retailer_id, name, description, category, flavor_notes, price, sizes, pairing, sku, in_stock, origin, process, altitude, roast_date, abv, ibu, style, tap_handle, vintage, appellation, varietal, cellar_note, sort_order, image_url)
       values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, true), $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, coalesce($23, 0), $24)
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
        imageUrl.value,
      ]
    )
    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('[api/catalog] create failed:', error)
    return apiError(error, 'Catalog operation failed')
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
      'image_url',
    ] as const
    const assignments: string[] = []
    const values: unknown[] = []
    for (const field of fields) {
      if (field in updates) {
        let value: unknown = updates[field] ?? null
        if (field === 'image_url') {
          const cleaned = cleanImageUrl(updates[field])
          if (!cleaned.ok) {
            return NextResponse.json({ error: 'Image URL must be a public https URL' }, { status: 400 })
          }
          value = cleaned.value
        }
        values.push(value)
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
    return apiError(error, 'Catalog operation failed')
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
    return apiError(error, 'Catalog operation failed')
  }
}
