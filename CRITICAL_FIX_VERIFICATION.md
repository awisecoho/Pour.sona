# Critical Fix Verification Report

**Date:** 2026-05-14  
**Scope:** Tasks 1–7 post-completion audit  
**Typecheck:** `npx tsc --noEmit` — only pre-existing `app/page.tsx` curly-apostrophe error (line 118); all task files clean.

---

## Summary Table

| # | Fix | Status | Notes |
|---|-----|--------|-------|
| 1 | Retailer publish transaction safety | ✅ PASS | Full BEGIN/COMMIT/ROLLBACK; grant helper transaction-aware |
| 2 | Order idempotency | ✅ PASS | ON CONFLICT partial index; emails suppressed on retry; migration exists |
| 3 | Trial-warning email reliability | ✅ PASS | DB-claim UPDATE…RETURNING; revert on failure; migration exists |
| 4 | Retailer-list N+1 fix | ✅ PASS | Single CTE + window function; no per-retailer queries |
| 5a | `/api/menu-scan` auth | ✅ PASS | Requires Clerk identity |
| 5b | `/api/chat` rate limiting | ⚠️ **FIXED** | `chatLimiter` was defined but never called — now applied, fail-closed |
| 5c | CSRF/origin protection | ✅ PASS | `checkOrigin()` on `/api/chat`, `/api/order`, `/api/session/email` |
| 5d | `/api/qr` SSRF/logo safety | ✅ PASS | `validateLogoUrl()` + content-type + 2 MB cap + stream guard |
| 5e | Prompt injection | ✅ PASS | `sanitizePromptInput()` applied to all retailer fields in `lib/prompts.ts` |
| 5f | `/api/session/email` validation | ✅ PASS | `checkOrigin()` + `validateEmailFormat()` |
| 6 | Performance migrations | ✅ PASS | All 4 required migrations exist |
| 7 | TypeScript build status | ✅ PASS | Only pre-existing `app/page.tsx` error; all task files clean |

---

## 1. Retailer Publish Transaction Safety

**Files inspected:** `lib/onboarding.ts` (publishDraft, lines 424–538), `lib/auth.ts` (grantRetailerAccessByEmail, lines 118–148)

**Findings:**
- `publishDraft()` acquires a dedicated pool client via `getPool().connect()`, runs `BEGIN`, and wraps all five writes inside:
  1. `INSERT INTO retailers`
  2. `grantRetailerAccessByEmail(retailer.id, ownerEmail, 'owner', client)` — access grant
  3. Batch `INSERT INTO products`
  4. Batch `INSERT INTO flights`
  5. `UPDATE retailer_drafts SET status = 'published'`
- On any failure: `ROLLBACK` runs in the `catch` block; `client.release()` always runs in `finally`.
- `grantRetailerAccessByEmail` accepts an optional `txClient?: PoolClient` parameter. When provided it calls `txClient.query()` directly, staying inside the same transaction. It does **not** escape to the global pool.
- The auto-link of team members (post-transaction, in finalize/route.ts) is correctly outside the transaction with a try/catch marking it non-critical.

**Result: PASS**

---

## 2. Order Idempotency

**File inspected:** `app/api/order/route.ts`

**Findings:**
- `X-Idempotency-Key` header is required (returns 400 if missing, empty, or > 128 chars).
- INSERT uses `ON CONFLICT (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id`.
- If `insertResult.rows.length === 0` (conflict fired): a follow-up SELECT returns the existing order; response is returned immediately **without** updating session status, inserting events, or sending emails.
- Concurrent duplicate requests: both attempt the INSERT; exactly one wins (PostgreSQL serializes at index level); the loser gets 0 rows and falls through to the SELECT. No duplicate order, no error.
- Emails (`sendOrderConfirmation`, `sendOrderAlert`) are only called in the new-order branch after the RETURNING check.

**Migration (`supabase/migrations/20260514_add_idempotency_key_to_orders.sql`):**
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_session_idempotency_key_unique
  ON orders(session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```
Migration exists and matches the ON CONFLICT target in the route exactly.

**Result: PASS**

---

## 3. Trial-Warning Email Reliability

**File inspected:** `app/api/chat/route.ts` (lines 58–91), `lib/email.ts`

**Migration (`supabase/migrations/20260514_add_trial_warning_sent_at_to_retailers.sql`):**
```sql
ALTER TABLE retailers ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz;
```

**Findings:**
- When `daysLeft <= 3`, the route runs:
  ```sql
  UPDATE retailers SET trial_warning_sent_at = now()
  WHERE id = $1
    AND (trial_warning_sent_at IS NULL
         OR trial_warning_sent_at < now() - interval '24 hours')
  RETURNING id
  ```
- Only the request that receives `RETURNING id` sends the email — the DB-claim pattern prevents concurrent duplicates even across multiple serverless instances.
- If `sendTrialExpiringWarning` fails: a non-blocking `dbQuery('UPDATE ... SET trial_warning_sent_at = NULL')` reverts the claim so the next request will retry. The revert is fire-and-forget with `.catch(() => {})` which is acceptable (failure of the revert means the warning may skip one 24-hour window, not be lost permanently).
- `sendTrialExpiringWarning` (and all email helpers) return `{ ok: boolean; error?: string; providerId?: string }` — consistent return shape confirmed in `lib/email.ts`.

**Result: PASS**

---

## 4. Retailer-List N+1 Fix

**File inspected:** `app/api/poursona-admin/retailers/route.ts`

**Findings:**
- One main query uses a CTE (`session_stats`) to aggregate per-retailer `total` and `ordered` counts across all retailers in a single round-trip. `COUNT(*) OVER()` returns paginated total count without a second query.
- Two parallel queries for global summary (unfiltered totals) and expired retailers list — both are fixed-cost regardless of retailer count.
- Total query count: **3 fixed queries** for any number of retailers. No N+1.

**Result: PASS**

---

## 5. Public API Security Hardening

### 5a. `/api/menu-scan` — Auth Required
`getAuthenticatedIdentity()` called at top; returns 401 if null. Clerk-gated. **PASS**

### 5b. `/api/chat` — Rate Limiting (FIXED)

**Gap found:** `chatLimiter` was exported from `lib/rate-limit.ts` but never imported or called in `app/api/chat/route.ts`. The most expensive route (Claude API) had no rate limit applied.

**Fix applied** in `app/api/chat/route.ts`:
```typescript
import { chatLimiter, getIp } from '@/lib/rate-limit'

// After checkOrigin():
try {
  const { success } = await chatLimiter.limit(getIp(req))
  if (!success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
} catch {
  return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
}
```
Fail-closed: Redis unavailable → 429 (blocks rather than allows unlimited Claude calls).

**Rate limit:** 20 requests / 1 hour sliding window per IP (defined in `lib/rate-limit.ts`).

`onboardLimiter` (5 req/hr) is applied in `/api/signup/url` and `/api/signup/finalize`. **PASS**

### 5c. CSRF / Origin Protection
- `checkOrigin()` in `lib/security.ts`: blocks cross-origin requests; passes server-to-server (no Origin header); allows `NEXT_PUBLIC_APP_URL`; allows localhost in development.
- Applied to: `/api/chat`, `/api/order`, `/api/session/email`. **PASS**

### 5d. `/api/qr` Logo URL Safety
- `validateLogoUrl()` enforces HTTPS, blocks all private network ranges (localhost, 10.x, 172.16–31.x, 192.168.x, ::1, fc00::/7, .local, .internal).
- Content-Type checked (`image/*` required), Content-Length cap at 2 MB, streaming read with hard 2 MB abort.
- AbortSignal.timeout(5000) on logo fetch.
- QR endpoint itself requires Clerk auth + `getRetailersForIdentity` authorization check. **PASS**

### 5e. Prompt Injection (`===REC===`)
`sanitizePromptInput()` strips `===WORD===` patterns. Applied in `lib/prompts.ts` to: product name, style, abv, flavor_notes, description, retailer story, culture, region, tagline. All vendor-supplied fields entering the system prompt are sanitized. **PASS**

### 5f. `/api/session/email` Validation
`checkOrigin()` + `validateEmailFormat()` applied before any DB write. Invalid emails return 400. **PASS**

---

## 6. Performance Migrations

**All migrations found at `supabase/migrations/`:**

| Migration | Status |
|-----------|--------|
| `20260514_add_performance_indexes.sql` — `sessions(retailer_id, created_at DESC)` | ✅ exists |
| `20260514_add_performance_indexes.sql` — `orders(retailer_id, created_at DESC)` | ✅ exists |
| `20260514_add_idempotency_key_to_orders.sql` — partial unique index on orders | ✅ exists |
| `20260514_add_trial_warning_sent_at_to_retailers.sql` — `trial_warning_sent_at` column | ✅ exists |

**Note:** These migrations are in `supabase/migrations/` but this project uses Neon PostgreSQL (not Supabase). There is no evidence of a migration runner being invoked automatically. Migrations must be applied manually to the Neon database. The files serve as the source of truth for required schema changes.

---

## 7. TypeScript Build Status

**Command:** `npx tsc --noEmit`

**Result:**
```
app/page.tsx(118,124): error TS1005: ',' expected.
[...6 more errors on same line]
```

All errors are on `app/page.tsx:118` — a curly apostrophe in a string literal (`'`) that TypeScript's parser rejects. This is **pre-existing**, unrelated to Tasks 1–7, and present in all prior typecheck runs.

**All task files are clean.** The chat rate-limit fix (`app/api/chat/route.ts`) compiles without errors.

---

## Fix Applied This Session

**`app/api/chat/route.ts`** — Added `chatLimiter` rate limiting (fail-closed on Redis failure). The limiter was implemented in Task 4 but never wired into the chat route.

---

## Remaining Critical Risks

1. **Migrations not auto-applied to Neon.** The four `supabase/migrations/*.sql` files exist on disk but there is no evidence they have been applied to the production Neon database. The chat route references `trial_warning_sent_at` and the order route references the `orders_session_idempotency_key_unique` index — both will fail at runtime if the column/index is missing. Recommend verifying with `\d orders` and `\d retailers` in the Neon console.

2. **`app/page.tsx:118` curly-apostrophe TS error.** Blocks clean `tsc` output, masking future type errors. Recommend fixing (replace curly apostrophe with straight apostrophe `'`).

3. **`rescanRetailer` ('full' mode) not transactional.** `lib/onboarding.ts` line 559 deletes products then re-inserts with individual `dbQuery` calls — not in a transaction. A crash mid-insert would leave a retailer with no products. Low priority if rescan is admin-only and infrequent.

4. **`chatLimiter` is per-IP, not per-retailer-slug.** A single user behind a shared IP (office NAT, mobile carrier) could hit the 20 req/hr limit for all users on that IP. Acceptable for now but worth noting.

---

## Recommended Next Task

**Task 8: Apply migrations and verify production schema.** Connect to the Neon database and confirm all four migration files have been applied. Fix the `app/page.tsx` curly-apostrophe error as a quick cleanup. Then proceed with planned feature work.
