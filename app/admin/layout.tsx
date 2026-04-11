'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/catalog', label: 'Catalog', icon: '☰' },
  { href: '/admin/flights', label: 'Flights', icon: '✦' },
  { href: '/admin/orders', label: 'Orders', icon: '◎' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
]
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [retailer, setRetailer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function init() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { if (!pathname.includes('/admin/login')) router.push('/admin/login'); setLoading(false); return }
      const { data: au } = await sb.from('admin_users').select('retailer_id, retailers(*)').eq('user_id', session.user.id).single()
      if (au?.retailers) setRetailer(au.retailers)
      setLoading(false)
    }
    init()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/admin/login')
      if (event === 'SIGNED_IN' && pathname.includes('/admin/login')) router.push('/admin')
    })
    return () => subscription.unsubscribe()
  }, [])
  if (pathname.includes('/admin/login') || pathname.includes('/admin/auth')) return <>{children}</>
  if (loading) return <div style={{ minHeight: '100vh', background: '#0a0603', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#C9A84C', fontFamily: 'Georgia, serif' }}>Loading…</div></div>
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080604', fontFamily: 'Georgia, serif' }}>
      <aside style={{ width: 220, flexShrink: 0, background: 'linear-gradient(180deg,#0d0904,#0a0603)', borderRight: '1px solid rgba(201,168,76,.12)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 }}>
        <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
          <div style={{ color: '#C9A84C', fontSize: 9, letterSpacing: '.35em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 15, fontWeight: 700 }}>{retailer?.name || 'Admin'}</div>
          <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2, textTransform: 'capitalize' }}>{retailer?.vertical || ''}</div>
        </div>
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV.map(item => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(201,168,76,.12)' : 'transparent', border: active ? '1px solid rgba(201,168,76,.2)' : '1px solid transparent', color: active ? '#C9A84C' : '#6a5a3a', textDecoration: 'none', fontSize: 13 }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(201,168,76,.1)' }}>
          {retailer?.slug && <a href={'/api/qr?slug=' + retailer.slug + '&format=png'} download={'qr-' + retailer.slug + '.png'} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, marginBottom: 8, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.15)', color: '#8a7a5a', textDecoration: 'none', fontSize: 12 }}><span>⊞</span> Download QR</a>}
          <button onClick={() => sb.auth.signOut()} style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: '1px solid rgba(201,168,76,.1)', borderRadius: 8, color: '#4a3a1a', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 12, textAlign: 'left' }}>← Sign Out</button>
        </div>
      </aside>
      <main style={{ flex: 1, marginLeft: 220, padding: '32px 36px', overflowY: 'auto' }}>{children}</main>
    </div>
  )
}