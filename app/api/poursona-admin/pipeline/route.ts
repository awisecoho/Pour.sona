import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
import { validateScrapeUrl } from '@/lib/security'
export const dynamic = 'force-dynamic'
// Web-search + possible retries can take a while; give functions enough runway.
export const maxDuration = 120

// ── Auth guard ────────────────────────────────────────────────────────────────
async function requireTeamMember() {
  const identity = await getAuthenticatedIdentity()
  if (!identity?.email) return null
  const member = await getInternalMemberByEmail(identity.email)
  return member ?? null
}

// ── Anthropic proxy with retry ────────────────────────────────────────────────
// Keeps ANTHROPIC_API_KEY on the server; browser never sees it.
// Web-search calls are token-heavy and the 30k TPM rate limit fires quickly.
// We respect the retry-after header and back off up to MAX_RETRY_WAIT ms so a
// single transient 429 doesn't surface as an error to the user.
const MAX_RETRY_WAIT = 15_000  // cap wait per attempt at 15 s (stays within maxDuration)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function callAnthropic(body: object, attempt = 0): Promise<any> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429 && attempt < 3) {
    // Honour Anthropic's retry-after (seconds), fall back to exponential backoff
    const retryAfterSec = parseInt(res.headers.get('retry-after') ?? '0', 10)
    const backoff = Math.min(
      Math.max(retryAfterSec * 1000, Math.pow(2, attempt) * 2000),
      MAX_RETRY_WAIT
    )
    console.warn(`[pipeline] 429 rate limit — waiting ${backoff}ms (attempt ${attempt + 1})`)
    await sleep(backoff)
    return callAnthropic(body, attempt + 1)
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 200)}`)
  }
  return res.json()
}

const textFrom = (data: any): string =>
  (data.content ?? []).map((b: any) => b.text ?? '').join('')

// ── Prompt helpers ────────────────────────────────────────────────────────────
const SEARCH_PROMPT = (verticalLabel: string, location: string) =>
  `Search for independent ${verticalLabel.toLowerCase()} in ${location} with their own websites. Find 5 real independent businesses (no chains/franchises). Return ONLY a JSON array, no markdown:
[{"name":"Business Name","url":"https://website.com","contact_url":"https://website.com/contact"}]
Guess contact_url as /contact or /contact-us. Return exactly 5.`

// Combined screen + message prompt. Runs on Haiku from the venue's OWN page text
// (fetched directly), so it needs NO web search — keeping input tokens tiny.
const SCREEN_AND_MSG_PROMPT = (name: string, url: string, pageText: string) =>
  `You are evaluating a beverage business as a sales prospect for Poursona, then drafting outreach.

Business: ${name} (${url})
${pageText
    ? `Website content (truncated):\n"""\n${pageText}\n"""`
    : `(Their website could not be read automatically — judge from the name/URL and note that manual review is needed.)`}

Poursona: Customers scan a QR code → natural AI conversation → personalized drink recommendation → order placed. 10-minute retailer setup. Flat monthly SaaS fee.

Step 1 — Score the prospect:
  hot  = has a product menu AND (online ordering OR a tasting room/taproom)
  warm = has a menu only, OR the site couldn't be read (needs manual review)
  skip = clearly no catalog, or a national chain/franchise
Step 2 — If hot or warm, write a short contact-form message from the founder of Poursona:
  open with ONE specific genuine observation about THIS business, explain Poursona in 1-2 sentences,
  make a single low-friction ask (demo or free trial), 80-110 words, sound like a real founder,
  no buzzwords, no subject line, no sign-off. If skip, use an empty string.

Respond ONLY with valid JSON, no markdown:
{"score":"hot"|"warm"|"skip","reason":"one sentence","has_menu":true|false,"has_ordering":true|false,"has_tasting_room":true|false,"message":"the message, or empty string"}`

// ── Lightweight site fetch (no web search → minimal input tokens) ──────────────
async function fetchSiteText(url: string, maxChars = 6000): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    const text = html
      .replace(/\x00/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.slice(0, maxChars)
  } catch { return '' }
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const member = await requireTeamMember()
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const { action } = body

  try {
    // ── action: search ──────────────────────────────────────────────────────
    if (action === 'search') {
      const { vertical, location } = body
      if (!vertical?.label || !location) {
        return NextResponse.json({ error: 'missing vertical or location' }, { status: 400 })
      }
      const data = await callAnthropic({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: SEARCH_PROMPT(vertical.label, location) }],
      })
      const text = textFrom(data)
      let businesses: any[] = []
      try {
        const match = text.replace(/```json|```/g, '').match(/\[[\s\S]*\]/)
        const parsed = match ? JSON.parse(match[0]) : []
        // Assign a stable id for React key / state tracking
        businesses = parsed.map((b: any, i: number) => ({
          ...b,
          id: `${i}-${(b.name ?? '').replace(/\s+/g, '-').toLowerCase().slice(0, 30)}`,
        }))
      } catch { /* return empty */ }
      return NextResponse.json({ ok: true, businesses })
    }

    // ── action: screen ──────────────────────────────────────────────────────
    if (action === 'screen') {
      const { biz } = body
      if (!biz?.name || !biz?.url) {
        return NextResponse.json({ error: 'missing biz.name or biz.url' }, { status: 400 })
      }

      // Fetch the venue's own page text directly (SSRF-guarded). This replaces the
      // web-search screen call that blew past the 30k TPM org limit on every run.
      let pageText = ''
      const safe = validateScrapeUrl(biz.url)
      if (safe.ok) pageText = await fetchSiteText(safe.url.toString())

      // Single Haiku call: classify AND draft the message. No web search → tiny
      // input footprint, and Haiku's TPM limit is far higher than Sonnet's.
      const data = await callAnthropic({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: SCREEN_AND_MSG_PROMPT(biz.name, biz.url, pageText) }],
      })
      let parsed: any = null
      try {
        const match = textFrom(data).match(/\{[\s\S]*\}/)
        parsed = match ? JSON.parse(match[0]) : null
      } catch { /* leave null */ }

      if (!parsed || parsed.score === 'skip') {
        return NextResponse.json({ ok: true, result: null })
      }

      const signals = {
        score: parsed.score,
        reason: parsed.reason ?? '',
        has_menu: !!parsed.has_menu,
        has_ordering: !!parsed.has_ordering,
        has_tasting_room: !!parsed.has_tasting_room,
      }
      const message = (parsed.message ?? '').trim()
      const contact_url = biz.contact_url || biz.url.replace(/\/$/, '') + '/contact'

      return NextResponse.json({ ok: true, result: { ...biz, signals, message, contact_url } })
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[pipeline]', err)
    return NextResponse.json({ error: err.message ?? 'pipeline error' }, { status: 500 })
  }
}
