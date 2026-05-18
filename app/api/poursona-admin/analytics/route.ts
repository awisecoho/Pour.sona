import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_CHART_DAYS = 90

function escCsv(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function csvRow(cells: unknown[]): string { return cells.map(escCsv).join(',') }

function clampRange(from: string, to: string) {
  const now     = new Date()
  const toDate  = to   ? new Date(to)   : now
  const fromRaw = from ? new Date(from) : new Date(Date.now() - 29 * 86_400_000)
  const msRange = toDate.getTime() - fromRaw.getTime()
  const maxMs   = MAX_CHART_DAYS * 86_400_000
  const fromClamped = msRange > maxMs ? new Date(toDate.getTime() - maxMs) : fromRaw
  return {
    chartFrom: fromClamped.toISOString().slice(0, 10),
    chartTo:   toDate.toISOString().slice(0, 10),
  }
}

export async function GET(req: NextRequest) {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const teamCheck = await dbQuery(
      'SELECT role FROM poursona_team WHERE lower(email) = lower($1) LIMIT 1',
      [identity.email || '']
    )
    if (!teamCheck.rows.length) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const sp     = req.nextUrl.searchParams
    const from   = sp.get('from')?.trim() || ''
    const to     = sp.get('to')?.trim()   || ''
    const format = sp.get('format') === 'csv' ? 'csv' : 'json'

    const { chartFrom, chartTo } = clampRange(from, to)

    // ── Summary (all-time when no range, filtered otherwise) ─────────────────
    const [summaryResult, dailyResult] = await Promise.all([
      dbQuery<Record<string, string>>(
        `SELECT
           COUNT(*)::int                                                               AS total_retailers,
           COUNT(*) FILTER (WHERE active = true)::int                                  AS active_retailers,
           COUNT(*) FILTER (WHERE subscription_status = 'active')::int                 AS paid_retailers,
           COUNT(*) FILTER (WHERE subscription_status = 'trial')::int                  AS trial_retailers,
           COUNT(*) FILTER (WHERE subscription_status = 'trial'
                                AND trial_ends_at < now())::int                        AS expired_trials,
           (SELECT COUNT(*)::int FROM sessions
            WHERE ($1::text = '' OR created_at >= $1::timestamptz)
              AND ($2::text = '' OR created_at <  ($2::timestamptz + interval '1 day'))
           ) AS total_sessions,
           (SELECT COUNT(*)::int FROM sessions
            WHERE order_status = 'ordered'
              AND ($1::text = '' OR created_at >= $1::timestamptz)
              AND ($2::text = '' OR created_at <  ($2::timestamptz + interval '1 day'))
           ) AS total_orders
         FROM retailers
         WHERE ($1::text = '' OR created_at >= $1::timestamptz)
            OR $1::text = ''`,
        [from, to]
      ),

      // ── Daily system-wide breakdown ──────────────────────────────────────────
      dbQuery<Record<string, unknown>>(
        `WITH day_series AS (
           SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS day
         ),
         daily_sessions AS (
           SELECT DATE(created_at) AS day,
             COUNT(*)::int                                                AS sessions,
             COUNT(*) FILTER (WHERE order_status = 'ordered')::int        AS orders
           FROM sessions
           WHERE created_at >= $1::timestamptz
             AND created_at <  ($2::timestamptz + interval '1 day')
           GROUP BY DATE(created_at)
         ),
         daily_retailers AS (
           SELECT DATE(created_at) AS day, COUNT(*)::int AS new_retailers
           FROM retailers
           WHERE created_at >= $1::timestamptz
             AND created_at <  ($2::timestamptz + interval '1 day')
           GROUP BY DATE(created_at)
         )
         SELECT
           ds.day::text                               AS day,
           COALESCE(dse.sessions,     0)              AS sessions,
           COALESCE(dse.orders,       0)              AS orders,
           COALESCE(dr.new_retailers, 0)              AS new_retailers
         FROM day_series ds
         LEFT JOIN daily_sessions  dse ON dse.day = ds.day
         LEFT JOIN daily_retailers dr  ON dr.day  = ds.day
         ORDER BY ds.day`,
        [chartFrom, chartTo]
      ),
    ])

    if (format === 'csv') {
      const header = csvRow(['Date', 'Sessions', 'Orders', 'New Retailers'])
      const rows = dailyResult.rows.map(r =>
        csvRow([r.day, r.sessions, r.orders, r.new_retailers])
      )
      return new NextResponse([header, ...rows].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="system-analytics.csv"',
        },
      })
    }

    const s = summaryResult.rows[0] ?? {}
    const totalSessions = Number(s.total_sessions ?? 0)
    const totalOrders   = Number(s.total_orders   ?? 0)

    return NextResponse.json({
      ok: true,
      summary: {
        totalRetailers:  Number(s.total_retailers  ?? 0),
        activeRetailers: Number(s.active_retailers ?? 0),
        paidRetailers:   Number(s.paid_retailers   ?? 0),
        trialRetailers:  Number(s.trial_retailers  ?? 0),
        expiredTrials:   Number(s.expired_trials   ?? 0),
        totalSessions,
        totalOrders,
        conversionRate:  totalSessions > 0
          ? Math.round((totalOrders / totalSessions) * 100)
          : 0,
      },
      daily: dailyResult.rows.map(r => ({
        day:           String(r.day).slice(0, 10),
        sessions:      Number(r.sessions),
        orders:        Number(r.orders),
        newRetailers:  Number(r.new_retailers),
      })),
      range: { from: from || null, to: to || null, chartFrom, chartTo },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
