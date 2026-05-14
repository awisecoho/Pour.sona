'use client'
import { useEffect, useState } from 'react'
import { storefrontUrl } from '@/lib/urls'

export default function QRPage() {
  const [retailer, setRetailer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const storedId = localStorage.getItem('poursona_active_retailer')
        const res = await fetch('/api/admin/access', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.ok) { setError('Could not load retailer'); setLoading(false); return }
        const found = (storedId ? json.retailers?.find((r: any) => r.id === storedId) : null) || json.retailers?.[0]
        if (!found) { setError('No retailer found'); setLoading(false); return }
        setRetailer(found)
      } catch {
        setError('Failed to load')
      }
      setLoading(false)
    }
    load()
  }, [])

  function downloadPNG() {
    if (!retailer?.slug) return
    const a = document.createElement('a')
    a.href = `/api/qr?slug=${encodeURIComponent(retailer.slug)}`
    a.download = `${retailer.slug}-qr-code.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function downloadSVG() {
    if (!retailer?.slug) return
    window.open(`/api/qr?slug=${encodeURIComponent(retailer.slug)}&format=svg`, '_blank')
  }

  const card: React.CSSProperties = {
    background: 'linear-gradient(145deg,#0e0b06,#0a0805)',
    border: '1px solid rgba(201,168,76,.15)',
    borderRadius: 14,
    padding: '24px 20px',
  }
  const btn = (v?: string): React.CSSProperties => ({
    padding: '12px 22px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    fontSize: 13,
    fontWeight: 700,
    background: v === 'outline' ? 'rgba(201,168,76,.08)' : 'linear-gradient(135deg,#C9A84C,#a07830)',
    color: v === 'outline' ? '#C9A84C' : '#060403',
    border: v === 'outline' ? '1px solid rgba(201,168,76,.25)' : 'none',
  })

  if (loading) return <div style={{ color: '#C9A84C', padding: 24 }}>Loading…</div>

  const guideUrl = retailer?.slug ? storefrontUrl(retailer.slug) : ''
  const qrSrc = retailer?.slug ? `/api/qr?slug=${encodeURIComponent(retailer.slug)}` : ''

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>QR Code</div>
        <div style={{ color: '#F5ECD7', fontSize: 24, fontWeight: 700 }}>Your Table QR Code</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>Print and place on every table. Guests scan to start their guided experience.</div>
      </div>

      {error && (
        <div style={{ color: '#e07070', marginBottom: 16, padding: '12px 16px', background: 'rgba(255,100,100,.08)', borderRadius: 8, fontSize: 13 }}>{error}</div>
      )}

      {retailer && (
        <div style={{ maxWidth: 520 }}>
          <div style={card}>
            {retailer.logo_url && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={retailer.logo_url} alt="" style={{ height: 52, objectFit: 'contain' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.3)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code for ${retailer.name}`}
                  width={240}
                  height={240}
                  style={{ display: 'block', imageRendering: 'pixelated' }}
                />
              </div>
            </div>

            <div style={{ color: '#4a3a1a', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
              {retailer.logo_url ? '✓ Logo embedded' : '⚠ No logo — add one in Settings'}
              {' · '}
              <a href={guideUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#C9A84C', textDecoration: 'none' }}>{guideUrl}</a>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              <button onClick={downloadPNG} style={btn()}>⋇ Download PNG</button>
              <button onClick={downloadSVG} style={btn('outline')}>⋇ Download SVG</button>
            </div>

            <div style={{ padding: 14, background: 'rgba(201,168,76,.06)', borderRadius: 10, border: '1px solid rgba(201,168,76,.1)' }}>
              <div style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Printing tip</div>
              <div style={{ color: '#4a3a1a', fontSize: 12, lineHeight: 1.7 }}>
                Download PNG at 300 DPI minimum. 3×3 inches minimum on table cards. Staples or Office Depot can laminate same-day.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
