import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
export const dynamic = 'force-dynamic'

const ADD_MISSING = `
-- Add any columns that may have been missing from first schema run
DO $$ BEGIN
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
  BEGIN ALTER TABLE admin_users ADD COLUMN clerk_user_id text; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE admin_users ADD COLUMN email text; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;
`

const SEED = `
INSERT INTO poursona_team (email, name, role)
VALUES ('awise873@gmail.com', 'Ang', 'owner')
ON CONFLICT (email) DO NOTHING;

INSERT INTO retailers
  (id, name, slug, vertical, location, tagline, logo_url, brand_color, owner_email, subscription_status, active, story, culture, region, source_url)
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
  ('awise873@gmail.com', 'awise873@gmail.com', '2420636e-a6f1-4ece-ab9f-cb5e8a9c21e8', 'owner'),
  ('awise873@gmail.com', 'awise873@gmail.com', 'bc2fde10-8eb1-42f7-9a03-d6b106332247', 'owner')
ON CONFLICT DO NOTHING;
`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.secret !== 'poursona-migrate-2026') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    await dbQuery(ADD_MISSING)
    await dbQuery(SEED)
    const tables = await dbQuery(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)
    const counts = await dbQuery(`
      SELECT
        (SELECT COUNT(*) FROM retailers) as retailers,
        (SELECT COUNT(*) FROM admin_users) as admin_users,
        (SELECT COUNT(*) FROM poursona_team) as poursona_team
    `)
    return NextResponse.json({ ok: true, tables: tables.rows.map((r:any) => r.tablename), counts: counts.rows[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
