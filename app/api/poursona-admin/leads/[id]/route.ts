/**
 * Single-lead routes.
 *
 *   GET    /api/poursona-admin/leads/[id]   → lead + activity timeline
 *   PATCH  /api/poursona-admin/leads/[id]   → update editable fields
 *                                              (status, email, notes, contact channels)
 *   DELETE /api/poursona-admin/leads/[id]   → remove lead + cascaded activities
 *
 * PATCH auto-logs a 'status_change' activity when status changes, and a
 * 'contact_added' activity when an email is added that wasn't there before.
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
import { sanitizePromptInput } from '@/lib/security'
import { LEAD_STATUSES } from '@/lib/leads-constants'

export const dynamic = 'force-dynamic'


function clean(v: unknown, cap = 1000): string | null | undefined {
  if (v === undefined) return undefined         // not provided in PATCH → leave alone
  if (v === null) return null                   // explicitly clear → SQL NULL
  if (typeof v !== 'string') return undefined
  const trimmed = sanitizePromptInput(v).slice(0, cap)
  return trimmed.length > 0 ? trimmed : null
}
function cleanUrl(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  try { new URL(v); return v.slice(0, 500) } catch { return undefined }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeamMember()
  if (!auth) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const [lead, activities] = await Promise.all([
      dbQuery(`SELECT * FROM prospect_leads WHERE id = $1 LIMIT 1`, [params.id]),
      dbQuery(
        `SELECT id, type, body, payload, created_by_email, created_at
         FROM prospect_activities
         WHERE lead_id = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [params.id]
      ),
    ])
    if (!lead.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, lead: lead.rows[0], activities: activities.rows })
  } catch (err) {
    console.error('[api/poursona-admin/leads/:id] get failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'lookup failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeamMember()
  if (!auth) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = await req.json()

    // Pull current state so we can log meaningful diffs (status change, email add).
    const before = await dbQuery(`SELECT * FROM prospect_leads WHERE id = $1 LIMIT 1`, [params.id])
    if (!before.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const current = before.rows[0] as any

    const updates: Record<string, string | null> = {}
    if ('status' in body) {
      if (typeof body.status === 'string' && (LEAD_STATUSES as readonly string[]).includes(body.status)) {
        updates.status = body.status
      } else if (typeof body.status === 'string') {
        // Allow custom statuses (free-text) but cap length.
        const s = sanitizePromptInput(body.status).slice(0, 60)
        if (s) updates.status = s
      }
    }
    const stringFields: Array<[string, number]> = [
      ['email', 200], ['notes', 4000], ['subject', 250], ['message', 4000], ['reason', 500],
    ]
    for (const [field, cap] of stringFields) {
      if (field in body) {
        const v = clean(body[field], cap)
        if (v !== undefined) updates[field] = v
      }
    }
    const urlFields = ['contact_url', 'instagram', 'facebook', 'linkedin', 'twitter']
    for (const field of urlFields) {
      if (field in body) {
        const v = cleanUrl(body[field])
        if (v !== undefined) updates[field] = v
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no updates provided' }, { status: 400 })
    }

    const cols = Object.keys(updates)
    const values = Object.values(updates)
    const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(', ')
    values.push(params.id)
    const result = await dbQuery(
      `UPDATE prospect_leads SET ${setClause}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    )

    // Auto-log meaningful changes.
    const activityInserts: Array<Promise<unknown>> = []
    if ('status' in updates && updates.status !== current.status) {
      activityInserts.push(dbQuery(
        `INSERT INTO prospect_activities (lead_id, type, body, payload, created_by_email)
         VALUES ($1, 'status_change', $2, $3::jsonb, $4)`,
        [params.id, `Status: ${current.status} → ${updates.status}`,
         JSON.stringify({ from: current.status, to: updates.status }), auth.identity.email]
      ))
    }
    if ('email' in updates && updates.email && !current.email) {
      activityInserts.push(dbQuery(
        `INSERT INTO prospect_activities (lead_id, type, body, payload, created_by_email)
         VALUES ($1, 'contact_added', $2, $3::jsonb, $4)`,
        [params.id, `Email added: ${updates.email}`,
         JSON.stringify({ field: 'email', value: updates.email }), auth.identity.email]
      ))
    }
    await Promise.allSettled(activityInserts)

    return NextResponse.json({ ok: true, lead: result.rows[0] })
  } catch (err) {
    console.error('[api/poursona-admin/leads/:id] patch failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'update failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTeamMember()
  if (!auth) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const result = await dbQuery(
      `DELETE FROM prospect_leads WHERE id = $1 RETURNING id`,
      [params.id]
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/poursona-admin/leads/:id] delete failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'delete failed' }, { status: 500 })
  }
}
