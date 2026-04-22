import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt } from '@/lib/prompts'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, retailerSlug, messages, chipContext } = await req.json()
    if (!sessionId || !retailerSlug) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: retailerRow } = await supabase.from('retailers').select('id').eq('slug', retailerSlug).single()
    if (!retailerRow) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    const [{ data: retailer }, { data: inStockProducts }, { data: activeFlights }] = await Promise.all([
      supabase.from('retailers').select('*').eq('slug', retailerSlug).single(),
      supabase.from('products').select('*').eq('retailer_id', retailerRow.id).eq('in_stock', true).order('sort_order').limit(80),
      supabase.from('flights').select('*').eq('retailer_id', retailerRow.id).eq('active', true),
    ])
    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    const systemPrompt = buildSystemPrompt(retailer, inStockProducts || [], activeFlights || [])

    let apiMessages = [...messages]
    if (chipContext && apiMessages[0]?.role === 'user') {
      apiMessages[0] = { role: 'user', content: `My mood/preference: ${chipContext}. Now help me find the perfect selection.` }
    }
    if (apiMessages[0]?.content === 'START_SESSION') {
      apiMessages[0] = { role: 'user', content: 'Hi, I just sat down.' }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: systemPrompt,
      messages: apiMessages.map(m => ({ role: m.role, content: m.content })),
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
            try { recData = JSON.parse(recMatch[1].trim().replace(/^```json\s*/i,'').replace(/```\s*$/i,'').trim()) } catch {}
          }
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ done: true, text: fullText, recData }) + '\n\n'))
          supabase.from('sessions').update({
            messages: apiMessages,
            order_status: recData ? 'recommended' : 'browsing',
            recommended_at: recData ? new Date().toISOString() : null,
            blend_name: recData?.recommendationName || null,
            blend_data: recData || null,
          }).eq('id', sessionId).then(() => {})
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
