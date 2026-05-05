import { auth, currentUser } from '@clerk/nextjs/server'
import { dbQuery } from '@/lib/db'

export function normalizeEmail(email: string | null | undefined) {
  return email?.toLowerCase().trim() || null
}

export async function getAuthenticatedEmail() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const primaryEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null

  return normalizeEmail(primaryEmail)
}

export async function getAuthenticatedIdentity() {
  const { userId } = await auth()
  if (!userId) return null

  const user = await currentUser()
  const email = normalizeEmail(
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    null
  )

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
  if (email) {
    await dbQuery(
      `update admin_users
       set clerk_user_id = coalesce(clerk_user_id, $1),
           email = coalesce(email, $2)
       where lower(email) = $2`,
      [userId, email]
    )
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
