-- Task 2: idempotent order creation
-- Add idempotency_key column to orders table and a partial unique index
-- so that (session_id, idempotency_key) pairs cannot be duplicated.
--
-- Partial index (WHERE idempotency_key IS NOT NULL) means:
--   - Legacy rows without a key are unaffected.
--   - New rows with a key are de-duplicated per session.
--   - ON CONFLICT (session_id, idempotency_key) WHERE idempotency_key IS NOT NULL
--     can reference this index directly in INSERT statements.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_session_idempotency_key_unique
  ON orders(session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
