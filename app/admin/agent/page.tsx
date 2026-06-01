/**
 * Vendor-facing editor for the AssistantProfile that drives the guest chat.
 *
 * Sections (top-to-bottom):
 *   1. Brand Identity — agent name, tone, style, personality, vocabulary
 *   2. Product Strategy — differentiators, best-sellers, if-X-then-Y rules
 *   3. Question Strategy — min/max bounds + theme selection
 *   4. Calls-to-Action — primary/secondary CTA copy + fallback line
 *
 * Anything left at "" / empty array reverts to the category default at runtime
 * (see lib/agent/profile.ts → resolveAssistantProfile). The Reset button writes
 * SQL NULL so the whole profile starts derived from scratch.
 */
'use client'
import { useEffect, useState } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'
import type { AssistantProfile, BrandTone, ExperienceStyle, RecommendationRule } from '@/lib/types'

interface QuestionTheme {
  id: string
  label: string
  example_phrasings: string[]
  suggested_chips: string[]
}
interface CategoryTemplate {
  vertical: string
  default_experience_style: ExperienceStyle
  default_tone: BrandTone
  min_questions: number
  max_questions: number
  question_themes: QuestionTheme[]
}

const BRAND_TONES: { value: BrandTone; label: string; hint: string }[] = [
  { value: 'warm',       label: 'Warm',       hint: 'Welcoming and genuine — like the best regular' },
  { value: 'expert',     label: 'Expert',     hint: 'Confident, knowledgeable, not a snob' },
  { value: 'playful',    label: 'Playful',    hint: 'Light, witty, easy' },
  { value: 'minimalist', label: 'Minimalist', hint: 'Direct, few words, well chosen' },
  { value: 'reverent',   label: 'Reverent',   hint: 'Quietly passionate, respects the craft' },
]
const EXPERIENCE_STYLES: { value: ExperienceStyle; label: string }[] = [
  { value: 'bartender',     label: 'Bartender' },
  { value: 'sommelier',     label: 'Sommelier / tasting-room guide' },
  { value: 'barista',       label: 'Barista' },
  { value: 'spirits-guide', label: 'Spirits guide' },
  { value: 'host',          label: 'Host' },
]

export default function AgentProfilePage() {
  const [retailer, setRetailer]   = useState<any>(null)
  const [profile, setProfile]     = useState<AssistantProfile | null>(null)
  const [category, setCategory]   = useState<CategoryTemplate | null>(null)
  const [bounds, setBounds]       = useState<{ min: number; max: number }>({ min: 3, max: 5 })
  const [absoluteMax, setAbsMax]  = useState<number>(6)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [saved, setSaved]         = useState(false)

  useEffect(() => { (async () => {
    try {
      const access = await loadAdminAccess()
      const retailers = access?.retailers || []
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('poursona_active_retailer') : null
      const r = retailers.find((x: any) => x.id === storedId) || retailers[0]
      if (!r) { setError('No retailer selected.'); setLoading(false); return }
      setRetailer(r)
      await reload(r.id)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setLoading(false)
    }
  })() }, [])

  async function reload(retailerId: string) {
    const res = await fetch(`/api/admin/agent-profile?retailerId=${encodeURIComponent(retailerId)}`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok || !json?.ok) {
      setError(json?.error || `Load failed (${res.status})`)
      setLoading(false)
      return
    }
    setProfile(json.profile)
    setCategory(json.category_template)
    setBounds(json.bounds)
    setAbsMax(json.absolute_max_questions || 6)
    setLoading(false)
  }

  async function save() {
    if (!retailer || !profile) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/agent-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id, profile }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) { setError(json?.error || `Save failed (${res.status})`); return }
      setProfile(json.profile)
      setBounds(json.bounds)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefaults() {
    if (!retailer) return
    if (!confirm('Reset every field to the category default? This clears your vendor customizations.')) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/agent-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id, profile: null }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) { setError(json?.error || `Reset failed (${res.status})`); return }
      setProfile(json.profile)
      setBounds(json.bounds)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ color: '#3FC6D4', padding: 24 }}>Loading…</div>
  if (!profile || !category) {
    return (
      <div style={{ color: '#e07070', padding: 24 }}>
        {error || 'No agent profile available.'}
      </div>
    )
  }

  function update<K extends keyof AssistantProfile>(key: K, value: AssistantProfile[K]) {
    setProfile((p) => p ? { ...p, [key]: value } : p)
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Header bounds={bounds} category={category} />

      {error && <ErrorBanner text={error} />}
      {saved && <SuccessBanner text="Saved — guests on the next chat will see your changes." />}

      <Section title="Brand Identity" subtitle="What does the assistant sound like? Who is it?">
        <Field label="Assistant Name" hint="Shown in the prompt as the guide's name. E.g. 'Maya', 'Sam at Keuka'.">
          <TextInput value={profile.agent_name} onChange={(v) => update('agent_name', v)} placeholder="Your guide at {name}" />
        </Field>
        <Field label="Brand Tone">
          <Select<BrandTone>
            value={profile.brand_tone}
            onChange={(v) => update('brand_tone', v)}
            options={BRAND_TONES.map((t) => ({ value: t.value, label: `${t.label} — ${t.hint}` }))}
          />
        </Field>
        <Field label="Experience Style" hint="What kind of expert the guest is talking to.">
          <Select<ExperienceStyle>
            value={profile.experience_style}
            onChange={(v) => update('experience_style', v)}
            options={EXPERIENCE_STYLES.map((s) => ({ value: s.value, label: s.label }))}
          />
        </Field>
        <Field label="Brand Personality" hint="1–2 sentences. Anything specific about your venue's voice you want the assistant to know.">
          <TextArea value={profile.brand_personality} onChange={(v) => update('brand_personality', v)} rows={3}
            placeholder="e.g. We're laid-back lakeside, never preachy about beer. Use the bartender voice." />
        </Field>
        <Field label="Preferred Vocabulary" hint="Words & phrases the assistant should lean on. Press Enter to add.">
          <TagInput values={profile.preferred_vocab} onChange={(v) => update('preferred_vocab', v)} placeholder="taproom, small-batch, on tap" />
        </Field>
        <Field label="Words to Avoid" hint="The assistant will never use these.">
          <TagInput values={profile.avoid_words} onChange={(v) => update('avoid_words', v)} placeholder="adult beverage, fuzzy" tagColor="#e07070" />
        </Field>
      </Section>

      <Section title="Product Strategy" subtitle="What makes your catalog distinctive and what should the assistant lean into?">
        <Field label="Key Differentiators" hint="What sets your venue apart? Used to inject brand context into recommendations.">
          <TagInput values={profile.key_differentiators} onChange={(v) => update('key_differentiators', v)} placeholder="barrel-aged in-house, Finger Lakes hops" />
        </Field>
        <Field label="Best-Sellers" hint="Exact product names. When a guest is undecided, the assistant biases toward these.">
          <TagInput values={profile.best_sellers} onChange={(v) => update('best_sellers', v)} placeholder="Keuka Pils, Smoked Porter" />
        </Field>
        <Field label="Recommendation Rules" hint='If a guest signals one thing, prioritize/avoid certain catalog categories.'>
          <RulesEditor rules={profile.recommendation_rules} onChange={(v) => update('recommendation_rules', v)} />
        </Field>
      </Section>

      <Section title="Question Strategy" subtitle="How many questions, and which topics, before recommending.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label={`Minimum Questions (category default: ${category.min_questions})`}>
            <NumberInput
              value={profile.min_questions ?? category.min_questions}
              onChange={(n) => update('min_questions', n)}
              min={1} max={absoluteMax}
            />
          </Field>
          <Field label={`Maximum Questions (category default: ${category.max_questions} · absolute ceiling: ${absoluteMax})`}>
            <NumberInput
              value={profile.max_questions ?? category.max_questions}
              onChange={(n) => update('max_questions', n)}
              min={1} max={absoluteMax}
            />
          </Field>
        </div>
        <div style={{ color: '#3A4456', fontSize: 11, marginTop: 4, marginBottom: 20 }}>
          Resolved bounds for this retailer: <strong style={{ color: '#3FC6D4' }}>{bounds.min}–{bounds.max} questions</strong>. The assistant stops asking sooner when it has enough.
        </div>

        <Field label="Question Themes" hint="Topics the assistant draws from. Uncheck anything that doesn't apply to your guests.">
          <ThemeChecklist
            themes={category.question_themes}
            selected={profile.question_themes}
            onChange={(v) => update('question_themes', v)}
          />
        </Field>
      </Section>

      <Section title="Calls-to-Action" subtitle="Button copy and fallback wording shown after the recommendation.">
        <Field label="Primary CTA"  hint="The order button under the recommendation.">
          <TextInput value={profile.cta_primary} onChange={(v) => update('cta_primary', v)} placeholder="Order this" />
        </Field>
        <Field label="Secondary CTA" hint='"Show me another match", "Try a different one", etc.'>
          <TextInput value={profile.cta_secondary} onChange={(v) => update('cta_secondary', v)} placeholder="Show me another" />
        </Field>
        <Field label="Fallback Line" hint="When the assistant can't get enough info to recommend confidently.">
          <TextArea value={profile.fallback_line} onChange={(v) => update('fallback_line', v)} rows={2}
            placeholder="No worries — let me suggest a good starting point." />
        </Field>
      </Section>

      <ActionBar onSave={save} onReset={resetToDefaults} saving={saving} />
    </div>
  )
}

// ── Page composition pieces ───────────────────────────────────────────────────

function Header({ bounds, category }: { bounds: { min: number; max: number }, category: CategoryTemplate }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Assistant Profile</div>
      <div style={{ color: '#E8EDF2', fontSize: 26, fontWeight: 700 }}>Your Agent</div>
      <div style={{ color: '#3A4456', fontSize: 13, marginTop: 6, lineHeight: 1.5, maxWidth: 640 }}>
        Tune how the guest-facing chat introduces itself, asks questions, and recommends. Fields left blank use the{' '}
        <strong style={{ color: '#3FC6D4' }}>{category.vertical}</strong> category default. Current question range:{' '}
        <strong style={{ color: '#3FC6D4' }}>{bounds.min}–{bounds.max}</strong>.
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.15)', borderRadius: 14, padding: '24px 24px 8px', marginBottom: 18 }}>
      <div style={{ color: '#E8EDF2', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ color: '#3A4456', fontSize: 12, marginBottom: 18 }}>{subtitle}</div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{label}</label>
      {hint && <div style={{ color: '#3A4456', fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  )
}

function ActionBar({ onSave, onReset, saving }: { onSave: () => void; onReset: () => void; saving: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, position: 'sticky', bottom: 0, padding: '16px 0', background: 'linear-gradient(0deg,#0A0E15,#0A0E15 60%,transparent)' }}>
      <button onClick={onSave} disabled={saving} style={{
        flex: 1, padding: '14px', background: 'linear-gradient(135deg,#3FC6D4,#2A9BA8)', border: 'none', borderRadius: 10,
        color: '#0A0E15', fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
      }}>{saving ? 'Saving…' : 'Save Profile'}</button>
      <button onClick={onReset} disabled={saving} style={{
        padding: '14px 22px', background: 'transparent', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10,
        color: '#e07070', fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, cursor: saving ? 'wait' : 'pointer',
      }}>Reset to Defaults</button>
    </div>
  )
}

function ErrorBanner({ text }: { text: string }) {
  return <div style={{ background: 'rgba(224,112,112,.1)', border: '1px solid rgba(224,112,112,.3)', borderRadius: 10, padding: '12px 16px', color: '#e07070', fontSize: 13, marginBottom: 16 }}>{text}</div>
}
function SuccessBanner({ text }: { text: string }) {
  return <div style={{ background: 'rgba(94,207,138,.08)', border: '1px solid rgba(94,207,138,.25)', borderRadius: 10, padding: '12px 16px', color: '#5ecf8a', fontSize: 13, marginBottom: 16 }}>{text}</div>
}

// ── Inputs ────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.04)',
  border: '1px solid rgba(63,198,212,.15)', borderRadius: 8, color: '#E8EDF2',
  fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box',
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} />
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle} />
}

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} style={inputStyle}>
      {options.map((o) => <option key={o.value} value={o.value} style={{ background: '#0A0E15' }}>{o.label}</option>)}
    </select>
  )
}

function TagInput({ values, onChange, placeholder, tagColor = '#3FC6D4' }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; tagColor?: string }) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v) return
    if (values.includes(v)) { setDraft(''); return }
    onChange([...values, v])
    setDraft('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: values.length ? 8 : 0 }}>
        {values.map((v, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 14, background: `${tagColor}14`, border: `1px solid ${tagColor}44`, color: tagColor, fontSize: 12 }}>
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={{ background: 'transparent', border: 'none', color: tagColor, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && draft === '' && values.length > 0) { onChange(values.slice(0, -1)) }
        }}
        onBlur={add}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

function ThemeChecklist({ themes, selected, onChange }: { themes: QuestionTheme[]; selected: string[]; onChange: (v: string[]) => void }) {
  const set = new Set(selected)
  function toggle(id: string) {
    if (set.has(id)) onChange(selected.filter((s) => s !== id))
    else onChange([...selected, id])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {themes.map((t) => {
        const on = set.has(t.id)
        return (
          <label key={t.id} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${on ? 'rgba(63,198,212,.35)' : 'rgba(63,198,212,.1)'}`, background: on ? 'rgba(63,198,212,.06)' : 'transparent', cursor: 'pointer' }}>
            <input type="checkbox" checked={on} onChange={() => toggle(t.id)} style={{ marginTop: 3, accentColor: '#3FC6D4' }} />
            <div style={{ flex: 1 }}>
              <div style={{ color: on ? '#3FC6D4' : '#E8EDF2', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
              <div style={{ color: '#3A4456', fontSize: 11, lineHeight: 1.5, fontStyle: 'italic' }}>
                e.g. &ldquo;{t.example_phrasings[0]}&rdquo;
              </div>
            </div>
          </label>
        )
      })}
    </div>
  )
}

function RulesEditor({ rules, onChange }: { rules: RecommendationRule[]; onChange: (v: RecommendationRule[]) => void }) {
  function update(i: number, patch: Partial<RecommendationRule>) {
    onChange(rules.map((r, j) => j === i ? { ...r, ...patch } : r))
  }
  function add() {
    onChange([...rules, { when_user_says: '', prioritize_categories: [], avoid_categories: [] }])
  }
  function remove(i: number) {
    onChange(rules.filter((_, j) => j !== i))
  }
  return (
    <div>
      {rules.map((r, i) => (
        <div key={i} style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(63,198,212,.12)', background: 'rgba(255,255,255,.02)', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: '#3A4456', fontSize: 11 }}>Rule {i + 1}</span>
            <button onClick={() => remove(i)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#e07070', cursor: 'pointer', fontSize: 12 }}>Remove</button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ color: '#6B7588', fontSize: 11, marginBottom: 6 }}>When the guest says (or signals):</div>
            <input value={r.when_user_says} onChange={(e) => update(i, { when_user_says: e.target.value })} placeholder="e.g. light and sessionable" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ color: '#6B7588', fontSize: 11, marginBottom: 6 }}>Prioritize categories</div>
              <TagInput values={r.prioritize_categories || []} onChange={(v) => update(i, { prioritize_categories: v })} placeholder="Lager, Pilsner" />
            </div>
            <div>
              <div style={{ color: '#6B7588', fontSize: 11, marginBottom: 6 }}>Avoid categories</div>
              <TagInput values={r.avoid_categories || []} onChange={(v) => update(i, { avoid_categories: v })} placeholder="Imperial IPA" tagColor="#e07070" />
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} style={{ padding: '10px 16px', background: 'rgba(63,198,212,.08)', border: '1px dashed rgba(63,198,212,.3)', borderRadius: 8, color: '#3FC6D4', fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, cursor: 'pointer' }}>
        + Add a rule
      </button>
    </div>
  )
}
