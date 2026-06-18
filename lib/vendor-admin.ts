import 'server-only'
import { dbQuery, getPool } from '@/lib/db'

/**
 * Internal vendor-account lifecycle: archive (reversible soft-delete) and
 * hard-delete (permanent, cascading purge).
 *
 * Archiving sets `archived_at` and flips `active = false` so the venue drops out
 * of the internal listing and its guest page goes inactive — but every row is
 * retained and `unarchiveRetailer` fully restores it.
 *
 * Hard-delete is irreversible: it removes the retailer row plus every dependent
 * row across all child tables. Several legacy tables carry `retailer_id` with NO
 * foreign key / cascade (billing_events, promo_codes, customer_profiles, …), so
 * a bare `DELETE FROM retailers` would orphan them. We therefore delete each
 * child table explicitly, inside one transaction, in FK-safe order.
 */

// Child tables that hold a retailer_id, ordered so FK dependents are deleted
// before their parents (events/orders reference sessions; promo_redemptions
// reference promo_codes). Any table that doesn't exist on this database is
// skipped per-statement via a savepoint, so the legacy/Neon schema drift between
// environments can't abort the purge.
const VENDOR_CHILD_TABLES = [
  'events',
  'orders',
  'sessions',
  'products',
  'flights',
  'billing_events',
  'admin_users',
  'social_accounts',
  'vendor_events',
  'vendor_intelligence',
  'customer_profiles',
  'customer_visits',
  'promo_redemptions',
  'promo_codes',
  'account_credits',
] as const

const UNDEFINED_TABLE = '42P01'

/** Archive one venue. Returns true if a row transitioned to archived. */
export async function archiveRetailer(retailerId: string): Promise<boolean> {
  const res = await dbQuery(
    `UPDATE retailers SET archived_at = now(), active = false
     WHERE id = $1 AND archived_at IS NULL
     RETURNING id`,
    [retailerId]
  )
  return res.rows.length > 0
}

/** Restore one archived venue. Returns true if a row was restored. */
export async function unarchiveRetailer(retailerId: string): Promise<boolean> {
  const res = await dbQuery(
    `UPDATE retailers SET archived_at = NULL, active = true
     WHERE id = $1 AND archived_at IS NOT NULL
     RETURNING id`,
    [retailerId]
  )
  return res.rows.length > 0
}

/**
 * Archive every venue, optionally preserving the account whose owner_email
 * matches `preserveEmail` (case-insensitive). Returns how many were archived.
 */
export async function archiveAllRetailers(preserveEmail?: string | null): Promise<number> {
  const res = await dbQuery(
    `UPDATE retailers SET archived_at = now(), active = false
     WHERE archived_at IS NULL
       AND ($1::text IS NULL OR lower(coalesce(owner_email, '')) <> lower($1))
     RETURNING id`,
    [preserveEmail || null]
  )
  return res.rows.length
}

/**
 * Permanently delete the given retailer ids and all their dependent rows in a
 * single transaction. Table names are compile-time constants (not user input);
 * the retailer id is always parameterized. Returns the count of retailers
 * removed. All-or-nothing: any unexpected error rolls the whole purge back.
 */
async function purgeRetailerIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    for (const rid of ids) {
      for (const table of VENDOR_CHILD_TABLES) {
        await client.query('SAVEPOINT del_child')
        try {
          await client.query(`DELETE FROM ${table} WHERE retailer_id = $1`, [rid])
          await client.query('RELEASE SAVEPOINT del_child')
        } catch (err: unknown) {
          // A table that doesn't exist in this environment is fine to skip;
          // anything else is a real failure and aborts the transaction.
          if ((err as { code?: string })?.code === UNDEFINED_TABLE) {
            await client.query('ROLLBACK TO SAVEPOINT del_child')
            await client.query('RELEASE SAVEPOINT del_child')
          } else {
            throw err
          }
        }
      }
      await client.query('DELETE FROM retailers WHERE id = $1', [rid])
    }
    await client.query('COMMIT')
    return ids.length
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** Permanently delete one venue and everything attached to it. */
export async function deleteRetailer(retailerId: string): Promise<boolean> {
  const n = await purgeRetailerIds([retailerId])
  return n > 0
}

/**
 * Permanently delete every venue, optionally preserving the account whose
 * owner_email matches `preserveEmail`. Returns how many were deleted.
 */
export async function deleteAllRetailers(preserveEmail?: string | null): Promise<number> {
  const where = preserveEmail
    ? `WHERE lower(coalesce(owner_email, '')) <> lower($1)`
    : ''
  const res = await dbQuery<{ id: string }>(
    `SELECT id FROM retailers ${where}`,
    preserveEmail ? [preserveEmail] : []
  )
  return purgeRetailerIds(res.rows.map((r) => r.id))
}
