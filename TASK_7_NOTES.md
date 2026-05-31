# Task 7 — Analytics Reporting Upgrade

## Files Changed

| File | Change |
|------|--------|
| `app/api/admin/dashboard/route.ts` | Rewrote to add `from`/`to`/`format` params, daily CTE with `generate_series`, CSV export. |
| `app/api/poursona-admin/analytics/route.ts` | New file — system-wide analytics endpoint with date range, daily breakdown, CSV export. |
| `app/admin/page.tsx` | Added `DailyChart` SVG component, date range controls, `loadDashboard()` with date params, CSV export, chart section between stat cards and recent sessions. |
| `app/poursona-admin/page.tsx` | Added `AdminChart` SVG component, `AdminDailyPoint`/`AdminAnalytics` interfaces, analytics state, `loadAnalytics()`/`exportAnalyticsCsv()`, and analytics section in dashboard tab. |

## API Params Added

### `GET /api/admin/dashboard`

| Param | Default | Notes |
|-------|---------|-------|
| retailerId | — | required |
| from | '' | ISO date, inclusive. Empty = all-time for summary |
| to | '' | ISO date, inclusive (adds 1 day in SQL). Empty = all-time |
| format | `json` | `csv` downloads daily analytics CSV |

**Response shape:**
```json
{
  "ok": true,
  "stats": { "scans": 120, "convos": 89, "recs": 45, "orders": 23 },
  "daily": [{ "day": "2024-01-15", "scans": 8, "convos": 6, "recs": 3, "orders": 2 }],
  "recent": [...],
  "range": { "from": null, "to": null, "chartFrom": "2024-12-15", "chartTo": "2025-01-14" }
}
```

CSV columns: Date, Scans, Conversations, Recommendations, Orders

### `GET /api/poursona-admin/analytics`

| Param | Default | Notes |
|-------|---------|-------|
| from | '' | ISO date, inclusive |
| to | '' | ISO date, inclusive |
| format | `json` | `csv` downloads daily analytics CSV |

**Response shape:**
```json
{
  "ok": true,
  "summary": {
    "totalRetailers": 42, "activeRetailers": 38, "paidRetailers": 20,
    "trialRetailers": 18, "expiredTrials": 4,
    "totalSessions": 1200, "totalOrders": 340, "conversionRate": 28
  },
  "daily": [{ "day": "2024-01-15", "sessions": 45, "orders": 12, "newRetailers": 1 }],
  "range": { "from": null, "to": null, "chartFrom": "2024-12-15", "chartTo": "2025-01-14" }
}
```

CSV columns: Date, Sessions, Orders, New Retailers

## Design Notes

- **No chart library**: SVG `<rect>` bar charts built inline. Bar width auto-calculated from data length (3–20px). Shows sessions (gray) and orders (gold overlay) to visualize funnel conversion.
- **`generate_series` for gap-free daily data**: CTE ensures every day in range appears with zero values — critical for chart rendering with no gaps.
- **90-day chart cap**: `clampRange()` bounds `generate_series` output; range > 90 days shifts start forward.
- **All-time backward compat**: Empty `from`/`to` → `$n::text = ''` conditions are no-ops, preserving all-time totals. Chart defaults to last 30 days.
- **Conversion rate**: `orders / sessions * 100` computed server-side and returned as `conversionRate`.
- **AdminChart green dots**: `newRetailers > 0` renders a small circle above the session bar.

## TypeScript

```
npx tsc --noEmit
```
Result: only pre-existing `app/page.tsx` curly-apostrophe error (line 118). All Task 7 code clean.

## Manual Verification Checklist

### Vendor Dashboard (`/admin`)
1. Navigate to `/admin` — dashboard loads with default 30-day chart
2. Date range: enter From/To → Apply → stats and chart update for selected range
3. Clear button → reverts to all-time stats, 30-day chart
4. Export CSV → downloads `analytics.csv` with daily rows for selected range
5. Chart shows gray bars (conversations) with gold overlay (orders)
6. Changing retailer via dropdown updates all data correctly

### Internal Admin (`/poursona-admin`)
1. Navigate to `/poursona-admin` — System Analytics section loads automatically below stat cards
2. Shows Sessions, Orders, Conversion %, Active Vendors mini-cards
3. AdminChart renders with session bars, order gold overlay, green dots for new retailers
4. Date range Apply → all analytics data updates
5. Clear → reverts to all-time range
6. Export CSV → downloads `system-analytics.csv`
7. Expired trials warning still appears above analytics section
8. Quick-links (Onboard, Team, System Check) still appear below

## Remaining Risks

- **`generate_series` max 90 days**: UI doesn't warn users that ranges > 90 days are silently clamped. Consider showing effective range near the chart.
- **Summary vs. chart range mismatch**: when `from`/`to` are empty, summary is all-time but chart shows last 30 days. This is intentional but could confuse users — the range label helps.
- **No retry on analytics fetch failure**: `loadAnalytics` fails silently if fetch rejects. The catch returns null and the section shows nothing.
