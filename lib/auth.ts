import { auth, currentUser } from '@clerk/nextjs/server'
import { dbQuery, type PoolClient } from '@/lib/db'

const hasClerkEnv =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
  Boolean(process.env.CLERK_SECRET_KEY)

export function normalizeEmail(email: string | null | undefined) {
  return email?.toLowerCase().trim() || null
}

function getEmailFromSessionClaims(sessionClaims: Record<string, any> | null | undefined) {
  if (!sessionClaims) return null
  const candidates = [
    sessionClaims.email,
    sessionClaims.email_address,
    sessionClaims.primary_email_address,
    Array.isArray(sessionClaims.email_addresses) ? sessionClaims.email_addresses[0] : null,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeEmail(candidate)
    }
  }
  return null
}

export async function getAuthenticatedEmail() {
  if (!hasClerkEnv) return null
  const authState = await auth()
  const { userId, sessionClaims } = authState
  if (!userId) return null
  const claimedEmail = getEmailFromSessionClaims(sessionClaims as Record<string, any> | null | undefined)
  if (claimedEmail) return claimedEmail
  const user = await currentUser()
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null
  return normalizeEmail(primaryEmail)
}

export async function getAuthenticatedIdentity() {
  if (!hasClerkEnv) return null
  const authState = await auth()
  const { sessionClaims } = authState
  let userId = authState.userId || null
  const claimedEmail = getEmailFromSessionClaims(sessionClaims as Record<string, any> | null | undefined)
  const user = await currentUser()
  userId = userId || user?.id || null
  const email = normalizeEmail(
    claimedEmail ||
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null
  )
  // Anonymous request: no Clerk session, no email. Return null so routes
  // can emit a proper 401 instead of bubbling a 500 to the caller (which
  // also spams Sentry on every unauth probe).
  if (!userId && !email) return null
  if (!userId) return null
  return { userId, email }
}

export async function getInternalMemberByEmail(email: string) {
  const result = await dbQuery<{ email: string; name: string | null; role: string }>(
    'select email, name, role from poursona_team where lower(email) = $1 limit 1',
    [normalizeEmail(email)]
  )
  return result.rows[0] || null
}

/**
 * Guard for internal (/api/poursona-admin) routes: the caller must be a
 * Clerk-authenticated identity whose email is in poursona_team. Returns null
 * when either condition fails — routes respond 401/403 on null. Pass a
 * minimum role ('owner') for destructive/team-management endpoints.
 */
export async function requireTeamMember(minRole?: 'owner') {
  const identity = await getAuthenticatedIdentity()
  if (!identity?.email) return null
  const member = await getInternalMemberByEmail(identity.email)
  if (!member) return null
  if (minRole === 'owner' && member.role !== 'owner') return null
  return { identity, member }
}

export async function getRetailersForIdentity(userId: string, email: string | null) {
  if (email && userId) {
    try {
      await dbQuery(
        `update admin_users
         set clerk_user_id = $1,
             email = coalesce(email, $2::text)
         where lower(email) = lower($2::text)
           and (clerk_user_id is null or clerk_user_id = $1)`,
        [userId, email]
      )
    } catch (err) {
      console.warn('[auth] clerk_user_id backfill failed (non-fatal):', err instanceof Error ? err.message : String(err))
    }
  }

  const result = await dbQuery(
    `select
       au.retailer_id,
       au.role,
       au.email as admin_email,
       au.clerk_user_id,
       r.*
     from admin_users au
     join retailers r on r.id = au.retailer_id
     where au.clerk_user_id = $1
        or ($2::text is not null and lower(au.email) = lower($2::text))
     order by r.created_at asc`,
    [userId, email]
  )

  return result.rows.map((row: any) => ({
    role: row.role,
    admin_email: row.admin_email,
    clerk_user_id: row.clerk_user_id,
    retailer_id: row.retailer_id,
    retailer: {
      ...row,
      role: undefined,
      admin_email: undefined,
      clerk_user_id: undefined,
      retailer_id: undefined,
    },
  }))
}

export async function grantRetailerAccessByEmail(
  retailerId: string,
  email: string,
  role = 'owner',
  txClient?: PoolClient
) {
  const normalizedEmail = normalizeEmail(email)
  // Use the provided transaction client when inside a transaction, otherwise fall back to pool.
  const run = txClient
    ? (text: string, values: unknown[]) => txClient.query(text, values)
    : (text: string, values: unknown[]) => dbQuery(text, values)

  const existing = await run(
    `select retailer_id from admin_users
     where retailer_id = $1 and lower(email) = $2::text
     limit 1`,
    [retailerId, normalizedEmail]
  )
  if (existing.rows[0]) {
    await run(
      `update admin_users set email = $3, role = $4
       where retailer_id = $1 and lower(email) = $2::text`,
      [retailerId, normalizedEmail, normalizedEmail, role]
    )
    return
  }
  await run(
    `insert into admin_users (retailer_id, email, role) values ($1, $2, $3)`,
    [retailerId, normalizedEmail, role]
  )
}

export async function getRetailersForEmail(email: string) {
  const accessRows = await getRetailersForIdentity(`email:${normalizeEmail(email)}`, normalizeEmail(email))
  return accessRows.map((row) => row.retailer)
}
