const OWNER='muneebaqureshi55@gmail.com';
const DEFAULT={businessName:'Lumo',businessPhone:'923095186022',pickupAddress:'',city:''};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function state(env){const obj=await env.BUCKET.get('pharmacy/state.json');return obj?{data:await obj.json(),etag:obj.etag}:{data:{products:JSON.parse(ASSETS['catalog.json']),config:DEFAULT},etag:null}}
export default {async fetch(req,env){const url=new URL(req.url),path=url.pathname;try{
if(path==='/api/manage'){
 if(req.headers.get('oai-authenticated-user-email')?.toLowerCase()!==OWNER)return json({error:'Sign in with the pharmacy owner account to manage the store.'},403);
 const current=await state(env);
 if(req.method==='GET')return json({...current.data,revision:current.etag||'initial'});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(req.headers.get('Origin')!==url.origin)return json({error:'Invalid request origin'},403);
 if(Number(req.headers.get('content-length')||0)>50000)return json({error:'Request too large'},413);
 const body=await req.json();if(body.revision!==(current.etag||'initial'))return json({error:'The catalogue changed in another session. Refresh this page before saving.'},409);
 const data=current.data;
 if(body.action==='settings'){const c=body.config||{};let phone=String(c.businessPhone||'').replace(/[\s()+-]/g,'');if(/^03\d{9}$/.test(phone))phone='92'+phone.slice(1);if(!/^[1-9]\d{7,14}$/.test(phone)||!String(c.businessName||'').trim())return json({error:'Enter a pharmacy name and valid WhatsApp number.'},400);data.config={businessName:String(c.businessName).trim().slice(0,100),businessPhone:phone,pickupAddress:String(c.pickupAddress||'').slice(0,500),city:String(c.city||'').slice(0,100)};
 }else if(body.action==='product'){const p=body.product||{};if(!p.id||!p.name?.trim()||!p.category?.trim()||p.price!==null&&(!Number.isFinite(p.price)||p.price<0||p.price>10000000)||p.image&&!/^https:\/\//.test(p.image))return json({error:'Check product name, category, price and HTTPS image URL.'},400);const clean={id:String(p.id).slice(0,100),name:p.name.trim().slice(0,200),category:p.category.trim().slice(0,180),price:p.price,vendor:String(p.vendor||'').slice(0,200),image:String(p.image||'').slice(0,2000),specs:String(p.specs||'').slice(0,10000)};const i=data.products.findIndex(x=>x.id===clean.id);if(i<0)data.products.push(clean);else data.products[i]=clean;
 }else if(body.action==='delete'){data.products=data.products.filter(p=>p.id!==body.id)}else return json({error:'Unknown action'},400);
 const result=await env.BUCKET.put('pharmacy/state.json',JSON.stringify(data),{onlyIf:current.etag?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});if(!result)return json({error:'Another edit was saved. Refresh and try again.'},409);return json({ok:true});
}
if(path==='/catalog.json')return json((await state(env)).data.products);
if(path==='/config.js'){const c=(await state(env)).data.config;return new Response('window.LUMO_CONFIG=Object.freeze('+JSON.stringify(c)+');',{headers:{'Content-Type':'text/javascript','Cache-Control':'no-store'}})}
const file=path==='/'?'index.html':path.slice(1);if(!(file in ASSETS))return new Response('Not found',{status:404});const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/json';return new Response(ASSETS[file],{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}catch(e){return json({error:'Service unavailable. Please retry; your changes have not been confirmed.'},503)}}};
