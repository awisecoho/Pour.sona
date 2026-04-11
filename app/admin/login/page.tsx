'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin/auth/callback` } })
    if (error) setError(error.message); else setSent(true)
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0a0603,#0d1a0f)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
          <div style={{ color: '#C9A84C', fontSize: 11, letterSpacing: '.4em', textTransform: 'uppercase' }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 22, fontWeight: 700, marginTop: 4 }}>Admin Portal</div>
        </div>
        {sent ? (
          <div style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📬</div>
            <div style={{ color: '#F5ECD7', fontSize: 17, marginBottom: 8 }}>Check your email</div>
            <div style={{ color: '#8a7a5a', fontSize: 14, lineHeight: 1.7 }}>Magic link sent to <strong style={{ color: '#C9A84C' }}>{email}</strong></div>
          </div>
        ) : (
          <form onSubmit={handle}>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 16, padding: '32px 24px' }}>
              <div style={{ color: '#8a7a5a', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>Enter your email to receive a sign-in link.</div>
              <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@yourbrewery.com" required style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 10, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
              {error && <div style={{ color: '#e07070', fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button type="submit" disabled={loading || !email} style={{ width: '100%', padding: '14px', background: email && !loading ? 'linear-gradient(135deg,#C9A84C,#a07830)' : 'rgba(201,168,76,.15)', border: 'none', borderRadius: 10, color: email && !loading ? '#0a0603' : '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, letterSpacing: '.15em', cursor: email && !loading ? 'pointer' : 'default' }}>
                {loading ? 'Sending…' : 'Send Magic Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}