'use client'
import { useEffect, useState } from 'react'

interface PlatformStatus { id: string; label: string; icon: string; configured: boolean; note: string }
interface Account {
  id: string; platform: string; display_name: string | null; avatar_url: string | null
  status: string; selected: boolean; connected_by: string | null; connected_at: string | null
}

const card: React.CSSProperties = { background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, padding: '20px', marginBottom: 16 }
const label: React.CSSProperties = { color: '#3FC6D4', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 8, color: '#E8EDF2', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box' }

const PLATFORM_ICON: Record<string, string> = { facebook: '📘', instagram: '📷', linkedin: '💼', twitter: '𝕏' }

export default function SocialAccounts() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [postResults, setPostResults] = useState<{ platform: string; ok: boolean; detail: string }[]>([])

  async function load() {
    const res = await fetch('/api/poursona-admin/social-accounts', { cache: 'no-store' }).catch(() => null)
    if (res?.ok) {
      const j = await res.json()
      setPlatforms(j.platforms || [])
      setAccounts(j.accounts || [])
      if (j.warning) setBanner({ kind: 'err', msg: j.warning })
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Surface ?connected= / ?error= from the OAuth round-trip
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('connected')) setBanner({ kind: 'ok', msg: `Connected ${p.get('connected')} ✓` })
    else if (p.get('error')) {
      const e = p.get('error'); const plat = p.get('platform')
      const msg = e === 'not_configured'
        ? `${plat} isn't configured yet — set its API credentials in the environment.`
        : `Connection failed (${e}${plat ? `, ${plat}` : ''}).`
      setBanner({ kind: 'err', msg })
    }
    if (p.get('connected') || p.get('error')) {
      window.history.replaceState({}, '', '/poursona-admin')
    }
  }, [])

  async function addManual(platform: string) {
    if (!addName.trim()) return
    const res = await fetch('/api/poursona-admin/social-accounts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, displayName: addName.trim(), profileUrl: addUrl.trim() || null }),
    })
    if (res.ok) { setAddFor(null); setAddName(''); setAddUrl(''); load() }
  }

  async function toggle(id: string, selected: boolean) {
    setAccounts(a => a.map(x => x.id === id ? { ...x, selected } : x))
    await fetch('/api/poursona-admin/social-accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, selected }) })
  }

  async function disconnect(id: string) {
    await fetch('/api/poursona-admin/social-accounts?id=' + id, { method: 'DELETE' })
    setAccounts(a => a.filter(x => x.id !== id))
  }

  async function post() {
    const ids = accounts.filter(a => a.selected).map(a => a.id)
    if (!composeBody.trim() || ids.length === 0) return
    setPosting(true); setPostResults([])
    const res = await fetch('/api/poursona-admin/social/post', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: composeBody.trim(), accountIds: ids }),
    })
    const j = await res.json().catch(() => ({}))
    setPostResults(j.results || [{ platform: '', ok: false, detail: j.error || 'post failed' }])
    setPosting(false)
  }

  if (loading) return <div style={{ color: '#8A95A5' }}>Loading social accounts…</div>

  const selectedCount = accounts.filter(a => a.selected).length

  return (
    <div>
      {banner && (
        <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13,
          background: banner.kind === 'ok' ? 'rgba(94,207,138,.1)' : 'rgba(255,100,100,.08)',
          border: '1px solid ' + (banner.kind === 'ok' ? 'rgba(94,207,138,.3)' : 'rgba(255,100,100,.25)'),
          color: banner.kind === 'ok' ? '#5ecf8a' : '#e07070' }}>
          {banner.msg}
        </div>
      )}

      {/* Connect platforms */}
      <div style={card}>
        <div style={{ color: '#E8EDF2', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Link Accounts</div>
        <div style={{ color: '#8A95A5', fontSize: 12, marginBottom: 16 }}>Connect via OAuth to enable posting, or add an account manually to track &amp; select it for research.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {platforms.map(p => (
            <div key={p.id} style={{ border: '1px solid rgba(63,198,212,.15)', borderRadius: 10, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ color: '#E8EDF2', fontSize: 14, fontWeight: 700 }}>{p.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#8A95A5', lineHeight: 1.5, marginBottom: 10, minHeight: 32 }}>
                {p.configured ? p.note : `Not configured — set API credentials to enable OAuth. ${p.note}`}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {p.configured ? (
                  <a href={'/api/poursona-admin/social/connect/' + p.id}
                    style={{ flex: 1, textAlign: 'center', padding: '9px 0', background: 'linear-gradient(135deg,#3FC6D4,#2A9BA8)', borderRadius: 8, color: '#0C1018', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                    Connect →
                  </a>
                ) : (
                  <span style={{ flex: 1, textAlign: 'center', padding: '9px 0', background: 'rgba(255,255,255,.04)', borderRadius: 8, color: '#6B7588', fontSize: 12 }}>Not configured</span>
                )}
                <button onClick={() => { setAddFor(addFor === p.id ? null : p.id); setAddName(''); setAddUrl('') }}
                  style={{ padding: '9px 12px', background: 'rgba(63,198,212,.08)', border: '1px solid rgba(63,198,212,.2)', borderRadius: 8, color: '#3FC6D4', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
                  + Add
                </button>
              </div>
              {addFor === p.id && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Account name / handle" style={inp} />
                  <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="Profile URL (optional)" style={inp} />
                  <button onClick={() => addManual(p.id)} style={{ padding: '8px', background: 'rgba(94,207,138,.12)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 8, color: '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>Save account</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Linked accounts + multi-select */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ color: '#E8EDF2', fontSize: 14, fontWeight: 700 }}>Linked Accounts ({accounts.length})</div>
          <div style={{ color: '#8A95A5', fontSize: 12 }}>{selectedCount} selected</div>
        </div>
        {accounts.length === 0 ? (
          <div style={{ color: '#8A95A5', fontSize: 13 }}>No accounts yet. Connect or add one above.</div>
        ) : accounts.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(63,198,212,.06)' }}>
            <input type="checkbox" checked={a.selected} onChange={e => toggle(a.id, e.target.checked)} style={{ width: 16, height: 16, accentColor: '#3FC6D4', cursor: 'pointer' }} />
            <span style={{ fontSize: 18 }}>{PLATFORM_ICON[a.platform] || '🔗'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#E8EDF2', fontSize: 14 }}>{a.display_name || a.platform}</div>
              <div style={{ color: '#8A95A5', fontSize: 11, textTransform: 'capitalize' }}>{a.platform}</div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11,
              background: a.status === 'connected' ? 'rgba(94,207,138,.12)' : 'rgba(63,198,212,.1)',
              color: a.status === 'connected' ? '#5ecf8a' : '#3FC6D4',
              border: '1px solid ' + (a.status === 'connected' ? 'rgba(94,207,138,.3)' : 'rgba(63,198,212,.25)') }}>
              {a.status === 'connected' ? 'OAuth' : 'manual'}
            </span>
            <button onClick={() => disconnect(a.id)} style={{ background: 'none', border: 'none', color: '#e07070', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>×</button>
          </div>
        ))}
      </div>

      {/* Compose & post */}
      <div style={card}>
        <div style={{ color: '#E8EDF2', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Compose &amp; Post</div>
        <div style={{ color: '#8A95A5', fontSize: 12, marginBottom: 12 }}>Publishes to the {selectedCount} selected account{selectedCount !== 1 ? 's' : ''}. Manual (non-OAuth) accounts are skipped with a reason.</div>
        <textarea value={composeBody} onChange={e => setComposeBody(e.target.value)} rows={4} placeholder="What do you want to share?" style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
        <button onClick={post} disabled={posting || selectedCount === 0 || !composeBody.trim()}
          style={{ padding: '12px 22px', borderRadius: 8, border: 'none', cursor: posting || selectedCount === 0 ? 'not-allowed' : 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, background: selectedCount === 0 ? 'rgba(63,198,212,.3)' : 'linear-gradient(135deg,#3FC6D4,#2A9BA8)', color: '#0C1018', opacity: posting ? .6 : 1 }}>
          {posting ? 'Posting…' : `Post to ${selectedCount} selected →`}
        </button>
        {postResults.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {postResults.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: r.ok ? '#5ecf8a' : '#e07070' }}>
                {r.ok ? '✓' : '✕'} {r.platform || 'error'}: {r.detail}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
