import { describe, it, expect } from 'vitest'
import { planToMrr, subStatusFromStripe, PLAN_MRR } from '@/lib/billing'

describe('planToMrr', () => {
  it('maps known plans to their MRR (starter is the $79 base)', () => {
    expect(planToMrr('starter')).toBe(79)
    expect(planToMrr('growth')).toBe(99)
    expect(planToMrr('pro')).toBe(199)
  })
  it('is case-insensitive', () => {
    expect(planToMrr('STARTER')).toBe(79)
  })
  it('defaults unknown/empty/null to the starter price', () => {
    expect(planToMrr('enterprise')).toBe(79)
    expect(planToMrr('')).toBe(79)
    expect(planToMrr(null)).toBe(79)
    expect(planToMrr(undefined)).toBe(79)
  })
  it('PLAN_MRR is the single source of truth', () => {
    expect(PLAN_MRR).toEqual({ starter: 79, growth: 99, pro: 199 })
  })
})

describe('subStatusFromStripe', () => {
  it('maps Stripe statuses to internal enum', () => {
    expect(subStatusFromStripe('active')).toBe('active')
    expect(subStatusFromStripe('trialing')).toBe('trial')
    expect(subStatusFromStripe('past_due')).toBe('past_due')
    expect(subStatusFromStripe('canceled')).toBe('cancelled')
    expect(subStatusFromStripe('unpaid')).toBe('expired')
  })
  it('defaults unknown/null to trial', () => {
    expect(subStatusFromStripe('incomplete')).toBe('trial')
    expect(subStatusFromStripe(null)).toBe('trial')
    expect(subStatusFromStripe(undefined)).toBe('trial')
  })
})
