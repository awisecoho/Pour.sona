import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type CheckResult = {
  key: string
  label: string
  ready: boolean
  error: string | null
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function createAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifyInternalMember(req: NextRequest, admin: SupabaseClient) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : ''
  if (!token) return null

  const authClient = createAuthClient()
  const { data, error } = await authClient.auth.getUser(token)
  const email = data.user?.email?.toLowerCase().trim()
  if (error || !email) return null

  const { data: member } = await admin
    .from('poursona_team')
    .select('email, role')
    .eq('email', email)
    .single()

  return member
}

async function checkTable(admin: SupabaseClient, table: string, label: string): Promise<CheckResult> {
  const { error } = await admin
    .from(table)
    .select('id', { head: true, count: 'exact' })
    .limit(1)

  return {
    key: table,
    label,
    ready: !error,
    error: error?.message || null,
  }
}

async function checkColumn(admin: SupabaseClient, table: string, column: string, label: string): Promise<CheckResult> {
  const { error } = await admin
    .from(table)
    .select(column, { head: true, count: 'exact' })
    .limit(1)

  return {
    key: `${table}.${column}`,
    label,
    ready: !error,
    error: error?.message || null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const member = await verifyInternalMember(req, admin)

    if (!member) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const checks = await Promise.all([
      checkTable(admin, 'vendor_intelligence', 'vendor_intelligence table exists'),
      checkTable(admin, 'vendor_events', 'vendor_events table exists'),
      checkColumn(admin, 'retailers', 'brand_voice', 'retailers.brand_voice exists'),
      checkColumn(admin, 'products', 'confidence_score', 'products.confidence_score exists'),
    ])

    return NextResponse.json({
      ok: true,
      ready: checks.every(check => check.ready),
      checkedAt: new Date().toISOString(),
      checks,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        ready: false,
        error: err instanceof Error ? err.message : 'system check failed',
      },
      { status: 500 }
    )
  }
}
