'use client'

import { createClient } from '@supabase/supabase-js'

let browserSupabase: ReturnType<typeof createClient> | null = null

export function getBrowserSupabase() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase browser client requested on the server')
  }

  if (!browserSupabase) {
    browserSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserSupabase
}
