import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompts'
import { dbQuery } from '@/lib/db'
import { sendTrialExpiredNotice, sendTrialExpiringWarning, sendAiCapNotice, sendAiBudgetWarning } from '@/lib/email'
import { billingUrl } from '@/lib/urls'
import { checkOrigin } from '@/lib/security'
import { chatLimiter, getIp } from '@/lib/rate-limit'
import { apiError } from '@/lib/api'
import {
  MAX_CATALOG_ITEMS,
  MAX_HISTORY_MESSAGES,
  AI_MONTHLY_BUDGET_USD,
  monthlyCostUsd,
  effectiveMonthlyUsage,
  buildFallbackRecommendation,
  selectRelevantProducts,
  validateRecAgainstCatalog,
  rankProductsByPopularity,
  droppedHallucinations,
} from '@/lib/chat-guardrails'
import { getQuestionBounds, resolveAssistantProfile } from '@/lib/agent/profile'
import { enrichRecommendationWithCatalog } from '@/lib/recommendation-enrich'
import { parseBeverageDNA } from '@/lib/agent/beverage-dna'
export const dynamic = 'force-dynamic'

const SSE_HEADERS = { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' }

/** Streamed response served when a venue has exhausted its monthly AI budget. */
function degradedResponse(products: any[], retailer?: any): Response {
  let rec = buildFallbackRecommendation(products)
  // Phase 3: still enrich the fallback so the catalog image shows up.
  rec = enrichRecommendationWithCatalog(rec, products)
  const msg = rec
    ? "Our AI guide is taking a quick breather — but here's a guest favorite to get you started. Ask our staff and they'll help you explore more."
    : 'Our AI guide is resting for the moment — please ask our staff and they\'ll point you to a great pick.'
  const profile = retailer ? resolveAssistantProfile(retailer) : null
  const ctas = profile ? { primary: profile.cta_primary, secondary: profile.cta_secondary } : undefined
  const fallbackLine = profile?.fallback_line
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: msg }) + '\n\n'))
      controller.enqueue(encoder.encode('data: ' + JSON.stringify({ done: true, text: msg, recData: rec, chips: [], ctas, fallbackLine }) + '\n\n'))
      controller.close()
    },
  })
  return new Response(readable, { headers: SSE_HEADERS })
}

/**
 * Order the in-stock catalog by real popularity (most-ordered first over the
 * trailing 90 days) so the degraded/over-budget fallback surfaces a genuine
 * guest favorite instead of whatever sorts first. Best-effort: any DB failure
 * or an empty order history returns the catalog unchanged.
 */
async function rankInStockByPopularity(retailerId: string, products: any[]): Promise<any[]> {
  if (products.length <= 1) return products
  try {
    // Pre-filter to array-typed items in the subquery so jsonb_array_elements
    // never sees a non-array row (older/malformed orders) and throws.
    const res = await dbQuery<{ name: string }>(
      `SELECT lower(item->>'name') AS name, COUNT(*)::int AS n
         FROM (
           SELECT items FROM orders
            WHERE retailer_id = $1
              AND created_at > now() - interval '90 days'
              AND jsonb_typeof(items) = 'array'
         ) o
         CROSS JOIN LATERAL jsonb_array_elements(o.items) item
        WHERE item->>'name' IS NOT NULL
        GROUP BY 1
        ORDER BY n DESC
        LIMIT 20`,
      [retailerId]
    )
    return rankProductsByPopularity(products, res.rows.map(r => r.name))
  } catch {
    return products
  }
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

    const { sessionId, retailerSlug, messages, forceRec } = await req.json()
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

    // Funnel: chat_started fires once per session (first turn only). Best-effort.
    if (Array.isArray(messages) && messages.length <= 1) {
      dbQuery(
        `insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, 'chat_started', '{}'::jsonb)`,
        [retailer.id, sessionId]
      ).catch(() => {})
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
    const monthCost = monthlyCostUsd(usage.input, usage.output)
    if (monthCost >= AI_MONTHLY_BUDGET_USD) {
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
      const rankedFallback = await rankInStockByPopularity(retailer.id, inStockProducts)
      return degradedResponse(rankedFallback, retailer)
    }
    // Approaching the cap (>=80%): nudge the owner once per month (best-effort).
    if (monthCost >= 0.8 * AI_MONTHLY_BUDGET_USD && retailer.owner_email) {
      const claimed = await dbQuery<{ id: string }>(
        `UPDATE retailers SET ai_warn_notified_at = now()
         WHERE id = $1 AND (ai_warn_notified_at IS NULL OR ai_warn_notified_at < date_trunc('month', now()))
         RETURNING id`,
        [retailer.id]
      )
      if (claimed.rows.length > 0) {
        const pct = Math.round((monthCost / AI_MONTHLY_BUDGET_USD) * 100)
        sendAiBudgetWarning({ to: retailer.owner_email, retailerName: retailer.name, pct, upgradeUrl: billingUrl() })
          .then(r => { if (!r.ok) console.error('[chat] sendAiBudgetWarning failed:', r.error) })
      }
    }

    let systemPrompt = buildSystemPrompt(retailer, promptProducts, flightsResult.rows)

    // Turn cap is per-vendor (driven by AssistantProfile / category template).
    // After max questions, force the recommendation so chat can't run unbounded
    // on cost or frustrate the guest. "START" doesn't count — it's the kick-off.
    // The client can also force it (forceRec) via the "Just give me a
    // recommendation" button, which guarantees the ===REC=== card on that turn.
    const { max: maxUserTurns } = getQuestionBounds(retailer)
    const userTurns = apiMessages.filter((m: any) => m.role === 'user' && m.content !== 'START').length
    // A recommendation is expected this turn when the cap is reached or the guest
    // forced it — used below to guarantee a card rather than dead-end on a handoff.
    const recExpected = forceRec === true || userTurns >= maxUserTurns
    if (recExpected) {
      systemPrompt += `\n\nIMPORTANT: Do NOT ask another question. Give your final recommendation NOW in this message using the ===REC=== format. If you already described a pick in an earlier message, do not repeat the description — one short confirmation line, then the ===REC=== block.`
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
          let recParseFailed = false
          const recMatch = fullText.match(/===REC===([\s\S]*?)===END===/)
          if (recMatch) {
            try { recData = JSON.parse(recMatch[1].trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()) } catch { recParseFailed = true }
          }
          // Telemetry: the model emitted a ===REC=== block but its JSON was
          // malformed, so the guest silently got no recommendation. Make it
          // observable instead of swallowing it.
          if (recParseFailed) {
            console.warn('[chat] malformed REC JSON', { retailer: retailer.id, session: sessionId })
            dbQuery(
              `insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, 'recommendation_parse_failed', '{}'::jsonb)`,
              [retailer.id, sessionId]
            ).catch(() => {})
          }
          // Snapshot the hallucinated SKUs before the destructive in-stock
          // validation so we can record what the model invented.
          const droppedSkus = droppedHallucinations(recData, inStockProducts)
          const recHadProducts = Array.isArray(recData?.selectedProducts) && recData.selectedProducts.length > 0
          // Hard-constrain the recommendation to real in-stock SKUs (drop hallucinations).
          recData = validateRecAgainstCatalog(recData, inStockProducts)
          // Telemetry: surface hallucinated SKUs. `discarded` means every product
          // was off-menu, so the whole recommendation was thrown out.
          if (droppedSkus.length > 0) {
            const discarded = recHadProducts && !recData
            console.warn('[chat] dropped hallucinated SKUs', { retailer: retailer.id, dropped: droppedSkus, discarded })
            dbQuery(
              `insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, 'recommendation_hallucination_dropped', $3::jsonb)`,
              [retailer.id, sessionId, JSON.stringify({ dropped: droppedSkus, discarded })]
            ).catch(() => {})
          }
          // Safety net: a recommendation was expected (cap reached or forced) but
          // the model produced none / only off-catalog SKUs that got dropped.
          // Surface a deterministic catalog pick so the guest never dead-ends on a
          // handoff line with no card, as long as there's a catalog to pick from.
          if (!recData && (recExpected || recMatch) && inStockProducts.length > 0) {
            recData = buildFallbackRecommendation(inStockProducts)
          }
          // Phase 3: enrich each surviving product with image_url / catalog price.
          // The AI never produces URLs; this is where they get joined in.
          recData = enrichRecommendationWithCatalog(recData, inStockProducts)
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
          // Beverage DNA — taste-intelligence layer parsed from the ===DNA===
          // block. Additive: null when absent/malformed, and a missing/invalid
          // block NEVER affects recData (the recommendation stands on its own).
          const dna = parseBeverageDNA(fullText)
          // Phase 3: include vendor CTA copy + fallback line in the done frame so
          // the UI can render branded button text without a second fetch.
          const resolvedProfile = resolveAssistantProfile(retailer)
          const donePayload = {
            done: true,
            text: fullText,
            recData,
            chips,
            ctas: { primary: resolvedProfile.cta_primary, secondary: resolvedProfile.cta_secondary },
            fallbackLine: resolvedProfile.fallback_line,
            dna,
          }
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(donePayload) + '\n\n'))
          // Funnel: recommendation_shown when a valid rec was produced. Best-effort.
          if (recData) {
            dbQuery(
              `insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, 'recommendation_shown', $3::jsonb)`,
              [retailer.id, sessionId, JSON.stringify({ name: recData.recommendationName || recData.blendName || null })]
            ).catch(() => {})
          }
          // Funnel: beverage_dna_generated mirrors recommendation_shown so the
          // vendor analytics can track DNA coverage. Persona only (no guest copy).
          if (dna) {
            dbQuery(
              `insert into events (retailer_id, session_id, event_type, payload) values ($1, $2, 'beverage_dna_generated', $3::jsonb)`,
              [retailer.id, sessionId, JSON.stringify({ persona: dna.persona })]
            ).catch(() => {})
          }
          dbQuery(
            `update sessions set
               messages = $2::jsonb,
               order_status = $3,
               recommended_at = $4,
               blend_name = $5,
               blend_data = $6::jsonb,
               beverage_dna = $7::jsonb,
               persona = $8
             where id = $1`,
            [
              sessionId,
              JSON.stringify(apiMessages),
              recData ? 'recommended' : 'browsing',
              recData ? new Date().toISOString() : null,
              recData?.recommendationName || null,
              JSON.stringify(recData || null),
              dna ? JSON.stringify(dna) : null,
              dna ? dna.persona : null,
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
