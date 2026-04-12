'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useActiveRetailer } from '@/lib/useActiveRetailer'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const EMPTY = { name:'',description:'',category:'',flavor_notes:'',price:'',abv:'',ibu:'',style:'',in_stock:true,sort_order:0 }
const FIELDS = [{k:'name',l:'Name *',t:'text'},{k:'category',l:'Category',t:'text'},{k:'style',l:'Style',t:'text'},{k:'description',l:'Description',t:'textarea'},{k:'flavor_notes',l:'Flavor Notes (for AI)',t:'textarea'},{k:'price',l:'Price ($)',t:'number'},{k:'abv',l:'ABV %',t:'text'},{k:'ibu',l:'IBU',t:'text'},{k:'sort_order',l:'Sort Order',t:'number'}]

export default function CatalogPage() {
  const { retailerId, retailer, loading: rLoading } = useActiveRetailer()
  const [products,setProducts]=useState<any[]>([])
  const [editing,setEditing]=useState<any|null>(null)
  const [isNew,setIsNew]=useState(false)
  const [saving,setSaving]=useState(false)
  const [loading,setLoading]=useState(true)

  useEffect(()=>{ if(retailerId) load() },[retailerId])

  async function load(){
    setLoading(true)
    const {data}=await sb.from('products').select('*').eq('retailer_id',retailerId!).order('sort_order')
    setProducts(data||[]);setLoading(false)
  }
  async function save(){
    if(!retailerId||!editing)return;setSaving(true)
    const payload={...editing,retailer_id:retailerId,price:editing.price?parseFloat(editing.price):null}
    const id=payload.id;delete payload.id
    if(isNew)await sb.from('products').insert(payload)
    else await sb.from('products').update(payload).eq('id',id)
    setSaving(false);setEditing(null);load()
  }
  async function toggleStock(id:string,cur:boolean){await sb.from('products').update({in_stock:!cur}).eq('id',id);setProducts(p=>p.map(x=>x.id===id?{...x,in_stock:!cur}:x))}
  async function del(id:string){if(!confirm('Delete?'))return;await sb.from('products').delete().eq('id',id);setProducts(p=>p.filter(x=>x.id!==id))}

  if(rLoading||loading)return <div style={{color:'#C9A84C'}}>Loading…</div>
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:32}}>
        <div>
          <div style={{color:'#C9A84C',fontSize:10,letterSpacing:'.3em',textTransform:'uppercase',marginBottom:4}}>Catalog</div>
          <div style={{color:'#F5ECD7',fontSize:26,fontWeight:700}}>Products</div>
          {retailer?.name&&<div style={{color:'#4a3a1a',fontSize:12,marginTop:4}}>{retailer.name}</div>}
        </div>
        <button onClick={()=>{setEditing({...EMPTY});setIsNew(true)}} style={{padding:'10px 20px',background:'linear-gradient(135deg,#C9A84C,#a07830)',border:'none',borderRadius:8,color:'#0a0603',fontFamily:'Georgia, serif',fontSize:12,fontWeight:700,cursor:'pointer'}}>+ Add Product</button>
      </div>
      <div style={{background:'linear-gradient(145deg,#0e0b06,#0a0805)',border:'1px solid rgba(201,168,76,.15)',borderRadius:14,overflow:'hidden'}}>
        {products.length===0?<div style={{padding:'48px 24px',textAlign:'center',color:'#4a3a1a',fontSize:14}}>No products yet.</div>:(
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1px solid rgba(201,168,76,.1)'}}>{['Name','Category','Price','In Stock',''].map(h=><th key={h} style={{padding:'12px 20px',textAlign:'left',color:'#4a3a1a',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',fontWeight:400}}>{h}</th>)}</tr></thead>
            <tbody>{products.map(p=>(
              <tr key={p.id} style={{borderBottom:'1px solid rgba(201,168,76,.05)'}}>
                <td style={{padding:'14px 20px'}}><div style={{color:'#F5ECD7',fontSize:14}}>{p.name}</div>{p.style&&<div style={{color:'#6a5a3a',fontSize:11,marginTop:2}}>{p.style}</div>}</td>
                <td style={{padding:'14px 20px',color:'#6a5a3a',fontSize:13}}>{p.category||'—'}</td>
                <td style={{padding:'14px 20px',color:'#C9A84C',fontSize:13}}>{p.price?'$'+p.price:'—'}</td>
                <td style={{padding:'14px 20px'}}><button onClick={()=>toggleStock(p.id,p.in_stock)} style={{padding:'4px 12px',borderRadius:20,border:'none',cursor:'pointer',background:p.in_stock?'rgba(94,207,138,.15)':'rgba(255,100,100,.1)',color:p.in_stock?'#5ecf8a':'#e07070',fontSize:11,fontFamily:'Georgia, serif'}}>{p.in_stock?'● In Stock':'○ Out'}</button></td>
                <td style={{padding:'14px 20px'}}><div style={{display:'flex',gap:8}}><button onClick={()=>{setEditing({...p});setIsNew(false)}} style={{background:'transparent',border:'1px solid rgba(201,168,76,.2)',borderRadius:6,padding:'5px 12px',color:'#C9A84C',cursor:'pointer',fontFamily:'Georgia, serif',fontSize:11}}>Edit</button><button onClick={()=>del(p.id)} style={{background:'transparent',border:'1px solid rgba(255,100,100,.2)',borderRadius:6,padding:'5px 12px',color:'#e07070',cursor:'pointer',fontFamily:'Georgia, serif',fontSize:11}}>Delete</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      {editing&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50,padding:24}}>
          <div style={{background:'#0e0b06',border:'1px solid rgba(201,168,76,.2)',borderRadius:18,padding:32,width:'100%',maxWidth:520,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{color:'#F5ECD7',fontSize:18,fontWeight:700,marginBottom:24}}>{isNew?'Add Product':'Edit Product'}</div>
            {FIELDS.map(({k,l,t})=>(
              <div key={k} style={{marginBottom:16}}>
                <label style={{color:'#C9A84C',fontSize:10,letterSpacing:'.15em',textTransform:'uppercase',display:'block',marginBottom:6}}>{l}</label>
                {t==='textarea'?<textarea value={editing[k]||''} onChange={e=>setEditing({...editing,[k]:e.target.value})} rows={3} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,resize:'vertical',outline:'none',boxSizing:'border-box'}}/>:<input type={t} value={editing[k]??''} onChange={e=>setEditing({...editing,[k]:e.target.value})} style={{width:'100%',padding:'10px 12px',background:'rgba(255,255,255,.04)',border:'1px solid rgba(201,168,76,.15)',borderRadius:8,color:'#F5ECD7',fontFamily:'Georgia, serif',fontSize:13,outline:'none',boxSizing:'border-box'}}/>}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}><input type="checkbox" id="stk" checked={editing.in_stock} onChange={e=>setEditing({...editing,in_stock:e.target.checked})}/><label htmlFor="stk" style={{color:'#F5ECD7',fontSize:13,cursor:'pointer'}}>In Stock</label></div>
            <div style={{display:'flex',gap:12}}>
              <button onClick={save} disabled={saving||!editing.name} style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#C9A84C,#a07830)',border:'none',borderRadius:8,color:'#0a0603',fontFamily:'Georgia, serif',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving…':'Save Product'}</button>
              <button onClick={()=>setEditing(null)} style={{padding:'12px 20px',background:'transparent',border:'1px solid rgba(201,168,76,.2)',borderRadius:8,color:'#6a5a3a',fontFamily:'Georgia, serif',fontSize:13,cursor:'pointer'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}