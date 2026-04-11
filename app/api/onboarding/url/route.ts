import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    const draft = await createDraftFromUrl(url)
    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}