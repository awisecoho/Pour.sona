import { describe, it, expect } from 'vitest'
import { roleSatisfies, ROLE_RANK } from '@/lib/authz'

describe('roleSatisfies (RBAC hierarchy owner > manager > staff)', () => {
  it('owner satisfies every required role', () => {
    expect(roleSatisfies('owner', 'owner')).toBe(true)
    expect(roleSatisfies('owner', 'manager')).toBe(true)
    expect(roleSatisfies('owner', 'staff')).toBe(true)
  })

  it('manager satisfies manager and staff but NOT owner', () => {
    expect(roleSatisfies('manager', 'owner')).toBe(false)
    expect(roleSatisfies('manager', 'manager')).toBe(true)
    expect(roleSatisfies('manager', 'staff')).toBe(true)
  })

  it('staff satisfies only staff', () => {
    expect(roleSatisfies('staff', 'owner')).toBe(false)
    expect(roleSatisfies('staff', 'manager')).toBe(false)
    expect(roleSatisfies('staff', 'staff')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(roleSatisfies('OWNER', 'manager')).toBe(true)
    expect(roleSatisfies('Manager', 'staff')).toBe(true)
  })

  it('denies unknown, empty, or null roles (rank 0)', () => {
    expect(roleSatisfies('', 'staff')).toBe(false)
    expect(roleSatisfies(null, 'staff')).toBe(false)
    expect(roleSatisfies(undefined, 'staff')).toBe(false)
    expect(roleSatisfies('superadmin', 'staff')).toBe(false)
  })

  it('has the expected rank ordering', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.manager)
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.staff)
  })
})
