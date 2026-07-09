'use client'
import { useEffect, useState } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'
import { storefrontUrl } from '@/lib/urls'

const inp: React.CSSProperties = {width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(97,42,134,.15)',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,outline:'none',boxSizing:'border-box'}
const label: React.CSSProperties = {color:'#D67A31',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}
const rescanBtn = (bg: string): React.CSSProperties => ({flex:1,padding:'11px 14px',background:bg,border:'none',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:12,fontWeight:700,cursor:'pointer'})

export default function SettingsPage() {
  const [retailer,setRetailer]=useState<any>(null)
  const [form,setForm]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [loading,setLoading]=useState(true)
  const [rescanUrl,setRescanUrl]=useState('')
  const [rescanning,setRescanning]=useState(false)
  const [rescanResult,setRescanResult]=useState<any>(null)
  const [rescanError,setRescanError]=useState('')
  useEffect(()=>{(async()=>{
    const access = await loadAdminAccess()
    const retailers = access.retailers || []
    const storedId = typeof window !== 'undefined' ? localStorage.getItem('poursona_active_retailer') : null
    const nextRetailer = retailers.find((r: any) => r.id === storedId) || retailers[0]
    if(!nextRetailer)return
    setRetailer(nextRetailer);setForm({...nextRetailer})
    if(nextRetailer.website_url) setRescanUrl(nextRetailer.website_url)
    setLoading(false)
  })()},[])
  async function save(e:React.FormEvent){
    e.preventDefault();if(!retailer)return;setSaving(true)
    const res = await fetch('/api/admin/retailer', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({retailerId:retailer.id,name:form.name,tagline:form.tagline,location:form.location,brand_color:form.brand_color,ordering_enabled:form.ordering_enabled !== false})})
    const json = await res.json()
    if(!res.ok || !json?.ok){console.error('[admin/settings] save failed:', json);setSaving(false);return}
    setRetailer(json.retailer);setForm({...json.retailer});setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000)
  }
  async function runRescan(mode: 'catalog' | 'branding' | 'full') {
    if (!retailer || !rescanUrl.trim()) return
    setRescanning(true);setRescanResult(null);setRescanError('')
    try {
      const res = await fetch('/api/admin/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailerId: retailer.id, url: rescanUrl.trim(), mode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Rescan failed')
      setRescanResult({ mode, ...json })
      setRetailer(json.retailer);setForm({...json.retailer})
    } catch (err: any) {
      setRescanError(err.message)
    }
    setRescanning(false)
  }
  if(loading)return <div style={{color:'#D67A31'}}>Loading…</div>
  return (
    <div>
      <div style={{marginBottom:32}}><div style={{color:'#D67A31',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Config</div><div style={{color:'#F5F2E8',fontSize:26,fontWeight:700}}>Settings</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        <div style={{background:'linear-gradient(145deg,#1C1A2A,#161423)',border:'1px solid rgba(97,42,134,.15)',borderRadius:14,padding:'28px 24px'}}>
          <div style={{color:'#F5F2E8',fontSize:15,fontWeight:700,marginBottom:20}}>Retailer Profile</div>
          <form onSubmit={save}>
            {[{k:'name',l:'Business Name'},{k:'tagline',l:'Tagline'},{k:'location',l:'Location'}].map(({k,l})=>(
              <div key={k} style={{marginBottom:16}}>
                <label style={{color:'#D67A31',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                <input value={form?.[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(97,42,134,.15)',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <div style={{marginBottom:16}}>
              <label style={{color:'#D67A31',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>Brand Color</label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <input type="color" value={form?.brand_color||'#D67A31'} onChange={e=>setForm({...form,brand_color:e.target.value})} style={{width:44,height:44,border:'none',borderRadius:8,cursor:'pointer'}}/>
                <input value={form?.brand_color||''} onChange={e=>setForm({...form,brand_color:e.target.value})} style={{flex:1,padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(97,42,134,.15)',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,outline:'none'}}/>
              </div>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                <input type="checkbox" checked={form?.ordering_enabled !== false} onChange={e=>setForm({...form,ordering_enabled:e.target.checked})} style={{width:16,height:16,accentColor:'#D67A31',cursor:'pointer'}}/>
                <span style={{color:'#F5F2E8',fontSize:13}}>Accept guest orders</span>
              </label>
              <div style={{color:'#3A3450',fontSize:11,marginTop:6,lineHeight:1.5}}>When off, the guest recommendation hides the order button and asks guests to see your staff instead. Turn off if you have no way to fulfill orders placed from the guest&apos;s phone.</div>
            </div>
            <button type="submit" disabled={saving} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#D67A31,#612A86)',border:'none',borderRadius:8,color:'#12111A',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':saved?'✓ Saved':'Save Changes'}</button>
          </form>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'linear-gradient(145deg,#1C1A2A,#161423)',border:'1px solid rgba(97,42,134,.15)',borderRadius:14,padding:'28px 24px'}}>
            <div style={{color:'#F5F2E8',fontSize:15,fontWeight:700,marginBottom:16}}>Your QR Code</div>
            <div style={{textAlign:'center',padding:'20px 0'}}><img src={'/api/qr?slug='+retailer?.slug} alt="QR" style={{width:160,height:160,borderRadius:8}}/></div>
            <div style={{color:'#3A3450',fontSize:12,textAlign:'center',marginBottom:16}}>{retailer?.slug ? storefrontUrl(retailer.slug) : ''}</div>
            <a href={'/api/qr?slug='+retailer?.slug+'&format=png'} download style={{display:'block',textAlign:'center',padding:'10px',background:'rgba(97,42,134,.08)',border:'1px solid rgba(97,42,134,.2)',borderRadius:8,color:'#D67A31',textDecoration:'none',fontSize:12}}>↓ Download PNG</a>
          </div>
          <div style={{background:'linear-gradient(145deg,#1C1A2A,#161423)',border:'1px solid rgba(97,42,134,.15)',borderRadius:14,padding:'24px'}}>
            <div style={{color:'#F5F2E8',fontSize:14,fontWeight:700,marginBottom:12}}>Account Info</div>
            {[['Slug',retailer?.slug],['Vertical',retailer?.vertical],['Plan',retailer?.subscription_tier||'starter'],['Status',retailer?.subscription_status||'trial']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(97,42,134,.06)'}}>
                <span style={{color:'#3A3450',fontSize:12}}>{l}</span><span style={{color:'#D67A31',fontSize:12}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{background:'linear-gradient(145deg,#1C1A2A,#161423)',border:'1px solid rgba(97,42,134,.15)',borderRadius:14,padding:'28px 24px',marginTop:24}}>
        <div style={{color:'#F5F2E8',fontSize:15,fontWeight:700,marginBottom:6}}>Re-scan Website</div>
        <div style={{color:'#3A3450',fontSize:13,marginBottom:20,lineHeight:1.6}}>
          Refresh your catalog and branding by having the AI re-read your website. Useful after you&apos;ve updated your menu or site.
        </div>
        <div style={{marginBottom:20}}>
          <label style={label}>Website URL</label>
          <input type="url" value={rescanUrl} onChange={e=>setRescanUrl(e.target.value)} placeholder="https://yourwebsite.com" style={inp} autoCapitalize="none" autoCorrect="off"/>
        </div>
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <button onClick={()=>runRescan('catalog')} disabled={!rescanUrl.trim()||rescanning} style={rescanBtn('rgba(97,42,134,.3)')}>{rescanning?'…':'Catalog Only'}</button>
          <button onClick={()=>runRescan('branding')} disabled={!rescanUrl.trim()||rescanning} style={rescanBtn('rgba(97,42,134,.3)')}>{rescanning?'…':'Branding Only'}</button>
          <button onClick={()=>runRescan('full')} disabled={!rescanUrl.trim()||rescanning} style={rescanBtn('linear-gradient(135deg,#D67A31,#612A86)')}>{rescanning?'Scanning…':'Full Rescan'}</button>
        </div>
        <div style={{color:'#3A3450',fontSize:11,lineHeight:1.7,marginBottom:rescanning||rescanResult||rescanError?16:0}}>
          <strong style={{color:'#6A6080'}}>Catalog Only</strong> — adds new products, keeps your manual edits<br/>
          <strong style={{color:'#6A6080'}}>Branding Only</strong> — updates colors, logo, story, tagline<br/>
          <strong style={{color:'#6A6080'}}>Full Rescan</strong> — replaces all products, updates all branding (cannot be undone)
        </div>
        {rescanning && (
          <div style={{textAlign:'center',padding:'16px',background:'rgba(97,42,134,.06)',borderRadius:8}}>
            <div style={{color:'#D67A31',fontSize:13,marginBottom:4}}>Reading website…</div>
            <div style={{color:'#3A3450',fontSize:12}}>20-40 seconds. AI is extracting colors, story, and products.</div>
          </div>
        )}
        {rescanResult && !rescanning && (
          <div style={{padding:'14px 16px',background:'rgba(94,207,138,.08)',border:'1px solid rgba(94,207,138,.25)',borderRadius:8}}>
            <div style={{color:'#5ecf8a',fontSize:13,fontWeight:700,marginBottom:4}}>Rescan Complete</div>
            <div style={{color:'#F5F2E8',fontSize:13}}>Mode: <span style={{color:'#D67A31'}}>{rescanResult.mode}</span></div>
            {rescanResult.newProducts > 0 && <div style={{color:'#F5F2E8',fontSize:13}}>{rescanResult.newProducts} new products added</div>}
          </div>
        )}
        {rescanError && <div style={{color:'#e07070',fontSize:13,padding:'12px',background:'rgba(255,100,100,.08)',borderRadius:8}}>{rescanError}</div>}
      </div>
    </div>
  )
}
