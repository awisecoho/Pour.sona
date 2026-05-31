-- Performance indexes for retailer stats queries
-- sessions(retailer_id) is the hot path for the admin retailer list CTE.
-- orders(retailer_id) follows the same pattern for future order stats queries.
-- These use IF NOT EXISTS so the migration is safe to re-run.

CREATE INDEX IF NOT EXISTS idx_sessions_retailer_id_created_at
  ON sessions(retailer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_retailer_id_created_at
  ON orders(retailer_id, created_at DESC);

-- Partial index to speed up expired-trial lookups used in the admin summary.
CREATE INDEX IF NOT EXISTS idx_retailers_expired_trials
  ON retailers(trial_ends_at ASC)
  WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL;
