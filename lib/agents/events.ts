import Anthropic from '@anthropic-ai/sdk'
import type { VendorEvent } from './research'

export interface EventAgentInput {
  eventsText: string
  sourceUrl: string
  currentDate: string
}

function textFromMessage(content: any[]): string {
  return content.map((c: any) => ('text' in c ? c.text : '')).join('').trim()
}

function cleanJson(raw: string): string {
  return raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
}

function normalizeEvent(data: any, sourceUrl: string): VendorEvent | null {
  if (!data || typeof data.name !== 'string' || !data.name.trim()) return null
  const allowedTypes = ['upcoming', 'recurring', 'seasonal', 'unknown']
  const eventType = allowedTypes.includes(data.event_type) ? data.event_type : 'unknown'
  return {
    name: data.name,
    description: typeof data.description === 'string' ? data.description : '',
    event_type: eventType,
    event_date: typeof data.event_date === 'string' ? data.event_date : null,
    recurrence_pattern: typeof data.recurrence_pattern === 'string' ? data.recurrence_pattern : null,
    source_url: typeof data.source_url === 'string' && data.source_url ? data.source_url : sourceUrl,
    visible_to_guests: true,
  }
}

export async function extractEvents(input: EventAgentInput): Promise<VendorEvent[]> {
  if (!input.eventsText.trim()) return []

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Extract guest-relevant events from this beverage venue events/calendar text.

Current date: ${input.currentDate}
Source URL: ${input.sourceUrl}

Return ONLY valid JSON as an array:
[
  {
    "name": "event name as written",
    "description": "brief description or empty string",
    "event_type": "upcoming" | "recurring" | "seasonal" | "unknown",
    "event_date": "YYYY-MM-DD" | null,
    "recurrence_pattern": "Every Friday" | null,
    "source_url": "${input.sourceUrl}",
    "visible_to_guests": true
  }
]

Rules:
- Use ISO YYYY-MM-DD dates only when a specific future date is clear.
- Use recurrence_pattern for recurring events without a single date.
- Return [] if no clear events are present.

Events text:
${input.eventsText.slice(0, 4000)}`,
      }],
    })

    const parsed = JSON.parse(cleanJson(textFromMessage(msg.content as any[])))
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => normalizeEvent(item, input.sourceUrl)).filter(Boolean) as VendorEvent[]
  } catch (err) {
    console.error('[EventAgent] failed:', err instanceof Error ? err.message : String(err))
    return []
  }
}
