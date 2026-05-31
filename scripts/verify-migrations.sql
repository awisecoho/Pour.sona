-- =============================================================================
-- Poursona / Neon PostgreSQL — Migration Verification Script
-- All statements are READ-ONLY (SELECT only). Safe to run in production.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/verify-migrations.sql
--
-- How to read results:
--   - Each section prints a label then runs a query.
--   - Expected row count is noted in a comment after each query.
--   - A section returning 0 rows means that migration has NOT been applied.
-- =============================================================================

\echo ''
\echo '======================================================================'
\echo '  POURSONA MIGRATION VERIFICATION'
\echo '======================================================================'
\echo ''

-- ── [0] Baseline schema ───────────────────────────────────────────────────────
-- Tables that must exist from supabase/schema.sql before any migrations run.

\echo '[0] Baseline tables from schema.sql'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'retailers', 'products', 'sessions', 'orders', 'events',
    'retailer_drafts', 'flights', 'admin_users', 'poursona_team', 'ingestion_jobs'
  )
ORDER BY table_name;
-- Expected: 10 rows

-- ── [1] 20260425_add_vendor_intelligence_table.sql ───────────────────────────
-- NOTE: This migration also attempts ENABLE ROW LEVEL SECURITY and a
-- CREATE POLICY ... TO service_role. On Neon, 'service_role' does not exist;
-- those two statements will error. Apply only the CREATE TABLE IF NOT EXISTS
-- line when running against Neon — see MIGRATION_VERIFICATION.md §Neon RLS.

\echo ''
\echo '[1] vendor_intelligence table (20260425)'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'vendor_intelligence';
-- Expected: 1 row

-- ── [2] 20260425_add_vendor_events_table.sql ─────────────────────────────────
-- Same Neon RLS caveat as above.

\echo ''
\echo '[2] vendor_events table (20260425)'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'vendor_events';
-- Expected: 1 row

-- ── [3] 20260425_add_vendor_intelligence_columns.sql ─────────────────────────
-- Adds columns to retailers, retailer_drafts, products.

\echo ''
\echo '[3a] retailers intelligence columns (20260425)'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'retailers'
  AND column_name IN ('mission_statement','brand_voice','guest_welcome_message','recommendation_style','hours')
ORDER BY column_name;
-- Expected: 5 rows

\echo ''
\echo '[3b] retailer_drafts intelligence columns (20260425)'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'retailer_drafts'
  AND column_name IN ('voice','events_json','intelligence_json','research_confidence')
ORDER BY column_name;
-- Expected: 4 rows

\echo ''
\echo '[3c] products intelligence columns (20260425)'
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('confidence_score','source_url')
ORDER BY column_name;
-- Expected: 2 rows

-- ── [4] 20260513_create_missing_neon_tables.sql ───────────────────────────────

\echo ''
\echo '[4] Tables from 20260513_create_missing_neon_tables'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'customer_profiles','customer_visits','promo_codes',
    'promo_redemptions','billing_events','account_credits'
  )
ORDER BY table_name;
-- Expected: 6 rows

-- ── [5] 20260513_add_website_url_to_retailers.sql ────────────────────────────

\echo ''
\echo '[5] retailers.website_url column (20260513)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'retailers' AND column_name = 'website_url';
-- Expected: 1 row (text, YES)

-- ── [6] 20260513_add_experience_level_to_customer_profiles.sql ───────────────

\echo ''
\echo '[6] customer_profiles.experience_level column (20260513)'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_profiles' AND column_name = 'experience_level';
-- Expected: 1 row (text, YES)
-- Note: this column is also included in CREATE TABLE IF NOT EXISTS in migration [4].
-- A 0-row result here means customer_profiles was created WITHOUT this column
-- (i.e. migration [4] ran but [6] did not).

-- ── [7] 20260514_add_idempotency_key_to_orders.sql ───────────────────────────
-- RUNTIME-CRITICAL: missing = every POST /api/order will error.

\echo ''
\echo '[7a] orders.idempotency_key column (20260514) *** RUNTIME-CRITICAL ***'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'idempotency_key';
-- Expected: 1 row (text, YES)

\echo ''
\echo '[7b] orders_session_idempotency_key_unique partial index (20260514) *** RUNTIME-CRITICAL ***'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname = 'orders_session_idempotency_key_unique';
-- Expected: 1 row
-- indexdef must contain: WHERE (idempotency_key IS NOT NULL)

-- ── [8] 20260514_add_trial_warning_sent_at_to_retailers.sql ──────────────────
-- RUNTIME-CRITICAL: missing = /api/chat errors for all trial vendors.

\echo ''
\echo '[8] retailers.trial_warning_sent_at column (20260514) *** RUNTIME-CRITICAL ***'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'retailers' AND column_name = 'trial_warning_sent_at';
-- Expected: 1 row (timestamp with time zone, YES)

-- ── [9] 20260514_add_performance_indexes.sql ─────────────────────────────────

\echo ''
\echo '[9a] idx_sessions_retailer_id_created_at (20260514)'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sessions'
  AND indexname = 'idx_sessions_retailer_id_created_at';
-- Expected: 1 row (retailer_id, created_at DESC)

\echo ''
\echo '[9b] idx_orders_retailer_id_created_at (20260514)'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname = 'idx_orders_retailer_id_created_at';
-- Expected: 1 row (retailer_id, created_at DESC)

\echo ''
\echo '[9c] idx_retailers_expired_trials (20260514)'
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'retailers'
  AND indexname = 'idx_retailers_expired_trials';
-- Expected: 1 row with WHERE clause filtering trial + non-null trial_ends_at

-- ── [10] Full column inventory spot-check ────────────────────────────────────
-- Quick summary of column counts per table — useful to catch silent partial applies.

\echo ''
\echo '[10] Column counts per core table (spot-check, not pass/fail)'
SELECT table_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'retailers','products','sessions','orders','events',
    'retailer_drafts','vendor_intelligence','vendor_events',
    'customer_profiles','promo_codes'
  )
GROUP BY table_name
ORDER BY table_name;
-- Reference column counts (schema.sql + all migrations applied):
--   retailers          ~26 (base 15 + website_url + trial_warning_sent_at + intelligence cols)
--   products           ~23 (base 21 + confidence_score + source_url)
--   sessions           ~16 (base 16)
--   orders             ~12 (base 11 + idempotency_key)
--   events             ~6
--   retailer_drafts    ~24 (check your schema for exact base count)
--   vendor_intelligence ~16
--   vendor_events      ~9
--   customer_profiles  ~16
--   promo_codes        ~14

-- ── [11] All indexes on core tables ──────────────────────────────────────────

\echo ''
\echo '[11] All indexes on core tables'
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('retailers','products','sessions','orders','events')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

\echo ''
\echo '======================================================================'
\echo '  DONE — Any section with 0 rows = migration not yet applied'
\echo '======================================================================'
\echo ''
