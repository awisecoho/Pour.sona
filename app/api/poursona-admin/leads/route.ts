/**
 * Prospect leads CRM-lite.
 *
 *   GET  /api/poursona-admin/leads
 *     Query: status (filter), q (search by name/email/url)
 *     Returns { leads: [...], counts: {by_status} }
 *
 *   POST /api/poursona-admin/leads
 *     Body: { name, url, vertical, location, score, reason, has_menu,
 *             has_ordering, has_tasting_room, email, contact_url,
 *             instagram, facebook, linkedin, twitter, subject, message,
 *             notes? }
 *     If a lead with the same url already exists, returns the existing row
 *     (idempotent save) so users can hit "Save Lead" without thinking about
 *     duplicates. Also auto-logs a 'saved' activity.
 *
 * Auth: team-member only (same pattern as /api/poursona-admin/me).
 */
import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
import { sanitizePromptInput } from '@/lib/security'

export const dynamic = 'force-dynamic'

function clean(v: unknown, cap = 1000): string | null {
  if (typeof v !== 'string') return null
  const trimmed = sanitizePromptInput(v).slice(0, cap)
  return trimmed.length > 0 ? trimmed : null
}
function cleanUrl(v: unknown): string | null {
  const s = clean(v, 500)
  if (!s) return null
  try { new URL(s); return s } catch { return null }
}

export async function GET(req: NextRequest) {
  const auth = await requireTeamMember()
  if (!auth) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const status = req.nextUrl.searchParams.get('status') || ''
    const q      = req.nextUrl.searchParams.get('q')      || ''

    const wheres: string[] = []
    const params: unknown[] = []
    if (status) {
      params.push(status)
      wheres.push(`status = $${params.length}`)
    }
    if (q) {
      params.push(`%${q.toLowerCase()}%`)
      wheres.push(`(lower(name) LIKE $${params.length} OR lower(coalesce(email,'')) LIKE $${params.length} OR lower(url) LIKE $${params.length})`)
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : ''

    const [leadsResult, countsResult] = await Promise.all([
      dbQuery(
        `SELECT * FROM prospect_leads ${whereSql} ORDER BY saved_at DESC LIMIT 200`,
        params
      ),
      dbQuery(`SELECT status, COUNT(*)::int AS n FROM prospect_leads GROUP BY status`),
    ])

    const counts: Record<string, number> = {}
    for (const row of countsResult.rows as Array<{ status: string; n: number }>) {
      counts[row.status] = Number(row.n)
    }

    return NextResponse.json({ ok: true, leads: leadsResult.rows, counts })
  } catch (err) {
    console.error('[api/poursona-admin/leads] list failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'list failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTeamMember()
  if (!auth) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const name = clean(body.name, 200)
    const url  = cleanUrl(body.url)
    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
    }

    const fields = {
      name,
      url,
      vertical:         clean(body.vertical, 60),
      location:         clean(body.location, 200),
      score:            clean(body.score, 20),
      reason:           clean(body.reason, 500),
      has_menu:         body.has_menu === true,
      has_ordering:     body.has_ordering === true,
      has_tasting_room: body.has_tasting_room === true,
      email:            clean(body.email, 200),
      contact_url:      cleanUrl(body.contact_url),
      instagram:        cleanUrl(body.instagram),
      facebook:         cleanUrl(body.facebook),
      linkedin:         cleanUrl(body.linkedin),
      twitter:          cleanUrl(body.twitter),
      subject:          clean(body.subject, 250),
      message:          clean(body.message, 4000),
      notes:            clean(body.notes, 4000),
      saved_by_email:   auth.identity.email,
    }

    // Idempotent save: if a row with the same URL exists, return it as-is and
    // signal "already saved" so the UI can avoid showing a misleading success
    // animation. Otherwise insert a fresh row.
    const existing = await dbQuery(
      `SELECT * FROM prospect_leads WHERE lower(url) = lower($1) LIMIT 1`,
      [url]
    )
    let row: any
    let wasInserted: boolean
    if (existing.rows[0]) {
      row = existing.rows[0]
      wasInserted = false
    } else {
      const cols = Object.keys(fields)
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ')
      const values = Object.values(fields)
      const inserted = await dbQuery(
        `INSERT INTO prospect_leads (${cols.join(', ')})
         VALUES (${placeholders})
         RETURNING *`,
        values
      )
      row = inserted.rows[0]
      wasInserted = true
    }

    // Auto-log activity. Best-effort.
    dbQuery(
      `INSERT INTO prospect_activities (lead_id, type, body, payload, created_by_email)
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        row.id,
        wasInserted ? 'saved' : 'resaved',
        wasInserted ? 'Lead saved from pipeline.' : 'Lead already existed; pipeline result refreshed.',
        JSON.stringify({ score: fields.score, vertical: fields.vertical }),
        auth.identity.email,
      ]
    ).catch((e) => console.warn('[leads] activity log failed:', e))

    return NextResponse.json({ ok: true, lead: row, was_inserted: wasInserted })
  } catch (err) {
    console.error('[api/poursona-admin/leads] create failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'create failed' }, { status: 500 })
  }
}
