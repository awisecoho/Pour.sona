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
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
]

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
