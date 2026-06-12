import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

// ── Prompt injection guard ────────────────────────────────────────────────────
// Strip ===WORD=== sentinel patterns from vendor-supplied text before inserting
// into system prompts. The recommendation parser looks for ===REC=== / ===END===;
// if a vendor embeds those in their story/culture/tagline the AI output could
// be silently corrupted or faked recommendations injected.

export function sanitizePromptInput(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/={3}[A-Z_]+={3}/g, '')  // strip ===WORD=== sentinels
    .trim()
}

// ── Origin / CSRF guard ───────────────────────────────────────────────────────
// Full stateful CSRF tokens aren't feasible for anonymous guest flows (no
// session cookies). Origin-header checking is the strongest practical defense
// for same-origin API calls from our own pages.
//
// Rules:
//   - No Origin header       → pass (server-to-server, same-site navigation)
//   - Origin === app URL     → pass
//   - Origin === localhost   → pass in development only
//   - Origin === "null"      → block (sandboxed iframe)
//   - Any other origin       → block

export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  if (origin === 'null') return false

  // Primary guard: same-origin request (Origin hostname === Host hostname).
  // This is the real CSRF defense and transparently covers EVERY domain the app
  // is served on — custom domain (pour-sona.com), *.vercel.app, and branch
  // aliases — without needing per-domain config. A cross-site POST has a
  // different Origin host than Host, so it's still blocked.
  const host = req.headers.get('host')
  if (host) {
    try {
      const originHost = new URL(origin).hostname.toLowerCase()
      if (originHost === host.split(':')[0].toLowerCase()) return true
    } catch {}
  }

  // Secondary allow: an explicitly configured canonical app URL.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && origin === appUrl) return true

  if (process.env.NODE_ENV === 'development') {
    try {
      const { hostname } = new URL(origin)
      if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    } catch {}
  }

  return false
}

// ── Onboarding secret verification ───────────────────────────────────────────
// Centralised so the secret is never echoed in logs or error responses.
// Uses timing-safe comparison to prevent secret-length oracle attacks.

export function verifyOnboardSecret(req: NextRequest): boolean {
  const provided = req.headers.get('x-onboard-secret')
  const expected = process.env.POURSONA_ONBOARD_SECRET
  if (!provided || !expected) return false
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Migration secret verification ─────────────────────────────────────────────
// Gates POST /api/migrate (production schema changes). Fails closed when
// MIGRATE_SECRET is unset so the endpoint can never run unguarded.

export function verifyMigrateSecret(provided: unknown): boolean {
  const expected = process.env.MIGRATE_SECRET
  if (typeof provided !== 'string' || !provided || !expected) return false
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

// ── Email validation ──────────────────────────────────────────────────────────
// RFC 5321 max length is 254. Simple structural check is enough for our uses;
// Resend will reject malformed addresses at send time.

export function validateEmailFormat(email: unknown): email is string {
  if (typeof email !== 'string') return false
  if (email.length < 3 || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

// ── Logo URL safety check ─────────────────────────────────────────────────────
// Applied before fetching a vendor-supplied logo URL in the QR route.
// Prevents SSRF against internal infrastructure and wasted bandwidth on
// non-image or oversized responses.

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,                       // 0.0.0.0/8 ("this host")
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./,
  /^169\.254\./,                // link-local / cloud metadata (169.254.169.254)
  /^::1$/,                      // IPv6 loopback
  /^::$/,                       // unspecified
  /^fc[0-9a-f]{2}:/i,           // IPv6 unique-local fc00::/7
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,                    // IPv6 link-local
  /\.local$/i,
  /\.internal$/i,
]

// ── Outbound scrape URL safety (SSRF guard) ───────────────────────────────────
// Applied before fetching a vendor-supplied website URL during onboarding so the
// scraper can't be pointed at internal infrastructure or cloud metadata.
export function validateScrapeUrl(raw: string | null | undefined): { ok: true; url: URL } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'string') return { ok: false, error: 'Missing url' }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, error: 'Invalid url' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL must use http or https' }
  }
  // Embedded credentials (user:pass@host) are a common SSRF bypass vector.
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'URL must not contain credentials' }
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (PRIVATE_HOST_PATTERNS.some(p => p.test(host))) {
    return { ok: false, error: 'URL points to a private or local network address' }
  }
  return { ok: true, url: parsed }
}

export function validateLogoUrl(raw: string | null | undefined): { ok: true; url: URL } | { ok: false; error: string } {
  if (!raw) return { ok: false, error: 'no logo URL' }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, error: 'invalid URL' }
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'logo URL must use https' }
  }

  const host = parsed.hostname.toLowerCase()
  if (PRIVATE_HOST_PATTERNS.some(p => p.test(host))) {
    return { ok: false, error: 'logo URL points to a private network address' }
  }

  return { ok: true, url: parsed }
}
