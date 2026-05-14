import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt } from '@/lib/prompts'
import { dbQuery } from '@/lib/db'
import { sendTrialExpiredNotice, sendTrialExpiringWarning } from '@/lib/email'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, retailerSlug, messages, chipContext } = await req.json()
    if (!sessionId || !retailerSlug) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const retailerResult = await dbQuery(
      'select * from retailers where slug = $1 limit 1',
      [retailerSlug]
    )
    const retailer = retailerResult.rows[0]
    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

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
        const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin/billing`
        sendTrialExpiredNotice({ to: retailer.owner_email, retailerName: retailer.name, upgradeUrl })
      }
      return NextResponse.json({ error: 'subscription_inactive' }, { status: 402 })
    }

    if (subStatus === 'trial' && trialEnd) {
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)
      if (daysLeft <= 3 && retailer.owner_email) {
        const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://pour-sona.com'}/admin/billing`
        sendTrialExpiringWarning({ to: retailer.owner_email, retailerName: retailer.name, daysLeft, upgradeUrl })
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

    const systemPrompt = buildSystemPrompt(retailer, productsResult.rows, flightsResult.rows)

    let apiMessages = [...messages]
    if (chipContext && apiMessages[0]?.role === 'user') {
      apiMessages[0] = { role: 'user', content: `My mood/preference: ${chipContext}. Now help me find the perfect selection.` }
    }
    if (apiMessages[0]?.content === 'START') {
      apiMessages[0] = { role: 'user', content: 'START' }
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
