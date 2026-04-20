'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function QRPage() {
  const [retailer, setRetailer] = useState<any>(null)
  const [qrData, setQrData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const storedId = localStorage.getItem('poursona_active_retailer')
      let q = sb.from('admin_users').select('retailer_id, retailers(*)').eq('user_id', user.id)
      const { data } = await q.limit(1).single()
      if (data?.retailers) {
        const r = Array.isArray(data.retailers) ? data.retailers[0] : data.retailers
        if (storedId) {
          const { data: sr } = await sb.from('retailers').select('*').eq('id', storedId).single()
          if (sr) { setRetailer(sr); setLoading(false); return }
        }
        setRetailer(r)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function generateQR() {
    if (!retailer) return
    setGenerating(true)
    const res = await fetch(`/api/qr?slug=${retailer.slug}`)
    const data = await res.json()
    setQrData(data)
    setGenerating(false)
    setTimeout(() => composeCanvas(data), 200)
  }

  async function composeCanvas(data: any) {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = 500
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // Draw QR
    const qrImg = new Image()
    qrImg.onload = async () => {
      ctx.drawImage(qrImg, 0, 0, size, size)
      // Overlay logo if available
      if (data.logoUrl) {
        try {
          const logoImg = new Image()
          logoImg.crossOrigin = 'anonymous'
          await new Promise<void>((res, rej) => {
            logoImg.onload = () => res()
            logoImg.onerror = () => rej()
            logoImg.src = data.logoUrl
          })
          // Center logo — white circle background
          const logoSize = size * 0.22
          const center = size / 2
          ctx.beginPath()
          ctx.arc(center, center, logoSize * 0.62, 0, Math.PI * 2)
          ctx.fillStyle = '#ffffff'
          ctx.fill()
          ctx.drawImage(logoImg, center - logoSize/2, center - logoSize/2, logoSize, logoSize)
        } catch { /* logo failed to load, QR still valid */ }
      }
    }
    qrImg.src = data.qrDataUrl
  }

  function downloadPNG() {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `${retailer?.slug}-qr-code.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  function downloadSVG() {
    if (!retailer) return
    window.open(`/api/qr?slug=${retailer.slug}&format=svg`, '_blank')
  }

  const s = {
    card: { background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '24px 20px' } as React.CSSProperties,
    btn: (variant?: string) => ({ padding: '12px 22px', border: 'none', borderRadius: 10, background: variant === 'outline' ? 'rgba(201,168,76,.08)' : 'linear-gradient(135deg,#C9A84C,#a07830)', color: variant === 'outline' ? '#C9A84C' : '#060403', fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: variant === 'outline' ? '1px solid rgba(201,168,76,.25)' : 'none' } as React.CSSProperties),
  }

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>QR Code</div>
        <div style={{ color: '#F5ECD7', fontSize: 24, fontWeight: 700 }}>Your Table QR Code</div>
        <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 6 }}>Print this and place it on every table. Guests scan to access their personal guide.</div>
      </div>
      <div style={{ maxWidth: 560 }}>
        <div style={s.card}>
          {!qrData ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              {retailer && (
                <div style={{ marginBottom: 24 }}>
                  {retailer.logo_url && <img src={retailer.logo_url} alt="" style={{ height: 60, objectFit: 'contain', marginBottom: 14 }} />}
                  <div style={{ color: '#F5ECD7', fontSize: 18, fontWeight: 700 }}>{retailer.name}</div>
                  <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>pour-sona.vercel.app/r/{retailer.slug}</div>
                </div>
              )}
              <button onClick={generateQR} disabled={generating} style={{ ...s.btn(), opacity: generating ? .6 : 1 }}>
                {generating ? 'Generating…' : '✦ Generate QR Code'}
              </button>
              <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 16, lineHeight: 1.7 }}>
                Your brand color and logo will be embedded into the QR code.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ padding: 16, background: '#fff', borderRadius: 16, display: 'inline-block' }}>
                  <canvas ref={canvasRef} style={{ width: 240, height: 240, display: 'block' }} />
                </div>
              </div>
              <div style={{ color: '#4a3a1a', fontSize: 12, textAlign: 'center', marginBottom: 24 }}>
                {qrData.logoUrl ? '✓ Logo embedded' : '⚠ No logo — set one in Settings to embed it'} · Brand color: <span style={{ color: qrData.brandColor }}>{qrData.brandColor}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={downloadPNG} style={s.btn()}>⬇ Download PNG</button>
                <button onClick={downloadSVG} style={s.btn('outline')}>⬇ Download SVG</button>
                <button onClick={() => { setQrData(null) }} style={s.btn('outline')}>↺ Regenerate</button>
              </div>
              <div style={{ marginTop: 24, padding: '16px', background: 'rgba(201,168,76,.06)', borderRadius: 10, border: '1px solid rgba(201,168,76,.1)' }}>
                <div style={{ color: '#C9A84C', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Printing tip</div>
                <div style={{ color: '#4a3a1a', fontSize: 12, lineHeight: 1.7 }}>Print PNG on a laser printer for best results. Place on each table in a small stand or laminated card. Staples or Office Depot can print and laminate same-day.</div>
              </div>
            </div>
          )}
        </div>

        {/* Table tent preview */}
        {qrData && (
          <div style={{ ...s.card, marginTop: 16 }}>
            <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Table Tent Preview</div>
            <div style={{ background: qrData.brandColor, borderRadius: 12, padding: '28px 24px', textAlign: 'center', maxWidth: 280, margin: '0 auto' }}>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{retailer?.name}</div>
              <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginBottom: 20 }}>Scan for your personal {retailer?.vertical === 'winery' ? 'wine' : retailer?.vertical === 'coffee' ? 'coffee' : 'drink'} guide</div>
              <div style={{ background: '#fff', borderRadius: 10, padding: 12, display: 'inline-block', marginBottom: 16 }}>
                <canvas ref={canvasRef} style={{ width: 120, height: 120, display: 'block' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11 }}>Powered by Poursona</div>
            </div>
            <div style={{ color: '#4a3a1a', fontSize: 12, textAlign: 'center', marginTop: 14 }}>Print as a 4×6 card for table tents</div>
          </div>
        )}
      </div>
    </div>
  )
}