'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
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
    const {data:{session}}=await sb.auth.getSession()
    if(!session)return
    const {data:au}=await sb.from('admin_users').select('retailer_id').eq('user_id',session.user.id).single()
    if(!au)return
    setRid(au.retailer_id)
    const {data}=await sb.from('flights').select('*').eq('retailer_id',au.retailer_id).order('sort_order')
    setFlights(data||[]);setLoading(false)
  }
  async function save(){
    if(!rid||!editing)return;setSaving(true)
    const payload={...editing,retailer_id:rid,price:editing.price?parseFloat(editing.price):0}
    const id=payload.id;delete payload.id
    if(isNew)await sb.from('flights').insert(payload)
    else await sb.from('flights').update(payload).eq('id',id)
    setSaving(false);setEditing(null);load()
  }
  async function toggle(id:string,cur:boolean){await sb.from('flights').update({active:!cur}).eq('id',id);setFlights(f=>f.map(x=>x.id===id?{...x,active:!cur}:x))}
  async function del(id:string){if(!confirm('Delete?'))return;await sb.from('flights').delete().eq('id',id);setFlights(f=>f.filter(x=>x.id!==id))}
  if(loading)return <div style={{color:'#C9A84C'}}>Loading…</div>
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32}}>
        <div><div style={{color:'#C9A84C',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Catalog</div><div style={{color:'#F5ECD7',fontSize:26,fontWeight:700}}>Flights</div></div>
        <button onClick={()=>{setEditing({...EMPTY});setIsNew(true)}} style={{padding:'10px 20px',background:'linear-gradient(135deg,#C9A84C,#a07830)',border:'none',borderRadius:8,color:'#0a0603',fontFamily:'Georgia, serif',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Add Flight</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
        {flights.length===0&&<div style={{background:'rgba(201,168,76,.04)',border:'1px dashed rgba(201,168,76,.2)',borderRadius:14,padding:'48px 24px',textAlign:'center',color:'#4a3a1a',fontSize:13,gridColumn:'1/-1'}}>No flights yet.</div>}
        {flights.map(f=>(
          <div key={f.id} style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid '+(f.active?'rgba(201,168,76,.2)':'rgba(255,255,255,.06)'),borderRadius:14,padding:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
              <div><div style={{color:'#F5ECD7',fontSize:15,fontWeight:700}}>{f.name}</div><div style={{color:'#C9A84C',fontSize:12,marginTop:2}}>undefined · {f.count} × {f.pour_size}</div></div>
              <button onClick={()=>toggle(f.id,f.active)} style={{padding:'3px 10px',borderRadius:20,border:'none',cursor:'pointer',background:f.active?'rgba(94,207,138,.15)':'rgba(255,100,100,.1)',color:f.active?'#5ecf8a':'#e07070',fontSize:11,fontFamily:'Georgia, serif'}}>{f.active?'● Active':'○ Off'}</button>
            </div>
            {f.description&&<div style={{color:'#6a5a3a',fontSize:12,lineHeight:1.6,marginBottom:14}}>{f.description}</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setEditing({...f});setIsNew(false)}} style={{flex:1,padding:'8px',background:'transparent',border:'1px solid rgba(201,168,76,.2)',borderRadius:6,color:'#C9A84C',cursor:'pointer',fontFamily:'Georgia, serif',fontSize:11}}>Edit</button>
              <button onClick={()=>del(f.id)} style={{padding:'8px 12px',background:'transparent',border:'1px solid rgba(255,100,100,.2)',borderRadius:6,color:'#e07070',cursor:'pointer',fontFamily:'Georgia, serif',fontSize:11}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      {editing&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:24}}>
          <div style={{background:'#0e0b06',border:'1px solid rgba(201,168,76,.2)',borderRadius:18,padding:32,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{color:'#F5ECD7',fontSize:18,fontWeight:700,marginBottom:24}}>{isNew?'Add Flight':'Edit Flight'}</div>
            {[{k:'name',l:'Name *',t:'text'},{k:'description',l:'Description',t:'textarea'},{k:'count',l:'Pours',t:'number'},{k:'pour_size',l:'Pour Size',t:'text'},{k:'price',l:'Price ($)',t:'number'},{k:'sort_order',l:'Sort Order',t:'number'}].map(({k,l,t})=>(
              <div key={k} style={{marginBottom:16}}>
                <label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                {t==='textarea'?<textarea value={editing[k]||''} onChange={e=>setEditing({...editing,[k]:e.target.value})} rows={3} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,resize:'vertical',outline:'none',boxSizing:'border-box'}}/>:<input type={t} value={editing[k]??''} onChange={e=>setEditing({...editing,[k]:e.target.value})} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,outline:'none',boxSizing:'border-box'}}/>}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}><input type="checkbox" id="act" checked={editing.active} onChange={e=>setEditing({...editing,active:e.target.checked})}/><label htmlFor="act" style={{color:'#F5ECD7',fontSize:13,cursor:'pointer'}}>Active</label></div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={save} disabled={saving||!editing.name} style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#C9A84C,#a07830)',border:'none',borderRadius:8,color:'#0a0603',fontFamily:'Georgia, serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':'Save'}</button>
              <button onClick={()=>setEditing(null)} style={{padding:'12px 20px',background:'transparent',border:'1px solid rgba(201,168,76,.2)',borderRadius:8,color:'#6a5a3a',fontFamily:'Georgia, serif',fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}