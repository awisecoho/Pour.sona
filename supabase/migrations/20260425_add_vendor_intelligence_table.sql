-- Adds vendor_intelligence table for deep vendor research profiles.
-- Approved: pending | Run: not run

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

ALTER TABLE public.vendor_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages vendor intelligence"
ON public.vendor_intelligence
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
