# Task 5 — Admin Performance & Retailer-List Scalability

## Files Changed

| File | Change |
|------|--------|
| `app/api/poursona-admin/retailers/route.ts` | Full rewrite — N+1 → CTE, pagination, search, summary stats |
| `app/poursona-admin/page.tsx` | UI — search input, pagination controls, summary-driven dashboard stats |
| `supabase/migrations/20260514_add_performance_indexes.sql` | New — 3 performance indexes |

## Old Query Pattern (N+1)

```
SELECT * FROM retailers ORDER BY created_at DESC          -- 1 query
→ for each retailer (N):
    SELECT count(*) FROM sessions WHERE retailer_id = $1  -- N queries
    SELECT count(*) FROM sessions WHERE retailer_id = $1  -- N queries (ordered)
```
Total: **1 + 2N** round-trips. With 50 retailers = 101 queries per page load.

## New Query Strategy

### Main paginated query — 1 round-trip
```sql
WITH session_stats AS (
  SELECT retailer_id,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE order_status = 'ordered')::int AS ordered
  FROM sessions GROUP BY retailer_id
)
SELECT r.*, COALESCE(ss.total,0) AS session_total,
       COALESCE(ss.ordered,0) AS session_ordered,
       COUNT(*) OVER() AS total_count
FROM retailers r
LEFT JOIN session_stats ss ON ss.retailer_id = r.id
WHERE (search filter) AND (status filter)
ORDER BY r.created_at DESC
LIMIT $limit OFFSET $offset
```

### Global summary + expired list — 2 additional queries (always small)
- Aggregate counts across all retailers (for dashboard stats)
- Expired trial retailers by name (for dashboard warning panel)

Total: **3 queries** regardless of retailer count.

## API Params & Response

### Request
```
GET /api/poursona-admin/retailers?page=1&limit=20&search=oak&status=trial
```
| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| page | 1 | — | 1-based page number |
| limit | 20 | 100 | Results per page |
| search | '' | — | ILIKE match on name, slug, owner_email |
| status | '' | — | Exact match on subscription_status |

### Response
```json
{
  "retailers": [{ "...all retailer fields...", "stats": { "total": 10, "recommended": 0, "ordered": 2 } }],
  "pagination": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 },
  "summary": {
    "totalRetailers": 45, "activeCount": 40, "paidCount": 12, "trialCount": 30,
    "expiredCount": 5, "totalSessions": 1234, "totalOrders": 234,
    "expiredRetailers": [{ "id": "...", "name": "...", "trial_ends_at": "..." }]
  }
}
```

## Indexes Added

```sql
-- sessions stats hot path
CREATE INDEX IF NOT EXISTS idx_sessions_retailer_id_created_at
  ON sessions(retailer_id, created_at DESC);

-- orders future stats (mirrors sessions pattern)
CREATE INDEX IF NOT EXISTS idx_orders_retailer_id_created_at
  ON orders(retailer_id, created_at DESC);

-- expired trial lookup (used in summary query)
CREATE INDEX IF NOT EXISTS idx_retailers_expired_trials
  ON retailers(trial_ends_at ASC)
  WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL;
```

## Commands Run

```
npx tsc --noEmit
```
Result: only pre-existing `app/page.tsx` curly-apostrophe error (unrelated to Task 5). All new code clean.

## Manual Verification Checklist

1. **Retailer list loads**
   - Navigate to `/poursona-admin` → should show retailer cards on Vendors tab
   - Dashboard stats (Total Vendors, Paid, On Trial, etc.) should be populated

2. **Search works**
   - Vendors tab → type part of a retailer name → press Enter or click Search
   - List should filter; result count line should update (e.g., "3 retailers matching 'oak'")
   - Clearing search and pressing Search should restore full list

3. **Pagination works**
   - Only visible when `totalPages > 1` (need >20 retailers)
   - Prev/Next buttons should be disabled at boundaries
   - Page X / Y label updates correctly

4. **Stats still match**
   - Dashboard: Total Sessions and Total Orders should equal the sum across all retailers
   - Individual retailer cards in Vendors tab should show correct session count

5. **N+1 eliminated**
   - Open browser DevTools → Network tab → filter for `/api/poursona-admin/retailers`
   - Confirm single request per page load (no additional session-count requests)
   - Or check Neon query logs: should see 3 queries total, not 1 + 2N

## Remaining Risks

- **ILIKE search with leading wildcard** (`%search%`) cannot use a B-tree index. Acceptable for admin use (low frequency, small table). If retailers grow to thousands, add `pg_trgm` extension + GIN index.
- **summary query** always runs unfiltered — correct for dashboard accuracy, but adds ~2ms on large datasets. Could be cached with a short TTL if needed.
- **Window function `COUNT(*) OVER()`** adds slight overhead vs. a separate COUNT query, but avoids an extra round-trip and is standard Postgres.
- **Migration must be applied manually** to Neon — run the SQL in `supabase/migrations/20260514_add_performance_indexes.sql` via the Neon console or psql.
