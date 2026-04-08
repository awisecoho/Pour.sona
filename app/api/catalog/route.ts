export const dynamic = "force-dynamic";
// app/api/catalog/route.ts
// ─── Product catalog CRUD ─────────────────────────────────────────────────────
// GET    /api/catalog?retailerId=xxx        → list products
// POST   /api/catalog                       → create product
// PUT    /api/catalog                       → update product
// DELETE /api/catalog?id=xxx               → delete product

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET — fetch all products for a retailer
export async function GET(req: NextRequest) {
  const retailerId = req.nextUrl.searchParams.get('retailerId')
  if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('retailer_id', retailerId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — create a new product
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { retailerId, ...product } = body

  if (!retailerId) return NextResponse.json({ error: 'Missing retailerId' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ retailer_id: retailerId, ...product })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — update an existing product
export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove a product
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
