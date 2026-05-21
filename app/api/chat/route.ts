import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompts'
import { dbQuery } from '@/lib/db'
import { sendTrialExpiredNotice, sendTrialExpiringWarning, sendAiCapNotice } from '@/lib/email'
import { billingUrl } from '@/lib/urls'
import { checkOrigin } from '@/lib/security'
import { chatLimiter, getIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api'
export const dynamic = 'force-dynamic'

// ── Cost guardrails ───────────────────────────────────────────────────────────
// These bound per-chat token spend so a venue stays well under its monthly AI
// budget regardless of catalog size or how long a guest rambles.
const MAX_CATALOG_ITEMS = 24      // SKUs injected into the prompt (relevance-filtered)
const MAX_HISTORY_MESSAGES = 14   // recent turns sent to the model
const MAX_USER_TURNS = 5          // after this many guest messages, force a recommendation

// Per-venue monthly AI budget. Haiku pricing ≈ $1/M input, $5/M output.
const AI_MONTHLY_BUDGET_USD   = Number(process.env.AI_MONTHLY_BUDGET_USD   || 15)
const AI_INPUT_USD_PER_MTOK   = Number(process.env.AI_INPUT_USD_PER_MTOK   || 1)
const AI_OUTPUT_USD_PER_MTOK  = Number(process.env.AI_OUTPUT_USD_PER_MTOK  || 5)

function monthlyCostUsd(inputTok: number, outputTok: number): number {
  return (inputTok / 1e6) * AI_INPUT_USD_PER_MTOK + (outputTok / 1e6) * AI_OUTPUT_USD_PER_MTOK
}

/** Usage so far this calendar month — treats a stale reset timestamp as zero. */
function effectiveMonthlyUsage(retailer: any): { input: number; output: number } {
  const reset = retailer.ai_month_reset_at ? new Date(retailer.ai_month_reset_at) : null
  const d = new Date()
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  const active = reset && reset.getTime() >= monthStart
  return {
    input: active ? Number(retailer.ai_input_tokens_month || 0) : 0,
    output: active ? Number(retailer.ai_output_tokens_month || 0) : 0,
  }
}

/** A no-AI recommendation built straight from the catalog, used when a venue is
 *  over its monthly AI budget so the guest experience never goes dark. */
function buildFallbackRecommendation(products: any[]): any | null {
  const pick = products[0]
  if (!pick) return null
  return {
    format: 'single',
    recommendationName: pick.name,
    tagline: 'A guest favorite',
    selectedProducts: [{ name: pick.name, why: 'One of our most-loved picks — ask our staff to tell you more.', price: pick.price ?? null }],
    flightDetails: null,
    flavorProfile: [pick.style, pick.category].filter(Boolean).slice(0, 3),
    story: pick.description || '',
    whyItFitsYou: 'A reliable crowd-pleaser to start with.',
    serveNote: '',
  }
}

const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }

/** Streamed response served when a venue has exhausted its monthly AI budget. */
function degradedResponse(products: any[]): Response {
  const rec = buildFallbackRecommendation(products)
  const msg = rec
    ? "Our AI guide is taking a quick breather — but here's a guest favorite to get you started. Ask our staff and they'll help you explore more."
    : 'Our AI guide is resting for the moment — please ask our staff and they\'ll point you to a great pick.'
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: msg }) + '\n\n'))
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ done: true, text: msg, recData: rec, chips: [] }) + '\n\n'))
      controller.close()
    },
  })
  return new Response(readable, { headers: SSE_HEADERS })
}

/**
 * Pick the most relevant in-stock products for the current conversation instead
 * of dumping the whole catalog into every prompt. Keyword overlap against the
 * guest's messages; falls back to catalog order when nothing matches or there's
 * no conversation yet (the opening turn).
 */
function selectRelevantProducts(products: any[], convoText: string, max: number): any[] {
  if (products.length <= max) return products
  const text = convoText.toLowerCase()
  const tokens = Array.from(new Set(text.split(/[^a-z0-9]+/).filter(w => w.length >= 3)))
  if (tokens.length === 0) return products.slice(0, max)
  const scored = products.map((p, idx) => {
    const hay = [p.name, p.category, p.style, p.flavor_notes, p.description]
      .filter(Boolean).join(' ').toLowerCase()
    let score = 0
    for (const t of tokens) if (hay.includes(t)) score++
    return { p, score, idx }
  })
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx)
  return scored.slice(0, max).map(s => s.p)
}

/**
 * Hard guardrail against hallucinated recommendations: every product in the REC
 * block must exist in the live in-stock catalog. Off-menu items are dropped; if
 * nothing valid remains, the recommendation is discarded entirely.
 */
function validateRecAgainstCatalog(recData: any, products: any[]): any | null {
  if (!recData) return null
  const names = new Set(products.map(p => String(p.name || '').trim().toLowerCase()))
  if (Array.isArray(recData.selectedProducts)) {
    const filtered = recData.selectedProducts.filter(
      (sp: any) => sp && typeof sp.name === 'string' && names.has(sp.name.trim().toLowerCase())
    )
    if (filtered.length === 0) return null
    recData.selectedProducts = filtered
  }
  return recData
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    // Rate-limit by IP — fail closed: if Redis is unavailable, block rather than
    // allow unlimited Claude API calls that could exhaust credits.
    try {
      const { success } = await chatLimiter.limit(getIp(req))
      if (!success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    } catch {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const { sessionId, retailerSlug, messages } = await req.json()
    if (!sessionId || !retailerSlug) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const retailerResult = await dbQuery(
      'select * from retailers where slug = $1 limit 1',
      [retailerSlug]
    )
    const retailer = retailerResult.rows[0]
    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    // Validate session belongs to this retailer (prevents cross-retailer session writes)
    const sessionCheck = await dbQuery(
      'select retailer_id from sessions where id = $1 limit 1',
      [sessionId]
    )
    if (sessionCheck.rows[0] && sessionCheck.rows[0].retailer_id !== retailer.id) {
      return NextResponse.json({ error: 'invalid session' }, { status: 403 })
    }

    const now = new Date()
    const trialEnd = retailer.trial_ends_at ? new Date(retailer.trial_ends_at) : null
    const subStatus = retailer.subscription_status
    if (retailer.active === false || subStatus === 'cancelled' || subStatus === 'expired') {
      return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 })
    }
    if (subStatus === 'trial' && trialEnd && now > trialEnd) {
      await dbQuery(
        "update retailers set subscription_status = 'expired' where id = $1",
        [retailer.id]
      )
      if (retailer.owner_email) {
        // Non-fatal: fire and don't block the 402 response
        sendTrialExpiredNotice({
          to: retailer.owner_email,
          retailerName: retailer.name,
          upgradeUrl: billingUrl(),
        }).then(r => {
          if (!r.ok) console.error('[chat] sendTrialExpiredNotice failed:', r.error)
        })
      }
      return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 })
    }

    if (subStatus === 'trial' && trialEnd) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 3 && retailer.owner_email) {
        // Atomic claim: UPDATE only succeeds when no warning has been sent in
        // the last 24 hours.  Concurrent requests racing here will both attempt
        // the UPDATE, but only one will receive RETURNING id — ensuring exactly
        // one email per day regardless of concurrent chat activity.
        const claimed = await dbQuery<{ id: string }>(
          `UPDATE retailers
           SET trial_warning_sent_at = now()
           WHERE id = $1
             AND (trial_warning_sent_at IS NULL
                  OR trial_warning_sent_at < now() - interval '24 hours')
           RETURNING id`,
          [retailer.id]
        )
        if (claimed.rows.length > 0) {
          const result = await sendTrialExpiringWarning({
            to: retailer.owner_email,
            retailerName: retailer.name,
            daysLeft,
            upgradeUrl: billingUrl(),
          })
          if (!result.ok) {
            // Revert the claim so the warning can be retried on the next request.
            console.error('[chat] sendTrialExpiringWarning failed:', result.error)
            dbQuery(
              'UPDATE retailers SET trial_warning_sent_at = NULL WHERE id = $1',
              [retailer.id]
            ).catch(() => {})
          }
        }
      }
    }

    const [productsResult, flightsResult] = await Promise.all([
      dbQuery(
        'select * from products where retailer_id = $1 and in_stock = true order by sort_order limit 80',
        [retailer.id]
      ),
      dbQuery(
        'select * from flights where retailer_id = $1 and active = true',
        [retailer.id]
      ),
    ])

    const apiMessages = [...messages]

    // Relevance-filter the catalog to the conversation so we send ~24 SKUs, not 80.
    const convoText = apiMessages
      .filter((m: any) => m.role === 'user' && m.content !== 'START')
      .map((m: any) => m.content)
      .join(' ')
    const inStockProducts = productsResult.rows
    const promptProducts = selectRelevantProducts(inStockProducts, convoText, MAX_CATALOG_ITEMS)

    // Per-venue monthly AI budget. Over the cap → serve a catalog fallback (no LLM
    // call) so the guest experience never goes dark and the venue stays under its
    // cost ceiling. Owner gets a one-per-month upsell nudge.
    const usage = effectiveMonthlyUsage(retailer)
    if (monthlyCostUsd(usage.input, usage.output) >= AI_MONTHLY_BUDGET_USD) {
      if (retailer.owner_email) {
        const claimed = await dbQuery<{ id: string }>(
          `UPDATE retailers SET ai_cap_notified_at = now()
           WHERE id = $1 AND (ai_cap_notified_at IS NULL OR ai_cap_notified_at < date_trunc('month', now()))
           RETURNING id`,
          [retailer.id]
        )
        if (claimed.rows.length > 0) {
          sendAiCapNotice({ to: retailer.owner_email, retailerName: retailer.name, upgradeUrl: billingUrl() })
            .then(r => { if (!r.ok) console.error('[chat] sendAiCapNotice failed:', r.error) })
        }
      }
      return degradedResponse(inStockProducts)
    }

    let systemPrompt = buildSystemPrompt(retailer, promptProducts, flightsResult.rows)

    // Turn cap: after enough back-and-forth, force the recommendation so a chat
    // can't run unbounded (cost) or frustrate the guest.
    const userTurns = apiMessages.filter((m: any) => m.role === 'user').length
    if (userTurns >= MAX_USER_TURNS) {
      systemPrompt += `\n\nIMPORTANT: The guest has answered enough. Do NOT ask another question. Give your final recommendation now in this message using the ===REC=== format.`
    }

    // Trim history sent to the model to the most recent turns (bounds input tokens).
    const modelMessages = apiMessages.slice(-MAX_HISTORY_MESSAGES).map((m: any) => ({ role: m.role, content: m.content }))

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: systemPrompt,
      messages: modelMessages,
    })

    const encoder = new TextEncoder()
    let fullText = ''
    let inputTokens = 0
    let outputTokens = 0

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const c = chunk as any
            if (chunk.type === 'message_start') inputTokens = c.message?.usage?.input_tokens || 0
            else if (chunk.type === 'message_delta') outputTokens = c.usage?.output_tokens ?? outputTokens
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: chunk.delta.text }) + '\n\n'))
            }
          }

          // Meter usage against the venue's monthly budget (resets each calendar
          // month). Fire-and-forget; never blocks the response.
          dbQuery(
            `UPDATE retailers SET
               ai_input_tokens_month  = CASE WHEN ai_month_reset_at IS NULL OR ai_month_reset_at < date_trunc('month', now()) THEN $2 ELSE ai_input_tokens_month  + $2 END,
               ai_output_tokens_month = CASE WHEN ai_month_reset_at IS NULL OR ai_month_reset_at < date_trunc('month', now()) THEN $3 ELSE ai_output_tokens_month + $3 END,
               ai_month_reset_at      = CASE WHEN ai_month_reset_at IS NULL OR ai_month_reset_at < date_trunc('month', now()) THEN date_trunc('month', now()) ELSE ai_month_reset_at END
             WHERE id = $1`,
            [retailer.id, inputTokens, outputTokens]
          ).catch(() => {})
          let recData = null
          const recMatch = fullText.match(/===REC===([\s\S]*?)===END===/)
          if (recMatch) {
            try { recData = JSON.parse(recMatch[1].trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()) } catch {}
          }
          // Hard-constrain the recommendation to real in-stock SKUs (drop hallucinations).
          recData = validateRecAgainstCatalog(recData, inStockProducts)
          // Quick-reply chips suggested by the AI for the question it just asked,
          // so the tappable options always match the question.
          let chips: string[] = []
          const chipsMatch = fullText.match(/===CHIPS===([\s\S]*?)===END===/)
          if (chipsMatch) {
            try {
              const parsed = JSON.parse(chipsMatch[1].trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim())
              if (Array.isArray(parsed)) chips = parsed.filter((c: unknown) => typeof c === 'string').slice(0, 4)
            } catch {}
          }
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ done: true, text: fullText, recData, chips }) + '\n\n'))
          dbQuery(
            `update sessions set
               messages = $2::jsonb,
               order_status = $3,
               recommended_at = $4,
               blend_name = $5,
               blend_data = $6::jsonb
             where id = $1`,
            [
              sessionId,
              JSON.stringify(apiMessages),
              recData ? 'recommended' : 'browsing',
              recData ? new Date().toISOString() : null,
              recData?.recommendationName || null,
              JSON.stringify(recData || null),
            ]
          ).catch(() => {})
          controller.close()
        } catch {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ error: 'Stream error' }) + '\n\n'))
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }
    })
  } catch (err) {
    return apiError(err, 'Chat request failed')
  }
}
