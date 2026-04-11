'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export default function OrdersPage() {
  const [orders,setOrders]=useState<any[]>([])
  const [sessions,setSessions]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState<'orders'|'sessions'>('orders')
  useEffect(()=>{(async()=>{
    const {data:{session}}=await sb.auth.getSession()
    if(!session)return
    const {data:au}=await sb.from('admin_users').select('retailer_id').eq('user_id',session.user.id).single()
    if(!au)return
    const rid=au.retailer_id
    const [o,s]=await Promise.all([sb.from('orders').select('*').eq('retailer_id',rid).order('created_at',{ascending:false}),sb.from('sessions').select('id,created_at,order_status,blend_name,messages').eq('retailer_id',rid).order('created_at',{ascending:false}).limit(50)])
    setOrders(o.data||[]);setSessions(s.data||[]);setLoading(false)
  })()},[])
  async function updateStatus(id:string,status:string){await sb.from('orders').update({status}).eq('id',id);setOrders(o=>o.map(x=>x.id===id?{...x,status}:x))}
  if(loading)return <div style={{color:'#C9A84C'}}>Loading…</div>
  return (
    <div>
      <div style={{marginBottom:32}}><div style={{color:'#C9A84C',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Activity</div><div style={{color:'#F5ECD7',fontSize:26,fontWeight:700}}>Orders & Sessions</div></div>
      <div style={{display:'flex',gap:4,marginBottom:24,background:'rgba(255,255,255,.03)',borderRadius:10,padding:4,width:'fit-content'}}>
        {(['orders','sessions'] as const).map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:'8px 20px',borderRadius:7,border:'none',background:tab===t?'rgba(201,168,76,.15)':'transparent',color:tab===t?'#C9A84C':'#4a3a1a',fontFamily:'Georgia, serif',fontSize:12,cursor:'pointer',textTransform:'capitalize'}}>{t} ({t==='orders'?orders.length:sessions.length})</button>)}
      </div>
      <div style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,overflow:'hidden'}}>
        {tab==='orders'&&(orders.length===0?<div style={{padding:'48px 24px',textAlign:'center',color:'#4a3a1a',fontSize:13}}>No orders yet.</div>:(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid rgba(201,168,76,.1)'}}>{['Selection','Items','Status','Date',''].map(h=><th key={h} style={{padding:'12px 20px',textAlign:'left',color:'#4a3a1a',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>{h}</th>)}</tr></thead>
            <tbody>{orders.map(o=>(
              <tr key={o.id} style={{borderBottom:'1px solid rgba(201,168,76,.05)'}}>
                <td style={{padding:'14px 20px'}}><div style={{color:'#F5ECD7',fontSize:13}}>{o.blend_name||'Order'}</div></td>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:12}}>{Array.isArray(o.items)?o.items.map((i:any)=>i.name).join(', '):'—'}</td>
                <td style={{padding:'14px 20px'}}><span style={{padding:'3px 10px',borderRadius:20,fontSize:11,background:o.status==='fulfilled'?'rgba(94,207,138,.12)':o.status==='cancelled'?'rgba(255,100,100,.1)':'rgba(201,168,76,.12)',color:o.status==='fulfilled'?'#5ecf8a':o.status==='cancelled'?'#e07070':'#C9A84C'}}>{o.status}</span></td>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:12}}>{new Date(o.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                <td style={{padding:'14px 20px'}}><select value={o.status} onChange={e=>updateStatus(o.id,e.target.value)} style={{background:'#0e0b06',border:'1px solid rgba(201,168,76,.2)',borderRadius:6,color:'#C9A84C',padding:'5px 8px',fontFamily:'Georgia, serif',fontSize:11,cursor:'pointer'}}><option value="pending">Pending</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></td>
              </tr>
            ))}</tbody>
          </table>
        ))}
        {tab==='sessions'&&(sessions.length===0?<div style={{padding:'48px 24px',textAlign:'center',color:'#4a3a1a',fontSize:13}}>No sessions yet.</div>:(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid rgba(201,168,76,.1)'}}>{['Session','Outcome','Messages','Date'].map(h=><th key={h} style={{padding:'12px 20px',textAlign:'left',color:'#4a3a1a',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>{h}</th>)}</tr></thead>
            <tbody>{sessions.map(s=>(
              <tr key={s.id} style={{borderBottom:'1px solid rgba(201,168,76,.05)'}}>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:12}}>{s.id.substring(0,8)}…</td>
                <td style={{padding:'14px 20px'}}>{s.blend_name?<span style={{color:'#C9A84C',fontSize:12}}>✦ {s.blend_name}</span>:<span style={{color:'#4a3a1a',fontSize:12}}>{s.order_status}</span>}</td>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:12}}>{Array.isArray(s.messages)?s.messages.length:0}</td>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:12}}>{new Date(s.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
              </tr>
            ))}</tbody>
          </table>
        ))}
      </div>
    </div>
  )
}