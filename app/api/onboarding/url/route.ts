import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-onboard-secret')
    if (!secret || secret !== process.env.POURSONA_ONBOARD_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Block non-HTTP URLs and private/localhost targets
    let parsed: URL
    try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }) }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const draft = await createDraftFromUrl(url)
    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
