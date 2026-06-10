/**
 * Pure billing config + mapping helpers — no Stripe/DB imports, so it unit-tests
 * in a plain node environment AND can be imported by client components.
 *
 * Single source of truth for plan tiers: name, monthly price, Stripe Price ID,
 * and features. checkout, the admin billing page, and the public pricing page
 * all read from PLAN_TIERS, so a price/feature change is a one-line edit here.
 * `priceId` holds the test-mode Stripe Price; a STRIPE_PRICE_<TIER> env var
 * overrides it per tier at go-live (live Price IDs differ from test). See
 * app/api/stripe/checkout.
 */

export type SubStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial'
export type PlanId = 'starter' | 'growth' | 'pro'

export interface PlanTier {
  id: PlanId
  name: string
  /** Monthly price in USD. Display + reported MRR; must match the Stripe Price. */
  price: number
  /**
   * Stripe Price ID (test mode). checkout uses this unless STRIPE_PRICE_<TIER>
   * is set, which overrides it — point those at the live Price IDs at go-live,
   * since price IDs differ between test and live mode.
   */
  priceId: string
  description: string
  features: string[]
  popular?: boolean
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    priceId: 'price_1TYzKkDsBETM9ESQSMyMfVjO', // test mode

    description: 'Perfect for a single location getting started',
    features: ['AI guided discovery', 'Unlimited sessions', 'QR code generator', 'Catalog management', 'Basic analytics'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 79,
    priceId: 'price_1TYzFADsBETM9ESQwWhwKvbM', // test mode

    description: 'For venues ready to grow their customer experience',
    features: ['Everything in Starter', 'Customer profiles', 'Promo codes', 'Priority support', 'Advanced analytics'],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceId: 'price_1TYz9NDsBETM9ESQLu12EzQu', // test mode

    description: 'For multi-location or high-volume venues',
    features: ['Everything in Growth', 'Multiple locations', 'Custom branding', 'API access', 'Dedicated support'],
  },
]

/** id → tier, for O(1) lookups in checkout/webhook. */
export const PLAN_BY_ID: Record<string, PlanTier> = Object.fromEntries(
  PLAN_TIERS.map((t) => [t.id, t]),
)

/** Monthly recurring revenue (USD) per plan id — derived from PLAN_TIERS. */
export const PLAN_MRR: Record<string, number> = Object.fromEntries(
  PLAN_TIERS.map((t) => [t.id, t.price]),
)

export function planToMrr(plan: string | null | undefined): number {
  return PLAN_MRR[(plan || 'starter').toLowerCase()] ?? PLAN_MRR.starter
}

/** Map a Stripe subscription status to our internal status enum. */
export function subStatusFromStripe(stripeStatus: string | null | undefined): SubStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return stripeStatus === 'trialing' ? 'trial' : 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'cancelled'
    case 'unpaid':
      return 'expired'
    default:
      return 'trial'
  }
}
