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
  const [newProduct, setNewProduct] = useState({ name: '', category: '', description: '', price: '', abv: '', flavor_notes: '', image_url: '' })
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [editSaving, setEditSaving] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [activeRetailerId, setActiveRetailerId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function openEdit(p: any) {
    setEditingProduct(p)
    setEditForm({ name: p.name || '', category: p.category || '', description: p.description || '', price: p.price ?? '', abv: p.abv || '', flavor_notes: p.flavor_notes || '', image_url: p.image_url || '' })
  }

  async function saveEdit() {
    if (!editingProduct) return
    setEditSaving(true)
    const res = await fetch('/api/catalog', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingProduct.id,
        name: editForm.name || editingProduct.name,
        category: editForm.category || null,
        description: editForm.description || null,
        price: editForm.price !== '' ? parseFloat(editForm.price) : null,
        abv: editForm.abv || null,
        flavor_notes: editForm.flavor_notes || null,
        image_url: editForm.image_url || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...updated } : p))
      setEditingProduct(null)
    }
    setEditSaving(false)
  }

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
      setActiveRetailerId(retailerData.id)
      localStorage.setItem('poursona_active_retailer', retailerData.id)
      sessionStorage.setItem('active_retailer', JSON.stringify(retailerData))

      await fetchProducts(retailerData.id, '')
      setLoading(false)
    } catch (error) {
      console.error('[admin/catalog] load failed:', error)
      setLoading(false)
    }
  }

  async function fetchProducts(rId: string, search: string) {
    const p = new URLSearchParams({ retailerId: rId })
    if (search) p.set('search', search)
    const res = await fetch('/api/catalog?' + p, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok || !json.ok) {
      console.error('[admin/catalog] products lookup failed:', json)
      setLoadMessage('Products could not be loaded right now.')
      return
    }
    setProducts(json.products || [])
  }

  function handleCatalogSearch() {
    if (activeRetailerId) fetchProducts(activeRetailerId, catalogSearch)
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
        image_url: newProduct.image_url || null,
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
    setNewProduct({ name: '', category: '', description: '', price: '', abv: '', flavor_notes: '', image_url: '' })
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

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#F5F2E8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box' }

  if (loading) return <div style={{ color: '#D67A31' }}>Loading...</div>
  if (loadMessage) return <div style={{ color: '#F5F2E8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14 }}>{loadMessage}</div>

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <div>
          <div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', marginBottom: 4 }}>Catalog</div>
          <div style={{ color: '#F5F2E8', fontSize: 24, fontWeight: 700 }}>Menu & Products</div>
          <div style={{ color: '#3A3450', fontSize: 13, marginTop: 4 }}>{inStock.length} available · {outOfStock.length} off-menu</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 16px', background: 'rgba(97,42,134,.08)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#D67A31', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
            Scan Menu Photo
          </button>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '10px 16px', background: 'linear-gradient(135deg,#D67A31,#612A86)', border: 'none', borderRadius: 8, color: '#12111A', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
            + Add Item
          </button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && scanPhoto(e.target.files[0])} />

      {scanning && (
        <div style={{ background: 'linear-gradient(145deg,#1C1A2A,#161423)', border: '1px solid rgba(97,42,134,.15)', borderRadius: 14, padding: '24px', marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: '#D67A31', fontSize: 14 }}>Reading menu photo...</div>
          <div style={{ color: '#3A3450', fontSize: 12, marginTop: 4 }}>AI is extracting products from your image.</div>
        </div>
      )}
      {scanResult.length > 0 && (
        <div style={{ background: 'linear-gradient(145deg,#1C1A2A,#161423)', border: '1px solid rgba(94,207,138,.2)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
          <div style={{ color: '#5ecf8a', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Found {scanResult.length} items - tap to add</div>
          {scanResult.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(97,42,134,.06)' }}>
              <div>
                <div style={{ color: '#F5F2E8', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#3A3450', fontSize: 11 }}>{[p.category, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
              </div>
              <button onClick={() => addScannedProduct(p)} style={{ padding: '7px 14px', background: 'rgba(94,207,138,.15)', border: '1px solid rgba(94,207,138,.3)', borderRadius: 8, color: '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif", fontWeight: 700 }}>+ Add</button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div style={{ background: 'linear-gradient(145deg,#1C1A2A,#161423)', border: '1px solid rgba(97,42,134,.15)', borderRadius: 14, padding: '20px', marginBottom: 16 }}>
          <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Add New Item</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Name *</div><input value={newProduct.name} onChange={e => setNewProduct(p => ({...p, name: e.target.value}))} placeholder="Dock Beer" style={inp} /></div>
            <div><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Category</div><input value={newProduct.category} onChange={e => setNewProduct(p => ({...p, category: e.target.value}))} placeholder="Lager, IPA, Moonshine..." style={inp} /></div>
            <div><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Price</div><input type="number" value={newProduct.price} onChange={e => setNewProduct(p => ({...p, price: e.target.value}))} placeholder="7.00" style={inp} /></div>
            <div><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>ABV</div><input value={newProduct.abv} onChange={e => setNewProduct(p => ({...p, abv: e.target.value}))} placeholder="5.2%" style={inp} /></div>
          </div>
          <div style={{ marginBottom: 12 }}><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Description / Flavor Notes</div><input value={newProduct.description} onChange={e => setNewProduct(p => ({...p, description: e.target.value}))} placeholder="Brief description..." style={{...inp, width: '100%'}} /></div>
          <div style={{ marginBottom: 12 }}><div style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 5 }}>Image URL (https)</div><input value={newProduct.image_url} onChange={e => setNewProduct(p => ({...p, image_url: e.target.value}))} placeholder="https://yoursite.com/photos/dock-beer.jpg" style={{...inp, width: '100%'}} /><div style={{ color: '#3A3450', fontSize: 11, marginTop: 4 }}>Shown on the guest recommendation card. Paste a link to a product photo from your website.</div></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addProduct} disabled={!newProduct.name || saving === 'new'} style={{ padding: '11px 20px', background: 'linear-gradient(135deg,#D67A31,#612A86)', border: 'none', borderRadius: 8, color: '#12111A', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: !newProduct.name || saving === 'new' ? .5 : 1 }}>{saving === 'new' ? 'Saving...' : 'Add Item'}</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#3A3450', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          value={catalogSearch}
          onChange={e => setCatalogSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCatalogSearch()}
          placeholder="Search products…"
          style={{ ...inp, flex: 1 }}
        />
        <button onClick={handleCatalogSearch} style={{ padding: '10px 16px', background: 'rgba(97,42,134,.08)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#D67A31', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Search</button>
        {catalogSearch && (
          <button onClick={() => { setCatalogSearch(''); if (activeRetailerId) fetchProducts(activeRetailerId, '') }} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(97,42,134,.15)', borderRadius: 8, color: '#3A3450', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Clear</button>
        )}
      </div>

      <div style={{ background: 'linear-gradient(145deg,#1C1A2A,#161423)', border: '1px solid rgba(97,42,134,.15)', borderRadius: 14, padding: '20px', marginBottom: 12 }}>
        <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Available Now ({inStock.length})</div>
        {inStock.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(97,42,134,.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F5F2E8', fontSize: 14, fontWeight: 500 }}>{p.name}</div>
              <div style={{ color: '#3A3450', fontSize: 11, marginTop: 2 }}>{[p.category, p.abv, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
              <button onClick={() => openEdit(p)} style={{ padding: '7px 14px', background: 'rgba(97,42,134,.08)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#D67A31', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Edit</button>
              <button onClick={() => toggleStock(p.id, p.in_stock)} disabled={saving === p.id} style={{ padding: '7px 14px', background: 'rgba(255,100,100,.08)', border: '1px solid rgba(255,100,100,.2)', borderRadius: 8, color: '#e07070', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif", opacity: saving === p.id ? .5 : 1 }}>
                {saving === p.id ? '...' : 'Off-Menu'}
              </button>
            </div>
          </div>
        ))}
        {inStock.length === 0 && <div style={{ color: '#3A3450', fontSize: 13 }}>No available items.</div>}
      </div>

      {outOfStock.length > 0 && (
        <div style={{ background: 'linear-gradient(145deg,#1C1A2A,#161423)', border: '1px solid rgba(97,42,134,.08)', borderRadius: 14, padding: '20px', opacity: .7 }}>
          <div style={{ color: '#3A3450', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Off-Menu / Seasonal ({outOfStock.length})</div>
          {outOfStock.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(97,42,134,.04)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#3A3450', fontSize: 14 }}>{p.name}</div>
                <div style={{ color: '#3A3450', fontSize: 11, marginTop: 2 }}>{[p.category, p.price ? '$'+p.price : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 12, flexShrink: 0 }}>
                <button onClick={() => openEdit(p)} style={{ padding: '7px 14px', background: 'rgba(97,42,134,.06)', border: '1px solid rgba(97,42,134,.15)', borderRadius: 8, color: '#6A6080', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif" }}>Edit</button>
                <button onClick={() => toggleStock(p.id, p.in_stock)} disabled={saving === p.id} style={{ padding: '7px 14px', background: 'rgba(94,207,138,.08)', border: '1px solid rgba(94,207,138,.2)', borderRadius: 8, color: '#5ecf8a', fontSize: 12, cursor: 'pointer', fontFamily: "var(--font-inter), system-ui, sans-serif", opacity: saving === p.id ? .5 : 1 }}>
                  {saving === p.id ? '...' : 'Back on Menu'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Edit modal */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => { if (e.target === e.currentTarget) setEditingProduct(null) }}>
          <div style={{ background: 'linear-gradient(145deg,#161423,#161423)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 16, padding: '28px 28px', width: '100%', maxWidth: 480 }}>
            <div style={{ color: '#F5F2E8', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Edit Product</div>
            {[
              { k: 'name', l: 'Name *', type: 'text' },
              { k: 'category', l: 'Category', type: 'text' },
              { k: 'price', l: 'Price ($)', type: 'number' },
              { k: 'abv', l: 'ABV / Vintage / Origin', type: 'text' },
              { k: 'flavor_notes', l: 'Flavor Notes', type: 'text' },
              { k: 'image_url', l: 'Image URL (https)', type: 'text' },
            ].map(({ k, l, type }) => (
              <div key={k} style={{ marginBottom: 14 }}>
                <label style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{l}</label>
                <input
                  type={type}
                  value={editForm[k] ?? ''}
                  onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#F5F2E8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: '#D67A31', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>Description</label>
              <textarea
                value={editForm.description ?? ''}
                onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(97,42,134,.2)', borderRadius: 8, color: '#F5F2E8', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg,#D67A31,#612A86)', border: 'none', borderRadius: 8, color: '#12111A', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: editSaving ? .6 : 1 }}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingProduct(null)} style={{ padding: '12px 18px', background: 'transparent', border: '1px solid rgba(97,42,134,.15)', borderRadius: 8, color: '#3A3450', fontFamily: "var(--font-inter), system-ui, sans-serif", fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
