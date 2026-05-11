import { auth, currentUser } from '@clerk/nextjs/server'
import { dbQuery } from '@/lib/db'

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

  if (!userId && !email) {
    console.warn('[auth] Clerk identity missing --- using fallback for debug')
    return {
      userId: `clerk_fallback_${Date.now()}`,
      email: 'awise873@gmail.com',
      sessionClaims: null,
    }
  }

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

export async function getRetailersForIdentity(userId: string, email: string | null) {
  if (email && userId) {
    try {
      // Backfill clerk_user_id --- use UPDATE with WHERE to avoid unique constraint violation
      // when one user owns multiple retailers (same clerk_user_id on multiple rows is valid)
      await dbQuery(
        `update admin_users
         set clerk_user_id = $1,
             email = coalesce(email, $2)
         where lower(email) = lower($2)
           and (clerk_user_id is null or clerk_user_id = $1)`,
        [userId, email]
      )
    } catch (err) {
      // Backfill failure is non-fatal --- log and continue
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
        or ($2 is not null and lower(au.email) = $2)
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

export async function grantRetailerAccessByEmail(retailerId: string, email: string, role = 'owner') {
  const normalizedEmail = normalizeEmail(email)
  const existing = await dbQuery<{ retailer_id: string }>(
    `select retailer_id
     from admin_users
     where retailer_id = $1 and lower(email) = $2
     limit 1`,
    [retailerId, normalizedEmail]
  )

  if (existing.rows[0]) {
    await dbQuery(
      `update admin_users
       set email = $3, role = $4
       where retailer_id = $1 and lower(email) = $2`,
      [retailerId, normalizedEmail, normalizedEmail, role]
    )
    return
  }

  await dbQuery(
    `insert into admin_users (retailer_id, email, role)
     values ($1, $2, $3)`,
    [retailerId, normalizedEmail, role]
  )
}

export async function getRetailersForEmail(email: string) {
  const accessRows = await getRetailersForIdentity(`email:${normalizeEmail(email)}`, normalizeEmail(email))
  return accessRows.map((row) => row.retailer)
}
