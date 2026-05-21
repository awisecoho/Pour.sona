import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

// Step 1: fix any column mismatches from partial first run
const FIX_SCHEMA = `
DO $$ BEGIN
  -- retailers missing columns
  BEGIN ALTER TABLE retailers ADD COLUMN source_url text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN bg_color text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN qr_color text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN bg_image_url text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN mission_statement text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN brand_voice text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN guest_welcome_message text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN recommendation_style text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN hours jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN stripe_customer_id text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN subscription_tier text DEFAULT 'starter'; EXCEPTION WHEN duplicate_column THEN NULL; END;
  -- vendor builder columns (AI persona, extended brand palette, take-home / featured items)
  BEGIN ALTER TABLE retailers ADD COLUMN chat_system_prompt text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN brand_secondary_color text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN brand_accent_color text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN brand_font_family text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN brand_font_url text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN take_home_json jsonb DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN has_take_home boolean DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN featured_items_json jsonb DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN scan_confidence double precision DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN personality_preview text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN vendor_builder_ran_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END;
  -- retailer_drafts vendor builder / research columns (defensive — draft insert already relies on these)
  BEGIN ALTER TABLE retailer_drafts ADD COLUMN voice text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailer_drafts ADD COLUMN events_json jsonb DEFAULT '[]'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailer_drafts ADD COLUMN intelligence_json jsonb DEFAULT '{}'::jsonb; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailer_drafts ADD COLUMN research_confidence double precision DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
  -- admin_users: add user_email if missing (old schema had user_id uuid)
  BEGIN ALTER TABLE admin_users ADD COLUMN user_email text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE admin_users ADD COLUMN email text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE admin_users ADD COLUMN clerk_user_id text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  -- drop the old user_id FK if it exists (from Supabase auth.users)
  BEGIN ALTER TABLE admin_users DROP COLUMN user_id; EXCEPTION WHEN undefined_column THEN NULL; END;
  -- per-venue monthly AI usage metering (enforces the AI cost ceiling)
  BEGIN ALTER TABLE retailers ADD COLUMN ai_input_tokens_month bigint DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN ai_output_tokens_month bigint DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN ai_month_reset_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN ai_cap_notified_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE retailers ADD COLUMN ai_warn_notified_at timestamptz; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Performance + tenant-isolation indexes (idempotent; ensures they exist on Neon)
CREATE INDEX IF NOT EXISTS idx_sessions_retailer_id_created_at ON sessions(retailer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_retailer_id_created_at   ON orders(retailer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_retailer_type_created    ON events(retailer_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_retailer_id            ON products(retailer_id);
CREATE INDEX IF NOT EXISTS idx_flights_retailer_id             ON flights(retailer_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email               ON admin_users(lower(email));
CREATE INDEX IF NOT EXISTS idx_retailers_slug                  ON retailers(slug);
CREATE INDEX IF NOT EXISTS idx_retailers_expired_trials        ON retailers(trial_ends_at ASC) WHERE subscription_status = 'trial' AND trial_ends_at IS NOT NULL;
`

// Step 2: seed core data
const SEED = `
INSERT INTO poursona_team (email, name, role)
VALUES ('awise873@gmail.com', 'Ang', 'owner')
ON CONFLICT (email) DO NOTHING;

INSERT INTO retailers
  (id, name, slug, vertical, location, tagline, logo_url, brand_color,
   owner_email, subscription_status, active, story, culture, region, source_url)
VALUES
  ('2420636e-a6f1-4ece-ab9f-cb5e8a9c21e8',
   'Keuka Brewing Co.', 'keuka-brewing-company', 'brewery',
   'Hammondsport, New York', 'Keuka lake''s first micro-brewery',
   'http://static1.squarespace.com/static/595575e7e6f2e1096815f37d/t/5956811659cc68415290f4bb/1498841369012/KBC_logo_fullcolor_onLight.png?format=1500w',
   '#C9A84C', 'owner+keuka-brewing-company@poursona.app', 'trial', true,
   'Rich Musso founded Keuka Brewing in 2008 as the first micro-brewery on Keuka Lake.',
   'Relaxed, unstuffy vibe overlooking Keuka Lake.',
   'Finger Lakes, New York.',
   'https://www.keukabrewingcompany.com/'),
  ('bc2fde10-8eb1-42f7-9a03-d6b106332247',
   'Steuben Brewing Company', 'steuben-brewing-company', 'brewery',
   'Finger Lakes, NY', 'A brewery in the Finger Lakes',
   'http://static1.squarespace.com/static/6716fb571cb5f2188253ccba/t/681301c38eddd01b950771dd/1746076099626/Steuben+Hops+%281%29.png?format=1500w',
   '#C9A84C', 'owner+steuben-brewing-company@poursona.app', 'trial', true,
   'Steuben Brewing has been serving beer since 2014.',
   'Laid-back, welcoming space on Keuka Lake.',
   'Finger Lakes, New York.',
   'https://www.steubenbrewingcompany.com/')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO admin_users (user_email, email, retailer_id, role)
VALUES
  ('awise873@gmail.com', 'awise873@gmail.com',
   '2420636e-a6f1-4ece-ab9f-cb5e8a9c21e8', 'owner'),
  ('awise873@gmail.com', 'awise873@gmail.com',
   'bc2fde10-8eb1-42f7-9a03-d6b106332247', 'owner')
ON CONFLICT DO NOTHING;
`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.secret !== 'poursona-migrate-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    // Get current admin_users columns for diagnostics
    const cols = await dbQuery(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
      ORDER BY ordinal_position
    `)

    await dbQuery(FIX_SCHEMA)
    await dbQuery(SEED)

    const tables = await dbQuery(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' ORDER BY tablename
    `)
    const counts = await dbQuery(`
      SELECT
        (SELECT COUNT(*) FROM retailers) as retailers,
        (SELECT COUNT(*) FROM admin_users) as admin_users,
        (SELECT COUNT(*) FROM poursona_team) as poursona_team
    `)
    const adminCols = await dbQuery(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      ok: true,
      tables: tables.rows.map((r: any) => r.tablename),
      counts: counts.rows[0],
      admin_users_columns: adminCols.rows.map((r: any) => r.column_name),
      before_fix_columns: cols.rows.map((r: any) => r.column_name + ':' + r.data_type)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
