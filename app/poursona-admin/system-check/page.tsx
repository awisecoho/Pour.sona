'use client'

import { useEffect, useState } from 'react'

type Check = { key: string; label: string; ready: boolean; error: string | null }
type SystemCheckResponse = { ok: boolean; ready?: boolean; checkedAt?: string; checks?: Check[]; error?: string }

export default function SystemCheckPage() {
  const [result, setResult] = useState<SystemCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/poursona-admin/system-check')
      .then(r => r.json())
      .then(json => { setResult(json); setLoading(false) })
      .catch(() => { setResult({ ok: false, error: 'Request failed.' }); setLoading(false) })
  }, [])

  if (loading) return <div style={{ color: '#3FC6D4' }}>Checking schema...</div>

  const checks = result?.checks || []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#3FC6D4', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>CuvAi Internal</div>
        <div style={{ color: '#E8EDF2', fontSize: 26, fontWeight: 700 }}>System Check</div>
        <div style={{ color: '#3A4456', fontSize: 13, marginTop: 4 }}>Live Neon DB schema verification.</div>
      </div>

      <div style={{ background: 'linear-gradient(145deg,#161C28,#10141D)', border: '1px solid rgba(63,198,212,.12)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(63,198,212,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ color: '#E8EDF2', fontSize: 16, fontWeight: 700 }}>
            {result?.ready ? 'DB schema is ready' : 'DB schema has issues'}
          </div>
          <span style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: result?.ready ? 'rgba(94,207,138,.12)' : 'rgba(224,112,112,.12)', color: result?.ready ? '#5ecf8a' : '#e07070', border: '1px solid ' + (result?.ready ? 'rgba(94,207,138,.3)' : 'rgba(224,112,112,.3)') }}>
            {result?.ready ? 'READY' : 'ISSUES'}
          </span>
        </div>

        {result?.error && (
          <div style={{ padding: '16px 20px', color: '#e07070', borderBottom: '1px solid rgba(63,198,212,.1)' }}>
            {result.error}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(63,198,212,.1)' }}>
              {['Check', 'Status', 'Message'].map(h => (
                <th key={h} style={{ padding: '12px 20px', textAlign: 'left', color: '#3A4456', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map(check => (
              <tr key={check.key} style={{ borderBottom: '1px solid rgba(63,198,212,.05)' }}>
                <td style={{ padding: '14px 20px', color: '#E8EDF2', fontSize: 13 }}>{check.label}</td>
                <td style={{ padding: '14px 20px', color: check.ready ? '#5ecf8a' : '#e07070', fontSize: 13 }}>{check.ready ? 'Found' : 'Missing'}</td>
                <td style={{ padding: '14px 20px', color: '#6B7588', fontSize: 12 }}>{check.error || 'OK'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {checks.length === 0 && !result?.error && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#3A4456', fontSize: 13 }}>No checks returned.</div>
        )}
      </div>

      {result?.checkedAt && (
        <div style={{ color: '#3A4456', fontSize: 12, marginTop: 14 }}>
          Checked {new Date(result.checkedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
