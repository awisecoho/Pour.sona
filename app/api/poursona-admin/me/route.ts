import { NextResponse } from 'next/server'
import {
  getAuthenticatedIdentity,
  getInternalMemberByEmail,
  getRetailersForIdentity,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const identity = await getAuthenticatedIdentity()
    if (!identity) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    if (!identity.email) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const member = await getInternalMemberByEmail(identity.email)
    if (!member) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
    const retailers = accessRows.map((row) => ({
      ...row.retailer,
      admin_role: row.role,
      admin_email: row.admin_email,
    }))

    return NextResponse.json({
      ok: true,
      user: {
        userId: identity.userId,
        email: identity.email,
        name: member.name,
      },
      retailers,
      role: member.role,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'member lookup failed',
      },
      { status: 500 }
    )
  }
}
