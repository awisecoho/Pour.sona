import { NextRequest, NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/auth'
import { validateScrapeUrl } from '@/lib/security'
export const dynamic = 'force-dynamic'
// Web-search + possible retries can take a while; give functions enough runway.
export const maxDuration = 120


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

// Vertical-specific noun for the AI guide we'd build for this prospect.
// Drives the "your personal digitalized X" phrasing in the outreach message,
// so a coffee roaster hears "Coffee Sommelier" while a brewery hears
// "Beer Curator" — much warmer than a generic "AI assistant".
const PERSONA_BY_VERTICAL: Record<string, string> = {
  coffee:     'Coffee Sommelier',
  winery:     'Wine Sommelier',
  brewery:    'Beer Curator',
  distillery: 'Spirits Guide',
  bottle:     'Bottle Shop Concierge',
  tea:        'Tea Sommelier',
}

// In-person experience phrase per vertical — what we'd be "alongside".
const IN_PERSON_BY_VERTICAL: Record<string, string> = {
  coffee:     'in-person tastings and cuppings',
  winery:     'in-person tastings',
  brewery:    'taproom experience',
  distillery: 'tasting-room pours',
  bottle:     'in-store guidance',
  tea:        'in-person tastings',
}

// Combined screen + message prompt. Runs on Haiku from the venue's OWN page text
// (fetched directly), so it needs NO web search — keeping input tokens tiny.
const SCREEN_AND_MSG_PROMPT = (name: string, url: string, pageText: string, verticalId: string) => {
  const persona = PERSONA_BY_VERTICAL[verticalId] || 'AI Sommelier'
  const inPerson = IN_PERSON_BY_VERTICAL[verticalId] || 'in-person experience'
  return `You are evaluating a beverage business as a sales prospect for Poursona, then drafting outreach.

Business: ${name} (${url})
Category: ${verticalId}
${pageText
    ? `Website content (truncated):\n"""\n${pageText}\n"""`
    : `(Their website could not be read automatically — judge from the name/URL and note that manual review is needed.)`}

Poursona: A vendor-specific AI guide that lives at a QR code. Each venue gets its own digitalized "${persona}" trained on their actual menu, brand story, and tone — not a generic chatbot. Customers scan, have a natural conversation about their taste, and get a recommendation that feels like talking to the venue's own expert. ~10 minute setup; runs on the vendor's own product offerings.

Step 1 — Score the prospect:
  hot  = has a product menu AND (online ordering OR a tasting room/taproom)
  warm = has a menu only, OR the site couldn't be read (needs manual review)
  skip = clearly no catalog, or a national chain/franchise

Step 2 — If hot or warm, write a contact-form message from the founder of Poursona that:
  • Opens with ONE specific genuine observation about THIS business (something you saw on their site — not generic praise)
  • Bridges that observation to what Poursona does for them, NOT what Poursona is in the abstract
  • Uses possessive "your" language to make it feel custom-built for them: "your customers", "your personal digitalized ${persona}", "your personalized offerings", "your ${inPerson}"
  • Names the persona explicitly: "their personal digitalized ${persona}" — this is the brand-specific guide we'd build for them
  • Closes with TWO asks layered together: (1) a soft demo question, (2) a low-friction offer to BUILD them a personal experience to try ("I'd be happy to spin up a personal experience for you to test")
  • 90-130 words for the BODY (excluding the sign-off block below), sounds like a real founder talking — warm, specific, confident
  • No buzzwords, no subject line inside the body

  THEN end with the SIGN-OFF block exactly as shown — two short lines, on their own, after a blank line. Always include these TWO links verbatim so the recipient has a one-click path to try Poursona and to learn more:

  ---
  Try Now → https://pour-sona.com/signup
  https://pour-sona.com
  ---

  Output the sign-off block exactly like that — the "Try Now" line first, the full website URL second, NO other CTA copy, NO "Best, Andy" / "Cheers" / signature name (the user adds their own name when they paste). The two links are mandatory.

  If skip, use an empty string for message.

  STRUCTURE TEMPLATE (rewrite the body naturally, don't copy verbatim; sign-off stays as shown):
  "I noticed [specific observation about their site/offering]. That [hands-on / craft / curated quality] is exactly what Poursona does digitally. Your customers scan a personalized QR code, have a natural conversation about their taste with your personal digitalized ${persona}, and get a recommendation that fits THEM before ordering. It takes about 10 minutes to set up and runs on your personalized offerings. Would you be open to a quick demo to see how it could work alongside your ${inPerson}? I'd be happy to spin up a personal experience for you to try.

  Try Now → https://pour-sona.com/signup
  https://pour-sona.com"

Step 3 — If hot or warm, write an email SUBJECT LINE designed to actually get opened:
  • 4-8 words, sentence case (no ALL CAPS, no Title Case)
  • Specific to THIS business — mention them by name OR a detail you noticed on their site
  • Open-curiosity hook OR a one-line benefit, not a sales pitch
  • Sounds like a real person, NOT marketing copy
  • Absolutely no: "Re:", "Fwd:", "Hi", "Hello", emojis, "introducing", "leveraging", "synergies", "[BRACKETS]"
  Good examples (for context only — write a fresh one):
    "your personal ${persona.toLowerCase()} for ${name}"
    "saw your menu — small thought"
    "${name} guests asking for menu help?"
  If skip, use an empty string.

Respond ONLY with valid JSON, no markdown:
{"score":"hot"|"warm"|"skip","reason":"one sentence","has_menu":true|false,"has_ordering":true|false,"has_tasting_room":true|false,"subject":"the subject line, or empty string","message":"the message, or empty string"}`
}

// ── Contact extraction ────────────────────────────────────────────────────────
// Pulled from the raw HTML we already fetch for screening, so it costs nothing
// extra. Surfaces real channels instead of a guessed /contact URL that 404s.
interface SiteContacts {
  email: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  twitter: string | null
  contactPage: string | null
}

const absolutize = (href: string, base: string): string | null => {
  try { return new URL(href.replace(/&amp;/g, '&'), base).toString() } catch { return null }
}

const firstUrl = (html: string, re: RegExp): string | null => {
  const m = html.match(re)
  return m ? m[0].replace(/&amp;/g, '&').replace(/^http:/, 'https:') : null
}

function extractContacts(html: string, baseUrl: string): SiteContacts {
  // Email: prefer mailto:, then fall back to bare addresses (filtering asset/vendor noise)
  let email: string | null = null
  const mailto = html.match(/mailto:([^"'?>\s]+)/i)
  if (mailto) {
    email = decodeURIComponent(mailto[1]).toLowerCase()
  } else {
    for (const m of html.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) {
      const e = m[0].toLowerCase()
      if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(e)) continue
      if (/(sentry|example\.com|wixpress|\.wix|sentry\.io|godaddy|squarespace\.com|cloudflare|domain\.com|email\.com|yourdomain)/.test(e)) continue
      email = e
      break
    }
  }

  // Social profiles (first occurrence of each)
  const instagram = firstUrl(html, /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.][A-Za-z0-9_./-]*/i)
  const facebook  = firstUrl(html, /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.][A-Za-z0-9_./-]*/i)
  const linkedin  = firstUrl(html, /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_.][A-Za-z0-9_./-]*/i)
  const twitter   = firstUrl(html, /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+/i)

  // Real contact-page link. Only look at <a> anchors (not <link> stylesheets),
  // skip asset/plugin URLs (e.g. the Contact Form 7 stylesheet
  // contact-form-7/.../styles.css), and require a contact-like URL *path*.
  let contactPage: string | null = null
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const href = m[1]
    if (/\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|pdf|mp4|zip)(\?|#|$)/i.test(href)) continue
    if (/(wp-content|wp-includes|\/plugins\/|\/themes\/|\/css\/|\/js\/|contact-form-7)/i.test(href)) continue
    const abs = absolutize(href, baseUrl)
    if (!abs) continue
    try {
      const path = new URL(abs).pathname.toLowerCase()
      if (/(^|\/)(contact|contact-us|contactus|get-in-touch|reach-us|connect)(\/|$)/.test(path)) {
        contactPage = abs
        break
      }
    } catch { /* skip unparseable */ }
  }

  return { email, instagram, facebook, linkedin, twitter, contactPage }
}

// ── Lightweight site fetch (no web search → minimal input tokens) ──────────────
// Returns BOTH the stripped text (for the model) and the contact channels parsed
// from the raw HTML.
async function fetchSite(url: string, maxChars = 6000): Promise<{ text: string; contacts: SiteContacts }> {
  const empty: SiteContacts = { email: null, instagram: null, facebook: null, linkedin: null, twitter: null, contactPage: null }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 PoursonaBot/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { text: '', contacts: empty }
    const html = (await res.text()).replace(/\x00/g, '')
    const contacts = extractContacts(html, url)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars)
    return { text, contacts }
  } catch { return { text: '', contacts: empty } }
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
      const { biz, vertical } = body
      if (!biz?.name || !biz?.url) {
        return NextResponse.json({ error: 'missing biz.name or biz.url' }, { status: 400 })
      }
      // verticalId is used by SCREEN_AND_MSG_PROMPT to pick vertical-specific
      // wording (Coffee Sommelier vs Beer Curator etc.). Default to coffee if
      // the client forgot to send one — keeps backward compatibility with any
      // cached/in-flight requests from before the multi-vertical update.
      const verticalId: string = typeof vertical?.id === 'string' ? vertical.id : 'coffee'

      // Fetch the venue's own page directly (SSRF-guarded). This replaces the
      // web-search screen call that blew past the 30k TPM org limit, and lets us
      // harvest real contact channels (email/socials/contact page) from the HTML.
      let pageText = ''
      let contacts: SiteContacts = { email: null, instagram: null, facebook: null, linkedin: null, twitter: null, contactPage: null }
      const safe = validateScrapeUrl(biz.url)
      if (safe.ok) {
        const site = await fetchSite(safe.url.toString())
        pageText = site.text
        contacts = site.contacts
      }

      // Single Haiku call: classify AND draft the message. No web search → tiny
      // input footprint, and Haiku's TPM limit is far higher than Sonnet's.
      const data = await callAnthropic({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        messages: [{ role: 'user', content: SCREEN_AND_MSG_PROMPT(biz.name, biz.url, pageText, verticalId) }],
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
      const SIGNUP_URL = 'https://pour-sona.com/signup'
      const WEBSITE_URL = 'https://pour-sona.com'
      let message = (parsed.message ?? '').trim()
      // Guarantee the sign-off is present even if the model omitted it.
      if (message && !message.includes(SIGNUP_URL)) {
        message += `\n\nTry Now → ${SIGNUP_URL}\n${WEBSITE_URL}`
      }
      // Subject sanitization: strip line breaks (mailto: links break on \n) and
      // any "Subject:" prefix the model occasionally hallucinates. Cap length so
      // we don't blow past mail-client subject-line limits.
      const rawSubject = String(parsed.subject ?? '').replace(/[\r\n]+/g, ' ').replace(/^\s*subject\s*:\s*/i, '').trim()
      const subject = rawSubject.slice(0, 120)
      // Prefer a real discovered contact page; fall back to the search guess, then homepage.
      const contact_url = contacts.contactPage || biz.contact_url || biz.url

      return NextResponse.json({ ok: true, result: { ...biz, signals, subject, message, contact_url, contacts } })
    }

    return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[pipeline]', err)
    return NextResponse.json({ error: err.message ?? 'pipeline error' }, { status: 500 })
  }
}
