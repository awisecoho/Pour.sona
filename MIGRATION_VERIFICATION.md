# Migration Verification Checklist

Migration files live in `supabase/migrations/`. This project uses **Neon PostgreSQL** — migrations are **not auto-applied**. Every file must be run manually. All migration files use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so re-running them is safe.

---

## Before You Begin

### 1. Export a backup (recommended)

```bash
# Dump schema + data to a local file before any migration run
pg_dump $DATABASE_URL --no-owner --no-acl -f poursona_backup_$(date +%Y%m%d_%H%M%S).sql

# Schema only (faster, for reference)
pg_dump $DATABASE_URL --no-owner --no-acl --schema-only -f poursona_schema_$(date +%Y%m%d_%H%M%S).sql
```

Neon also has point-in-time restore via the Neon console (Project → Branches → Restore). Note the branch restore point before running migrations.

### 2. Set your connection string

```bash
# Replace with your actual Neon connection string
export DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

---

## ⚠️ Neon RLS Incompatibility Warning

Two migrations contain Supabase-specific statements that **will error on Neon**:

- `20260425_add_vendor_intelligence_table.sql`
- `20260425_add_vendor_events_table.sql`

Both files include:
```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON public.<table> FOR ALL TO service_role ...
```

`service_role` is a Supabase built-in role that does not exist on Neon. Running these files unmodified against Neon will error at the `CREATE POLICY` line. The `CREATE TABLE IF NOT EXISTS` lines are safe.

**Recommended approach:** Use the Neon-safe versions at the bottom of this document (§ Neon-Safe Migration Snippets) which strip the RLS/policy lines.

---

## Migration Execution Order

Apply in ascending filename order (already chronological). The two runtime-critical migrations are marked **★**.

| # | File | What It Does | Runtime-Critical | Neon-Safe As-Is |
|---|------|--------------|:---:|:---:|
| 1 | `20260425_add_vendor_intelligence_table.sql` | Creates `vendor_intelligence` table | No | ❌ (RLS) |
| 2 | `20260425_add_vendor_events_table.sql` | Creates `vendor_events` table | No | ❌ (RLS) |
| 3 | `20260425_add_vendor_intelligence_columns.sql` | Adds 9 columns to retailers/retailer_drafts/products | No | ✅ |
| 4 | `20260513_create_missing_neon_tables.sql` | Creates customer_profiles, customer_visits, promo_codes, promo_redemptions, billing_events, account_credits | No | ✅ |
| 5 | `20260513_add_website_url_to_retailers.sql` | Adds `retailers.website_url` | No | ✅ |
| 6 | `20260513_add_experience_level_to_customer_profiles.sql` | Adds `customer_profiles.experience_level` | No | ✅ |
| 7 ★ | `20260514_add_idempotency_key_to_orders.sql` | Adds `orders.idempotency_key` + partial unique index | **YES** | ✅ |
| 8 ★ | `20260514_add_trial_warning_sent_at_to_retailers.sql` | Adds `retailers.trial_warning_sent_at` | **YES** | ✅ |
| 9 | `20260514_add_performance_indexes.sql` | Adds 3 performance indexes | No | ✅ |

**Runtime-critical** means the app will throw errors on live traffic if that migration has not been applied.

---

## Apply Migrations

### Apply safe migrations directly

```bash
# Apply each safe migration (files 3–9):
psql $DATABASE_URL -f supabase/migrations/20260425_add_vendor_intelligence_columns.sql
psql $DATABASE_URL -f supabase/migrations/20260513_create_missing_neon_tables.sql
psql $DATABASE_URL -f supabase/migrations/20260513_add_website_url_to_retailers.sql
psql $DATABASE_URL -f supabase/migrations/20260513_add_experience_level_to_customer_profiles.sql
psql $DATABASE_URL -f supabase/migrations/20260514_add_idempotency_key_to_orders.sql
psql $DATABASE_URL -f supabase/migrations/20260514_add_trial_warning_sent_at_to_retailers.sql
psql $DATABASE_URL -f supabase/migrations/20260514_add_performance_indexes.sql
```

### Apply RLS-incompatible migrations (Neon-safe versions)

Run the inline SQL below instead of the raw files for the two 20260425 table-creation migrations:

```sql
-- Neon-safe version of 20260425_add_vendor_intelligence_table.sql
CREATE TABLE IF NOT EXISTS public.vendor_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE CASCADE,
  founding_story text,
  mission_statement text,
  brand_personality text[],
  brand_voice_tone text,
  signature_items text[],
  tasting_pathways jsonb,
  guest_welcome_message text,
  recommendation_style text,
  social_links jsonb,
  source_urls_crawled text[],
  research_confidence integer DEFAULT 0,
  last_researched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- (RLS and service_role policy omitted — not applicable on Neon)
```

```sql
-- Neon-safe version of 20260425_add_vendor_events_table.sql
CREATE TABLE IF NOT EXISTS public.vendor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES public.retailers(id) ON DELETE CASCADE,
  name text,
  description text,
  event_type text,
  event_date date,
  recurrence_pattern text,
  source_url text,
  visible_to_guests boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
-- (RLS and service_role policy omitted — not applicable on Neon)
```

---

## Verify After Applying

```bash
# Run the full read-only verification script
psql $DATABASE_URL -f scripts/verify-migrations.sql

# Or check the two runtime-critical items quickly
psql $DATABASE_URL -c "\d orders" | grep idempotency
psql $DATABASE_URL -c "\d retailers" | grep trial_warning
```

Every section in the verification script should return at least one row. Any section returning 0 rows = that migration has not been applied.

---

## Rollback Notes

PostgreSQL DDL (ALTER TABLE, CREATE TABLE, CREATE INDEX) is transactional on Neon. If you wrap an `ALTER TABLE` in an explicit `BEGIN`/`COMMIT` block you can roll it back if it errors mid-way.

However, **these migrations do not use explicit transactions** — they are individual DDL statements. If a multi-statement migration partially executes (e.g. the first ADD COLUMN succeeds but the second fails), you will need to manually undo the partial apply.

### Rollback SQL for each migration

Only needed if you need to undo a migration. These are destructive — use only after taking a backup.

```sql
-- Undo [7] 20260514_add_idempotency_key_to_orders
DROP INDEX IF EXISTS orders_session_idempotency_key_unique;
ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;

-- Undo [8] 20260514_add_trial_warning_sent_at_to_retailers
ALTER TABLE retailers DROP COLUMN IF EXISTS trial_warning_sent_at;

-- Undo [9] 20260514_add_performance_indexes
DROP INDEX IF EXISTS idx_sessions_retailer_id_created_at;
DROP INDEX IF EXISTS idx_orders_retailer_id_created_at;
DROP INDEX IF EXISTS idx_retailers_expired_trials;

-- Undo [5] 20260513_add_website_url_to_retailers
ALTER TABLE retailers DROP COLUMN IF EXISTS website_url;

-- Undo [3] 20260425_add_vendor_intelligence_columns (retailers)
ALTER TABLE retailers
  DROP COLUMN IF EXISTS mission_statement,
  DROP COLUMN IF EXISTS brand_voice,
  DROP COLUMN IF EXISTS guest_welcome_message,
  DROP COLUMN IF EXISTS recommendation_style,
  DROP COLUMN IF EXISTS hours;

-- Undo [3] 20260425_add_vendor_intelligence_columns (retailer_drafts)
ALTER TABLE retailer_drafts
  DROP COLUMN IF EXISTS voice,
  DROP COLUMN IF EXISTS events_json,
  DROP COLUMN IF EXISTS intelligence_json,
  DROP COLUMN IF EXISTS research_confidence;

-- Undo [3] 20260425_add_vendor_intelligence_columns (products)
ALTER TABLE products
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS source_url;

-- Undo [1/2] vendor tables (also cascades data)
DROP TABLE IF EXISTS public.vendor_intelligence;
DROP TABLE IF EXISTS public.vendor_events;

-- Undo [4] 20260513 tables
DROP TABLE IF EXISTS public.account_credits;
DROP TABLE IF EXISTS public.billing_events;
DROP TABLE IF EXISTS public.promo_redemptions;
DROP TABLE IF EXISTS public.promo_codes;
DROP TABLE IF EXISTS public.customer_visits;
DROP TABLE IF EXISTS public.customer_profiles;
```

---

## Quick Reference: What Each Migration Enables

| Migration | Features unlocked if not applied |
|-----------|----------------------------------|
| idempotency_key | Order creation (`POST /api/order`) — will 500 without index |
| trial_warning_sent_at | Trial expiry warning emails in `/api/chat` — will 500 for trial vendors |
| performance indexes | Admin retailer list / analytics queries become slow sequential scans |
| website_url | Retailer rescan and onboarding source tracking |
| vendor_intelligence table/cols | AI brand intelligence, host persona generation |
| vendor_events table | Extracted venue events displayed to guests |
| customer_profiles + related | Customer loyalty, promos, billing events |

---

## Local Typecheck Status

As of 2026-05-14: `npx tsc --noEmit` exits 0 with zero errors. Codebase is fully type-clean.
