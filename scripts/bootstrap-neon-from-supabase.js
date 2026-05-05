const fs = require('fs')
const { Client } = require('pg')

function parseEnvFile(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    let value = line.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[line.slice(0, i)] = value
  }
  return env
}

async function fetchSupabaseTable(env, table) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=*`
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${table} fetch failed (${res.status}): ${text.slice(0, 300)}`)
  }

  return res.json()
}

async function ensureSchema(client) {
  await client.query(`
    create extension if not exists "pgcrypto";

    create table if not exists retailers (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      name text not null,
      slug text not null unique,
      vertical text not null,
      location text,
      tagline text,
      logo_url text,
      brand_color text default '#C9A84C',
      owner_email text not null unique,
      stripe_customer_id text,
      subscription_status text default 'trial',
      subscription_tier text default 'starter',
      trial_ends_at timestamptz default (now() + interval '14 days'),
      active boolean default true,
      story text,
      culture text,
      region text,
      mission_statement text,
      brand_voice text,
      guest_welcome_message text,
      recommendation_style text,
      hours jsonb
    );

    create table if not exists products (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      retailer_id uuid not null references retailers(id) on delete cascade,
      name text not null,
      description text,
      category text,
      flavor_notes text,
      price numeric(10,2),
      sizes text,
      pairing text,
      sku text,
      in_stock boolean default true,
      origin text,
      process text,
      altitude text,
      roast_date text,
      abv text,
      ibu text,
      style text,
      tap_handle text,
      vintage text,
      appellation text,
      varietal text,
      cellar_note text,
      sort_order integer default 0,
      confidence_score integer,
      source_url text
    );

    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      retailer_id uuid not null references retailers(id) on delete cascade,
      customer_name text,
      customer_email text,
      messages jsonb default '[]'::jsonb,
      blend_name text,
      blend_data jsonb,
      recommended_at timestamptz,
      order_status text default 'browsing',
      order_id text,
      order_total numeric(10,2),
      ordered_at timestamptz,
      device_type text,
      completed boolean default false
    );

    create table if not exists orders (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      session_id uuid references sessions(id),
      retailer_id uuid not null references retailers(id) on delete cascade,
      customer_email text,
      customer_name text,
      blend_name text,
      items jsonb not null,
      subtotal numeric(10,2),
      status text default 'pending',
      pos_order_id text,
      notes text
    );

    create table if not exists events (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      retailer_id uuid not null references retailers(id) on delete cascade,
      session_id uuid references sessions(id),
      event_type text not null,
      payload jsonb default '{}'::jsonb
    );

    create table if not exists flights (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      retailer_id uuid not null references retailers(id) on delete cascade,
      name text not null,
      description text,
      count integer default 4,
      pour_size text default '4oz',
      price numeric(10,2),
      active boolean default true,
      sort_order integer default 0
    );

    create table if not exists admin_users (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      user_id text,
      retailer_id uuid not null references retailers(id) on delete cascade,
      role text default 'owner',
      clerk_user_id text,
      email text
    );

    create unique index if not exists admin_users_clerk_user_id_unique
      on admin_users (clerk_user_id)
      where clerk_user_id is not null;

    create unique index if not exists admin_users_retailer_email_unique
      on admin_users (retailer_id, lower(email))
      where email is not null;

    create table if not exists poursona_team (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      email text not null unique,
      name text,
      role text default 'staff'
    );

    create table if not exists ingestion_jobs (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      source_type text,
      source_value text,
      status text,
      raw_text text,
      raw_json jsonb,
      normalized_json jsonb
    );

    create table if not exists retailer_drafts (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      ingestion_job_id uuid references ingestion_jobs(id) on delete set null,
      status text default 'draft',
      name text not null,
      slug text not null unique,
      vertical text,
      location text,
      tagline text,
      logo_url text,
      brand_color text default '#C9A84C',
      source_url text,
      owner_email text,
      menu_json jsonb,
      flight_json jsonb,
      parsed_json jsonb,
      story text,
      culture text,
      region text,
      voice text,
      events_json jsonb,
      intelligence_json jsonb,
      research_confidence integer
    );

    create table if not exists vendor_events (
      id uuid primary key default gen_random_uuid(),
      retailer_id uuid references retailers(id) on delete cascade,
      name text,
      description text,
      event_type text,
      event_date date,
      recurrence_pattern text,
      source_url text,
      visible_to_guests boolean default true,
      created_at timestamptz default now()
    );

    create table if not exists vendor_intelligence (
      id uuid primary key default gen_random_uuid(),
      retailer_id uuid references retailers(id) on delete cascade,
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
      research_confidence integer default 0,
      last_researched_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
  `)
}

async function upsertRows(client, table, columns, rows, conflictTarget, updateColumns = columns) {
  if (!rows.length) return

  const quotedColumns = columns.map((column) => `"${column}"`)
  const updateAssignments = updateColumns
    .filter((column) => !conflictTarget.includes(column))
    .map((column) => `"${column}" = excluded."${column}"`)

  const values = []
  const groups = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      let value = row[column] ?? null
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        value = JSON.stringify(value)
      }
      values.push(value)
      return `$${rowIndex * columns.length + columnIndex + 1}`
    })
    return `(${placeholders.join(', ')})`
  })

  const sql = `
    insert into "${table}" (${quotedColumns.join(', ')})
    values ${groups.join(', ')}
    on conflict (${conflictTarget.map((column) => `"${column}"`).join(', ')})
    do ${updateAssignments.length ? `update set ${updateAssignments.join(', ')}` : 'nothing'}
  `

  await client.query(sql, values)
}

async function main() {
  const env = parseEnvFile('.env.vercel')
  const neon = new Client({
    connectionString: env.POSTGRES_URL || env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await neon.connect()
  await ensureSchema(neon)

  const [
    retailers,
    products,
    sessions,
    orders,
    events,
    flights,
    adminUsers,
    poursonaTeam,
  ] = await Promise.all([
    fetchSupabaseTable(env, 'retailers'),
    fetchSupabaseTable(env, 'products'),
    fetchSupabaseTable(env, 'sessions'),
    fetchSupabaseTable(env, 'orders'),
    fetchSupabaseTable(env, 'events'),
    fetchSupabaseTable(env, 'flights'),
    fetchSupabaseTable(env, 'admin_users'),
    fetchSupabaseTable(env, 'poursona_team'),
  ])

  const retailerById = new Map(retailers.map((row) => [row.id, row]))
  const hydratedAdminUsers = adminUsers.map((row) => ({
    ...row,
    email: row.email || retailerById.get(row.retailer_id)?.owner_email || null,
    clerk_user_id: row.clerk_user_id || null,
    user_id: row.user_id || null,
  }))

  await neon.query('begin')
  try {
    await upsertRows(neon, 'retailers', [
      'id', 'created_at', 'name', 'slug', 'vertical', 'location', 'tagline', 'logo_url',
      'brand_color', 'owner_email', 'stripe_customer_id', 'subscription_status',
      'subscription_tier', 'trial_ends_at', 'active', 'story', 'culture', 'region',
      'mission_statement', 'brand_voice', 'guest_welcome_message', 'recommendation_style',
      'hours',
    ], retailers, ['id'])

    await upsertRows(neon, 'products', [
      'id', 'created_at', 'updated_at', 'retailer_id', 'name', 'description', 'category',
      'flavor_notes', 'price', 'sizes', 'pairing', 'sku', 'in_stock', 'origin', 'process',
      'altitude', 'roast_date', 'abv', 'ibu', 'style', 'tap_handle', 'vintage',
      'appellation', 'varietal', 'cellar_note', 'sort_order', 'confidence_score', 'source_url',
    ], products, ['id'])

    await upsertRows(neon, 'sessions', [
      'id', 'created_at', 'retailer_id', 'customer_name', 'customer_email', 'messages',
      'blend_name', 'blend_data', 'recommended_at', 'order_status', 'order_id', 'order_total',
      'ordered_at', 'device_type', 'completed',
    ], sessions, ['id'])

    await upsertRows(neon, 'orders', [
      'id', 'created_at', 'session_id', 'retailer_id', 'customer_email', 'customer_name',
      'blend_name', 'items', 'subtotal', 'status', 'pos_order_id', 'notes',
    ], orders, ['id'])

    await upsertRows(neon, 'events', [
      'id', 'created_at', 'retailer_id', 'session_id', 'event_type', 'payload',
    ], events, ['id'])

    await upsertRows(neon, 'flights', [
      'id', 'created_at', 'retailer_id', 'name', 'description', 'count', 'pour_size',
      'price', 'active', 'sort_order',
    ], flights, ['id'])

    await upsertRows(neon, 'admin_users', [
      'id', 'created_at', 'user_id', 'retailer_id', 'role', 'clerk_user_id', 'email',
    ], hydratedAdminUsers, ['id'])

    await upsertRows(neon, 'poursona_team', [
      'id', 'created_at', 'email', 'name', 'role',
    ], poursonaTeam, ['id'])

    await neon.query('commit')
  } catch (error) {
    await neon.query('rollback')
    throw error
  } finally {
    await neon.end()
  }

  console.log(`Migrated ${retailers.length} retailers, ${products.length} products, ${sessions.length} sessions.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
