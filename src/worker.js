// Sites autentica al titular antes de ejecutar este módulo.
import {api} from './http.js';
import {assets} from './assets.generated.js';

function d1Store(binding){
 const statement=(sql,args=[])=>binding.prepare(sql).bind(...args);
 return {
   all:async(sql,args)=>(await statement(sql,args).all()).results,
   one:(sql,args)=>statement(sql,args).first(),
   batch:stmts=>binding.batch(stmts.map(([sql,args])=>statement(sql,args)))
 };
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!request.headers.get('oai-authenticated-user-id')) return new Response('Ingresá con la cuenta titular del consultorio.',{status:401,headers:{'Cache-Control':'no-store'}});
  if(url.pathname.startsWith('/api/'))return api(request,d1Store(env.DB));
  const item=Object.hasOwn(assets,url.pathname)&&assets[url.pathname];
  if(!item||request.method!=='GET')return new Response('Página no encontrada.',{status:404});
  const headers={'Content-Type':item.type,'Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
  if(item.filename)headers['Content-Disposition']='attachment; filename="'+item.filename+'"';
  return new Response(item.binary?Uint8Array.from(atob(item.data),c=>c.charCodeAt(0)):item.data,{headers});
 }
};
