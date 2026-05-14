-- Task 3: add trial_warning_sent_at to retailers so the trial-warning email
-- gate is durable and survives across serverless invocations.
--
-- Without this column, the in-memory check in chat/route.ts never persisted,
-- meaning the 24-hour de-duplicate gate never actually worked.

ALTER TABLE retailers
  ADD COLUMN IF NOT EXISTS trial_warning_sent_at timestamptz;
