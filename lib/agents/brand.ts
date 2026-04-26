import Anthropic from '@anthropic-ai/sdk'
import type { BrandData } from './research'

export interface BrandAgentInput {
  storyText: string
  rootText: string
  title: string
  sourceUrl: string
}

const emptyBrandData: BrandData = {
  story: '',
  culture: '',
  region: '',
  voice: '',
  mission_statement: '',
  brand_personality: [],
  brand_voice_tone: '',
  signature_items: [],
  research_confidence: 0,
}

function textFromMessage(content: any[]): string {
  return content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
}

function cleanJson(raw: string): string {
  return raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
}

function normalizeBrandData(data: any): BrandData {
  return {
    story: typeof data.story === 'string' ? data.story : '',
    culture: typeof data.culture === 'string' ? data.culture : '',
    region: typeof data.region === 'string' ? data.region : '',
    voice: typeof data.voice === 'string' ? data.voice : '',
    mission_statement: typeof data.mission_statement === 'string' ? data.mission_statement : '',
    brand_personality: Array.isArray(data.brand_personality) ? data.brand_personality.filter((item: any) => typeof item === 'string') : [],
    brand_voice_tone: typeof data.brand_voice_tone === 'string' ? data.brand_voice_tone : '',
    signature_items: Array.isArray(data.signature_items) ? data.signature_items.filter((item: any) => typeof item === 'string') : [],
    research_confidence: typeof data.research_confidence === 'number' ? Math.max(0, Math.min(100, Math.round(data.research_confidence))) : 0,
  }
}

export async function extractBrand(input: BrandAgentInput): Promise<BrandData> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze this beverage vendor's homepage and about/story pages for a rich vendor intelligence profile.

Return ONLY valid JSON:
{
  "story": "2-4 sentences: founding story, who built it and why, what makes it unique. Make it human and specific.",
  "culture": "2-3 sentences: the vibe and atmosphere of the place. What kind of experience do guests have?",
  "region": "1-2 sentences: geographic and cultural context. Local ingredients, traditions, history, or place-based details.",
  "voice": "3-5 words describing brand personality: e.g. bold, warm, craft-forward",
  "mission_statement": "Their stated purpose in their own words when possible, otherwise a careful inference.",
  "brand_personality": ["3-5 single descriptive words"],
  "brand_voice_tone": "single phrase, e.g. casual and irreverent",
  "signature_items": ["2-3 product names if identifiable"],
  "research_confidence": 0
}

Research confidence scoring:
- +30 if story/about content is substantial
- +20 if a founding year or person name appears
- +20 if mission language is specific and non-generic
- +15 if brand_personality has 3+ useful entries
- +15 if signature_items has 2+ entries
Maximum 100. Score only what the source content supports.

If story pages are sparse, infer from the homepage, but avoid generic filler.

Site: ${input.sourceUrl}
Title: ${input.title}

About/Story content:
${(input.storyText || '').slice(0, 6000)}

Homepage content:
${(input.rootText || '').slice(0, 3000)}`,
      }],
    })

    return normalizeBrandData(JSON.parse(cleanJson(textFromMessage(msg.content as any[]))))
  } catch (err) {
    console.error('[BrandAgent] failed:', err instanceof Error ? err.message : String(err))
    return emptyBrandData
  }
}
