/**
 * Demo chat — identical to /api/chat but:
 *  - reads from retailer_drafts (not retailers)
 *  - no billing / AI-budget metering
 *  - no trial expiry checks
 *  - no session tracking writes
 *  - tighter rate limit (10 msgs/hr per IP)
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompts'
import { dbQuery } from '@/lib/db'
import { checkOrigin } from '@/lib/security'
import { getIp, demoChatLimiter } from '@/lib/rate-limit'
import { apiError } from '@/lib/api'
import {
  MAX_CATALOG_ITEMS,
  MAX_HISTORY_MESSAGES,
  selectRelevantProducts,
  validateRecAgainstCatalog,
  buildFallbackRecommendation,
} from '@/lib/chat-guardrails'
import { getQuestionBounds, resolveAssistantProfile } from '@/lib/agent/profile'
import { enrichRecommendationWithCatalog } from '@/lib/recommendation-enrich'
import { parseBeverageDNA } from '@/lib/agent/beverage-dna'
export const dynamic = 'force-dynamic'


const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    try {
      const { success } = await demoChatLimiter.limit(getIp(req))
      if (!success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    } catch {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }

    const { draftId, messages, forceRec } = await req.json()
    if (!draftId) return NextResponse.json({ error: 'missing draftId' }, { status: 400 })

    // Load draft
    const draftResult = await dbQuery<any>('select * from retailer_drafts where id = $1 limit 1', [draftId])
    const draft = draftResult.rows[0]
    if (!draft) return NextResponse.json({ error: 'draft not found' }, { status: 404 })

    // Expired demos get no chat
    if (draft.demo_expires_at && new Date(draft.demo_expires_at) < new Date()) {
      return NextResponse.json({ error: 'demo_expired' }, { status: 410 })
    }

    // Shape draft as retailer-compatible object for buildSystemPrompt + resolveAssistantProfile
    const vb = draft.intelligence_json?.vendorBuilder || {}
    const retailer = {
      id:                   draft.id,
      name:                 draft.name,
      vertical:             draft.vertical || 'brewery',
      location:             draft.location || null,
      tagline:              draft.tagline  || null,
      brand_color:          draft.brand_color || '#D67A31',
      story:                draft.story   || null,
      culture:              draft.culture || null,
      region:               draft.region  || null,
      voice:                draft.voice   || null,
      chat_system_prompt:   vb.chat_system_prompt    || null,
      take_home_json:       JSON.stringify(vb.take_home_items  || []),
      has_take_home:        Boolean(vb.has_take_home),
      featured_items_json:  JSON.stringify(vb.featured_items   || []),
      assistant_profile:    null,
    }

    const allProducts: any[] = Array.isArray(draft.menu_json)   ? draft.menu_json   : []
    const flights:     any[] = Array.isArray(draft.flight_json) ? draft.flight_json : []

    const apiMessages = [...(messages || [])]
    const convoText = apiMessages
      .filter((m: any) => m.role === 'user' && m.content !== 'START')
      .map((m: any) => m.content)
      .join(' ')

    const promptProducts = selectRelevantProducts(allProducts, convoText, MAX_CATALOG_ITEMS)

    let systemPrompt = buildSystemPrompt(retailer as any, promptProducts, flights)

    const { max: maxUserTurns } = getQuestionBounds(retailer as any)
    const userTurns = apiMessages.filter((m: any) => m.role === 'user' && m.content !== 'START').length
    // A recommendation is expected this turn when the question cap is reached or
    // the guest tapped "just recommend" (forceRec). On those turns we guarantee
    // a card below, falling back to a catalog pick if the model doesn't comply.
    const recExpected = forceRec === true || userTurns >= maxUserTurns
    if (recExpected) {
      systemPrompt += `\n\nIMPORTANT: Do NOT ask another question. Give your final recommendation NOW in this message using the ===REC=== format. If you already described a pick in an earlier message, do not repeat the description — one short confirmation line, then the ===REC=== block.`
    }

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

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              fullText += chunk.delta.text
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: chunk.delta.text }) + '\n\n'))
            }
          }

          let recData = null
          const recMatch = fullText.match(/===REC===([\s\S]*?)===END===/)
          if (recMatch) {
            try { recData = JSON.parse(recMatch[1].trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()) } catch {}
          }
          recData = validateRecAgainstCatalog(recData, allProducts)
          // Safety net: a recommendation was expected (cap reached or forced) but
          // the model produced none / an off-catalog one that got dropped. Rather
          // than dead-end the guest after a handoff line, surface a deterministic
          // catalog pick so a card always appears when there's a catalog to pick from.
          if (!recData && (recExpected || recMatch) && allProducts.length > 0) {
            recData = buildFallbackRecommendation(allProducts)
          }
          recData = enrichRecommendationWithCatalog(recData, allProducts)

          let chips: string[] = []
          const chipsMatch = fullText.match(/===CHIPS===([\s\S]*?)===END===/)
          if (chipsMatch) {
            try {
              const parsed = JSON.parse(chipsMatch[1].trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim())
              if (Array.isArray(parsed)) chips = parsed.filter((c: unknown) => typeof c === 'string').slice(0, 4)
            } catch {}
          }

          // Beverage DNA — parsed for the done frame so the demo reveal (Phase B)
          // matches the live guest page. Demo writes nothing, so this isn't
          // persisted; it's emit-only. Additive, never affects recData.
          const dna = parseBeverageDNA(fullText)
          const resolvedProfile = resolveAssistantProfile(retailer as any)
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({
            done: true, text: fullText, recData, chips,
            ctas: { primary: resolvedProfile.cta_primary, secondary: resolvedProfile.cta_secondary },
            fallbackLine: resolvedProfile.fallback_line,
            dna,
          }) + '\n\n'))
        } catch (err) {
          console.error('[demo/chat] stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, { headers: SSE_HEADERS })
  } catch (err) {
    return apiError(err, 'Demo chat failed')
  }
}
