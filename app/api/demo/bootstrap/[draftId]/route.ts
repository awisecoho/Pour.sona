import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getIp } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { draftId: string } }
) {
  const { draftId } = params
  if (!draftId) return NextResponse.json({ error: 'missing draftId' }, { status: 400 })

  const result = await dbQuery<any>(
    'select * from retailer_drafts where id = $1 limit 1',
    [draftId]
  )
  const draft = result.rows[0]
  if (!draft) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Expired — caller should redirect to /signup
  if (draft.demo_expires_at && new Date(draft.demo_expires_at) < new Date()) {
    // Best-effort: upsert into prospect_leads so the team can follow up
    const name   = draft.name   || null
    const url    = draft.source_url || null
    if (url) {
      dbQuery(
        `INSERT INTO prospect_leads (name, url, vertical, location, email, status)
         VALUES ($1, $2, $3, $4, $5, 'new')
         ON CONFLICT (lower(url)) DO UPDATE
           SET name     = EXCLUDED.name,
               vertical = EXCLUDED.vertical,
               location = EXCLUDED.location,
               email    = coalesce(EXCLUDED.email, prospect_leads.email),
               status   = CASE WHEN prospect_leads.status = 'new' THEN 'new' ELSE prospect_leads.status END,
               updated_at = now()`,
        [name, url, draft.vertical || null, draft.location || null, draft.demo_email || null]
      ).catch(() => {})
    }
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  // Stamp demo_started_at on first view (idempotent)
  if (!draft.demo_started_at) {
    const ip = getIp(req)
    dbQuery(
      `UPDATE retailer_drafts SET demo_started_at = now(), demo_ip = $2 WHERE id = $1 AND demo_started_at IS NULL`,
      [draftId, ip]
    ).catch(() => {})
  }

  // Shape draft into the Retailer-compatible object the chat page expects.
  // Keys match what /api/retailer returns for published venues.
  const vb = draft.intelligence_json?.vendorBuilder || {}
  const retailer = {
    id:                   draft.id,
    name:                 draft.name,
    slug:                 `demo-${draft.id}`,   // never used for routing, just for display
    vertical:             draft.vertical || 'brewery',
    location:             draft.location || null,
    tagline:              draft.tagline  || null,
    logo_url:             draft.logo_url || null,
    source_url:           draft.source_url || null,
    brand_color:          draft.brand_color || '#3FC6D4',
    brand_secondary_color: vb.brand_secondary_color || null,
    brand_accent_color:   vb.brand_accent_color    || null,
    brand_font_family:    vb.brand_font_family     || null,
    brand_font_url:       vb.brand_font_url        || null,
    story:                draft.story   || null,
    culture:              draft.culture || null,
    region:               draft.region  || null,
    voice:                draft.voice   || null,
    chat_system_prompt:   vb.chat_system_prompt    || null,
    take_home_json:       JSON.stringify(vb.take_home_items  || []),
    has_take_home:        Boolean(vb.has_take_home),
    featured_items_json:  JSON.stringify(vb.featured_items   || []),
    personality_preview:  vb.personality_preview   || null,
    assistant_profile:    null,   // demo uses category defaults
    // subscription: always "active" for demo purposes
    subscription_status:  'trial',
    active:               true,
    trial_ends_at:        null,
    // token metering: zeros so nothing hits the cap
    ai_input_tokens_month:  0,
    ai_output_tokens_month: 0,
    ai_month_reset_at:      null,
  }

  const products: any[] = Array.isArray(draft.menu_json)   ? draft.menu_json   : []
  const flights:  any[] = Array.isArray(draft.flight_json) ? draft.flight_json : []

  return NextResponse.json({ retailer, products, flights, draftId })
}
