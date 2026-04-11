'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function TeamPage() {
  const [team, setTeam] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('staff')
  const [saving, setSaving] = useState(false)
  useEffect(() => { load() }, [])
  async function load() {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const res = await fetch('/api/poursona-admin/team-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: session.user.email }) })
    const json = await res.json()
    setTeam(json.team || [])
    setLoading(false)
  }
  async function addMember(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/poursona-admin/team-add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newEmail, name: newName, role: newRole }) })
    setNewEmail(''); setNewName(''); setNewRole('staff'); setAdding(false); setSaving(false); load()
  }
  async function removeMember(email: string) {
    if (!confirm('Remove ' + email + ' from the team?')) return
    await fetch('/api/poursona-admin/team-remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
    load()
  }
  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
          <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Team Members</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>These people have access to this portal.</div>
        </div>
        <button onClick={() => setAdding(true)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 8, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Member</button>
      </div>
      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>{['Name','Email','Role','Added',''].map(h => <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#4a3a1a', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>)}</tr></thead>
          <tbody>{team.map(m => (
            <tr key={m.id} style={{ borderBottom: '1px solid rgba(201,168,76,.05)' }}>
              <td style={{ padding: '14px 20px', color: '#F5ECD7', fontSize: 13 }}>{m.name || '—'}</td>
              <td style={{ padding: '14px 20px', color: '#C9A84C', fontSize: 13 }}>{m.email}</td>
              <td style={{ padding: '14px 20px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, background: m.role === 'owner' ? 'rgba(201,168,76,.15)' : 'rgba(255,255,255,.05)', color: m.role === 'owner' ? '#C9A84C' : '#6a5a3a' }}>{m.role}</span></td>
              <td style={{ padding: '14px 20px', color: '#4a3a1a', fontSize: 12 }}>{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
              <td style={{ padding: '14px 20px' }}>{m.role !== 'owner' && <button onClick={() => removeMember(m.email)} style={{ background: 'transparent', border: '1px solid rgba(255,100,100,.2)', borderRadius: 6, padding: '4px 11px', color: '#e07070', cursor: 'pointer', fontFamily: 'Georgia, serif', fontSize: 11 }}>Remove</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        {team.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No team members yet.</div>}
      </div>
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}>
          <div style={{ background: '#0e0b06', border: '1px solid rgba(201,168,76,.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ color: '#F5ECD7', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Add Team Member</div>
            <form onSubmit={addMember}>
              {[{ k: 'newEmail', l: 'Email *', t: 'email', v: newEmail, s: setNewEmail }, { k: 'newName', l: 'Name', t: 'text', v: newName, s: setNewName }].map(({ k, l, t, v, s }) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{l}</label>
                  <input type={t} value={v} onChange={e => s(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
              ))}
              <div style={{ marginBottom: 20 }}>
                <label style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#0e0b06', border: '1px solid rgba(201,168,76,.15)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 13, outline: 'none' }}>
                  <option value="staff">Staff</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" disabled={saving || !newEmail} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 8, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Adding…' : 'Add Member'}</button>
                <button type="button" onClick={() => setAdding(false)} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#6a5a3a', fontFamily: 'Georgia, serif', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}