import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { requireTeamMember } from '@/lib/auth'
export const dynamic = 'force-dynamic'

type CheckResult = { key: string; label: string; ready: boolean; error: string | null }

async function checkTable(table: string, label: string): Promise<CheckResult> {
  try {
    await dbQuery(`select id from ${table} limit 1`, [])
    return { key: table, label, ready: true, error: null }
  } catch (err: any) {
    return { key: table, label, ready: false, error: err.message }
  }
}

async function checkColumn(table: string, column: string, label: string): Promise<CheckResult> {
  try {
    await dbQuery(`select ${column} from ${table} limit 1`, [])
    return { key: `${table}.${column}`, label, ready: true, error: null }
  } catch (err: any) {
    return { key: `${table}.${column}`, label, ready: false, error: err.message }
  }
}

export async function GET() {
  try {
    // Defense in depth: the middleware also guards this route, but middleware
    // can be bypassed (e.g. CVE-2025-29927), so enforce here too.
    if (!(await requireTeamMember())) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
    const checks = await Promise.all([
      checkTable('retailers', 'retailers table'),
      checkTable('products', 'products table'),
      checkTable('sessions', 'sessions table'),
      checkTable('orders', 'orders table'),
      checkColumn('retailers', 'website_url', 'retailers.website_url exists'),
      checkColumn('retailers', 'subscription_status', 'retailers.subscription_status exists'),
      checkColumn('sessions', 'customer_email', 'sessions.customer_email exists'),
    ])

    return NextResponse.json({
      ok: true,
      ready: checks.every(c => c.ready),
      checkedAt: new Date().toISOString(),
      checks,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, ready: false, error: err instanceof Error ? err.message : 'system check failed' },
      { status: 500 }
    )
  }
}
