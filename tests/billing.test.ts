import { describe, it, expect } from 'vitest'
import { planToMrr, subStatusFromStripe, PLAN_MRR } from '@/lib/billing'

describe('planToMrr', () => {
  it('maps known plans to their MRR (starter is the $49 base)', () => {
    expect(planToMrr('starter')).toBe(49)
    expect(planToMrr('growth')).toBe(79)
    expect(planToMrr('pro')).toBe(99)
  })
  it('is case-insensitive', () => {
    expect(planToMrr('STARTER')).toBe(49)
  })
  it('defaults unknown/empty/null to the starter price', () => {
    expect(planToMrr('enterprise')).toBe(49)
    expect(planToMrr('')).toBe(49)
    expect(planToMrr(null)).toBe(49)
    expect(planToMrr(undefined)).toBe(49)
  })
  it('PLAN_MRR is the single source of truth', () => {
    expect(PLAN_MRR).toEqual({ starter: 49, growth: 79, pro: 99 })
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
