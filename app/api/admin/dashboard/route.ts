import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'
import { adminError } from '@/lib/api'

export const dynamic = 'force-dynamic'

// RFC 4180 CSV helpers (reused from Task 6 pattern)
function escCsv(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function csvRow(cells: unknown[]): string { return cells.map(escCsv).join(',') }

// Cap chart range to 90 days to bound generate_series output
const MAX_CHART_DAYS = 90

// AI budget config (mirrors the chat route) for the usage card.
const AI_BUDGET_USD          = Number(process.env.AI_MONTHLY_BUDGET_USD  || 15)
const AI_INPUT_USD_PER_MTOK  = Number(process.env.AI_INPUT_USD_PER_MTOK  || 1)
const AI_OUTPUT_USD_PER_MTOK = Number(process.env.AI_OUTPUT_USD_PER_MTOK || 5)

function clampRange(from: string, to: string): { chartFrom: string; chartTo: string } {
  const now = new Date()
  const toDate  = to   ? new Date(to)   : now
  const fromDate = from ? new Date(from) : new Date(Date.now() - 29 * 86_400_000)
  const msRange = toDate.getTime() - fromDate.getTime()
  const maxMs   = MAX_CHART_DAYS * 86_400_000
  const adjustedFrom = msRange > maxMs
    ? new Date(toDate.getTime() - maxMs)
    : fromDate
  return {
    chartFrom: adjustedFrom.toISOString().slice(0, 10),
    chartTo:   toDate.toISOString().slice(0, 10),
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const retailerId = sp.get('retailerId')
    if (!retailerId) {
      return NextResponse.json({ ok: false, error: 'Missing retailerId' }, { status: 400 })
    }

    const identity = await getAuthenticatedIdentity()
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    if (!accessRows.some((row) => row.retailer_id === retailerId)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const from   = sp.get('from')?.trim() || ''
    const to     = sp.get('to')?.trim()   || ''
    const format = sp.get('format') === 'csv' ? 'csv' : 'json'

    // Chart always covers a concrete date range; summary respects empty = all-time
    const { chartFrom, chartTo } = clampRange(from, to)

    // ── Summary stats (all-time when no from/to, filtered otherwise) ──────────
    const [summaryResult, dailyResult, recentResult, aiResult] = await Promise.all([
      dbQuery<Record<string, string>>(
        `SELECT
           (SELECT COUNT(*)::int FROM events
            WHERE retailer_id = $1 AND event_type = 'scan'
              AND ($2::text = '' OR created_at >= $2::timestamptz)
              AND ($3::text = '' OR created_at <  ($3::timestamptz + interval '1 day'))
           ) AS scans,
           COUNT(*)::int                                                          AS convos,
           COUNT(*) FILTER (WHERE order_status IN ('recommended','ordered'))::int AS recs,
           COUNT(*) FILTER (WHERE order_status = 'ordered')::int                  AS orders
         FROM sessions
         WHERE retailer_id = $1
           AND ($2::text = '' OR created_at >= $2::timestamptz)
           AND ($3::text = '' OR created_at <  ($3::timestamptz + interval '1 day'))`,
        [retailerId, from, to]
      ),

      // ── Daily breakdown — uses generate_series so every day appears ──────────
      dbQuery<Record<string, unknown>>(
        `WITH day_series AS (
           SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS day
         ),
         daily_sessions AS (
           SELECT DATE(created_at) AS day,
             COUNT(*)::int                                                          AS convos,
             COUNT(*) FILTER (WHERE order_status IN ('recommended','ordered'))::int AS recs,
             COUNT(*) FILTER (WHERE order_status = 'ordered')::int                  AS orders
           FROM sessions
           WHERE retailer_id = $1
             AND created_at >= $2::timestamptz
             AND created_at <  ($3::timestamptz + interval '1 day')
           GROUP BY DATE(created_at)
         ),
         daily_scans AS (
           SELECT DATE(created_at) AS day, COUNT(*)::int AS scans
           FROM events
           WHERE retailer_id = $1 AND event_type = 'scan'
             AND created_at >= $2::timestamptz
             AND created_at <  ($3::timestamptz + interval '1 day')
           GROUP BY DATE(created_at)
         )
         SELECT
           ds_series.day::text                    AS day,
           COALESCE(de.scans,   0)                AS scans,
           COALESCE(ds.convos,  0)                AS convos,
           COALESCE(ds.recs,    0)                AS recs,
           COALESCE(ds.orders,  0)                AS orders
         FROM day_series ds_series
         LEFT JOIN daily_sessions ds ON ds.day  = ds_series.day
         LEFT JOIN daily_scans    de ON de.day  = ds_series.day
         ORDER BY ds_series.day`,
        [retailerId, chartFrom, chartTo]
      ),

      // ── Recent sessions (respect date filter) ────────────────────────────────
      dbQuery<Record<string, unknown>>(
        `SELECT id, order_status, created_at
         FROM sessions
         WHERE retailer_id = $1
           AND ($2::text = '' OR created_at >= $2::timestamptz)
           AND ($3::text = '' OR created_at <  ($3::timestamptz + interval '1 day'))
         ORDER BY created_at DESC LIMIT 10`,
        [retailerId, from, to]
      ),

      // ── This month's AI usage (for the cost/budget card) ──────────────────────
      dbQuery<Record<string, unknown>>(
        `SELECT ai_input_tokens_month, ai_output_tokens_month, ai_month_reset_at
         FROM retailers WHERE id = $1 LIMIT 1`,
        [retailerId]
      ),
    ])

    if (format === 'csv') {
      const header = csvRow(['Date', 'Scans', 'Conversations', 'Recommendations', 'Orders'])
      const rows = dailyResult.rows.map(r =>
        csvRow([r.day, r.scans, r.convos, r.recs, r.orders])
      )
      return new NextResponse([header, ...rows].join('\r\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="analytics.csv"',
        },
      })
    }

    const s = summaryResult.rows[0] ?? {}

    // AI usage this month — treat a stale reset timestamp as zero.
    const aiRow = aiResult.rows[0] ?? {}
    const reset = aiRow.ai_month_reset_at ? new Date(aiRow.ai_month_reset_at as string) : null
    const monthStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    const aiActive = reset && reset.getTime() >= monthStart
    const inTok  = aiActive ? Number(aiRow.ai_input_tokens_month  ?? 0) : 0
    const outTok = aiActive ? Number(aiRow.ai_output_tokens_month ?? 0) : 0
    const aiCostUsd = (inTok / 1e6) * AI_INPUT_USD_PER_MTOK + (outTok / 1e6) * AI_OUTPUT_USD_PER_MTOK

    return NextResponse.json({
      ok: true,
      stats: {
        scans:  Number(s.scans  ?? 0),
        convos: Number(s.convos ?? 0),
        recs:   Number(s.recs   ?? 0),
        orders: Number(s.orders ?? 0),
      },
      aiUsage: {
        costUsd:   Math.round(aiCostUsd * 100) / 100,
        budgetUsd: AI_BUDGET_USD,
        pct:       AI_BUDGET_USD > 0 ? Math.min(100, Math.round((aiCostUsd / AI_BUDGET_USD) * 100)) : 0,
      },
      daily: dailyResult.rows.map(r => ({
        day:    String(r.day).slice(0, 10),
        scans:  Number(r.scans),
        convos: Number(r.convos),
        recs:   Number(r.recs),
        orders: Number(r.orders),
      })),
      recent: recentResult.rows,
      range: {
        from: from || null,
        to:   to   || null,
        chartFrom,
        chartTo,
      },
    })
  } catch (error) {
    return adminError('dashboard load', error, 'dashboard lookup failed')
  }
}
