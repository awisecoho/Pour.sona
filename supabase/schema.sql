-- ─────────────────────────────────────────────────────────────────────────────
-- POURSONA DATABASE SCHEMA
-- Paste this entire file into Supabase → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── RETAILERS ───────────────────────────────────────────────────────────────
-- One row per subscribing business (roaster, brewery, winery)
create table retailers (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  name          text not null,
  slug          text not null unique,        -- URL-safe: "ember-oak-roasters"
  vertical      text not null,               -- 'coffee' | 'brewery' | 'winery'
  location      text,
  tagline       text,
  logo_url      text,
  brand_color   text default '#C9A84C',
  owner_email   text not null unique,
  stripe_customer_id text,
  subscription_status text default 'trial',  -- trial | active | paused | cancelled
  subscription_tier   text default 'starter',-- starter | growth | pro
  trial_ends_at timestamptz default (now() + interval '14 days'),
  active        boolean default true
);

-- ─── PRODUCTS ─────────────────────────────────────────────────────────────────
-- Each retailer's catalog items
create table products (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  retailer_id   uuid not null references retailers(id) on delete cascade,
  name          text not null,
  description   text,
  category      text,
  flavor_notes  text,                        -- comma-separated
  price         numeric(10,2),
  sizes         text,                        -- pipe-separated: "12oz|1lb"
  pairing       text,
  sku           text,
  in_stock      boolean default true,
  -- Coffee fields
  origin        text,
  process       text,
  altitude      text,
  roast_date    text,
  -- Brewery fields
  abv           text,
  ibu           text,
  style         text,
  tap_handle    text,
  -- Winery fields
  vintage       text,
  appellation   text,
  varietal      text,
  cellar_note   text,
  -- Sorting
  sort_order    integer default 0
);

-- ─── SESSIONS ─────────────────────────────────────────────────────────────────
-- Each customer QR scan = one session
create table sessions (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  retailer_id   uuid not null references retailers(id) on delete cascade,
  customer_name text,
  customer_email text,
  -- Conversation
  messages      jsonb default '[]',          -- full chat history
  -- Recommendation
  blend_name    text,
  blend_data    jsonb,                        -- full recommendation JSON
  recommended_at timestamptz,
  -- Order
  order_status  text default 'browsing',     -- browsing | recommended | ordered | fulfilled
  order_id      text,                        -- POS reference
  order_total   numeric(10,2),
  ordered_at    timestamptz,
  -- Tracking
  device_type   text,
  completed     boolean default false
);

-- ─── ORDERS ───────────────────────────────────────────────────────────────────
create table orders (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  session_id    uuid references sessions(id),
  retailer_id   uuid not null references retailers(id) on delete cascade,
  customer_email text,
  customer_name text,
  blend_name    text,
  items         jsonb not null,              -- [{name, size, price, qty}]
  subtotal      numeric(10,2),
  status        text default 'pending',      -- pending | confirmed | fulfilled | cancelled
  pos_order_id  text,                        -- Square / Shopify reference
  notes         text
);

-- ─── ANALYTICS EVENTS ────────────────────────────────────────────────────────
create table events (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz default now(),
  retailer_id   uuid not null references retailers(id) on delete cascade,
  session_id    uuid references sessions(id),
  event_type    text not null,               -- scan | message | recommendation | order | reorder
  payload       jsonb default '{}'
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Retailers can only see their own data
alter table retailers  enable row level security;
alter table products   enable row level security;
alter table sessions    enable row level security;
alter table orders     enable row level security;
alter table events     enable row level security;

-- Service role (server-side API) bypasses RLS automatically
-- Public anon key can only read active retailer slugs + their in-stock products

create policy "Public can read retailer by slug"
  on retailers for select
  using (active = true);

create policy "Public can read in-stock products"
  on products for select
  using (in_stock = true);

create policy "Public can insert sessions"
  on sessions for insert
  with check (true);

create policy "Public can update their session"
  on sessions for update
  using (true);

create policy "Public can insert orders"
  on orders for insert
  with check (true);

create policy "Public can insert events"
  on events for insert
  with check (true);

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────

-- Auto-update updated_at on products
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute function update_updated_at();

-- Get retailer analytics summary
create or replace function retailer_analytics(r_id uuid)
returns json as $$
declare result json;
begin
  select json_build_object(
    'total_scans',          (select count(*) from sessions where retailer_id = r_id),
    'recommendations',      (select count(*) from sessions where retailer_id = r_id and blend_name is not null),
    'orders',               (select count(*) from orders   where retailer_id = r_id and status != 'cancelled'),
    'revenue',              (select coalesce(sum(subtotal),0) from orders where retailer_id = r_id and status = 'fulfilled'),
    'conversion_rate',      (select round(
                              case when count(*) = 0 then 0
                              else count(*) filter (where order_status = 'ordered') * 100.0 / count(*)
                              end, 1
                            ) from sessions where retailer_id = r_id),
    'top_blends',           (select json_agg(t) from (
                              select blend_name, count(*) as times
                              from sessions where retailer_id = r_id and blend_name is not null
                              group by blend_name order by times desc limit 5
                            ) t),
    'scans_this_week',      (select count(*) from sessions where retailer_id = r_id and created_at > now() - interval '7 days'),
    'scans_this_month',     (select count(*) from sessions where retailer_id = r_id and created_at > now() - interval '30 days')
  ) into result;
  return result;
end;
$$ language plpgsql security definer;

-- ─── SEED: SAMPLE RETAILERS ───────────────────────────────────────────────────
-- Uncomment to load sample data for testing

/*
insert into retailers (name, slug, vertical, location, tagline, owner_email) values
  ('Ember & Oak Roasters',  'ember-oak',   'coffee',  'Asheville, NC',  'Small-batch roasters since 2018',     'test-coffee@poursona.app'),
  ('Ironweed Brewing Co.',  'ironweed',    'brewery', 'Nashville, TN',  'Craft beer brewed with intention',     'test-beer@poursona.app'),
  ('Ridgeline Cellars',     'ridgeline',   'winery',  'Sonoma, CA',     'Estate wines from fog-kissed hillsides','test-wine@poursona.app');
*/
