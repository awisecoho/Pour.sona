import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  vertical text NOT NULL,
  location text, tagline text, logo_url text,
  brand_color text DEFAULT '#C9A84C',
  owner_email text NOT NULL UNIQUE,
  stripe_customer_id text,
  subscription_status text DEFAULT 'trial',
  subscription_tier text DEFAULT 'starter',
  trial_ends_at timestamptz DEFAULT now() + interval '14 days',
  active boolean DEFAULT true,
  story text, culture text, region text, source_url text,
  bg_color text, qr_color text, bg_image_url text,
  mission_statement text, brand_voice text,
  guest_welcome_message text, recommendation_style text, hours jsonb
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  name text NOT NULL, description text, category text,
  flavor_notes text, price numeric, sizes text, pairing text, sku text,
  in_stock boolean DEFAULT true, origin text, process text, altitude text,
  roast_date text, abv text, ibu text, style text, tap_handle text,
  vintage text, appellation text, varietal text, cellar_note text,
  sort_order integer DEFAULT 0, confidence_score integer, source_url text
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  customer_name text, customer_email text,
  messages jsonb DEFAULT '[]', blend_name text, blend_data jsonb,
  recommended_at timestamptz, order_status text DEFAULT 'browsing',
  order_id text, order_total numeric, ordered_at timestamptz,
  device_type text, completed boolean DEFAULT false,
  guest_email text, guest_name text, mood_chips text[]
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  customer_email text, customer_name text, blend_name text,
  items jsonb NOT NULL, subtotal numeric,
  status text DEFAULT 'pending', pos_order_id text, notes text
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL, payload jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  count integer NOT NULL DEFAULT 3, pour_size text NOT NULL DEFAULT '4oz',
  price numeric NOT NULL, eligible text[] DEFAULT '{}',
  active boolean DEFAULT true, sort_order integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_email text NOT NULL,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  clerk_user_id text, email text
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  source_type text NOT NULL, source_value text,
  status text NOT NULL DEFAULT 'uploaded',
  raw_text text, raw_json jsonb DEFAULT '{}',
  normalized_json jsonb DEFAULT '{}', error_message text
);

CREATE TABLE IF NOT EXISTS retailer_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  ingestion_job_id uuid REFERENCES ingestion_jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  name text, slug text, vertical text, location text, tagline text,
  logo_url text, brand_color text DEFAULT '#C9A84C', source_url text,
  menu_json jsonb DEFAULT '[]', flight_json jsonb DEFAULT '[]',
  parsed_json jsonb DEFAULT '{}', story text, culture text, region text,
  voice text, events_json jsonb DEFAULT '[]',
  intelligence_json jsonb DEFAULT '{}', research_confidence integer
);

CREATE TABLE IF NOT EXISTS poursona_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  email text NOT NULL UNIQUE, name text,
  role text NOT NULL DEFAULT 'staff', password_hash text
);

CREATE TABLE IF NOT EXISTS rescan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES retailers(id) ON DELETE CASCADE,
  scan_type text NOT NULL, url text, changes jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid REFERENCES retailers(id) ON DELETE CASCADE,
  image_url text, raw_result jsonb DEFAULT '[]',
  status text DEFAULT 'pending', created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  founding_story text, mission_statement text, brand_personality text[],
  brand_voice_tone text, signature_items text[], tasting_pathways jsonb,
  guest_welcome_message text, recommendation_style text, social_links jsonb,
  source_urls_crawled text[], research_confidence integer DEFAULT 0,
  last_researched_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vendor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  name text NOT NULL, description text, event_type text,
  event_date text, recurrence_pattern text, source_url text,
  visible_to_guests boolean DEFAULT true, created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retailers_slug_idx ON retailers(slug);
CREATE INDEX IF NOT EXISTS retailers_email_idx ON retailers(owner_email);
CREATE INDEX IF NOT EXISTS retailers_status_idx ON retailers(subscription_status);
CREATE INDEX IF NOT EXISTS products_retailer_idx ON products(retailer_id);
CREATE INDEX IF NOT EXISTS products_stock_idx ON products(in_stock);
CREATE INDEX IF NOT EXISTS sessions_retailer_idx ON sessions(retailer_id);
CREATE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users(user_email);
`

const SEED = `
INSERT INTO poursona_team (email, name, role) VALUES ('awise873@gmail.com', 'Ang', 'owner') ON CONFLICT (email) DO NOTHING;
INSERT INTO retailers (id, name, slug, vertical, location, tagline, logo_url, brand_color, owner_email, subscription_status, active, story, culture, region, source_url) VALUES
 ('2420636e-a6f1-4ece-ab9f-cb5e8a9c21e8','Keuka Brewing Co.','keuka-brewing-company','brewery','Hammondsport, New York','Keuka lake''s first micro-brewery','http://static1.squarespace.com/static/595575e7e6f2e1096815f37d/t/5956811659cc68415290f4bb/1498841369012/KBC_logo_fullcolor_onLight.png?format=1500w','#C9A84C','owner+keuka-brewing-company@poursona.app','trial',true,'Rich Musso founded Keuka Brewing in 2008 as the first micro-brewery on Keuka Lake.','Relaxed, unstuffy vibe overlooking Keuka Lake.','Finger Lakes, New York.','https://www.keukabrewingcompany.com/'),
 ('bc2fde10-8eb1-42f7-9a03-d6b106332247','Steuben Brewing Company','steuben-brewing-company','brewery','Finger Lakes, NY','A brewery in the Finger Lakes','http://static1.squarespace.com/static/6716fb571cb5f2188253ccba/t/681301c38eddd01b950771dd/1746076099626/Steuben+Hops+%281%29.png?format=1500w','#C9A84C','owner+steuben-brewing-company@poursona.app','trial',true,'Steuben Brewing has been serving beer since 2014.','Laid-back, welcoming space on Keuka Lake.','Finger Lakes, New York.','https://www.steubenbrewingcompany.com/')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO admin_users (user_email, retailer_id, role, email) VALUES
 ('awise873@gmail.com','2420636e-a6f1-4ece-ab9f-cb5e8a9c21e8','owner','awise873@gmail.com'),
 ('awise873@gmail.com','bc2fde10-8eb1-42f7-9a03-d6b106332247','owner','awise873@gmail.com')
ON CONFLICT DO NOTHING;
`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.secret !== process.env.MIGRATE_SECRET && body.secret !== 'poursona-migrate-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    await dbQuery(SCHEMA)
    await dbQuery(SEED)
    const tables = await dbQuery(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
    return NextResponse.json({ ok: true, tables: tables.rows.map((r: any) => r.tablename) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
