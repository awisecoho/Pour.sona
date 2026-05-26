/**
 * Extract a likely public contact email from an HTML page.
 *
 * Shared between the prospect pipeline (poursona-admin) and the vendor signup
 * scrape so both surface the same "best email we could find" signal. Kept as a
 * pure function so it has no Next-specific imports and can be unit-tested.
 *
 * Strategy:
 *   1. Prefer mailto: hrefs (highest signal — explicitly placed by the venue)
 *   2. Fall back to bare email-shaped strings in the body, filtering out:
 *      - Vendor / platform asset emails (sentry, wix, squarespace, godaddy, etc.)
 *      - Image-extension false positives (e.g. "name.png@2x")
 *      - Placeholder addresses (example.com, yourdomain, hello@email.com)
 */

const PROVIDER_NOISE = /(sentry|example\.com|wixpress|\.wix|sentry\.io|godaddy|squarespace\.com|cloudflare|domain\.com|email\.com|yourdomain)/i
const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|css|js)$/

export function extractContactEmail(html: string | null | undefined): string | null {
  if (!html || typeof html !== 'string') return null

  // 1. Prefer mailto: — explicit contact intent.
  const mailtoMatch = html.match(/mailto:([^"'?>\s]+)/i)
  if (mailtoMatch) {
    try {
      const decoded = decodeURIComponent(mailtoMatch[1]).toLowerCase()
      if (isPlausibleEmail(decoded)) return decoded
    } catch { /* fall through to bare scan */ }
  }

  // 2. Bare email-shaped strings, filtered for plausibility.
  const seen = new Set<string>()
  for (const m of html.matchAll(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g)) {
    const e = m[0].toLowerCase()
    if (seen.has(e)) continue
    seen.add(e)
    if (!isPlausibleEmail(e)) continue
    return e
  }
  return null
}

function isPlausibleEmail(e: string): boolean {
  if (!e || e.length < 5) return false
  if (ASSET_EXT.test(e)) return false
  if (PROVIDER_NOISE.test(e)) return false
  if (!e.includes('@') || !e.includes('.')) return false
  return true
}
