/**
 * POST /api/poursona-admin/leads/[id]/activities
 *
 * Log a manual activity on a lead (note, email_sent confirmation, demo_scheduled,
 * etc.). System-logged activities (status_change, contact_added) happen
 * automatically from PATCH /leads/[id]; this endpoint is for things the user
 * does outside the form (e.g., "I just sent the email", "they called me back").
 *
 * Body: { type: string, body?: string, payload?: object }
 *   type — short tag; canonical set defined below, but free-text accepted.
 *   body — human-readable note shown in the timeline.
 *   payload — optional structured data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
import { sanitizePromptInput } from '@/lib/security'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const caller = await requireTeamMember()
  if (!caller) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const typeRaw = typeof body.type === 'string' ? body.type.trim() : ''
    if (!typeRaw) return NextResponse.json({ error: 'type is required' }, { status: 400 })
    const type = sanitizePromptInput(typeRaw).slice(0, 60)

    // Verify the lead exists so we don't insert orphan activities.
    const leadCheck = await dbQuery(`SELECT id FROM prospect_leads WHERE id = $1 LIMIT 1`, [params.id])
    if (!leadCheck.rows[0]) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

    const noteBody = typeof body.body === 'string' ? sanitizePromptInput(body.body).slice(0, 4000) : null
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : null

    const result = await dbQuery(
      `INSERT INTO prospect_activities (lead_id, type, body, payload, created_by_email)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, type, body, payload, created_by_email, created_at`,
      [params.id, type, noteBody, payload ? JSON.stringify(payload) : null, caller.identity.email]
    )

    // If this is an email_sent activity, advance status to 'contacted' on the
    // lead (only when it was still 'new' — don't downgrade a richer state).
    if (type === 'email_sent') {
      await dbQuery(
        `UPDATE prospect_leads SET status = 'contacted', updated_at = now()
         WHERE id = $1 AND status = 'new'`,
        [params.id]
      ).catch(() => {})
    }

    return NextResponse.json({ ok: true, activity: result.rows[0] })
  } catch (err) {
    console.error('[api/poursona-admin/leads/:id/activities] post failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'activity log failed' }, { status: 500 })
  }
}
