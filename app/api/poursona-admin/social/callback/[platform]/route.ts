import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
import { dbQuery } from '@/lib/db'
import { PLATFORMS, isPlatform, isConfigured, redirectUri, encryptToken, type Platform } from '@/lib/social'

export const dynamic = 'force-dynamic'

const back = (origin: string, qs: string) =>
  NextResponse.redirect(`${origin}/poursona-admin?tab=social&${qs}`)

// Exchange an authorization code for an access token. Meta + LinkedIn use a
// standard form-encoded POST; X (Twitter) additionally needs the PKCE verifier
// and HTTP Basic auth.
async function exchangeCode(
  platform: Platform,
  code: string,
  origin: string,
  verifier?: string
): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number }> {
  const def = PLATFORMS[platform]
  const clientId = process.env[def.clientIdEnv]!
  const clientSecret = process.env[def.clientSecretEnv]!
  const redirect = redirectUri(platform, origin)

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect,
    client_id: clientId,
  })

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (platform === 'twitter') {
    if (verifier) form.set('code_verifier', verifier)
    headers.Authorization = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  } else {
    form.set('client_secret', clientSecret)
  }

  const res = await fetch(def.tokenUrl, { method: 'POST', headers, body: form })
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

// Best-effort profile lookup so the saved account has a human-readable name.
async function fetchProfile(platform: Platform, accessToken: string): Promise<{ id?: string; name?: string }> {
  try {
    if (platform === 'facebook' || platform === 'instagram') {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`)
      const j = await r.json()
      return { id: j.id, name: j.name }
    }
    if (platform === 'twitter') {
      const r = await fetch('https://api.twitter.com/2/users/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      const j = await r.json()
      return { id: j.data?.id, name: j.data?.username ? `@${j.data.username}` : j.data?.name }
    }
    if (platform === 'linkedin') {
      const r = await fetch('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      const j = await r.json()
      const name = [j.localizedFirstName, j.localizedLastName].filter(Boolean).join(' ')
      return { id: j.id, name: name || 'LinkedIn account' }
    }
  } catch { /* fall through */ }
  return {}
}

export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const origin = req.nextUrl.origin
  const platform = params.platform

  const identity = await getAuthenticatedIdentity()
  if (!identity?.email || !(await getInternalMemberByEmail(identity.email))) {
    return back(origin, 'error=forbidden')
  }
  if (!isPlatform(platform)) return back(origin, 'error=unknown_platform')
  if (!isConfigured(platform)) return back(origin, `error=not_configured&platform=${platform}`)

  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  if (oauthError) return back(origin, `error=denied&platform=${platform}`)
  if (!code) return back(origin, `error=no_code&platform=${platform}`)

  // CSRF: state must match the cookie set during initiate.
  const expectedState = req.cookies.get(`oauth_state_${platform}`)?.value
  if (!expectedState || expectedState !== state) {
    return back(origin, `error=bad_state&platform=${platform}`)
  }
  const verifier = req.cookies.get(`oauth_verifier_${platform}`)?.value

  try {
    const tokens = await exchangeCode(platform as Platform, code, origin, verifier)
    if (!tokens.access_token) throw new Error('no access_token returned')
    const profile = await fetchProfile(platform as Platform, tokens.access_token)

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null

    await dbQuery(
      `insert into social_accounts
         (scope, platform, external_id, display_name, access_token, refresh_token, scopes, status, selected, connected_by, expires_at)
       values ('poursona', $1, $2, $3, $4, $5, $6, 'connected', true, $7, $8)
       on conflict (platform, coalesce(external_id, ''), coalesce(retailer_id::text, ''))
       do update set access_token = excluded.access_token,
                     refresh_token = excluded.refresh_token,
                     status = 'connected',
                     scopes = excluded.scopes,
                     expires_at = excluded.expires_at,
                     connected_at = now()`,
      [
        platform,
        profile.id ?? null,
        profile.name ?? PLATFORMS[platform as Platform].label,
        encryptToken(tokens.access_token),
        encryptToken(tokens.refresh_token ?? null),
        PLATFORMS[platform as Platform].scopes,
        identity.email,
        expiresAt,
      ]
    )

    const res = back(origin, `connected=${platform}`)
    res.cookies.delete(`oauth_state_${platform}`)
    res.cookies.delete(`oauth_verifier_${platform}`)
    return res
  } catch (e: any) {
    console.error('[social/callback]', platform, e?.message)
    return back(origin, `error=exchange_failed&platform=${platform}`)
  }
}
