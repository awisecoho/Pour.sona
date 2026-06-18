import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

interface RetailerPageRow {
  id: string
  name: string
  slug: string
  vertical: string
  owner_email: string | null
  subscription_status: string | null
  trial_ends_at: string | null
  active: boolean
  created_at: string
  brand_color: string | null
  logo_url: string | null
  session_total: number
  session_ordered: number
  total_count: string
  [key: string]: unknown
}

interface SummaryRow {
  total_retailers: string
  active_count: string
  paid_count: string
  trial_count: string
  expired_count: string
  total_sessions: string
  total_orders: string
}

interface ExpiredRow {
  id: string
  name: string
  trial_ends_at: string | null
}

export async function GET(req: NextRequest) {
  try {
    // Cross-tenant data (owner emails, revenue stats) — team members only.
    if (!(await requireTeamMember())) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const rawLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    const search = (searchParams.get('search') || '').trim()
    const status = (searchParams.get('status') || '').trim()
    // Archived venues are hidden unless explicitly requested.
    const includeArchived = searchParams.get('includeArchived') === '1'
    const offset = (page - 1) * limit
    const searchPattern = search ? `%${search}%` : ''

    // Single round-trip: CTE aggregates per-retailer stats, window fn gives total filtered count
    const retailersResult = await dbQuery<RetailerPageRow>(
      `WITH session_stats AS (
        SELECT
          retailer_id,
          COUNT(*)::int                                                    AS total,
          COUNT(*) FILTER (WHERE order_status = 'ordered')::int           AS ordered
        FROM sessions
        GROUP BY retailer_id
      )
      SELECT
        r.*,
        COALESCE(ss.total,   0) AS session_total,
        COALESCE(ss.ordered, 0) AS session_ordered,
        COUNT(*) OVER()         AS total_count
      FROM retailers r
      LEFT JOIN session_stats ss ON ss.retailer_id = r.id
      WHERE ($3::text = '' OR r.name ILIKE $4 OR r.slug ILIKE $4 OR r.owner_email ILIKE $4)
        AND ($5::text = '' OR r.subscription_status = $5)
        AND ($6::boolean OR r.archived_at IS NULL)
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset, search, searchPattern, status, includeArchived]
    )

    // Global summary (always unfiltered — dashboard stats)
    const [summaryResult, expiredResult] = await Promise.all([
      dbQuery<SummaryRow>(
        `SELECT
          COUNT(*)::int                                                              AS total_retailers,
          COUNT(*) FILTER (WHERE active = true)::int                                AS active_count,
          COUNT(*) FILTER (WHERE subscription_status = 'active')::int               AS paid_count,
          COUNT(*) FILTER (WHERE subscription_status = 'trial')::int                AS trial_count,
          COUNT(*) FILTER (WHERE subscription_status = 'trial'
                               AND trial_ends_at < now())::int                      AS expired_count,
          (SELECT COUNT(*)::int FROM sessions)                                       AS total_sessions,
          (SELECT COUNT(*) FILTER (WHERE order_status = 'ordered') FROM sessions)::int AS total_orders
        FROM retailers`,
        []
      ),
      dbQuery<ExpiredRow>(
        `SELECT id, name, trial_ends_at FROM retailers
         WHERE subscription_status = 'trial' AND trial_ends_at < now()
         ORDER BY trial_ends_at ASC`,
        []
      ),
    ])

    const totalCount = retailersResult.rows[0]
      ? parseInt(String(retailersResult.rows[0].total_count), 10)
      : 0

    const retailers = retailersResult.rows.map((row) => {
      const { session_total, session_ordered, total_count, ...rest } = row
      return {
        ...rest,
        stats: {
          total: session_total,
          recommended: 0,
          ordered: session_ordered,
        },
      }
    })

    const s = summaryResult.rows[0]
    const summary = s
      ? {
          totalRetailers: parseInt(String(s.total_retailers), 10),
          activeCount:    parseInt(String(s.active_count),    10),
          paidCount:      parseInt(String(s.paid_count),      10),
          trialCount:     parseInt(String(s.trial_count),     10),
          expiredCount:   parseInt(String(s.expired_count),   10),
          totalSessions:  parseInt(String(s.total_sessions),  10),
          totalOrders:    parseInt(String(s.total_orders),    10),
          expiredRetailers: expiredResult.rows,
        }
      : null

    return NextResponse.json({
      retailers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
