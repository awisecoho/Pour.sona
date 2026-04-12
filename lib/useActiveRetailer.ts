// lib/useActiveRetailer.ts
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export function useActiveRetailer() {
  const [retailer, setRetailer] = useState<any>(null)
  const [retailerId, setRetailerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setLoading(false); return }

      // Check if layout stored active retailer in sessionStorage
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('active_retailer') : null
      if (stored) {
        try {
          const r = JSON.parse(stored)
          setRetailer(r)
          setRetailerId(r.id)
          setLoading(false)
          return
        } catch {}
      }

      // Fall back to first linked retailer
      const { data: au } = await sb
        .from('admin_users')
        .select('retailer_id, retailers(*)')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (au?.retailers) {
        setRetailer(au.retailers)
        setRetailerId(au.retailer_id)
        if (typeof window !== 'undefined') sessionStorage.setItem('active_retailer', JSON.stringify(au.retailers))
      }
      setLoading(false)
    }
    load()
  }, [])

  return { retailer, retailerId, loading }
}