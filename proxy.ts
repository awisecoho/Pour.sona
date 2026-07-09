import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import * as Sentry from '@sentry/nextjs'

const LIMITS: Record<string, { max: number; window: string }> = {
  '/api/chat':        { max: 20,  window: '1 h' },
  '/api/menu-scan':   { max: 10,  window: '1 h' },
  '/api/retailer':    { max: 120, window: '1 h' },
  '/api/order':       { max: 30,  window: '1 h' },
  // Vendor self-service rescan: runs the same AI scraping pipeline as
  // menu-scan and isn't covered by the per-vendor chat AI budget, so it needs
  // its own cap now that vendors (not just internal staff) can trigger it.
  '/api/admin/rescan': { max: 5, window: '1 h' },
}

// Routes that must fail-closed if Redis is unavailable (expensive AI calls)
const FAIL_CLOSED_PATHS = new Set(['/api/chat', '/api/menu-scan', '/api/admin/rescan'])

// Prefix-based limits applied to authenticated admin routes
const PREFIX_LIMITS: Array<{ prefix: string; max: number; window: string }> = [
  { prefix: '/api/admin',           max: 120, window: '1 h' },
  { prefix: '/api/poursona-admin',  max: 60,  window: '1 h' },
  { prefix: '/api/catalog',         max: 120, window: '1 h' },
]

type LimiterMap = Record<string, Ratelimit>
let exactLimiters: LimiterMap | null = null
let prefixLimiters: Array<{ prefix: string; limiter: Ratelimit }> | null = null

// ── In-memory fallback limiter ────────────────────────────────────────────────
// Used only when Upstash Redis is NOT configured. Best-effort, per serverless
// instance (NOT global) — so it's weaker than Redis under horizontal scale, but
// it lets fail-closed routes (chat) keep working instead of returning 503, while
// still throttling obvious abuse from a single IP hitting one warm instance.
const memBuckets = new Map<string, { count: number; reset: number }>()

function inMemoryAllow(path: string, ip: string, max: number, windowMs: number): boolean {
  const key = `${path}:${ip}`
  const now = Date.now()
  const bucket = memBuckets.get(key)
  if (!bucket || now > bucket.reset) {
    memBuckets.set(key, { count: 1, reset: now + windowMs })
    // Opportunistic cleanup so the Map can't grow unbounded on a long-lived instance.
    if (memBuckets.size > 5000) {
      for (const [k, v] of memBuckets) if (now > v.reset) memBuckets.delete(k)
    }
    return true
  }
  if (bucket.count >= max) return false
  bucket.count++
  return true
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

function tooManyRequests() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { status: 429 }
  )
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
}

function getLimiters(): { exact: LimiterMap; prefix: Array<{ prefix: string; limiter: Ratelimit }> } | null {
  if (exactLimiters && prefixLimiters) return { exact: exactLimiters, prefix: prefixLimiters }
  const redis = getRedis()
  if (!redis) return null

  exactLimiters = Object.fromEntries(
    Object.entries(LIMITS).map(([path, { max, window: w }]) => [
      path,
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, w as any), prefix: `rl:${path}` }),
    ])
  )
  prefixLimiters = PREFIX_LIMITS.map(({ prefix, max, window: w }) => ({
    prefix,
    limiter: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, w as any), prefix: `rl:${prefix}` }),
  }))
  return { exact: exactLimiters, prefix: prefixLimiters }
}

async function applyRateLimit(req: NextRequest) {
  const path = req.nextUrl.pathname
  const ip = getClientIp(req)
  const rl = getLimiters()
  if (!rl) {
    // Redis not configured. Instead of 503-ing expensive routes, fall back to a
    // best-effort in-memory limiter so the experience keeps working (e.g. guest
    // chat) while still throttling abuse. Non-tracked routes pass through.
    const cfg = LIMITS[path]
    if (cfg && FAIL_CLOSED_PATHS.has(path)) {
      if (!inMemoryAllow(path, ip, cfg.max, 60 * 60 * 1000)) return tooManyRequests()
    }
    return NextResponse.next()
  }

  let limiter: Ratelimit | undefined = rl.exact[path]
  if (!limiter) {
    limiter = rl.prefix.find(p => path.startsWith(p.prefix))?.limiter
  }
  if (!limiter) return NextResponse.next()

  let success: boolean, limit: number, remaining: number, reset: number
  try {
    ;({ success, limit, remaining, reset } = await limiter.limit(ip))
  } catch (err) {
    Sentry.captureException(err, { extra: { path, context: 'rate-limit' } })
    // Redis errored mid-request — degrade to the in-memory limiter rather than 503.
    const cfg = LIMITS[path]
    if (cfg && FAIL_CLOSED_PATHS.has(path)) {
      if (!inMemoryAllow(path, ip, cfg.max, 60 * 60 * 1000)) return tooManyRequests()
    }
    return NextResponse.next()
  }

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
const isVendorAdminPublicPage = createRouteMatcher(['/admin/login(.*)', '/admin/signup(.*)', '/admin/auth(.*)'])
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
