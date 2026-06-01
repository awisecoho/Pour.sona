'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/poursona-admin', label: 'All Retailers', icon: '◈' },
  { href: '/poursona-admin/onboard', label: 'Onboard New', icon: '✦' },
  { href: '/poursona-admin/team', label: 'Team', icon: '◎' },
]

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [member, setMember] = useState<any>(null)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/poursona-admin/me', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          console.error('[poursona-admin/layout] member check failed:', json)
          if (json.error === 'forbidden') {
            setMessage('This Clerk account is not linked to a CuvAi internal team member.')
          } else {
            setMember(null)
            setMemberRole(null)
            router.push('/poursona-admin/login')
          }
          setLoading(false)
          return
        }
        setMember(json.user || null)
        setMemberRole(json.role || null)
        setMessage(null)
        setLoading(false)
      } catch (error) {
        console.error('[poursona-admin/layout] member check failed:', error)
        setMember(null)
        setMemberRole(null)
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
  if (loading) return <div style={{ minHeight: '100vh', background: '#0C1018', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#3FC6D4', fontFamily: "'Space Grotesk', sans-serif" }}>Verifying access…</div></div>
  if (message) return <div style={{ minHeight: '100vh', background: '#0C1018', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}><div style={{ color: '#E8EDF2', fontFamily: "'Space Grotesk', sans-serif", maxWidth: 420, textAlign: 'center' }}>{message}</div></div>
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0C1018', fontFamily: "'Space Grotesk', sans-serif" }}>
      <aside style={{ width: 240, flexShrink: 0, background: 'linear-gradient(180deg,#0a0704,#0C1018)', borderRight: '1px solid rgba(63,198,212,.15)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '28px 24px', borderBottom: '1px solid rgba(63,198,212,.1)' }}>
          <div style={{ color: '#3FC6D4', fontSize: 9, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4 }}>CuvAi Internal</div>
          <div style={{ color: '#E8EDF2', fontSize: 15, fontWeight: 700 }}>{member?.name || member?.email || 'Team'}</div>
          <div style={{ color: '#3A4456', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>{memberRole || 'staff'}</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(63,198,212,.12)' : 'transparent', border: active ? '1px solid rgba(63,198,212,.2)' : '1px solid transparent', color: active ? '#3FC6D4' : '#6B7588', textDecoration: 'none', fontSize: 13 }}>
                <span>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(63,198,212,.1)' }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 8, background: 'rgba(63,198,212,.05)', border: '1px solid rgba(63,198,212,.1)', color: '#6B7588', textDecoration: 'none', fontSize: 12 }}>⊞ My Vendor Portal</Link>
          <button onClick={handleSignOut} style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(63,198,212,.1)', borderRadius: 8, color: '#3A4456', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, textAlign: 'left' }}>← Sign Out</button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 240, padding: '32px 40px', overflowY: 'auto' as const }}>{children}</main>
    </div>
  )
}
