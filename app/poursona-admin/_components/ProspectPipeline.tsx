'use client'
import { useState, useRef, useEffect } from 'react'

const BRAND = {
  bg: '#0a0a08', surface: '#111110', card: '#181816', border: '#2a2a26',
  accent: '#c8a96e', accentDim: '#8a6f3e', text: '#e8e4dc', muted: '#7a7568',
  hop: '#4a7c4e', warm: '#c8743a',
}

interface Vertical { id: string; label: string; icon: string; query: string }

const VERTICALS: Vertical[] = [
  { id: 'winery',     label: 'Wineries',       icon: '🍷', query: 'winery tasting room' },
  { id: 'brewery',    label: 'Craft Breweries', icon: '🍺', query: 'craft brewery taproom' },
  { id: 'coffee',     label: 'Coffee Roasters', icon: '☕', query: 'specialty coffee roaster cafe' },
  { id: 'bottle',     label: 'Bottle Shops',    icon: '🍾', query: 'bottle shop wine spirits retail' },
  { id: 'distillery', label: 'Distilleries',    icon: '🥃', query: 'craft distillery tasting room' },
  { id: 'tea',        label: 'Tea Rooms',       icon: '🍵', query: 'specialty tea room loose leaf shop' },
]

interface Business { id: string; name: string; url: string; contact_url?: string }
interface Signals {
  score: 'hot' | 'warm' | 'skip'
  reason: string
  has_menu: boolean
  has_ordering: boolean
  has_tasting_room: boolean
}
interface Contacts {
  email: string | null
  instagram: string | null
  facebook: string | null
  linkedin: string | null
  twitter: string | null
  contactPage: string | null
}
interface ScreenedBusiness extends Business {
  signals: Signals
  subject?: string
  message: string
  contact_url: string
  contacts?: Contacts
}

// Internal mailbox the Poursona team sends prospect outreach from. Gmail
// resolves authuser=<address> to whichever account-index that mailbox
// currently lives at, so swapping in a new team mailbox here Just Works
// without us needing to know u/0 vs u/1.
const POURSONA_OUTBOUND_MAILBOX = 'andy@pour-sona.com'

// Build a Gmail web-compose URL pre-populated with to, subject, and body.
// Avoids the mailto: protocol (which on a browser without a configured
// system mail handler just opens about:blank), and forces the draft into
// the @pour-sona.com Workspace account regardless of which Gmail tab the
// user has focused. Falls back to a templated subject if the AI didn't
// return one.
function buildGmailCompose(email: string, subject: string | undefined, body: string, businessName: string): string {
  const subj = (subject && subject.trim()) ? subject.trim() : `Quick idea for ${businessName}`
  // URLSearchParams encodes spaces as '+', which Gmail decodes correctly in
  // both subject and body. Newlines come through verbatim.
  const params = new URLSearchParams({
    view: 'cm',
    fs:   '1',
    tf:   '1',
    to:   email,
    su:   subj,
    body,
    authuser: POURSONA_OUTBOUND_MAILBOX,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}
interface LogEntry { msg: string; type: 'info' | 'success' | 'error' | 'warn' | 'muted' }

// ── Nominatim autocomplete (public API — no key needed) ───────────────────────
async function fetchSuggestions(query: string): Promise<string[]> {
  if (query.length < 2) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`,
      { headers: { 'Accept-Language': 'en-US,en' } }
    )
    const data = await res.json()
    const seen = new Set<string>()
    return data.reduce((acc: string[], item: any) => {
      const a = item.address
      const city  = a.city || a.town || a.village || a.municipality || a.county || ''
      const state = a.state || a.region || ''
      const country = a.country_code?.toUpperCase() || ''
      const label = [city, state, country].filter(Boolean).join(', ')
      if (label && !seen.has(label)) { seen.add(label); acc.push(label) }
      return acc
    }, [])
  } catch { return [] }
}

// ── Backend proxy calls ───────────────────────────────────────────────────────
// Anthropic API key stays on the server; we call our own internal endpoint.
async function searchProspects(vertical: Vertical, location: string): Promise<Business[]> {
  const res = await fetch('/api/poursona-admin/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', vertical, location }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Search failed')
  return data.businesses ?? []
}

async function screenAndMessage(biz: Business, vertical: Vertical): Promise<ScreenedBusiness | null> {
  const res = await fetch('/api/poursona-admin/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Pass vertical so the server prompt can use vertical-specific wording
    // (e.g. "Coffee Sommelier", "Wine Sommelier") in the outreach message.
    body: JSON.stringify({ action: 'screen', biz, vertical }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Screen failed')
  return data.result ?? null
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: string }) {
  const map: Record<string, [string, string]> = {
    hot:  [BRAND.hop,  '● HOT'],
    warm: [BRAND.warm, '◐ WARM'],
  }
  const [color, label] = map[score] ?? [BRAND.muted, score]
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.1em', color, border: `1px solid ${color}`, padding: '2px 7px', borderRadius: '2px' }}>
      {label}
    </span>
  )
}

function LocationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown]  = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    setShowDropdown(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setSuggestions([]); return }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(val)
      setSuggestions(results)
      setLoading(false)
    }, 350)
  }

  const handleSelect = (label: string) => {
    onChange(label); setSuggestions([]); setShowDropdown(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const open = showDropdown && suggestions.length > 0

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={handleChange}
          onFocus={e => { if (suggestions.length > 0) setShowDropdown(true); e.target.style.borderColor = BRAND.accent }}
          onBlur={e  => (e.target.style.borderColor = BRAND.border)}
          placeholder="City, zip, or area — e.g. Austin TX"
          style={{
            width: '100%', background: BRAND.card, border: `1px solid ${BRAND.border}`,
            borderRadius: open ? '2px 2px 0 0' : '2px',
            padding: '11px 36px 11px 14px', color: BRAND.text, fontSize: '15px',
            fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {loading && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', border: `2px solid ${BRAND.border}`, borderTop: `2px solid ${BRAND.accent}`, borderRadius: '50%', animation: 'ppSpin 0.7s linear infinite' }} />
        )}
        {value && !loading && (
          <button onClick={() => { onChange(''); setSuggestions([]) }} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: BRAND.muted, cursor: 'pointer', fontSize: '16px', padding: '0', lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: BRAND.card, border: `1px solid ${BRAND.accent}`, borderTop: 'none', borderRadius: '0 0 2px 2px', overflow: 'hidden' }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => handleSelect(s)}
              style={{ padding: '11px 14px', fontSize: '14px', color: BRAND.text, cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? `1px solid ${BRAND.border}` : 'none', fontFamily: 'Georgia, serif' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = BRAND.surface)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >
              📍 {s}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes ppSpin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProspectPipeline() {
  const [vertical,  setVertical]  = useState<Vertical | null>(null)
  const [location,  setLocation]  = useState('')
  const [running,   setRunning]   = useState(false)
  const [log,       setLog]       = useState<LogEntry[]>([])
  const [prospects, setProspects] = useState<ScreenedBusiness[]>([])
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({})
  const [copied,    setCopied]    = useState<Record<string, boolean>>({})
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    setLog(l => [...l, { msg, type }])
    setTimeout(() => { if (logRef.current) logRef.current.scrollTop = 99999 }, 50)
  }

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(c => ({ ...c, [id]: true }))
    setTimeout(() => setCopied(c => ({ ...c, [id]: false })), 2000)
  }

  const runPipeline = async () => {
    if (!vertical || !location.trim()) return
    setRunning(true); setProspects([]); setLog([]); setExpanded({})
    addLog(`Searching ${vertical.label} in ${location}…`)
    let businesses: Business[] = []
    try {
      businesses = await searchProspects(vertical, location)
      addLog(`Found ${businesses.length} — screening each…`, 'success')
    } catch (err: any) {
      addLog(err.message ?? 'Search failed. Try again.', 'error')
      setRunning(false); return
    }
    for (let i = 0; i < businesses.length; i++) {
      const biz = businesses[i]
      // Small gap between businesses. Screening is now a single cheap Haiku call
      // (no web search), so a short pause is plenty to stay clear of the rate limit.
      if (i > 0) await new Promise(r => setTimeout(r, 800))
      addLog(`Screening ${biz.name}…`)
      try {
        const result = await screenAndMessage(biz, vertical)
        if (!result) { addLog(`${biz.name} → skipped`, 'muted'); continue }
        addLog(`${biz.name} → ${result.signals.score.toUpperCase()} ✓`, result.signals.score === 'hot' ? 'success' : 'warn')
        setProspects(p => [...p, result])
      } catch (err: any) {
        addLog(`${biz.name} → ${err.message ?? 'error'}`, 'error')
      }
    }
    addLog('Done.', 'success')
    setRunning(false)
  }

  const hot  = prospects.filter(p => p.signals?.score === 'hot')
  const warm = prospects.filter(p => p.signals?.score === 'warm')
  const canRun = !running && !!vertical && !!location.trim()

  const logColor: Record<LogEntry['type'], string> = {
    success: BRAND.hop, error: '#c84a4a', warn: BRAND.warm, muted: BRAND.muted, info: BRAND.muted,
  }

  return (
    <div style={{ maxWidth: '640px' }}>

      {/* ① Business Type */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.15em', color: BRAND.muted, textTransform: 'uppercase', marginBottom: '8px' }}>① Business Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {VERTICALS.map(v => (
            <button key={v.id} onClick={() => setVertical(v)} style={{
              background: vertical?.id === v.id ? BRAND.card : 'transparent',
              border: `1px solid ${vertical?.id === v.id ? BRAND.accent : BRAND.border}`,
              borderRadius: '2px', padding: '12px 10px', cursor: 'pointer',
              color: vertical?.id === v.id ? BRAND.text : BRAND.muted,
              fontFamily: 'Georgia, serif', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
            }}>
              <span style={{ fontSize: '18px' }}>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ② Location */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.15em', color: BRAND.muted, textTransform: 'uppercase', marginBottom: '8px' }}>② Location</div>
        <LocationInput value={location} onChange={setLocation} />
      </div>

      {/* Run */}
      <button
        onClick={runPipeline}
        disabled={!canRun}
        style={{ background: canRun ? BRAND.accent : BRAND.accentDim, color: BRAND.bg, border: 'none', borderRadius: '2px', padding: '14px', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canRun ? 'pointer' : 'not-allowed', width: '100%' }}
      >
        {running ? 'Running pipeline…' : 'Run Pipeline →'}
      </button>

      {/* Log */}
      {log.length > 0 && (
        <div ref={logRef} style={{ marginTop: '16px', background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: '2px', padding: '12px', maxHeight: '160px', overflowY: 'auto' }}>
          {log.map((l, i) => (
            <div key={i} style={{ fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.6, color: logColor[l.type] }}>
              {l.msg}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {prospects.length === 0 && !running && log.length === 0 && (
        <div style={{ marginTop: '40px', color: BRAND.muted, fontSize: '14px', lineHeight: 2 }}>
          <div style={{ color: BRAND.accentDim, fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '12px' }}>HOW IT WORKS</div>
          <div>① Search for real businesses with websites</div>
          <div>② Screen each for menu, ordering, tasting room</div>
          <div>③ Draft a personalised contact message</div>
          <div>④ Copy message · open their contact page · send</div>
        </div>
      )}

      {/* Results */}
      {[
        { label: 'Hot Prospects',  items: hot,  color: BRAND.hop  },
        { label: 'Warm Prospects', items: warm, color: BRAND.warm },
      ].filter(g => g.items.length > 0).map(group => (
        <div key={group.label} style={{ marginTop: '28px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.18em', color: group.color, textTransform: 'uppercase', marginBottom: '12px' }}>
            {group.label} ({group.items.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {group.items.map(p => (
              <div key={p.id} style={{ background: BRAND.card, border: `1px solid ${BRAND.border}`, borderRadius: '2px' }}>
                {/* Summary row */}
                <div
                  onClick={() => setExpanded(e => ({ ...e, [p.id]: !e[p.id] }))}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <ScoreBadge score={p.signals?.score} />
                      {p.signals?.has_menu      && <span style={{ fontSize: '9px', color: BRAND.hop,  fontFamily: 'monospace' }}>MENU</span>}
                      {p.signals?.has_ordering  && <span style={{ fontSize: '9px', color: BRAND.hop,  fontFamily: 'monospace' }}>ORDER</span>}
                      {p.signals?.has_tasting_room && <span style={{ fontSize: '9px', color: BRAND.hop, fontFamily: 'monospace' }}>TASTING</span>}
                    </div>
                    <div style={{ fontSize: '15px', color: BRAND.text, marginBottom: '2px' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: BRAND.muted, fontFamily: 'monospace', wordBreak: 'break-all' }}>{p.url}</div>
                    <div style={{ fontSize: '12px', color: BRAND.muted, fontStyle: 'italic', marginTop: '6px' }}>{p.signals?.reason}</div>
                  </div>
                  <div style={{ color: BRAND.muted, fontFamily: 'monospace', fontSize: '14px', flexShrink: 0, paddingTop: '2px' }}>
                    {expanded[p.id] ? '▲' : '▼'}
                  </div>
                </div>

                {/* Expanded — subject + message + CTA buttons */}
                {expanded[p.id] && (
                  <div style={{ borderTop: `1px solid ${BRAND.border}`, padding: '16px' }}>
                    {/* Subject line preview — surfaces what the email link will use */}
                    {(p.subject || p.contacts?.email) && (
                      <>
                        <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: '6px' }}>
                          Subject line
                        </div>
                        <div style={{ background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: '2px', padding: '10px 12px', fontSize: '13px', color: BRAND.text, marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span style={{ flex: 1, fontStyle: p.subject ? 'normal' : 'italic', color: p.subject ? BRAND.text : BRAND.muted }}>
                            {p.subject || `Quick idea for ${p.name}`}
                          </span>
                          <button
                            onClick={() => handleCopy(`${p.id}-subject`, p.subject || `Quick idea for ${p.name}`)}
                            style={{ background: 'transparent', border: `1px solid ${BRAND.border}`, color: BRAND.muted, borderRadius: '2px', padding: '4px 8px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.05em', cursor: 'pointer', flexShrink: 0 }}>
                            {copied[`${p.id}-subject`] ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </>
                    )}

                    <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: '10px' }}>
                      Message — ready to paste
                    </div>
                    <div style={{ background: BRAND.surface, border: `1px solid ${BRAND.border}`, borderRadius: '2px', padding: '14px', fontSize: '14px', lineHeight: 1.8, color: BRAND.text, whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
                      {p.message}
                    </div>
                    <button
                      onClick={() => handleCopy(p.id, p.message)}
                      style={{ background: copied[p.id] ? BRAND.hop : BRAND.accent, color: BRAND.bg, border: 'none', borderRadius: '2px', padding: '13px', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', width: '100%', marginBottom: '12px' }}
                    >
                      {copied[p.id] ? 'Copied ✓' : 'Copy Message'}
                    </button>

                    {/* Reach-out channels harvested from the site */}
                    <div style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.15em', color: BRAND.accentDim, textTransform: 'uppercase', marginBottom: '8px' }}>
                      Reach out
                    </div>
                    {(() => {
                      const c = p.contacts
                      const channels: { label: string; href: string }[] = []
                      channels.push({ label: '↗ Contact Page', href: p.contact_url })
                      // Email link opens Gmail web compose (NOT mailto:) signed
                      // in to andy@pour-sona.com, with subject + body already
                      // populated from the AI draft.
                      if (c?.email) channels.push({
                        label: '✉ Email via Gmail',
                        href: buildGmailCompose(c.email, p.subject, p.message, p.name),
                      })
                      if (c?.instagram) channels.push({ label: 'Instagram', href: c.instagram })
                      if (c?.facebook)  channels.push({ label: 'Facebook',  href: c.facebook })
                      if (c?.linkedin)  channels.push({ label: 'LinkedIn',  href: c.linkedin })
                      if (c?.twitter)   channels.push({ label: 'X / Twitter', href: c.twitter })
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {channels.map(ch => (
                            <a key={ch.label} href={ch.href} target="_blank" rel="noopener noreferrer"
                              style={{ background: 'transparent', border: `1px solid ${BRAND.accent}`, color: BRAND.accent, borderRadius: '2px', padding: '9px 12px', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em', textDecoration: 'none' }}>
                              {ch.label}
                            </a>
                          ))}
                          {c?.email && (
                            <button
                              onClick={() => handleCopy(`${p.id}-email`, c.email!)}
                              style={{ background: 'transparent', border: `1px solid ${BRAND.border}`, color: BRAND.muted, borderRadius: '2px', padding: '9px 12px', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em', cursor: 'pointer' }}>
                              {copied[`${p.id}-email`] ? 'Copied ✓' : `Copy ${c.email}`}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ height: '40px' }} />
    </div>
  )
}
