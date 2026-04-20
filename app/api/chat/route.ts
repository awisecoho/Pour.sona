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

    const [{ data: retailer }, { data: products }, { data: flights }] = await Promise.all([
      supabase.from('retailers').select('*').eq('slug', retailerSlug).single(),
      supabase.from('products').select('*').eq('retailer_id',
        supabase.from('retailers').select('id').eq('slug', retailerSlug)
      ).eq('in_stock', true).order('sort_order').limit(80),
      supabase.from('flights').select('*').eq('active', true).order('sort_order'),
    ])

    if (!retailer) return NextResponse.json({ error: 'retailer not found' }, { status: 404 })

    // Get products directly since subquery may not work
    const { data: retailerRow } = await supabase.from('retailers').select('id').eq('slug', retailerSlug).single()
    const { data: inStockProducts } = await supabase.from('products').select('*').eq('retailer_id', retailerRow?.id).eq('in_stock', true).order('sort_order').limit(80)
    const { data: activeFlights } = await supabase.from('flights').select('*').eq('retailer_id', retailerRow?.id).eq('active', true)

    const systemPrompt = buildSystemPrompt(retailer, inStockProducts || [], activeFlights || [])

    // Build messages — prepend chip context as system context if present
    let apiMessages = [...messages]
    if (chipContext && apiMessages[0]?.role === 'user') {
      apiMessages[0] = { role: 'user', content: `My mood/preference: ${chipContext}. Now help me find the perfect selection.` }
    }
    if (apiMessages[0]?.content === 'START_SESSION') {
      apiMessages[0] = { role: 'user', content: 'Hi, I just sat down.' }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: systemPrompt,
      messages: apiMessages.map(m => ({ role: m.role, content: m.content })),
    })

    const text = response.content.map((c: any) => ('text' in c ? c.text : '')).join('')

    // Parse recommendation if present
    let recData = null
    const recMatch = text.match(/===REC===([\s\S]*?)===END===/)
    if (recMatch) {
      try {
        const clean = recMatch[1].trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
        recData = JSON.parse(clean)
      } catch { /* rec parse failed */ }
    }

    // Update session
    await supabase.from('sessions').update({
      messages: apiMessages,
      order_status: recData ? 'recommended' : 'browsing',
      recommended_at: recData ? new Date().toISOString() : null,
      blend_name: recData?.recommendationName || null,
      blend_data: recData || null,
    }).eq('id', sessionId)

    return NextResponse.json({ text, recData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}