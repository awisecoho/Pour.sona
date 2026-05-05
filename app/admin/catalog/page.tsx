'use client'
import { useEffect, useState, useRef } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'

export default function CatalogPage() {
  const [retailer, setRetailer] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', category: '', description: '', price: '', abv: '', flavor_notes: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoadMessage(null)
      const access = await loadAdminAccess()
      if (!access?.ok) {
        console.error('[admin/catalog] auth getUser/getSession failed:', access)
        setLoading(false)
        window.location.href = '/admin/login'
        return
      }

      const storedId = localStorage.getItem('poursona_active_retailer')
      let retailerData: any = null

      if (storedId) {
        retailerData = access.retailers?.find((r: any) => r.id === storedId) || null
        if (!retailerData) console.error('[admin/catalog] retailers lookup failed:', { storedId, accessible: access.retailers?.map((r: any) => r.id) })
      }

      if (!retailerData) {
        retailerData = access.retailers?.[0] || null
        if (!retailerData) {
          console.error('[admin/catalog] admin_users lookup returned no retailer')
        }
      }

      if (!retailerData) {
        setLoadMessage('No retailer is linked to this admin account.')
        setLoading(false)
        return
      }

      setRetailer(retailerData)
      localStorage.setItem('poursona_active_retailer', retailerData.id)
      sessionStorage.setItem('active_retailer', JSON.stringify(retailerData))

      const res = await fetch(`/api/catalog?retailerId=${encodeURIComponent(retailerData.id)}`, {
        cache: 'no-store',
      })
      const prods = await res.json()
      if (!res.ok) {
        console.error('[admin/catalog] products lookup failed:', prods)
        setLoadMessage('Products could not be loaded right now.')
        setLoading(false)
        return
      }

      setProducts(prods || [])
      setLoading(false)
    } catch (error) {
      console.error('[admin/catalog] load failed:', error)
      setLoading(false)
    }
  }

  async function toggleStock(id: string, current: boolean) {
    setSaving(id)
    const res = await fetch('/api/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, in_stock: !current }),
    })
    if (!res.ok) {
      console.error('[admin/catalog] stock toggle failed:', await res.json())
      setSaving(null)
      return
    }
    setProducts(prev => prev.map(p => p.id === id ? { ...p, in_stock: !current } : p))
    setSaving(null)
  }

  async function addProduct() {
    if (!newProduct.name || !retailer) return
    setSaving('new')
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retailerId: retailer.id,
        name: newProduct.name,
        category: newProduct.category || null,
        description: newProduct.description || null,
        price: newProduct.price ? parseFloat(newProduct.price) : null,
        abv: newProduct.abv || null,
        flavor_notes: newProduct.flavor_notes || null,
        in_stock: true,
        sort_order: products.length,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[admin/catalog] add product failed:', data)
      setSaving(null)
      return
    }
    if (data) setProducts(prev => [...prev, data])
    setNewProduct({ name: '', category: '', description: '', price: '', abv: '', flavor_notes: '' })
    setShowAdd(false)
    setSaving(null)
  }

  async function scanPhoto(file: File) {
    setScanning(true); setScanResult([])
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      const res = await fetch('/api/menu-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64, retailerId: retailer?.id }) })
      const data = await res.json()
      setScanResult(data.products || [])
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  async function addScannedProduct(p: any) {
    if (!retailer) return
    const res = await fetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        retailerId: retailer.id,
        name: p.name,
        category: p.category || null,
        description: p.description || null,
        price: p.price || null,
        flavor_notes: p.flavor_notes || null,
        in_stock: true,
        sort_order: products.length,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('[admin/catalog] add scanned product failed:', data)
      return
    }
    if (data) { setProducts(prev => [...prev, data]); setScanResult(prev => prev.filter(x => x.name !== p.name)) }
  }

  const inStock = products.filter(p => p.in_stock)
  const outOfStock = products.filter(p => !p.in_stock)

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  if (loading) return <div style={{ color: '#C9A84C' }}>Loading...</div>
  if (loadMessage) return <div style={{ color: '#F5ECD7', fontFamily: 'Georgia, serif', fontSize: 14 }}>{loadMessage}</div>

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Catalog</div>
          <div style={{ color: '#F5ECD7', fontSize: 24, fontWeight: 700 }}>Menu & Products</div>
          <div style={{ color: '#4a3a1a', fontSize: 13, marginTop: 4 }}>{inStock.length} available · {outOfStock.length} off-menu</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 16px', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#C9A84C', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
            Scan Menu Photo
          </button>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '10px 16px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 8, color: '#060403', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Georgia, serif' }}>
            + Add Item
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && scanPhoto(e.target.files[0])} />

      {scanning && (
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '24px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: '#C9A84C', fontSize: 14 }}>Reading menu photo...</div>
          <div style={{ color: '#4a3a1a', fontSize: 12, marginTop: 4 }}>AI is extracting products from your image.</div>
        </div>
      )}
      {scanResult.length > 0 && (
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(94,207,138,.2)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
          <div style={{ color: '#5ecf8a', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Found {scanResult.length} items - tap to add</div>
          {scanResult.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
              <div>
                <div style={{ color: '#F5ECD7', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#4a3a1a', fontSize: 11 }}>{[p.category, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => addScannedProduct(p)} style={{ padding: '7px 14px', background: 'rgba(94,207,138,.15)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 8, color: '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', fontWeight: 700 }}>+ Add</button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
          <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Add New Item</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Name *</div><input value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} placeholder="Dock Beer" style={inp} /></div>
            <div><div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Category</div><input value={newProduct.category} onChange={e => setNewProduct(p => ({...p, category: e.target.value}))} placeholder="Lager, IPA, Moonshine..." style={inp} /></div>
            <div><div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Price</div><input type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({...p, price: e.target.value}))} placeholder="7.00" style={inp} /></div>
            <div><div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>ABV</div><input value={newProduct.abv} onChange={e => setNewProduct(p => ({...p, abv: e.target.value}))} placeholder="5.2%" style={inp} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><div style={{ color: '#C9A84C', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Description / Flavor Notes</div><input value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))} placeholder="Brief description..." style={{...inp, width: '100%'}} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addProduct} disabled={!newProduct.name || saving === 'new'} style={{ padding: '11px 20px', background: 'linear-gradient(135deg,#C9A84C,#a07830)', border: 'none', borderRadius: 8, color: '#060403', fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !newProduct.name || saving === 'new' ? .5 : 1 }}>{saving === 'new' ? 'Saving...' : 'Add Item'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, color: '#4a3a1a', fontFamily: 'Georgia, serif', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.15)', borderRadius: 14, padding: '20px', marginBottom: 12 }}>
        <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Available Now ({inStock.length})</div>
        {inStock.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(201,168,76,.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F5ECD7', fontSize: 14, fontWeight: 500 }}>{p.name}</div>
              <div style={{ color: '#4a3a1a', fontSize: 11, marginTop: 2 }}>{[p.category, p.abv, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
            </div>
            <button onClick={() => toggleStock(p.id, p.in_stock)} disabled={saving === p.id} style={{ marginLeft: 12, padding: '7px 14px', background: 'rgba(255,100,100,.08)', border: '1px solid rgba(255,100,100,.2)', borderRadius: 8, color: '#e07070', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', flexShrink: 0, opacity: saving === p.id ? .5 : 1 }}>
              {saving === p.id ? '...' : 'Mark Off-Menu'}
            </button>
          </div>
        ))}
        {inStock.length === 0 && <div style={{ color: '#4a3a1a', fontSize: 13 }}>No available items.</div>}
      </div>

      {outOfStock.length > 0 && (
        <div style={{ background: 'linear-gradient(145deg,#0e0b06,#0a0805)', border: '1px solid rgba(201,168,76,.08)', borderRadius: 14, padding: '20px', opacity: .7 }}>
          <div style={{ color: '#4a3a1a', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Off-Menu / Seasonal ({outOfStock.length})</div>
          {outOfStock.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,.04)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#4a3a1a', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#3a2a0a', fontSize: 11, marginTop: 2 }}>{[p.category, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => toggleStock(p.id, p.in_stock)} disabled={saving === p.id} style={{ marginLeft: 12, padding: '7px 14px', background: 'rgba(94,207,138,.08)', border: '1px solid rgba(94,207,138,.2)', borderRadius: 8, color: '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: 'Georgia, serif', flexShrink: 0, opacity: saving === p.id ? .5 : 1 }}>
                {saving === p.id ? '...' : 'Back on Menu'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
