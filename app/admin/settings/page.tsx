'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function SettingsPage() {
  const [retailer,setRetailer]=useState<any>(null)
  const [form,setForm]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{(async()=>{
    const {data:{session}}=await sb.auth.getSession()
    if(!session)return
    const {data:au}=await sb.from('admin_users').select('retailer_id,retailers(*)').eq('user_id',session.user.id).single()
    if(!au?.retailers)return
    setRetailer(au.retailers);setForm({...au.retailers});setLoading(false)
  })()},[])
  async function save(e:React.FormEvent){
    e.preventDefault();if(!retailer)return;setSaving(true)
    await sb.from('retailers').update({name:form.name,tagline:form.tagline,location:form.location,brand_color:form.brand_color}).eq('id',retailer.id)
    setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),3000)
  }
  if(loading)return <div style={{color:'#C9A84C'}}>Loading…</div>
  return (
    <div>
      <div style={{marginBottom:32}}><div style={{color:'#C9A84C',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Config</div><div style={{color:'#F5ECD7',fontSize:26,fontWeight:700}}>Settings</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        <div style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:'28px 24px'}}>
          <div style={{color:'#F5ECD7',fontSize:15,fontWeight:700,marginBottom:20}}>Retailer Profile</div>
          <form onSubmit={save}>
            {[{k:'name',l:'Business Name'},{k:'tagline',l:'Tagline'},{k:'location',l:'Location'}].map(({k,l})=>(
              <div key={k} style={{marginBottom:16}}>
                <label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                <input value={form?.[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <div style={{marginBottom:24}}>
              <label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>Brand Color</label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <input type="color" value={form?.brand_color||'#C9A84C'} onChange={e=>setForm({...form,brand_color:e.target.value})} style={{width:44,height:44,border:'none',borderRadius:8,cursor:'pointer'}}/>
                <input value={form?.brand_color||''} onChange={e=>setForm({...form,brand_color:e.target.value})} style={{flex:1,padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,outline:'none'}}/>
              </div>
            </div>
            <button type="submit" disabled={saving} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#C9A84C,#a07830)',border:'none',borderRadius:8,color:'#0a0603',fontFamily:'Georgia, serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':saved?'✓ Saved':'Save Changes'}</button>
          </form>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:'28px 24px'}}>
            <div style={{color:'#F5ECD7',fontSize:15,fontWeight:700,marginBottom:16}}>Your QR Code</div>
            <div style={{textAlign:'center',padding:'20px 0'}}><img src={'/api/qr?slug='+retailer?.slug} alt="QR" style={{width:160,height:160,borderRadius:8}}/></div>
            <div style={{color:'#4a3a1a',fontSize:12,textAlign:'center',marginBottom:16}}>pour-sona.vercel.app/r/{retailer?.slug}</div>
            <a href={'/api/qr?slug='+retailer?.slug+'&format=png'} download style={{display:'block',textAlign:'center',padding:'10px',background:'rgba(201,168,76,.08)',border:'1px solid rgba(201,168,76,.2)',borderRadius:8,color:'#C9A84C',textDecoration:'none',fontSize:12}}>↓ Download PNG</a>
          </div>
          <div style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:'24px'}}>
            <div style={{color:'#F5ECD7',fontSize:14,fontWeight:700,marginBottom:12}}>Account Info</div>
            {[['Slug',retailer?.slug],['Vertical',retailer?.vertical],['Plan',retailer?.subscription_tier||'starter'],['Status',retailer?.subscription_status||'trial']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(201,168,76,.06)'}}>
                <span style={{color:'#4a3a1a',fontSize:12}}>{l}</span><span style={{color:'#C9A84C',fontSize:12}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}