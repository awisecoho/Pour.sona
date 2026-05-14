import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { success } = await onboardLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }

    let parsed: URL
    try { parsed = new URL(url) } catch {
      return NextResponse.json({ error: 'Invalid URL — please include https://' }, { status: 400 })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'URL must start with https://' }, { status: 400 })
    }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const draft = await createDraftFromUrl(url)
    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to analyze your website. Please try again.' }, { status: 500 })
  }
}
