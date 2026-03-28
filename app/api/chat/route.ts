// app/api/chat/route.ts
// ─── Poursona streaming chat endpoint ────────────────────────────────────────
// POST /api/chat
// Body: { sessionId, retailerSlug, messages }
// Returns: Server-Sent Events stream

import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import {
  supabase,
  supabaseAdmin,
  getRetailerBySlug,
  getProductsByRetailer,
  updateSession,
  logEvent,
} from '@/lib/supabase'
import { buildSystemPrompt } from '@/lib/prompts'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { sessionId, retailerSlug, messages } = await req.json()

    if (!retailerSlug || !messages) {
      return new Response('Missing retailerSlug or messages', { status: 400 })
    }

    // 1. Load retailer + catalog
    const retailer = await getRetailerBySlug(retailerSlug)
    if (!retailer) return new Response('Retailer not found', { status: 404 })

    const products = await getProductsByRetailer(retailer.id)
    if (products.length === 0) {
      return new Response('No products in catalog', { status: 404 })
    }

    // 2. Build dynamic system prompt from their catalog
    const systemPrompt = buildSystemPrompt(retailer, products)

    // 3. Stream response from Anthropic
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ''

        try {
          const anthropicStream = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          })

          // Stream tokens to client
          for await (const chunk of anthropicStream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const text = chunk.delta.text
              fullText += text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              )
            }
          }

          // 4. Extract recommendation if present
          const recMatch = fullText.match(
            /---RECOMMENDATION_START---([\s\S]*?)---RECOMMENDATION_END---/
          )
          let blendData = null
          if (recMatch) {
            try {
              blendData = JSON.parse(recMatch[1].trim())
            } catch {}
          }

          // 5. Save session state
          if (sessionId) {
            const updatedMessages = [
              ...messages,
              { role: 'assistant', content: fullText },
            ]
            await updateSession(sessionId, {
              messages: updatedMessages,
              ...(blendData && {
                blend_name: blendData.recommendationName,
                blend_data: blendData,
                recommended_at: new Date().toISOString(),
                order_status: 'recommended',
              }),
            })

            // Log analytics event
            if (blendData) {
              await logEvent(retailer.id, sessionId, 'recommendation', {
                blend_name: blendData.recommendationName,
                products: blendData.selectedProducts?.map(
                  (p: { name: string }) => p.name
                ),
              })
            } else {
              await logEvent(retailer.id, sessionId, 'message', {
                message_count: messages.length + 1,
              })
            }
          }

          // Signal done with recommendation data
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, blendData })}\n\n`
            )
          )
          controller.close()
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
