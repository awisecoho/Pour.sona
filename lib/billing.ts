/**
 * Pure billing mapping helpers — no Stripe/DB imports, so they unit-test in a
 * plain node environment. Single source of truth for plan pricing and the
 * Stripe→internal subscription-status mapping used by the webhook.
 */

export type SubStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trial'

/** Monthly recurring revenue (USD) reported per plan. Starter is the $79 base. */
export const PLAN_MRR: Record<string, number> = { starter: 79, growth: 99, pro: 199 }

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
