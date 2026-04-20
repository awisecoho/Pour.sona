import { NextRequest, NextResponse } from 'next/server'
import { rescanRetailer } from '@/lib/onboarding'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { retailerId, url, mode } = await req.json()
    if (!retailerId || !url || !mode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!['catalog', 'branding', 'full'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    const result = await rescanRetailer(retailerId, url, mode)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
