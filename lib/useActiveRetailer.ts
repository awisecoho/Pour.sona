// lib/useActiveRetailer.ts
import { useEffect, useState } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'

export function useActiveRetailer() {
  const [retailer, setRetailer] = useState<any>(null)
  const [retailerId, setRetailerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const access = await loadAdminAccess()
      const retailers = access.retailers || []
      if (!access.ok || retailers.length === 0) { setLoading(false); return }

      const storedRetailerId = typeof window !== 'undefined' ? localStorage.getItem('poursona_active_retailer') : null
      if (storedRetailerId) {
        const matchedRetailer = retailers.find((r: any) => r.id === storedRetailerId)
        if (matchedRetailer) {
          setRetailer(matchedRetailer)
          setRetailerId(matchedRetailer.id)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('active_retailer', JSON.stringify(matchedRetailer))
          }
          setLoading(false)
          return
        }
      }

      const storedRetailer = typeof window !== 'undefined' ? sessionStorage.getItem('active_retailer') : null
      if (storedRetailer) {
        try {
          const parsedRetailer = JSON.parse(storedRetailer)
          const matchedRetailer = retailers.find((r: any) => r.id === parsedRetailer?.id)
          if (matchedRetailer) {
            setRetailer(matchedRetailer)
            setRetailerId(matchedRetailer.id)
            if (typeof window !== 'undefined') {
              localStorage.setItem('poursona_active_retailer', matchedRetailer.id)
            }
            setLoading(false)
            return
          }
        } catch {}
      }

      const firstRetailer = retailers[0]
      setRetailer(firstRetailer)
      setRetailerId(firstRetailer.id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('poursona_active_retailer', firstRetailer.id)
        sessionStorage.setItem('active_retailer', JSON.stringify(firstRetailer))
      }
      setLoading(false)
    }
    load()
  }, [])

  return { retailer, retailerId, loading }
}
