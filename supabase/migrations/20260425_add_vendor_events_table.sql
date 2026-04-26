-- Adds vendor_events table for extracted upcoming and recurring venue events.
-- Approved: pending | Run: not run

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

ALTER TABLE public.vendor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages vendor events"
ON public.vendor_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
