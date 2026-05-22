import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
import { isConfigured, decryptToken, type Platform } from '@/lib/social'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function requireTeamMember() {
  const identity = await getAuthenticatedIdentity()
  if (!identity?.email) return null
  const member = await getInternalMemberByEmail(identity.email)
  if (!member) return null
  return { email: identity.email }
}

// Per-platform publish. Returns the external post id on success.
async function publish(platform: Platform, token: string, externalId: string | null, body: string): Promise<string> {
  if (platform === 'twitter') {
    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.detail || j?.title || `X ${r.status}`)
    return j.data?.id ?? ''
  }
  if (platform === 'facebook') {
    // Posts to the authenticated target's feed. (Page posting needs a page token;
    // wire page selection in a later pass.)
    const r = await fetch(`https://graph.facebook.com/v19.0/me/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body, access_token: token }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error?.message || `Meta ${r.status}`)
    return j.id ?? ''
  }
  if (platform === 'linkedin') {
    if (!externalId) throw new Error('missing LinkedIn author id')
    const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify({
        author: `urn:li:person:${externalId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: body }, shareMediaCategory: 'NONE' } },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.message || `LinkedIn ${r.status}`)
    return j.id ?? ''
  }
  // Instagram requires an image/video container flow — not supported for text-only.
  throw new Error(`${platform}: text posting not supported (needs media)`)
}

export async function POST(req: NextRequest) {
  const ctx = await requireTeamMember()
  if (!ctx) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { body, accountIds } = await req.json().catch(() => ({}))
  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'post body required' }, { status: 400 })
  }
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return NextResponse.json({ error: 'select at least one account' }, { status: 400 })
  }

  const r = await dbQuery(
    `select id, platform, external_id, access_token, status from social_accounts
     where scope = 'poursona' and id = any($1::uuid[])`,
    [accountIds]
  )

  const results: { id: string; platform: string; ok: boolean; detail: string }[] = []
  for (const acc of r.rows as any[]) {
    const platform = acc.platform as Platform
    try {
      if (acc.status !== 'connected') throw new Error('not connected via OAuth — connect to enable posting')
      if (!isConfigured(platform)) throw new Error(`${platform} app not configured`)
      const token = decryptToken(acc.access_token)
      if (!token) throw new Error('no access token on file')
      const extId = await publish(platform, token, acc.external_id, body.trim())
      await dbQuery(
        `insert into social_posts (account_id, platform, body, external_post_id, status, posted_by) values ($1,$2,$3,$4,'posted',$5)`,
        [acc.id, platform, body.trim(), extId, ctx.email]
      ).catch(() => {})
      results.push({ id: acc.id, platform, ok: true, detail: extId || 'posted' })
    } catch (e: any) {
      await dbQuery(
        `insert into social_posts (account_id, platform, body, status, error, posted_by) values ($1,$2,$3,'failed',$4,$5)`,
        [acc.id, platform, body.trim(), e?.message ?? 'error', ctx.email]
      ).catch(() => {})
      results.push({ id: acc.id, platform, ok: false, detail: e?.message ?? 'error' })
    }
  }

  return NextResponse.json({ ok: true, results })
}
