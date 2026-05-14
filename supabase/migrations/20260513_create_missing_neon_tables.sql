-- Tables that exist in Supabase but were missing from Neon.
-- Applied to Neon 2026-05-13.

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  email text NOT NULL,
  name text,
  clerk_user_id text,
  phone text,
  preferences jsonb DEFAULT '{}'::jsonb,
  favorite_retailers text[] DEFAULT '{}'::text[],
  opted_in_promos boolean DEFAULT true,
  opted_in_marketing boolean DEFAULT false,
  total_visits integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  experience_level text
);

CREATE TABLE IF NOT EXISTS public.customer_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  customer_profile_id uuid,
  retailer_id uuid,
  session_id uuid,
  ordered boolean DEFAULT false,
  promo_redeemed text,
  visit_count integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  code text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'percent',
  value numeric DEFAULT 0,
  applies_to text DEFAULT 'subscription',
  retailer_id uuid,
  max_uses integer,
  uses_count integer DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  active boolean DEFAULT true,
  created_by text
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  promo_code_id uuid,
  retailer_id uuid,
  redeemed_by_email text,
  applied_discount numeric,
  notes text
);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  retailer_id uuid,
  event_type text NOT NULL,
  amount numeric,
  stripe_event_id text,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.account_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  retailer_id uuid,
  amount numeric NOT NULL,
  reason text,
  applied_by text,
  applied_at timestamptz DEFAULT now(),
  expires_at timestamptz
);
