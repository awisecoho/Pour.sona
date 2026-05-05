import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter (resets on cold start — acceptable for MVP)
// For production: replace with Vercel KV or Upstash Redis
const rateMap = new Map<string, { count: number; reset: number }>()

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/chat':        { max: 20,  windowMs: 60 * 60 * 1000 }, // 20/hr — protect Anthropic budget
  '/api/menu-scan':   { max: 10,  windowMs: 60 * 60 * 1000 }, // 10/hr — vision is expensive
  '/api/retailer':    { max: 120, windowMs: 60 * 60 * 1000 }, // 120/hr — page loads
}

function applyRateLimit(req: NextRequest) {
  const path = req.nextUrl.pathname
  const limit = LIMITS[path]
  if (!limit) return NextResponse.next()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  const key = `${path}:${ip}`
  const now = Date.now()
  const entry = rateMap.get(key)

  if (!entry || now > entry.reset) {
    rateMap.set(key, { count: 1, reset: now + limit.windowMs })
    return NextResponse.next()
  }

  if (entry.count >= limit.max) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((entry.reset - now) / 1000)),
          'X-RateLimit-Limit': String(limit.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(entry.reset),
        }
      }
    )
  }

  entry.count++
  return NextResponse.next()
}

const isProtectedRoute = createRouteMatcher([
  '/admin((?!/login|/auth).*)',
  '/poursona-admin((?!/login).*)',
  '/api/admin/access',
  '/api/poursona-admin/invite',
  '/api/poursona-admin/system-check',
  '/api/poursona-admin/me',
])

const hasClerkEnv =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
  Boolean(process.env.CLERK_SECRET_KEY)

const protectedMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth().protect()
  }

  return applyRateLimit(req)
})

export default function middleware(req: NextRequest, evt: any) {
  if (!hasClerkEnv) {
    if (isProtectedRoute(req)) {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: 'Admin authentication is not configured.' },
          { status: 503 }
        )
      }

      return NextResponse.redirect(new URL('/admin/login', req.url))
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
