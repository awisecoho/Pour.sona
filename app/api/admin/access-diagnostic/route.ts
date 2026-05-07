import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { dbQuery } from '@/lib/db'
import { normalizeEmail } from '@/lib/auth'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  let dbError: string | null = null

  try {
    const authState = await auth()
    const userId = authState.userId
    const sessionClaimsEmail = getEmailFromSessionClaims(authState.sessionClaims as Record<string, any> | null | undefined)
    const user = userId ? await currentUser() : null
    const currentUserEmail = normalizeEmail(
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null
    )
    const resolvedEmail = sessionClaimsEmail || currentUserEmail

    let matchingAdminUsersByEmail = 0
    let matchingAdminUsersByClerkUserId = 0
    let returnedRetailersCount = 0
    let clerkUserIdBackfillRan = false

    if (resolvedEmail) {
      const emailCount = await dbQuery<{ count: number }>(
        'select count(*)::int as count from admin_users where lower(email) = $1',
        [resolvedEmail]
      )
      matchingAdminUsersByEmail = emailCount.rows[0]?.count || 0
    }

    if (userId) {
      const clerkCount = await dbQuery<{ count: number }>(
        'select count(*)::int as count from admin_users where clerk_user_id = $1',
        [userId]
      )
      matchingAdminUsersByClerkUserId = clerkCount.rows[0]?.count || 0
    }

    if (userId && resolvedEmail) {
      const updateResult = await dbQuery(
        `update admin_users
         set clerk_user_id = coalesce(clerk_user_id, $1),
             email = coalesce(email, $2)
         where lower(email) = $2
           and clerk_user_id is null`,
        [userId, resolvedEmail]
      )
      clerkUserIdBackfillRan = (updateResult.rowCount || 0) > 0

      const retailersResult = await dbQuery(
        `select count(*)::int as count
         from admin_users au
         join retailers r on r.id = au.retailer_id
         where au.clerk_user_id = $1
            or lower(au.email) = $2`,
        [userId, resolvedEmail]
      )
      returnedRetailersCount = retailersResult.rows[0]?.count || 0
    }

    return NextResponse.json({
      ok: true,
      clerkUserIdPresent: Boolean(userId),
      clerkEmailResolved: resolvedEmail,
      sessionClaimsEmail,
      currentUserEmail,
      matchingAdminUsersByEmail,
      matchingAdminUsersByClerkUserId,
      returnedRetailersCount,
      clerkUserIdBackfillRan,
      dbQueryError: dbError,
    })
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'diagnostic failed'
    return NextResponse.json(
      {
        ok: false,
        clerkUserIdPresent: false,
        clerkEmailResolved: null,
        sessionClaimsEmail: null,
        currentUserEmail: null,
        matchingAdminUsersByEmail: 0,
        matchingAdminUsersByClerkUserId: 0,
        returnedRetailersCount: 0,
        clerkUserIdBackfillRan: false,
        dbQueryError: dbError,
      },
      { status: 500 }
    )
  }
}
