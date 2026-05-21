import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
import { validateScrapeUrl } from '@/lib/security'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { success } = await onboardLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { url } = await req.json()
    // Full SSRF guard — covers loopback, RFC1918 (10/8, 172.16/12, 192.168/16),
    // 0.0.0.0/8, 169.254/16 (cloud metadata), IPv6 private ranges, *.local,
    // *.internal, and embedded credentials — not just the partial subset that
    // was here before.
    const validated = validateScrapeUrl(url)
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error === 'Missing url' ? 'Missing url' : 'Invalid URL — please include https://' },
        { status: 400 }
      )
    }

    const draft = await createDraftFromUrl(validated.url.toString())
    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    return apiError(err, 'Failed to analyze your website. Please try again.')
  }
}
