/**
 * Server-side RBAC for venue admin surfaces.
 *
 * Roles (admin_users.role) form a hierarchy: owner > manager > staff. Tenant
 * scoping is enforced first (the caller must have an admin_users row for the
 * retailer), then the role rank is checked. This is the authoritative server-side
 * guard — UI gating is cosmetic only.
 */
export type Role = 'owner' | 'manager' | 'staff'

export const ROLE_RANK: Record<string, number> = { owner: 3, manager: 2, staff: 1 }

/** Pure decision: does `actual` meet or exceed the `required` role? Unknown roles rank 0. */
export function roleSatisfies(actual: string | null | undefined, required: Role): boolean {
  const a = ROLE_RANK[(actual || '').toLowerCase()] ?? 0
  const r = ROLE_RANK[required] ?? 0
  return a > 0 && a >= r
}

export type AuthzResult =
  | { ok: true; role: string; access: any; identity: { userId: string; email: string | null } }
  | { ok: false; status: 401 | 403; error: string }

/**
 * Authorize the current Clerk identity for a retailer at a minimum role.
 * - No identity            → 401 unauthorized
 * - No access to retailer  → 403 forbidden (cross-tenant denial)
 * - Role below required    → 403 insufficient_role
 */
export async function authorizeRetailer(retailerId: string, required: Role = 'staff'): Promise<AuthzResult> {
  // Lazy import keeps the server-only (Clerk/DB) chain out of pure unit tests.
  const { getAuthenticatedIdentity, getRetailersForIdentity } = await import('@/lib/auth')
  const identity = await getAuthenticatedIdentity()
  if (!identity) return { ok: false, status: 401, error: 'unauthorized' }

  const accessRows = await getRetailersForIdentity(identity.userId, identity.email)
  const access = accessRows.find((row) => row.retailer_id === retailerId)
  if (!access) return { ok: false, status: 403, error: 'forbidden' }
  if (!roleSatisfies(access.role, required)) return { ok: false, status: 403, error: 'insufficient_role' }

  return { ok: true, role: access.role, access, identity }
}
