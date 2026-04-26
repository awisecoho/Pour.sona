'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Check = {
  key: string
  label: string
  ready: boolean
  error: string | null
}

type SystemCheckResponse = {
  ok: boolean
  ready?: boolean
  checkedAt?: string
  checks?: Check[]
  error?: string
}

export default function SystemCheckPage() {
  const [result, setResult] = useState<SystemCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) {
        setResult({ ok: false, error: 'Not signed in.' })
        setLoading(false)
        return
      }

      const res = await fetch('/api/poursona-admin/system-check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      setResult(json)
      setLoading(false)
    }

    load()
  }, [])

  if (loading) return <div style={{ color: '#C9A84C' }}>Checking schema...</div>

  const checks = result?.checks || []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Poursona Internal</div>
        <div style={{ color: '#F5ECD7', fontSize: 26, fontWeight: 700 }}>Phase 1 System Check</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>
          Read-only verification for vendor intelligence schema.
        </div>
      </div>

      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(201,168,76,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: '#F5ECD7', fontSize: 16, fontWeight: 700 }}>
            {result?.ready ? 'Live DB schema is ready' : 'Live DB schema is not ready'}
          </div>
          <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: result?.ready ? 'rgba(94,207,138,.12)' : 'rgba(224,112,112,.12)', color: result?.ready ? '#5ecf8a' : '#e07070', border: '1px solid ' + (result?.ready ? 'rgba(94,207,138,.3)' : 'rgba(224,112,112,.3)') }}>
            {result?.ready ? 'READY' : 'MISSING'}
          </span>
        </div>

        {result?.error && (
          <div style={{ padding: '16px 20px', color: '#e07070', borderBottom: '1px solid rgba(201,168,76,.1)' }}>
            {result.error}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(201,168,76,.1)' }}>
              {['Check', 'Status', 'Message'].map(header => (
                <th key={header} style={{ padding: '12px 20px', textAlign: 'left', color: '#4a3a1a', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map(check => (
              <tr key={check.key} style={{ borderBottom: '1px solid rgba(201,168,76,.05)' }}>
                <td style={{ padding: '14px 20px', color: '#F5ECD7', fontSize: 13 }}>{check.label}</td>
                <td style={{ padding: '14px 20px', color: check.ready ? '#5ecf8a' : '#e07070', fontSize: 13 }}>{check.ready ? 'Found' : 'Missing'}</td>
                <td style={{ padding: '14px 20px', color: '#6a5a3a', fontSize: 12 }}>{check.error || 'OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {checks.length === 0 && !result?.error && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#4a3a1a', fontSize: 13 }}>No checks returned.</div>
        )}
      </div>

      {result?.checkedAt && (
        <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 14 }}>
          Checked {new Date(result.checkedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
