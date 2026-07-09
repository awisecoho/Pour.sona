ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS brand_personality text;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS key_differentiators jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS preferred_vocab jsonb DEFAULT '[]'::jsonb;
