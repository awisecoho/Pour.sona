/**
 * Normalize NEXT_PUBLIC_APP_URL into a valid absolute origin. A scheme-less
 * value (e.g. "pour-sona.com") or a trailing slash would otherwise produce
 * invalid URLs — Stripe rejects success_url/return_url with "Not a valid URL"
 * (url_invalid). Prepend https:// when missing, drop any path, fall back to the
 * known production origin if the value is empty or unparseable.
 */
function normalizeOrigin(raw: string | undefined, fallback: string): string {
  const v = raw?.trim()
  if (v) {
    const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`
    try {
      return new URL(candidate).origin
    } catch {
      /* fall through to fallback */
    }
  }
  return fallback
}

/** Validated absolute origin for the app, safe to build redirect/return URLs from. */
export const APP_ORIGIN = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL, 'https://pour-sona.com')

const BASE = APP_ORIGIN

export const storefrontUrl = (slug: string) => `${BASE}/r/${slug}`
export const adminUrl      = (path = '')     => `${BASE}/admin${path}`
export const billingUrl    = ()              => `${BASE}/admin/billing`
export const ordersUrl     = ()              => `${BASE}/admin/orders`
