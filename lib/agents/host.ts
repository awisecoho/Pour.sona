import Anthropic from '@anthropic-ai/sdk'

export interface HostAgentInput {
  retailerName: string
  vertical: string
  location: string | null
  tagline: string | null
  story: string | null
  culture: string | null
  brand_personality: string[]
  brand_voice_tone: string
  signature_items: string[]
  topProducts: string[]
  hasFlights: boolean
}

export interface HostAgentOutput {
  guest_welcome_message: string
  recommendation_style: string
  tasting_pathways: Array<{
    title: string
    description: string
    suggested_products: string[]
  }>
}

function textFromMessage(content: any[]): string {
  return content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
}

function cleanJson(raw: string): string {
  return raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
}

function fallback(input: HostAgentInput): HostAgentOutput {
  const name = input.retailerName || 'this venue'
  return {
    guest_welcome_message: `Welcome to ${name}. Let me help you find the perfect pour.`,
    recommendation_style: 'Conversational, guest-led discovery with strong product knowledge.',
    tasting_pathways: [],
  }
}

function normalizeHostOutput(data: any, input: HostAgentInput): HostAgentOutput {
  const safe = fallback(input)
  const pathways = Array.isArray(data.tasting_pathways)
    ? data.tasting_pathways.slice(0, 3).map((pathway: any) => ({
        title: typeof pathway.title === 'string' ? pathway.title : '',
        description: typeof pathway.description === 'string' ? pathway.description : '',
        suggested_products: Array.isArray(pathway.suggested_products)
          ? pathway.suggested_products.filter((item: any) => typeof item === 'string').slice(0, 3)
          : [],
      }))
    : []

  return {
    guest_welcome_message: typeof data.guest_welcome_message === 'string' && data.guest_welcome_message.trim()
      ? data.guest_welcome_message
      : safe.guest_welcome_message,
    recommendation_style: typeof data.recommendation_style === 'string' && data.recommendation_style.trim()
      ? data.recommendation_style
      : safe.recommendation_style,
    tasting_pathways: pathways,
  }
}

export async function generateHostPersona(input: HostAgentInput): Promise<HostAgentOutput> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Create the guest-facing AI host preview for this beverage venue.

Return ONLY valid JSON:
{
  "guest_welcome_message": "1-2 sentences, venue-specific, in the brand voice",
  "recommendation_style": "1 sentence describing how the AI should guide guests",
  "tasting_pathways": [
    { "title": "For the Explorer", "description": "1-2 sentences", "suggested_products": ["2-3 product names"] }
  ]
}

Rules:
- Always produce exactly 3 tasting_pathways when product names are available.
- Suggested products must come from topProducts or signature_items.
- Mention the venue name in the welcome message.
- Keep copy concise for phone use at a table.

Venue:
Name: ${input.retailerName}
Vertical: ${input.vertical}
Location: ${input.location || ''}
Tagline: ${input.tagline || ''}
Story: ${input.story || ''}
Culture: ${input.culture || ''}
Brand personality: ${input.brand_personality.join(', ')}
Brand voice tone: ${input.brand_voice_tone}
Signature items: ${input.signature_items.join(', ')}
Top products: ${input.topProducts.join(', ')}
Has flights: ${input.hasFlights ? 'yes' : 'no'}`,
      }],
    })

    return normalizeHostOutput(JSON.parse(cleanJson(textFromMessage(msg.content as any[]))), input)
  } catch (err) {
    console.error('[HostAgent] failed:', err instanceof Error ? err.message : String(err))
    return fallback(input)
  }
}
