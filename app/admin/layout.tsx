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
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

        // Demo-first signup: if the vendor claimed a guide before creating their
        // Clerk account, publish the pending draft now using their real email.
        if (typeof window !== 'undefined') {
          const pendingDraftId = localStorage.getItem('pending_draft_id')
          if (pendingDraftId && access.email) {
            try {
              const finalizeRes = await fetch('/api/signup/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ draftId: pendingDraftId, email: access.email }),
              })
              if (finalizeRes.ok) {
                // Capture the retailer finalize just created so we can open THAT one,
                // not an arbitrary retailers[0] (which for multi-venue accounts is
                // some other venue — the cause of "landed on the wrong vendor").
                const finalizeJson = await finalizeRes.json().catch(() => null)
                const newRetailerId: string | null = finalizeJson?.retailer?.id || null
                localStorage.removeItem('pending_draft_id')
                // Pin the new venue BEFORE reloading access so resolveRetailer picks it.
                if (newRetailerId) localStorage.setItem('poursona_active_retailer', newRetailerId)
                // Bust the access cache so the new retailer appears
                resetAdminAccessCache()
                const freshAccess = await loadAdminAccess()
                if (cancelled || currentRequestIdRef.current !== requestId) return
                if (freshAccess?.ok) {
                  const freshRetailers = Array.isArray(freshAccess.retailers) ? freshAccess.retailers : []
                  setAllRetailers(freshRetailers)
                  // Prefer the just-created venue; fall back to first only if not found.
                  const newRetailer = freshRetailers.find((r: any) => r.id === newRetailerId) || freshRetailers[0] || null
                  setRetailer(newRetailer)
                  if (newRetailer?.id) localStorage.setItem('poursona_active_retailer', newRetailer.id)
                  setShellState(freshRetailers.length > 0 ? 'ready' : 'no-retailers')
                  return
                }
              } else {
                // Non-fatal: log but don't block the dashboard
                console.error('[admin/layout] pending draft finalize failed:', await finalizeRes.text())
                localStorage.removeItem('pending_draft_id')
              }
            } catch (err) {
              console.error('[admin/layout] pending draft finalize error:', err)
              localStorage.removeItem('pending_draft_id')
            }
          }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('poursona_active_retailer')
      sessionStorage.removeItem('active_retailer')
    }
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

  if (shellState === 'no-retailers') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0603',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✦</div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 8 }}>Account not found</div>
          <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>No venue linked to this account</div>
          <div style={{ color: '#6a5a3a', fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>
            The email you signed in with is not linked to any Poursona venue.
            This can happen if you used a different email than the one you signed up with.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a href="/signup" style={{ padding: '13px 24px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', borderRadius: 10, color: '#060403', fontWeight: 700, fontSize: 14, textDecoration: 'none', display: 'block' }}>
              Create a new venue →
            </a>
            <button
              onClick={handleSignOut}
              style={{ padding: '12px 24px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 10, color: '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 13, cursor: 'pointer' }}
            >
              Sign in with a different account
            </button>
            <a href="mailto:hello@pour-sona.com" style={{ color: '#4a3a1a', fontSize: 12, textDecoration: 'none', marginTop: 4 }}>
              Need help? hello@pour-sona.com
            </a>
          </div>
        </div>
      </div>
    )
  }

  const isTrial = retailer?.subscription_status === 'trial'
  const trialEnds = retailer?.trial_ends_at ? new Date(retailer.trial_ends_at) : null
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)) : 0

  const sidebarContent = (
    <>
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
                onClick={() => { switchRetailer(r); setSidebarOpen(false) }}
                style={{ width: '100%', padding: '12px 16px', background: r.id === retailer?.id ? 'rgba(201,168,76,.1)' : 'transparent', border: 'none', borderBottom: '1px solid rgba(201,168,76,.06)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontSize: 16 }}>{VERTICAL_ICONS[r.vertical] || 'R'}</span>
                <div>
                  <div style={{ color: r.id === retailer?.id ? '#C9A84C' : '#F5ECD7', fontSize: 12, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ color: '#4a3a1a', fontSize: 10, textTransform: 'capitalize' }}>{r.vertical}</div>
                </div>
                {r.id === retailer?.id && <span style={{ marginLeft: 'auto', color: '#C9A84C', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {isTrial && daysLeft <= 7 && (
        <Link href="/admin/billing" style={{ margin: '10px 12px 0', padding: '10px 12px', background: daysLeft <= 3 ? 'rgba(255,100,100,.1)' : 'rgba(201,168,76,.08)', border: '1px solid ' + (daysLeft <= 3 ? 'rgba(255,100,100,.25)' : 'rgba(201,168,76,.2)'), borderRadius: 8, textDecoration: 'none', display: 'block' }}>
          <div style={{ color: daysLeft <= 3 ? '#e07070' : '#C9A84C', fontSize: 11, fontWeight: 700 }}>{daysLeft === 0 ? 'Trial expired' : daysLeft + 'd left in trial'}</div>
          <div style={{ color: '#4a3a1a', fontSize: 10, marginTop: 2 }}>Upgrade to keep access →</div>
        </Link>
      )}

      <nav style={{ flex: 1, padding: '14px 12px' }}>
        {NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(201,168,76,.12)' : 'transparent', border: active ? '1px solid rgba(201,168,76,.2)' : '1px solid transparent', color: active ? '#C9A84C' : '#6a5a3a', textDecoration: 'none', fontSize: 14 }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid rgba(201,168,76,.1)' }}>
        {retailer?.slug && (
          <a href={'/r/' + retailer.slug} target="_blank" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: '#6a5a3a', textDecoration: 'none', fontSize: 12 }}>
            → Preview Guide
          </a>
        )}
        {retailer?.slug && (
          <a href={'/api/qr?slug=' + retailer.slug + '&format=png'} download={'qr-' + retailer.slug + '.png'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.12)', color: '#6a5a3a', textDecoration: 'none', fontSize: 12 }}>
            QR Download
          </a>
        )}
        <button onClick={handleSignOut} style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid rgba(201,168,76,.1)', borderRadius: 8, color: '#4a3a1a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, textAlign: 'left' }}>
          ← Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080604', fontFamily: 'Georgia, serif' }}>
      <style>{`
        /* Desktop: fixed sidebar, main has left margin */
        .admin-sidebar {
          width: 224px; flex-shrink: 0;
          background: linear-gradient(180deg,#0d0904,#0a0603);
          border-right: 1px solid rgba(201,168,76,.12);
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 20;
          transition: transform 0.25s ease;
        }
        .admin-topbar { display: none; }
        .admin-main { flex: 1; margin-left: 224px; padding: 32px 36px; overflow-y: auto; min-width: 0; }
        .admin-overlay { display: none; }

        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
            width: 280px;
            box-shadow: 4px 0 24px rgba(0,0,0,.5);
          }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-topbar {
            display: flex; align-items: center; justify-content: space-between;
            position: fixed; top: 0; left: 0; right: 0; height: 52px; z-index: 19;
            background: #0d0904; border-bottom: 1px solid rgba(201,168,76,.12);
            padding: 0 16px;
          }
          .admin-main { margin-left: 0; padding: 72px 16px 24px; }
          .admin-overlay { display: block; position: fixed; inset: 0; z-index: 18; background: rgba(0,0,0,.6); }
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="admin-topbar">
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ background: 'none', border: 'none', color: '#C9A84C', cursor: 'pointer', padding: '8px 4px', fontSize: 20, lineHeight: 1 }}
          aria-label="Open menu"
        >☰</button>
        <div style={{ color: '#C9A84C', fontSize: 13, fontWeight: 700, letterSpacing: '.05em' }}>
          {retailer?.name || 'Poursona'}
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay — tap to close sidebar */}
      {sidebarOpen && (
        <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop switching overlay */}
      {switching && !sidebarOpen && <div onClick={() => setSwitching(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}

      <main className="admin-main">
        <div data-retailer-id={retailer?.id} data-retailer-slug={retailer?.slug}>
          {children}
        </div>
      </main>
    </div>
  )
}
