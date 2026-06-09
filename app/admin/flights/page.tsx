'use client'
import { useEffect, useState } from 'react'
import { loadAdminAccess } from '@/lib/admin-access'
const EMPTY = {name:'',description:'',count:4,pour_size:'4oz',price:'',active:true,sort_order:0}
export default function FlightsPage() {
  const [flights,setFlights]=useState<any[]>([])
  const [rid,setRid]=useState<string|null>(null)
  const [editing,setEditing]=useState<any|null>(null)
  const [isNew,setIsNew]=useState(false)
  const [saving,setSaving]=useState(false)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{load()},[])
  async function load(){
    const access = await loadAdminAccess()
    const nextRid = (typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('active_retailer') || 'null')?.id : null) || access.retailers?.[0]?.id
    if(!nextRid){setLoading(false);return}
    setRid(nextRid)
    const res = await fetch(`/api/admin/flights?retailerId=${encodeURIComponent(nextRid)}`, { cache: 'no-store' })
    const json = await res.json()
    if(!res.ok || !json?.ok){console.error('[admin/flights] load failed:', json);setLoading(false);return}
    setFlights(json.flights||[]);setLoading(false)
  }
  async function save(){
    if(!rid||!editing)return;setSaving(true)
    const payload={...editing,retailer_id:rid,price:editing.price?parseFloat(editing.price):0}
    const id=payload.id;delete payload.id
    const res=await fetch('/api/admin/flights',{method:isNew?'POST':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(isNew?{retailerId:rid,...payload}:{retailerId:rid,id,...payload})})
    const json=await res.json()
    if(!res.ok||!json?.ok){console.error('[admin/flights] save failed:',json);setSaving(false);return}
    setSaving(false);setEditing(null);load()
  }
  async function toggle(id:string,cur:boolean){if(!rid)return;const res=await fetch('/api/admin/flights',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({retailerId:rid,id,active:!cur})});const json=await res.json();if(!res.ok||!json?.ok){console.error('[admin/flights] toggle failed:',json);return}setFlights(f=>f.map(x=>x.id===id?{...x,active:!cur}:x))}
  async function del(id:string){if(!confirm('Delete?')||!rid)return;const res=await fetch(`/api/admin/flights?retailerId=${encodeURIComponent(rid)}&id=${encodeURIComponent(id)}`,{method:'DELETE'});const json=await res.json();if(!res.ok||!json?.ok){console.error('[admin/flights] delete failed:',json);return}setFlights(f=>f.filter(x=>x.id!==id))}
  if(loading)return <div style={{color:'#D67A31'}}>Loading…</div>
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32}}>
        <div><div style={{color:'#D67A31',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Catalog</div><div style={{color:'#F5F2E8',fontSize:26,fontWeight:700}}>Flights</div></div>
        <button onClick={()=>{setEditing({...EMPTY});setIsNew(true)}} style={{padding:'10px 20px',background:'linear-gradient(135deg,#D67A31,#612A86)',border:'none',borderRadius:8,color:'#12111A',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Add Flight</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {flights.length===0&&<div style={{background:'rgba(97,42,134,.04)',border:'1px dashed rgba(97,42,134,.2)',borderRadius:14,padding:'48px 24px',textAlign:'center',color:'#3A3450',fontSize:13,gridColumn:'1/-1'}}>No flights yet.</div>}
        {flights.map(f=>(
          <div key={f.id} style={{background:'linear-gradient(145deg,#1C1A2A,#161423)',border:'1px solid '+(f.active?'rgba(97,42,134,.2)':'rgba(255,255,255,.06)'),borderRadius:14,padding:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div><div style={{color:'#F5F2E8',fontSize:15,fontWeight:700}}>{f.name}</div><div style={{color:'#D67A31',fontSize:12,marginTop:2}}>{f.price != null ? '$' + Number(f.price).toFixed(2) : '—'} · {f.count} × {f.pour_size}</div></div>
              <button onClick={()=>toggle(f.id,f.active)} style={{padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',background:f.active?'rgba(94,207,138,.15)':'rgba(255,100,100,.1)',color:f.active?'#5ecf8a':'#e07070',fontSize:11,fontFamily:"var(--font-inter), system-ui, sans-serif"}}>{f.active?'● Active':'○ Off'}</button>
            </div>
            {f.description&&<div style={{color:'#6A6080',fontSize:12,lineHeight:1.6,marginBottom:14}}>{f.description}</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setEditing({...f});setIsNew(false)}} style={{flex:1,padding:'8px',background:'transparent',border:'1px solid rgba(97,42,134,.2)',borderRadius:6,color:'#D67A31',cursor:'pointer',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:11}}>Edit</button>
              <button onClick={()=>del(f.id)} style={{padding:'8px 12px',background:'transparent',border:'1px solid rgba(255,100,100,.2)',borderRadius:6,color:'#e07070',cursor:'pointer',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:11}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {editing&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:24}}>
          <div style={{background:'#1C1A2A',border:'1px solid rgba(97,42,134,.2)',borderRadius:18,padding:32,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{color:'#F5F2E8',fontSize:18,fontWeight:700,marginBottom:24}}>{isNew?'Add Flight':'Edit Flight'}</div>
            {[{k:'name',l:'Name *',t:'text'},{k:'description',l:'Description',t:'textarea'},{k:'count',l:'Pours',t:'number'},{k:'pour_size',l:'Pour Size',t:'text'},{k:'price',l:'Price ($)',t:'number'},{k:'sort_order',l:'Sort Order',t:'number'}].map(({k,l,t})=>(
              <div key={k} style={{marginBottom:16}}>
                <label style={{color:'#D67A31',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                {t==='textarea'?<textarea value={editing[k]||''} onChange={e=>setEditing({...editing,[k]:e.target.value})} rows={3} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(97,42,134,.15)',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,resize:'vertical',outline:'none',boxSizing:'border-box'}}/>:<input type={t} value={editing[k]??''} onChange={e=>setEditing({...editing,[k]:e.target.value})} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(97,42,134,.15)',borderRadius:8,color:'#F5F2E8',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,outline:'none',boxSizing:'border-box'}}/>}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}><input type="checkbox" id="act" checked={editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/><label htmlFor="act" style={{color:'#F5F2E8',fontSize:13,cursor:'pointer'}}>Active</label></div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={save} disabled={saving||!editing.name} style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#D67A31,#612A86)',border:'none',borderRadius:8,color:'#12111A',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':'Save'}</button>
              <button onClick={()=>setEditing(null)} style={{padding:'12px 20px',background:'transparent',border:'1px solid rgba(97,42,134,.2)',borderRadius:8,color:'#6A6080',fontFamily:"var(--font-inter), system-ui, sans-serif",fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
