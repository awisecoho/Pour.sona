import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
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

const SCREEN_PROMPT = (name: string, url: string) =>
  `Look up the website ${url} for "${name}". Check for: product menu, ordering, tasting room, in-person experience.
Respond ONLY with valid JSON, no markdown:
{"score":"hot"|"warm"|"skip","reason":"one sentence","has_menu":true|false,"has_ordering":true|false,"has_tasting_room":true|false,"contact_page_hint":"/contact or unknown"}
Score: hot=menu+ordering/tasting room, warm=menu only, skip=no catalog or chain.`

const MSG_PROMPT = (name: string, url: string, signals: any) =>
  `Write a short contact form message from the founder of Poursona to ${name} (${url}).
About them: ${signals.reason}. They ${signals.has_menu ? 'have a product menu' : "don't have a clear menu"}${signals.has_tasting_room ? ', have a tasting room' : ''}${signals.has_ordering ? ', and offer ordering' : ''}.
Poursona: Customers scan a QR code → natural AI conversation → personalized drink recommendation → order placed. 10-minute retailer setup. Flat monthly SaaS fee.
Write a message that: opens with ONE specific genuine observation, explains Poursona in 1–2 sentences, makes a single low-friction ask (demo or free trial), is 80–110 words, sounds like a real founder, no buzzwords.
Output ONLY the message body. No subject, no sign-off.`

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

      // Step 1 — qualify the business (Sonnet + web search; low max_tokens: JSON only)
      const screenData = await callAnthropic({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: SCREEN_PROMPT(biz.name, biz.url) }],
      })
      const screenText = textFrom(screenData)
      let signals: any = null
      try {
        const match = screenText.match(/\{[\s\S]*?\}/)
        signals = match ? JSON.parse(match[0]) : null
      } catch { /* leave null */ }

      if (!signals || signals.score === 'skip') {
        return NextResponse.json({ ok: true, result: null })
      }

      // Step 2 — draft a personalised message (Haiku: no web search, high TPM limit)
      const msgData = await callAnthropic({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: MSG_PROMPT(biz.name, biz.url, signals) }],
      })
      const message = textFrom(msgData).trim()

      const hint = signals.contact_page_hint
      const contact_url =
        biz.contact_url ||
        (hint && hint !== 'unknown'
          ? hint.startsWith('http')
            ? hint
            : biz.url.replace(/\/$/, '') + '/' + hint.replace(/^\//, '')
          : biz.url)

      return NextResponse.json({ ok: true, result: { ...biz, signals, message, contact_url } })
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[pipeline]', err)
    return NextResponse.json({ error: err.message ?? 'pipeline error' }, { status: 500 })
  }
}
