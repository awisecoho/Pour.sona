import { describe, it, expect, afterEach } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { verifyMigrateSecret } from '@/lib/security'

/**
 * Regression guard for the 2026-06 incident where several /api/poursona-admin
 * routes shipped with no authentication at all (team-add, toggle, retailers,
 * rescan, ...). Auth on these routes is opt-in per handler, so a static sweep
 * is the cheapest way to guarantee no route ships unguarded again: every
 * route.ts under app/api/poursona-admin must reference one of the server-side
 * auth guards. The middleware allowlist is NOT sufficient — it only covers a
 * few paths, and middleware itself can be bypassed (CVE-2025-29927).
 */

const INTERNAL_API_DIR = join(__dirname, '..', 'app', 'api', 'poursona-admin')
const AUTH_MARKERS = [
  'requireTeamMember(',
  'getAuthenticatedIdentity(',
  'getAuthenticatedEmail(',
]

function collectRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectRouteFiles(full))
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

describe('internal admin route auth coverage', () => {
  const routeFiles = collectRouteFiles(INTERNAL_API_DIR)

  it('finds the internal admin routes (sanity)', () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(15)
  })

  for (const file of collectRouteFiles(INTERNAL_API_DIR)) {
    const rel = file.split('poursona-admin')[1].replace(/\\/g, '/')
    it(`enforces auth in poursona-admin${rel}`, () => {
      const src = readFileSync(file, 'utf-8')
      const guarded = AUTH_MARKERS.some(marker => src.includes(marker))
      expect(
        guarded,
        `${rel} has no server-side auth guard (expected one of: ${AUTH_MARKERS.join(', ')})`
      ).toBe(true)
    })
  }
})

describe('migrate endpoint secret', () => {
  it('uses the env-var verifier, not a hardcoded literal', () => {
    const src = readFileSync(
      join(__dirname, '..', 'app', 'api', 'migrate', 'route.ts'),
      'utf-8'
    )
    expect(src).toContain('verifyMigrateSecret(')
    expect(src).not.toContain('poursona-migrate-2026')
  })
})

describe('verifyMigrateSecret', () => {
  const original = process.env.MIGRATE_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.MIGRATE_SECRET
    else process.env.MIGRATE_SECRET = original
  })

  it('fails closed when MIGRATE_SECRET is unset', () => {
    delete process.env.MIGRATE_SECRET
    expect(verifyMigrateSecret('anything')).toBe(false)
    expect(verifyMigrateSecret('')).toBe(false)
  })

  it('rejects wrong, empty, and non-string secrets', () => {
    process.env.MIGRATE_SECRET = 'correct-horse-battery-staple'
    expect(verifyMigrateSecret('wrong')).toBe(false)
    expect(verifyMigrateSecret('')).toBe(false)
    expect(verifyMigrateSecret(undefined)).toBe(false)
    expect(verifyMigrateSecret(null)).toBe(false)
    expect(verifyMigrateSecret(42)).toBe(false)
    // same length, different content (exercises the timing-safe compare)
    expect(verifyMigrateSecret('correct-horse-battery-stapl3')).toBe(false)
  })

  it('accepts the exact secret', () => {
    process.env.MIGRATE_SECRET = 'correct-horse-battery-staple'
    expect(verifyMigrateSecret('correct-horse-battery-staple')).toBe(true)
  })
})
