'use client'
import { useState } from 'react'
export default function SetupPage() {
  const [url,setUrl]=useState('')
  const [email,setEmail]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [draft,setDraft]=useState<any>(null)
  const [published,setPublished]=useState<any>(null)
  async function buildDraft(e:React.FormEvent){
    e.preventDefault();setLoading(true);setError('');setDraft(null)
    try{
      const res=await fetch('/api/onboarding/url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})
      const json=await res.json()
      if(!res.ok)throw new Error(json.error||'Failed')
      setDraft(json.draft)
    }catch(err:any){setError(err.message)}
    setLoading(false)
  }
  async function publish(){
    if(!draft?.id)return;setLoading(true);setError('')
    try{
      const res=await fetch('/api/onboarding/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({draftId:draft.id,ownerEmail:email||undefined})})
      const json=await res.json()
      if(!res.ok)throw new Error(json.error||'Failed')
      setPublished(json)
    }catch(err:any){setError(err.message)}
    setLoading(false)
  }
  const inp = {width:'100%',padding:'13px 16px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.2)',borderRadius:10,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:15,outline:'none',boxSizing:'border-box' as const}
  const btn = {padding:'13px 20px',border:'none',borderRadius:10,background:'linear-gradient(135deg,#C9A84C,#a07830)',color:'#0a0603',fontWeight:700,cursor:'pointer',fontFamily:'Georgia, serif',fontSize:13}
  if(published)return(
    <div style={{minHeight:'100vh',background:'#0a0603',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia, serif'}}>
      <div style={{maxWidth:480,width:'100%',padding:'0 24px',textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:16}}>✦</div>
        <div style={{color:'#C9A84C',fontSize:11,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:8}}>Live</div>
        <div style={{color:'#F5ECD7',fontSize:28,fontWeight:700,marginBottom:8}}>{published.retailer?.name}</div>
        <div style={{color:'#6a5a3a',marginBottom:32}}>Your Poursona experience is live.</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <a href={published.links.storefront} target="_blank" style={{...btn,display:'block',textAlign:'center',textDecoration:'none'}}>View Customer Experience →</a>
          <a href={published.links.qr} download style={{display:'block',padding:'12px',border:'1px solid rgba(201,168,76,.2)',borderRadius:10,color:'#C9A84C',textAlign:'center',textDecoration:'none',fontSize:13}}>⊞ Download QR Code</a>
          <a href="/admin" style={{display:'block',padding:'12px',border:'1px solid rgba(201,168,76,.2)',borderRadius:10,color:'#C9A84C',textAlign:'center',textDecoration:'none',fontSize:13}}>◈ Go to Admin Portal</a>
        </div>
      </div>
    </div>
  )
  return(
    <div style={{minHeight:'100vh',background:'#0a0603',color:'#F5ECD7',padding:'48px 24px',fontFamily:'Georgia, serif'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{marginBottom:40}}>
          <div style={{color:'#C9A84C',fontSize:10,letterSpacing:'.35em',textTransform:'uppercase',marginBottom:8}}>Poursona</div>
          <div style={{fontSize:34,fontWeight:700,marginBottom:8}}>Vendor Setup</div>
          <div style={{color:'#6a5a3a',fontSize:15,lineHeight:1.7}}>Paste your website URL. Poursona reads your menu, branding, and catalog — then builds your AI guide automatically.</div>
        </div>
        {!draft?(
          <form onSubmit={buildDraft} style={{maxWidth:640}}>
            <div style={{marginBottom:16}}><label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',display:'block',marginBottom:8}}>Business Website URL</label><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://yourbrewery.com" style={inp} required/></div>
            <div style={{marginBottom:24}}><label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',display:'block',marginBottom:8}}>Your Email (for admin access)</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@yourbrewery.com" style={inp}/></div>
            {error&&<div style={{color:'#e07070',marginBottom:16,fontSize:13}}>{error}</div>}
            <button type="submit" disabled={!url||loading} style={{...btn,opacity:!url||loading?.5:1}}>{loading?'Reading your website…':'Build My AI Guide →'}</button>
          </form>
        ):(
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
              <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:24}}>
                <div style={{color:'#F5ECD7',fontSize:14,fontWeight:700,marginBottom:16}}>Detected Business</div>
                {draft.logo_url&&<img src={draft.logo_url} alt="logo" style={{height:48,marginBottom:12,borderRadius:6}}/>}
                {[['Name',draft.name],['URL','/r/'+draft.slug],['Type',draft.vertical],['Location',draft.location],['Tagline',draft.tagline]].map(([k,v])=>v?(<div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid rgba(201,168,76,.07)'}}><span style={{color:'#4a3a1a',fontSize:12}}>{k}</span><span style={{color:'#C9A84C',fontSize:12}}>{v}</span></div>):null)}
                {draft.brand_color&&<div style={{marginTop:12,display:'flex',alignItems:'center',gap:8}}><div style={{width:20,height:20,borderRadius:4,background:draft.brand_color,border:'1px solid rgba(255,255,255,.1)'}}/><span style={{color:'#6a5a3a',fontSize:12}}>{draft.brand_color}</span></div>}
              </div>
              <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:24}}>
                <div style={{color:'#F5ECD7',fontSize:14,fontWeight:700,marginBottom:4}}>Menu Items</div>
                <div style={{color:'#4a3a1a',fontSize:12,marginBottom:12}}>{(draft.menu_json||[]).length} products detected</div>
                <div style={{maxHeight:280,overflowY:'auto'}}>
                  {(draft.menu_json||[]).map((p:any,i:number)=>(
                    <div key={i} style={{padding:'8px 0',borderBottom:'1px solid rgba(201,168,76,.06)'}}>
                      <div style={{color:'#F5ECD7',fontSize:13}}>{p.name}</div>
                      <div style={{color:'#4a3a1a',fontSize:11}}>{[p.category,p.style,p.price!=null?'$'+p.price:null].filter(Boolean).join(' · ')}</div>
                    </div>
                  ))}
                </div>
              </div>
              {(draft.flight_json||[]).length>0&&(
                <div style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,padding:24,gridColumn:'1/-1'}}>
                  <div style={{color:'#F5ECD7',fontSize:14,fontWeight:700,marginBottom:12}}>Suggested Flights</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {(draft.flight_json||[]).map((f:any,i:number)=>(
                      <div key={i} style={{background:'rgba(201,168,76,.07)',border:'1px solid rgba(201,168,76,.15)',borderRadius:10,padding:'12px 16px'}}>
                        <div style={{color:'#C9A84C',fontSize:13,fontWeight:700}}>{f.name}</div>
                        <div style={{color:'#4a3a1a',fontSize:11,marginTop:2}}>{f.count} × {f.pour_size} · undefined</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error&&<div style={{color:'#e07070',marginBottom:16,fontSize:13}}>{error}</div>}
            <div style={{display:'flex',gap:12}}>
              <button onClick={publish} disabled={loading} style={{...btn,opacity:loading?.5:1}}>{loading?'Publishing…':'✦ Publish — Go Live'}</button>
              <button onClick={()=>setDraft(null)} style={{padding:'13px 20px',background:'transparent',border:'1px solid rgba(201,168,76,.2)',borderRadius:10,color:'#6a5a3a',cursor:'pointer',fontFamily:'Georgia, serif',fontSize:13}}>← Try Different URL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}