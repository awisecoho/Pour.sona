import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { image, retailerId } = await req.json()
    if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: image }
          },
          {
            type: 'text',
            text: `This is a photo of a menu board or product list from a beverage vendor (brewery, distillery, winery, or coffee shop).

Extract all products you can read. Return ONLY valid JSON array, no explanation:
[
  {
    "name": "Product name exactly as written",
    "category": "Beer/Wine/Spirit/Cocktail/Coffee/etc",
    "description": "Any description shown",
    "price": 7.50,
    "abv": "5.2%",
    "flavor_notes": "Any tasting notes shown"
  }
]

Rules:
- price should be a number (null if not shown)
- Include every readable item
- If text is unclear, make your best guess
- Return empty array [] if no products can be read`
          }
        ]
      }]
    })

    const raw = msg.content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
    let products = []
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
      products = JSON.parse(clean)
    } catch { products = [] }

    return NextResponse.json({ ok: true, products, count: products.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}