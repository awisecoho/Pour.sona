import Stripe from 'stripe'
import type { PlanTier } from './billing'

/**
 * Additive Stripe mode switch.
 *
 * With STRIPE_MODE unset (or anything other than "test"), everything uses the
 * LIVE credentials exactly as before — the live STRIPE_SECRET_KEY /
 * STRIPE_WEBHOOK_SECRET are read unchanged and NEVER modified or deleted.
 *
 * Set STRIPE_MODE=test in Vercel to route checkout / portal / webhook through the
 * separate test credentials below, run a no-charge test end to end, then remove
 * STRIPE_MODE (or set it back to "live") to instantly return to live. The live
 * keys stay configured the whole time.
 *
 * Test-mode env vars (all additive — set alongside the live ones, never replace):
 *   STRIPE_MODE=test
 *   STRIPE_TEST_SECRET_KEY=sk_test_...
 *   STRIPE_TEST_WEBHOOK_SECRET=whsec_...        (for the test webhook endpoint)
 *   STRIPE_TEST_PRICE_STARTER=price_...         (test-mode Price ids — these
 *   STRIPE_TEST_PRICE_GROWTH=price_...           differ from the live ones)
 *   STRIPE_TEST_PRICE_PRO=price_...
 */
export const STRIPE_TEST_MODE = process.env.STRIPE_MODE === 'test'

const API_VERSION = '2024-06-20' as const

/** Stripe client for the active mode (test key when STRIPE_MODE=test, else live). */
export function getStripe(): Stripe {
  const key = STRIPE_TEST_MODE
    ? process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY
  return new Stripe(key!, { apiVersion: API_VERSION })
}

/** Webhook signing secret for the active mode. */
export function getWebhookSecret(): string | undefined {
  return STRIPE_TEST_MODE
    ? process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET
}

/**
 * Resolve a tier's Stripe Price id for the active mode.
 * - Test: STRIPE_TEST_PRICE_<TIER> (must be a price_ id; null otherwise).
 * - Live: STRIPE_PRICE_<TIER> when it's a real price_ id, else the baked-in
 *   live id in PLAN_TIERS (guards against stale env vars set to prod_ ids).
 */
export function resolvePriceId(tier: PlanTier): string | null {
  if (STRIPE_TEST_MODE) {
    const t = process.env[`STRIPE_TEST_PRICE_${tier.id.toUpperCase()}`]
    return t?.startsWith('price_') ? t : null
  }
  const envPrice = process.env[`STRIPE_PRICE_${tier.id.toUpperCase()}`]
  return envPrice?.startsWith('price_') ? envPrice : tier.priceId
}
