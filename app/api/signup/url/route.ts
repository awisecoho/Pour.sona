import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
import { onboardLimiter, getIp } from '@/lib/rate-limit'
import { validateScrapeUrl } from '@/lib/security'
import { apiError } from '@/lib/api'
import { extractContactEmail } from '@/lib/contact-extract'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // website analysis pipeline: crawl + 5 LLM calls can take 60–120s

// Best-effort secondary fetch to surface a public contact email for prefill.
// The main scrape pipeline strips HTML before passing to the LLM agents, so the
// mailto/bare-email signal would be lost otherwise. We keep this on a tight
// timeout because a failure here must NOT block the draft response.
async function fetchEmailFromSite(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = (await res.text()).replace(/\x00/g, '')
    return extractContactEmail(html)
  } catch { return null }
}

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

    // Run the main draft pipeline and the email extraction in parallel so we
    // don't pay a serial-fetch tax on the user.
    const safeUrl = validated.url.toString()
    const [draft, discoveredEmail] = await Promise.all([
      createDraftFromUrl(safeUrl),
      fetchEmailFromSite(safeUrl),
    ])
    return NextResponse.json({ ok: true, draft, discoveredEmail })
  } catch (err: any) {
    return apiError(err, 'Failed to analyze your website. Please try again.')
  }
}
