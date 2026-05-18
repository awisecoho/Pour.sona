import { NextRequest, NextResponse } from 'next/server'
import { createDraftFromUrl } from '@/lib/onboarding'
import { getAuthenticatedIdentity } from '@/lib/auth'
import { verifyOnboardSecret } from '@/lib/security'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Accept either a Clerk-authenticated team member or the server-side onboard secret
    const identity = await getAuthenticatedIdentity()
    if (identity) {
      const teamCheck = await dbQuery('select 1 from poursona_team where email = $1 limit 1', [identity.email])
      if (teamCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } else if (!verifyOnboardSecret(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url || typeof url !== 'string') return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Block non-HTTP URLs and private/localhost targets
    let parsed: URL
    try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }) }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local')) {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    const draft = await createDraftFromUrl(url)
    return NextResponse.json({ ok: true, draft })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 })
  }
}
