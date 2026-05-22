import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
import { PLATFORMS, platformStatus, isPlatform, type Platform } from '@/lib/social'

export const dynamic = 'force-dynamic'

async function requireTeamMember() {
  const identity = await getAuthenticatedIdentity()
  if (!identity?.email) return null
  const member = await getInternalMemberByEmail(identity.email)
  if (!member) return null
  return { email: identity.email, member }
}

// Columns safe to return to the browser — never the encrypted tokens.
const SAFE_COLS = 'id, scope, retailer_id, platform, external_id, display_name, avatar_url, scopes, status, selected, connected_by, expires_at, connected_at'

// GET — platform connect status + all linked accounts (internal scope)
export async function GET() {
  const ctx = await requireTeamMember()
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const platforms = (Object.keys(PLATFORMS) as Platform[]).map(platformStatus)
  let accounts: any[] = []
  try {
    const r = await dbQuery(
      `select ${SAFE_COLS} from social_accounts where scope = 'poursona' order by platform, connected_at desc`
    )
    accounts = r.rows
  } catch (e: any) {
    // Table may not exist until /api/migrate has run.
    return NextResponse.json({ ok: true, platforms, accounts: [], warning: 'social_accounts table missing — run /api/migrate' })
  }
  return NextResponse.json({ ok: true, platforms, accounts })
}

// POST — manually add an account (handle/profile) without OAuth. Lets the team
// track + select accounts now; posting stays gated until OAuth is connected.
export async function POST(req: NextRequest) {
  const ctx = await requireTeamMember()
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { platform, displayName, profileUrl } = body
  if (!isPlatform(platform)) {
    return NextResponse.json({ error: 'invalid platform' }, { status: 400 })
  }
  if (!displayName || typeof displayName !== 'string') {
    return NextResponse.json({ error: 'displayName required' }, { status: 400 })
  }

  try {
    const r = await dbQuery(
      `insert into social_accounts (scope, platform, display_name, avatar_url, status, selected, connected_by, external_id)
       values ('poursona', $1, $2, $3, 'manual', true, $4, $5)
       on conflict do nothing
       returning ${SAFE_COLS}`,
      [platform, displayName.trim(), profileUrl || null, ctx.email, profileUrl || displayName.trim()]
    )
    return NextResponse.json({ ok: true, account: r.rows[0] ?? null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'insert failed' }, { status: 500 })
  }
}

// PATCH — toggle whether an account is included in multi-select actions
export async function PATCH(req: NextRequest) {
  const ctx = await requireTeamMember()
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id, selected } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await dbQuery(`update social_accounts set selected = $2 where id = $1 and scope = 'poursona'`, [id, !!selected])
  return NextResponse.json({ ok: true })
}

// DELETE — disconnect / remove an account
export async function DELETE(req: NextRequest) {
  const ctx = await requireTeamMember()
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await dbQuery(`delete from social_accounts where id = $1 and scope = 'poursona'`, [id])
  return NextResponse.json({ ok: true })
}
