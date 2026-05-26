'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { loadAdminAccess, resetAdminAccessCache } from '@/lib/admin-access'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'D' },
  { href: '/admin/catalog', label: 'Catalog', icon: 'C' },
  { href: '/admin/flights', label: 'Flights', icon: 'F' },
  { href: '/admin/agent', label: 'Agent', icon: 'A' },
  { href: '/admin/orders', label: 'Orders', icon: 'O' },
  { href: '/admin/billing', label: 'Billing', icon: 'B' },
  { href: '/admin/settings', label: 'Settings', icon: 'S' },
]

const VERTICAL_ICONS: Record<string, string> = {
  brewery: 'B',
  winery: 'W',
  distillery: 'D',
  coffee: 'C',
}

type AdminShellState = 'bootstrapping' | 'ready' | 'no-retailers' | 'unauthorized'

function isAdminAuthPath(pathname: string) {
  return pathname.includes('/admin/login') || pathname.includes('/admin/auth')
}

function resolveRetailer(access: any, previousRetailer: any) {
  const retailers = Array.isArray(access?.retailers) ? access.retailers : []
  if (retailers.length === 0) {
    return null
  }

  const savedId =
    typeof window !== 'undefined'
      ? localStorage.getItem('poursona_active_retailer')
      : null

  if (savedId) {
    const savedRetailer = retailers.find((r: any) => r.id === savedId)
    if (savedRetailer) return savedRetailer
  }

  if (previousRetailer?.id) {
    const previous = retailers.find((r: any) => r.id === previousRetailer.id)
    if (previous) return previous
  }

  if (access?.defaultRetailerId) {
    const defaultRetailer = retailers.find((r: any) => r.id === access.defaultRetailerId)
    if (defaultRetailer) return defaultRetailer
  }

  return retailers[0]
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [allRetailers, setAllRetailers] = useState<any[]>([])
  const [retailer, setRetailer] = useState<any>(null)
  const [shellState, setShellState] = useState<AdminShellState>('bootstrapping')
  const [switching, setSwitching] = useState(false)
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null)
  const currentRequestIdRef = useRef(0)

  useEffect(() => {
    if (!isAdminAuthPath(pathname)) return

    currentRequestIdRef.current += 1
    bootstrapPromiseRef.current = null
    resetAdminAccessCache()
    setSwitching(false)
    setAllRetailers([])
    setRetailer(null)
    setShellState('bootstrapping')
  }, [pathname])

  useEffect(() => {
    if (isAdminAuthPath(pathname)) return
    if (bootstrapPromiseRef.current) return

    let cancelled = false
    const requestId = ++currentRequestIdRef.current

    const bootstrap = async () => {
      setShellState((current) => (current === 'ready' ? current : 'bootstrapping'))

      try {
        const access = await loadAdminAccess()
        if (cancelled || currentRequestIdRef.current !== requestId) return

        if (!access?.ok) {
          console.error('[admin/layout] admin access failed:', access)
          setShellState('unauthorized')
          return
        }

        const retailers = Array.isArray(access.retailers) ? access.retailers : []
        setAllRetailers(retailers)

        if (retailers.length === 0) {
          setRetailer(null)
          if (typeof window !== 'undefined') {
            localStorage.removeItem('poursona_active_retailer')
            sessionStorage.removeItem('active_retailer')
          }
          setShellState('no-retailers')
          return
        }

        setRetailer((previousRetailer: any) => {
          const nextRetailer = resolveRetailer(access, previousRetailer)
          if (nextRetailer && typeof window !== 'undefined') {
            localStorage.setItem('poursona_active_retailer', nextRetailer.id)
            sessionStorage.setItem('active_retailer', JSON.stringify(nextRetailer))
          }
          return nextRetailer
        })
        setShellState('ready')
      } catch (error) {
        if (cancelled || currentRequestIdRef.current !== requestId) return
        console.error('[admin/layout] bootstrap failed:', error)
        setShellState('unauthorized')
      } finally {
        if (!cancelled && currentRequestIdRef.current === requestId) {
          bootstrapPromiseRef.current = null
        }
      }
    }

    bootstrapPromiseRef.current = bootstrap()

    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (isAdminAuthPath(pathname)) return
    if (shellState !== 'unauthorized') return

    router.push('/admin/login')
  }, [pathname, router, shellState])

  function switchRetailer(r: any) {
    setRetailer(r)
    setSwitching(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('poursona_active_retailer', r.id)
      sessionStorage.setItem('active_retailer', JSON.stringify(r))
    }
    router.push('/admin')
  }

  function handleSignOut() {
    resetAdminAccessCache()
    window.location.href = '/admin/login'
  }

  if (isAdminAuthPath(pathname)) return <>{children}</>

  if (shellState === 'bootstrapping') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0603',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif' }}>Loading...</div>
      </div>
    )
  }

  if (shellState === 'unauthorized') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0603',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ color: '#F5ECD7', fontFamily: 'Georgia, serif' }}>
          Redirecting to admin login...
        </div>
      </div>
    )
  }

  const isTrial = retailer?.subscription_status === 'trial'
  const trialEnds = retailer?.trial_ends_at ? new Date(retailer.trial_ends_at) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080604', fontFamily: 'Georgia, serif' }}>
      <aside style={{ width: 224, flexShrink: 0, background: 'linear-gradient(180deg,#0d0904,#0a0603)', borderRight: '1px solid rgba(201,168,76,.12)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(201,168,76,.1)', position: 'relative' }}>
          <div style={{ color: '#C9A84C', fontSize: 9, letterSpacing: '.35em', textTransform: 'uppercase', marginBottom: 8 }}>Poursona</div>
          <button
            onClick={() => allRetailers.length > 1 && setSwitching(!switching)}
            style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, cursor: allRetailers.length > 1 ? 'pointer' : 'default', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{VERTICAL_ICONS[retailer?.vertical] || 'R'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F5ECD7', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {retailer?.name || 'Select Retailer'}
                </div>
                <div style={{ color: '#4a3a1a', fontSize: 10, marginTop: 1, textTransform: 'capitalize' }}>
                  {retailer?.vertical || ''} {retailer?.vertical ? '·' : ''} {retailer?.subscription_status || 'trial'}
                </div>
              </div>
              {allRetailers.length > 1 && <div style={{ color: '#4a3a1a', fontSize: 10 }}>v</div>}
            </div>
          </button>

          {switching && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#0e0b06', border: '1px solid rgba(201,168,76,.2)', borderTop: 'none', zIndex: 30, maxHeight: 240, overflowY: 'auto' }}>
              {allRetailers.map((r) => (
                <button
                  key={r.id}
                  onClick={() => switchRetailer(r)}
                  style={{ width: '100%', padding: '12px 16px', background: r.id === retailer?.id ? 'rgba(201,168,76,.1)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(201,168,76,.06)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <span style={{ fontSize: 16 }}>{VERTICAL_ICONS[r.vertical] || 'R'}</span>
                  <div>
                    <div style={{ color: r.id === retailer?.id ? '#C9A84C' : '#F5ECD7', fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: '#4a3a1a', fontSize: 10, textTransform: 'capitalize' }}>{r.vertical}</div>
                  </div>
                  {r.id === retailer?.id && <span style={{ marginLeft: 'auto', color: '#C9A84C', fontSize: 12 }}>OK</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {isTrial && daysLeft <= 7 && (
          <Link href="/admin/billing" style={{ margin: '10px 12px 0', padding: '10px 12px', background: daysLeft <= 3 ? 'rgba(255,100,100,.1)' : 'rgba(201,168,76,.08)', border: '1px solid ' + (daysLeft <= 3 ? 'rgba(255,100,100,.25)' : 'rgba(201,168,76,.2)'), borderRadius: 8, textDecoration: 'none', display: 'block' }}>
            <div style={{ color: daysLeft <= 3 ? '#e07070' : '#C9A84C', fontSize: 11, fontWeight: 700 }}>{daysLeft === 0 ? 'Trial expired' : daysLeft + 'd left in trial'}</div>
            <div style={{ color: '#4a3a1a', fontSize: 10, marginTop: 2 }}>Upgrade to keep access {'->'}</div>
          </Link>
        )}

        <nav style={{ flex: 1, padding: '14px 12px' }}>
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(201,168,76,.12)' : 'transparent', border: active ? '1px solid rgba(201,168,76,.2)' : '1px solid transparent', color: active ? '#C9A84C' : '#6a5a3a', textDecoration: 'none', fontSize: 13 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid rgba(201,168,76,.1)' }}>
          {retailer?.slug && (
            <a href={'/r/' + retailer.slug} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 6, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: '#6a5a3a', textDecoration: 'none', fontSize: 11 }}>
              <span>{'->'}</span> Preview Guide
            </a>
          )}
          {retailer?.slug && (
            <a href={'/api/qr?slug=' + retailer.slug + '&format=png'} download={'qr-' + retailer.slug + '.png'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 6, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: '#6a5a3a', textDecoration: 'none', fontSize: 11 }}>
              <span>QR</span> Download QR
            </a>
          )}
          <button onClick={handleSignOut} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid rgba(201,168,76,.1)', borderRadius: 8, color: '#4a3a1a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 11, textAlign: 'left' }}>
            {'<-'} Sign Out
          </button>
        </div>
      </aside>

      {switching && <div onClick={() => setSwitching(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}

      <main style={{ flex: 1, marginLeft: 224, padding: '32px 36px', overflowY: 'auto' as const }}>
        <div data-retailer-id={retailer?.id} data-retailer-slug={retailer?.slug}>
          {children}
        </div>
      </main>
    </div>
  )
}
