/**
 * Saved-leads CRM panel inside /poursona-admin.
 *
 * Left column: filterable list of saved leads with status badges + counts.
 * Right column (when one is selected): editable detail + activity timeline.
 *
 * Built as a controlled component (no router push) so the user stays in the
 * Leads tab regardless of which lead they're inspecting.
 */
'use client'
import { useEffect, useState } from 'react'

const BRAND = {
  bg: '#0a0a08', surface: '#111110', card: '#181816', border: '#2a2a26',
  accent: '#c8a96e', accentDim: '#8a6f3e', text: '#e8e4dc', muted: '#7a7568',
  hop: '#4a7c4e', warm: '#c8743a', red: '#c84a4a',
}

const STATUS_OPTIONS = [
  { value: 'new',             label: 'New' },
  { value: 'contacted',       label: 'Contacted' },
  { value: 'replied',         label: 'Replied' },
  { value: 'demo_scheduled',  label: 'Demo Scheduled' },
  { value: 'qualified',       label: 'Qualified' },
  { value: 'closed_won',      label: 'Closed (Won)' },
  { value: 'closed_lost',     label: 'Closed (Lost)' },
] as const

const STATUS_COLOR: Record<string, string> = {
  new: BRAND.muted,
  contacted: BRAND.accent,
  replied: BRAND.warm,
  demo_scheduled: '#7a8ec8',
  qualified: BRAND.hop,
  closed_won: BRAND.hop,
  closed_lost: BRAND.red,
}

interface Lead {
  id: string
  name: string
  url: string
  vertical: string | null
  location: string | null
  score: string | null
  reason: string | null
  has_menu: boolean
  has_ordering: boolean
  has_tasting_room: boolean
  email: string | null
  contact_url: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  twitter: string | null
  subject: string | null
  message: string | null
  status: string
  notes: string | null
  saved_by_email: string | null
  saved_at: string
  updated_at: string
}

interface Activity {
  id: string
  type: string
  body: string | null
  payload: Record<string, unknown> | null
  created_by_email: string | null
  created_at: string
}

export default function LeadsManager() {
  const [leads, setLeads]   = useState<Lead[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<string>('')        // '' = all
  const [q, setQ]           = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => { void loadLeads() }, [status])

  async function loadLeads() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (q)      params.set('q', q)
      const res = await fetch('/api/poursona-admin/leads?' + params, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.ok) {
        setLeads(json.leads || [])
        setCounts(json.counts || {})
      }
    } finally { setLoading(false) }
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') void loadLeads()
  }

  const totalCount = Object.values(counts).reduce((s, n) => s + Number(n), 0)
  const selected = leads.find(l => l.id === selectedId) || null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.4fr' : '1fr', gap: 20 }}>
      <div>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setStatus('')}
            style={chipStyle(status === '')}
          >All · {totalCount}</button>
          {STATUS_OPTIONS.map(s => {
            const n = counts[s.value] || 0
            if (n === 0 && status !== s.value) return null
            return (
              <button key={s.value} onClick={() => setStatus(s.value)} style={chipStyle(status === s.value, STATUS_COLOR[s.value])}>
                {s.label} · {n}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 14 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Search name, email, or URL — press Enter"
            style={{ width: '100%', background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 2, padding: '10px 12px', color: BRAND.text, fontSize: 13, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {loading && <div style={{ color: BRAND.muted, fontSize: 13 }}>Loading leads…</div>}
        {!loading && leads.length === 0 && (
          <div style={{ color: BRAND.muted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            No saved leads yet. Run the Pipeline tab and click <strong style={{ color: BRAND.accent }}>＋ Save Lead</strong> on any prospect.
          </div>
        )}

        {!loading && leads.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leads.map(l => (
              <LeadRow key={l.id} lead={l} active={l.id === selectedId} onClick={() => setSelectedId(l.id === selectedId ? null : l.id)} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <LeadDetail
          key={selected.id}
          leadId={selected.id}
          onUpdated={(updated) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
            // Status counts may have shifted; reload counts only.
            void loadLeads()
          }}
          onDeleted={(id) => {
            setLeads(prev => prev.filter(l => l.id !== id))
            setSelectedId(null)
            void loadLeads()
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LeadRow({ lead, active, onClick }: { lead: Lead; active: boolean; onClick: () => void }) {
  const color = STATUS_COLOR[lead.status] || BRAND.muted
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: active ? 'rgba(200,169,110,.08)' : BRAND.card,
        border: `1px solid ${active ? BRAND.accent : BRAND.border}`, borderRadius: 2,
        padding: '12px 14px', cursor: 'pointer', fontFamily: 'Georgia, serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <span style={{ color: BRAND.text, fontSize: 14, fontWeight: 600 }}>{lead.name}</span>
        <span style={{ color, fontSize: 10, fontFamily: 'monospace', letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {lead.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div style={{ color: BRAND.muted, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 3 }}>{lead.url}</div>
      <div style={{ display: 'flex', gap: 10, color: BRAND.muted, fontSize: 11 }}>
        {lead.email && <span>✉ {lead.email}</span>}
        {lead.vertical && <span style={{ textTransform: 'capitalize' }}>{lead.vertical}</span>}
        <span style={{ marginLeft: 'auto' }}>{new Date(lead.saved_at).toLocaleDateString()}</span>
      </div>
    </button>
  )
}

function LeadDetail({ leadId, onUpdated, onDeleted, onClose }: {
  leadId: string
  onUpdated: (l: Lead) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [savingField, setSavingField] = useState<string | null>(null)
  const [emailDraft, setEmailDraft] = useState('')
  const [notesDraft, setNotesDraft] = useState('')
  const [noteInput, setNoteInput]   = useState('')
  const [postingNote, setPostingNote] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/poursona-admin/leads/${leadId}`, { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled && res.ok && json.ok) {
          setLead(json.lead)
          setActivities(json.activities || [])
          setEmailDraft(json.lead.email || '')
          setNotesDraft(json.lead.notes || '')
        }
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [leadId])

  async function patch(updates: Record<string, unknown>, fieldLabel: string) {
    setSavingField(fieldLabel)
    try {
      const res = await fetch(`/api/poursona-admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setLead(json.lead)
        onUpdated(json.lead)
        // Reload activities to surface auto-logged status/contact changes.
        void reloadActivities()
      }
    } finally { setSavingField(null) }
  }

  async function reloadActivities() {
    const res = await fetch(`/api/poursona-admin/leads/${leadId}`, { cache: 'no-store' })
    const json = await res.json()
    if (res.ok && json.ok) setActivities(json.activities || [])
  }

  async function addNote() {
    if (!noteInput.trim()) return
    setPostingNote(true)
    try {
      const res = await fetch(`/api/poursona-admin/leads/${leadId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', body: noteInput.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.ok) {
        setActivities(prev => [json.activity, ...prev])
        setNoteInput('')
      }
    } finally { setPostingNote(false) }
  }

  async function deleteLead() {
    if (!confirm('Delete this lead and all its activity history?')) return
    const res = await fetch(`/api/poursona-admin/leads/${leadId}`, { method: 'DELETE' })
    if (res.ok) onDeleted(leadId)
  }

  if (loading || !lead) {
    return (
      <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 2, padding: 20, color: BRAND.muted, fontSize: 13 }}>
        Loading lead…
      </div>
    )
  }

  return (
    <div style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: 2, padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: BRAND.text, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{lead.name}</div>
          <a href={lead.url} target="_blank" rel="noopener noreferrer" style={{ color: BRAND.muted, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', textDecoration: 'none' }}>{lead.url}</a>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: BRAND.muted, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
      </div>

      {/* Status selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: 6 }}>Status</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s.value}
              onClick={() => patch({ status: s.value }, 'status')}
              disabled={savingField === 'status'}
              style={{
                padding: '6px 10px', borderRadius: 2, fontSize: 11, fontFamily: 'monospace',
                background: lead.status === s.value ? STATUS_COLOR[s.value] : 'transparent',
                color: lead.status === s.value ? BRAND.bg : BRAND.muted,
                border: `1px solid ${lead.status === s.value ? STATUS_COLOR[s.value] : BRAND.border}`,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email — editable inline */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={emailDraft}
            onChange={e => setEmailDraft(e.target.value)}
            placeholder="contact@business.com"
            style={inputStyle()}
          />
          <button
            onClick={() => patch({ email: emailDraft.trim() || null }, 'email')}
            disabled={savingField === 'email' || emailDraft === (lead.email || '')}
            style={btnPrimary(savingField === 'email' || emailDraft === (lead.email || ''))}
          >
            {savingField === 'email' ? '…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: 6 }}>Notes</div>
        <textarea
          value={notesDraft}
          onChange={e => setNotesDraft(e.target.value)}
          rows={3}
          placeholder="Internal notes about this lead — context, follow-up dates, gotchas…"
          style={{ ...inputStyle(), resize: 'vertical', minHeight: 70 }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            onClick={() => patch({ notes: notesDraft }, 'notes')}
            disabled={savingField === 'notes' || notesDraft === (lead.notes || '')}
            style={btnPrimary(savingField === 'notes' || notesDraft === (lead.notes || ''))}
          >
            {savingField === 'notes' ? '…' : 'Save Notes'}
          </button>
        </div>
      </div>

      {/* Activity log */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: 6 }}>Activity</div>

        {/* Add note */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void addNote() }}
            placeholder='Log an activity — "Sent follow-up", "Called Tuesday", etc.'
            style={inputStyle()}
          />
          <button onClick={addNote} disabled={postingNote || !noteInput.trim()} style={btnPrimary(postingNote || !noteInput.trim())}>
            {postingNote ? '…' : '＋ Log'}
          </button>
        </div>

        {/* Timeline */}
        {activities.length === 0 ? (
          <div style={{ color: BRAND.muted, fontSize: 12, fontStyle: 'italic' }}>No activity yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map(a => (
              <div key={a.id} style={{ padding: '10px 12px', background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 10 }}>
                  <span style={{ color: BRAND.accent, fontSize: 10, fontFamily: 'monospace', letterSpacing: '.1em', textTransform: 'uppercase' }}>{a.type.replace(/_/g, ' ')}</span>
                  <span style={{ color: BRAND.muted, fontSize: 10, fontFamily: 'monospace' }}>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                {a.body && <div style={{ color: BRAND.text, fontSize: 13, lineHeight: 1.5 }}>{a.body}</div>}
                {a.created_by_email && <div style={{ color: BRAND.muted, fontSize: 10, marginTop: 4 }}>by {a.created_by_email}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Original AI message — reference */}
      {lead.message && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: 6 }}>Original Outreach (for reference)</div>
          {lead.subject && <div style={{ color: BRAND.text, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{lead.subject}</div>}
          <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: 10, background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: 2 }}>
            {lead.message}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BRAND.border}` }}>
        <span style={{ color: BRAND.muted, fontSize: 10, fontFamily: 'monospace' }}>
          Saved {new Date(lead.saved_at).toLocaleDateString()} by {lead.saved_by_email || 'unknown'}
        </span>
        <button onClick={deleteLead} style={{ background: 'transparent', border: `1px solid ${BRAND.red}44`, color: BRAND.red, borderRadius: 2, padding: '6px 12px', fontSize: 11, fontFamily: 'monospace', cursor: 'pointer' }}>
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

function chipStyle(active: boolean, color: string = BRAND.accent): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 2, border: `1px solid ${active ? color : BRAND.border}`,
    background: active ? `${color}1a` : 'transparent', color: active ? color : BRAND.muted,
    fontSize: 11, fontFamily: 'monospace', letterSpacing: '.05em', cursor: 'pointer',
  }
}

function inputStyle(): React.CSSProperties {
  return {
    flex: 1, background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: 2,
    padding: '8px 10px', color: BRAND.text, fontSize: 13, fontFamily: 'Georgia, serif',
    outline: 'none', boxSizing: 'border-box', width: '100%',
  }
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'transparent' : BRAND.accent, color: disabled ? BRAND.muted : BRAND.bg,
    border: disabled ? `1px solid ${BRAND.border}` : 'none', borderRadius: 2,
    padding: '8px 14px', fontSize: 11, fontFamily: 'monospace', letterSpacing: '.06em',
    cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
  }
}
