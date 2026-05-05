'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/poursona-admin', label: 'All Retailers', icon: 'â—ˆ' },
  { href: '/poursona-admin/onboard', label: 'Onboard New', icon: 'âœ¦' },
  { href: '/poursona-admin/team', label: 'Team', icon: 'â—Ž' },
]

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [member, setMember] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/poursona-admin/me', { cache: 'no-store' })
        const json = await res.json()
        if (!json.ok) {
          console.error('[poursona-admin/layout] member check failed:', json)
          router.push('/poursona-admin/login')
          setLoading(false)
          return
        }
        setMember(json.member)
        setLoading(false)
      } catch (error) {
        console.error('[poursona-admin/layout] member check failed:', error)
        router.push('/poursona-admin/login')
        setLoading(false)
      }
    }
    if (pathname.includes('/poursona-admin/login')) return
    check()
  }, [pathname, router])

  function handleSignOut() {
    window.location.href = '/poursona-admin/login'
  }

  if (pathname.includes('/poursona-admin/login')) return <>{children}</>
  if (loading) return <div style={{ minHeight: '100vh', background: '#060403', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif' }}>Verifying accessâ€¦</div></div>
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060403', fontFamily: 'Georgia, serif' }}>
      <aside style={{ width: 240, flexShrink: 0, background: 'linear-gradient(180deg,#0a0704,#060403)', borderRight: '1px solid rgba(201,168,76,.15)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '28px 24px', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
          <div style={{ color: '#C9A84C', fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700 }}>{member?.name || member?.email || 'Team'}</div>
          <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>{member?.role || 'staff'}</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(201,168,76,.12)' : 'transparent', border: active ? '1px solid rgba(201,168,76,.2)' : '1px solid transparent', color: active ? '#C9A84C' : '#6a5a3a', textDecoration: 'none', fontSize: 13 }}>
                <span>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(201,168,76,.1)' }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 8, background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.1)', color: '#6a5a3a', textDecoration: 'none', fontSize: 12 }}>âŠž My Vendor Portal</Link>
          <button onClick={handleSignOut} style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(201,168,76,.1)', borderRadius: 8, color: '#4a3a1a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, textAlign: 'left' }}>â† Sign Out</button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 240, padding: '32px 40px', overflowY: 'auto' as const }}>{children}</main>
    </div>
  )
}
