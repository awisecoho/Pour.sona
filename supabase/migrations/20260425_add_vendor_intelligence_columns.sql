-- Adds additive vendor intelligence fields to existing onboarding and catalog tables.
-- Approved: pending | Run: not run

ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS mission_statement text,
  ADD COLUMN IF NOT EXISTS brand_voice text,
  ADD COLUMN IF NOT EXISTS guest_welcome_message text,
  ADD COLUMN IF NOT EXISTS recommendation_style text,
  ADD COLUMN IF NOT EXISTS hours jsonb;

ALTER TABLE public.retailer_drafts
  ADD COLUMN IF NOT EXISTS voice text,
  ADD COLUMN IF NOT EXISTS events_json jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_json jsonb,
  ADD COLUMN IF NOT EXISTS research_confidence integer;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS confidence_score integer,
  ADD COLUMN IF NOT EXISTS source_url text;
