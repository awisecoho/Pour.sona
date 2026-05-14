import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const LIMITS: Record<string, { max: number; window: string }> = {
  '/api/chat':      { max: 20,  window: '1 h' },
  '/api/menu-scan': { max: 10,  window: '1 h' },
  '/api/retailer':  { max: 120, window: '1 h' },
}

let limiters: Record<string, Ratelimit> | null = null

function getLimiters() {
  if (limiters) return limiters
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  limiters = Object.fromEntries(
    Object.entries(LIMITS).map(([path, { max, window: w }]) => [
      path,
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, w as any), prefix: `rl:${path}` }),
    ])
  )
  return limiters
}

async function applyRateLimit(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (!LIMITS[path]) return NextResponse.next()

  const rl = getLimiters()
  if (!rl) return NextResponse.next() // no Redis configured — pass through

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  const { success, limit, remaining, reset } = await rl[path].limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }
  return NextResponse.next()
}

const isVendorAdminPage = createRouteMatcher(['/admin', '/admin/(.*)'])
const isVendorAdminPublicPage = createRouteMatcher(['/admin/login(.*)', '/admin/auth(.*)'])
const isInternalAdminPage = createRouteMatcher(['/poursona-admin', '/poursona-admin/(.*)'])
const isInternalAdminPublicPage = createRouteMatcher(['/poursona-admin/login(.*)'])
const isProtectedApiRoute = createRouteMatcher([
  '/api/admin/access',
  '/api/poursona-admin/invite',
  '/api/poursona-admin/system-check',
  '/api/poursona-admin/me',
])

const hasClerkEnv =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY)

const protectedMiddleware = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()

  if (isVendorAdminPage(req) && !isVendorAdminPublicPage(req) && !userId) {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  if (isInternalAdminPage(req) && !isInternalAdminPublicPage(req) && !userId) {
    return NextResponse.redirect(new URL('/poursona-admin/login', req.url))
  }
  if (isProtectedApiRoute(req) && !userId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return applyRateLimit(req)
})

export default function middleware(req: NextRequest, evt: any) {
  const needsVendorLogin = isVendorAdminPage(req) && !isVendorAdminPublicPage(req)
  const needsInternalLogin = isInternalAdminPage(req) && !isInternalAdminPublicPage(req)

  if (!hasClerkEnv) {
    if (needsVendorLogin || needsInternalLogin || isProtectedApiRoute(req)) {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ ok: false, error: 'Admin authentication is not configured.' }, { status: 503 })
      }
      const loginPath = needsInternalLogin ? '/poursona-admin/login' : '/admin/login'
      return NextResponse.redirect(new URL(loginPath, req.url))
    }
    return applyRateLimit(req)
  }

  return protectedMiddleware(req, evt)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
