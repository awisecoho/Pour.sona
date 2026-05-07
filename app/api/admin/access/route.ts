import { NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getRetailersForIdentity } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    const retailers = accessRows.map((row) => ({
      ...row.retailer,
      admin_role: row.role,
      admin_email: row.admin_email,
    }))

    return NextResponse.json({
      ok: true,
      email: identity.email,
      userId: identity.userId,
      defaultRetailerId: retailers[0]?.id || null,
      retailers,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'access lookup failed',
      },
      { status: 500 }
    )
  }
}
