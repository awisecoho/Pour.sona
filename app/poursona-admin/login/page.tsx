'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function InternalLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function handle(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    // First check if team member
    const check = await fetch('/api/poursona-admin/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    const json = await check.json()
    if (!json.ok) { setError('Access denied. This portal is for Poursona team members only.'); setLoading(false); return }
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/poursona-admin' } })
    if (error) setError(error.message); else setSent(true)
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#060403,#0a0704)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.4em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona</div>
          <div style={{ color: '#F5ECD7', fontSize: 20, fontWeight: 700 }}>Internal Portal</div>
          <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 4 }}>Team access only</div>
        </div>
        {sent ? (
          <div style={{ background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.3)', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📬</div>
            <div style={{ color: '#F5ECD7', fontSize: 16, marginBottom: 8 }}>Magic link sent</div>
            <div style={{ color: '#6a5a3a', fontSize: 13 }}>Check <strong style={{ color: '#C9A84C' }}>{email}</strong></div>
          </div>
        ) : (
          <form onSubmit={handle}>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 16, padding: '28px 24px' }}>
              <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Team Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@poursona.app" required style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 9, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 16 }} />
              {error && <div style={{ color: '#e07070', fontSize: 12, marginBottom: 14 }}>{error}</div>}
              <button type="submit" disabled={loading || !email} style={{ width: '100%', padding: '13px', background: email && !loading ? 'linear-gradient(135deg,#C9A84C,#a07830)' : 'rgba(201,168,76,.12)', border: 'none', borderRadius: 9, color: email && !loading ? '#060403' : '#4a3a1a', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, letterSpacing: '.15em', cursor: email && !loading ? 'pointer' : 'default' }}>
                {loading ? 'Checking…' : 'Sign In'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}