'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); setLoading(false) }
    else router.push('/admin')
  }
  const inp = { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 10, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const }
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase' }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginTop: 4 }}>Admin Portal</div>
        </div>
        <form onSubmit={handle}>
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 16, padding: '28px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbrewery.com" required autoComplete="email" style={inp} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required autoComplete="current-password" style={{ ...inp, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4a3a1a', cursor: 'pointer', fontSize: 14 }}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
            {error && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 16, padding: '10px 12px', background: 'rgba(255,100,100,.08)', borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading || !email || !password} style={{ width: '100%', padding: '14px', background: email && password && !loading ? 'linear-gradient(135deg,#C9A84C,#a07830)' : 'rgba(201,168,76,.15)', border: 'none', borderRadius: 10, color: email && password && !loading ? '#0a0603' : '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, letterSpacing: '.15em', cursor: email && password && !loading ? 'pointer' : 'default' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}