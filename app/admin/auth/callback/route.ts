import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get('code')
  if (code) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    await sb.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(new URL('/admin', req.url))
}