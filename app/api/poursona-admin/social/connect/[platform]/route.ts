import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { getAuthenticatedIdentity, getInternalMemberByEmail } from '@/lib/auth'
import { PLATFORMS, isPlatform, isConfigured, redirectUri, type Platform } from '@/lib/social'

export const dynamic = 'force-dynamic'

const back = (origin: string, qs: string) =>
  NextResponse.redirect(`${origin}/poursona-admin?tab=social&${qs}`)

const base64url = (b: Buffer) =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// GET — begin the OAuth authorization-code flow for a platform.
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const origin = req.nextUrl.origin

  // Auth: must be a Poursona team member (Clerk cookies travel with this nav).
  const identity = await getAuthenticatedIdentity()
  if (!identity?.email || !(await getInternalMemberByEmail(identity.email))) {
    return back(origin, 'error=forbidden')
  }

  const { platform } = await params
  if (!isPlatform(platform)) return back(origin, 'error=unknown_platform')
  if (!isConfigured(platform)) return back(origin, `error=not_configured&platform=${platform}`)

  const def = PLATFORMS[platform as Platform]
  const clientId = process.env[def.clientIdEnv]!
  const state = base64url(randomBytes(16))

  const authUrl = new URL(def.authorizeUrl)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri(platform as Platform, origin))
  authUrl.searchParams.set('scope', def.scopes)
  authUrl.searchParams.set('state', state)

  // PKCE is required by X (Twitter) OAuth2; we only attach it for twitter.
  let verifier = ''
  if (platform === 'twitter') {
    verifier = base64url(randomBytes(32))
    const challenge = base64url(createHash('sha256').update(verifier).digest())
    authUrl.searchParams.set('code_challenge', challenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
  }

  const redirect = NextResponse.redirect(authUrl.toString())
  const cookieOpts = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 }
  redirect.cookies.set(`oauth_state_${platform}`, state, cookieOpts)
  if (verifier) redirect.cookies.set(`oauth_verifier_${platform}`, verifier, cookieOpts)
  return redirect
}
