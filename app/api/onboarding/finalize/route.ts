import { NextRequest, NextResponse } from 'next/server'
import { publishDraft } from '@/lib/onboarding'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const { draftId, ownerEmail } = await req.json()
    if (!draftId) return NextResponse.json({ error: 'Missing draftId' }, { status: 400 })
    const retailer = await publishDraft(draftId, ownerEmail)
    return NextResponse.json({ ok: true, retailer, links: { storefront: `/r/${retailer.slug}`, qr: `/api/qr?slug=${retailer.slug}&format=png`, admin: '/admin' } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}