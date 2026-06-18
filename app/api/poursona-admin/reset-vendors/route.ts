import { NextRequest, NextResponse } from 'next/server'
import { requireTeamMember } from '@/lib/auth'
import { archiveAllRetailers, deleteAllRetailers } from '@/lib/vendor-admin'

export const dynamic = 'force-dynamic'

/**
 * Bulk vendor reset for starting fresh in testing. Owner-only and deliberately
 * awkward to fire by accident:
 *
 *   POST /api/poursona-admin/reset-vendors
 *   { "mode": "archive" | "delete",
 *     "confirm": "ARCHIVE ALL" | "DELETE ALL",
 *     "preserveEmail": "you@example.com" | null }
 *
 * - mode "archive" → reversible soft-delete of every venue (recommended).
 * - mode "delete"  → permanent purge of every venue and all dependent rows.
 * - preserveEmail keeps the account whose owner_email matches (case-insensitive).
 *
 * The confirm phrase must match the mode exactly, so a stray request body can't
 * trigger a wipe.
 */
const CONFIRM: Record<'archive' | 'delete', string> = {
  archive: 'ARCHIVE ALL',
  delete: 'DELETE ALL',
}

export async function POST(req: NextRequest) {
  try {
    // Destructive bulk op — internal owners only.
    if (!(await requireTeamMember('owner'))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const { mode, confirm, preserveEmail } = await req.json().catch(() => ({}))
    if (mode !== 'archive' && mode !== 'delete') {
      return NextResponse.json({ error: 'mode must be "archive" or "delete"' }, { status: 400 })
    }
    const safeMode: 'archive' | 'delete' = mode
    if (confirm !== CONFIRM[safeMode]) {
      return NextResponse.json(
        { error: `confirm must be exactly "${CONFIRM[safeMode]}" for mode "${safeMode}"` },
        { status: 400 }
      )
    }
    const preserve = typeof preserveEmail === 'string' && preserveEmail.trim() ? preserveEmail.trim() : null

    const affected =
      safeMode === 'archive'
        ? await archiveAllRetailers(preserve)
        : await deleteAllRetailers(preserve)

    return NextResponse.json({ ok: true, mode: safeMode, affected, preserved: preserve })
  } catch (err) {
    console.error('[api/poursona-admin/reset-vendors] failed:', err)
    return NextResponse.json({ error: 'reset failed' }, { status: 500 })
  }
}
