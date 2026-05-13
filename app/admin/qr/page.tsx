'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

export default function QRPage() {
  const [retailer, setRetailer] = useState<any>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [brandColor, setBrandColor] = useState('#C9A84C')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const storedId = localStorage.getItem('poursona_active_retailer')
        const res = await fetch('/api/admin/access', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok || !json?.ok) {
          setError('Could not load retailer')
          setLoading(false)
          return
        }
        const found = (storedId ? json.retailers?.find((r: any) => r.id === storedId) : null) || json.retailers?.[0]
        if (!found) {
          setError('No retailer found')
          setLoading(false)
          return
        }
        setRetailer(found)
      } catch {
        setError('Failed to load')
      }
      setLoading(false)
    }
    load()
  }, [])

  const drawCanvas = useCallback(async (qrUrl: string, logo: string | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const SIZE = 600
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, SIZE, SIZE)
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img, 0, 0, SIZE, SIZE); resolve() }
      img.onerror = () => resolve()
      img.src = qrUrl
    })
    if (logo) {
      await new Promise<void>((resolve) => {
        const li = new Image()
        li.crossOrigin = 'anonymous'
        li.onload = () => {
          const ls = SIZE * 0.22
          const center = SIZE / 2
          const pad = ls * 0.15
          ctx.beginPath()
          ctx.arc(center, center, ls / 2 + pad, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.drawImage(li, center - ls / 2, center - ls / 2, ls, ls)
          resolve()
        }
        li.onerror = () => resolve()
        li.src = logo
      })
    }
    setDrawn(true)
  }, [])

  async function generateQR() {
    if (!retailer?.slug) return
    setGenerating(true)
    setDrawn(false)
    setError('')
    try {
      const res = await fetch('/api/qr?slug=' + encodeURIComponent(retailer.slug))
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'QR generation failed')
      setQrDataUrl(data.qrDataUrl)
      setBrandColor(data.brandColor || '#C9A84C')
      setLogoUrl(data.logoUrl || null)
      setGenerating(false)
      setTimeout(() => drawCanvas(data.qrDataUrl, data.logoUrl || null), 150)
    } catch (err: any) {
      setError(err.message)
      setGenerating(false)
    }
  }

  function downloadPNG() {
    const canvas = canvasRef.current
    if (!canvas || !drawn) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (retailer?.slug || 'poursona') + '-qr-code.png'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  function downloadSVG() {
    if (!retailer?.slug) return
    window.open('/api/qr?slug=' + encodeURIComponent(retailer.slug) + '&format=svg', '_blank')
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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>QR Code</div>
        <div style={{ color: '#F5ECD7', fontSize: 24, fontWeight: 700 }}>Your Table QR Code</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>Print and place on every table. Guests scan to start their guided experience.</div>
      </div>
      {error && <div style={{ color: '#e07070', marginBottom: 16, padding: '12px 16px', background: 'rgba(255,100,100,.08)', borderRadius: 8, fontSize: 13 }}>{error}</div>}
      <div style={{ maxWidth: 520 }}>
        <div style={card}>
          {!qrDataUrl ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              {retailer && (
                <div style={{ marginBottom: 24 }}>
                  {retailer.logo_url && <img src={retailer.logo_url} alt="" style={{ height: 60, objectFit: 'contain', marginBottom: 14 }} />}
                  <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700 }}>{retailer.name}</div>
                  <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>pour-sona.vercel.app/r/{retailer.slug}</div>
                </div>
              )}
              <button onClick={generateQR} disabled={generating || !retailer} style={{ ...btn(), opacity: generating || !retailer ? .6 : 1 }}>
                {generating ? 'Generating…' : '✦ Generate QR Code'}
              </button>
              <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 16, lineHeight: 1.7 }}>
                Brand color and logo will be embedded in the QR code.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,.3)' }}>
                  <canvas ref={canvasRef} style={{ width: 240, height: 240, display: 'block', imageRendering: 'pixelated' }} />
                </div>
              </div>
              <div style={{ color: '#4a3a1a', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
                {logoUrl ? '✓ Logo embedded' : '⚠ No logo — add one in Settings'}
                {' · '}Brand color: <span style={{ color: brandColor, fontWeight: 700 }}>{brandColor}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
                <button onClick={downloadPNG} disabled={!drawn} style={{ ...btn(), opacity: drawn ? 1 : .5 }}>⋇ Download PNG</button>
                <button onClick={downloadSVG} style={btn('outline')}>⋇ Download SVG</button>
                <button onClick={() => { setQrDataUrl(null); setDrawn(false) }} style={btn('outline')}>↶ Regenerate</button>
              </div>
              <div style={{ padding: 14, background: 'rgba(201,168,76,.06)', borderRadius: 10, border: '1px solid rgba(201,168,76,.1)' }}>
                <div style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Printing tip</div>
                <div style={{ color: '#4a3a1a', fontSize: 12, lineHeight: 1.7 }}>
                  Download PNG at 300 DPI minimum. 3×3 inches minimum on table cards. Staples or Office Depot can laminate same-day.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
