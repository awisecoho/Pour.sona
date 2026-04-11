export interface BrandTheme {
  primary: string; primaryDim: string; bg: string; surface: string; surfaceHover: string
  border: string; borderStrong: string; text: string; textMuted: string; textFaint: string
}
function hexToHsl(hex: string): [number,number,number] {
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255
  const max=Math.max(r,g,b),min=Math.min(r,g,b);let h=0,s=0;const l=(max+min)/2
  if(max!==min){const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break}}
  return [Math.round(h*360),Math.round(s*100),Math.round(l*100)]
}
function hslToHex(h:number,s:number,l:number):string{
  s/=100;l/=100;const k=(n:number)=>(n+h/30)%12;const a=s*Math.min(l,1-l);const f=(n:number)=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)))
  return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')
}
export function deriveTheme(brandColor:string):BrandTheme{
  let hex=brandColor?.trim()||'#C9A84C';if(!hex.startsWith('#')||hex.length<7)hex='#C9A84C'
  try{const[h,s]=hexToHsl(hex);const cs=Math.max(20,Math.min(s,80));return{primary:hex,primaryDim:hex+'99',bg:hslToHex(h,Math.min(cs,40),5),surface:hslToHex(h,Math.min(cs,30),9),surfaceHover:hslToHex(h,Math.min(cs,25),12),border:hex+'25',borderStrong:hex+'55',text:hslToHex(h,15,92),textMuted:hslToHex(h,12,65),textFaint:hslToHex(h,10,35)}}
  catch{return{primary:'#C9A84C',primaryDim:'#C9A84C99',bg:'#0a0603',surface:'#0e0b06',surfaceHover:'#120e08',border:'#C9A84C25',borderStrong:'#C9A84C55',text:'#F5ECD7',textMuted:'#a09070',textFaint:'#4a3a1a'}}
}
export function getVerticalVoice(vertical:string,categories:string[]){
  const hasCocktails=categories.some(c=>c?.toLowerCase().includes('cocktail'))
  const hasSpirits=categories.some(c=>['spirit','whiskey','bourbon','gin','vodka','rum','tequila','scotch','whisky'].some(s=>c?.toLowerCase().includes(s)))
  switch(vertical){
    case 'brewery':return{icon:'🍺',greeting:'taproom guide',placeholder:'What are you in the mood for?',cta:'Find My Beer',singleLabel:'Your Pour',flightLabel:'Your Flight'}
    case 'winery':return{icon:'🍷',greeting:'wine guide',placeholder:'Tell me about your taste…',cta:'Find My Wine',singleLabel:'Your Selection',flightLabel:'Your Tasting'}
    case 'distillery':return{icon:hasCocktails?'🍸':'🥃',greeting:'spirits guide',placeholder:hasCocktails?'Cocktail or spirit — what sounds good?':'Tell me what you enjoy…',cta:hasCocktails?'Find My Drink':'Find My Spirit',singleLabel:hasSpirits?'Your Pour':'Your Cocktail',flightLabel:'Your Tasting Flight'}
    case 'coffee':return{icon:'☕',greeting:'coffee guide',placeholder:'What are you feeling today?',cta:'Find My Coffee',singleLabel:'Your Cup',flightLabel:'Your Tasting'}
    default:return{icon:'✦',greeting:'guide',placeholder:'What sounds good?',cta:'Get Started',singleLabel:'Your Selection',flightLabel:'Your Tasting'}
  }
}