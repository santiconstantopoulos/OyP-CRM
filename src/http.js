import {snapshot,save,InputError} from './service.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function api(req,db,demo=false){
 try{
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/api/datos')return json(await snapshot(db,demo));
  if(req.method==='POST'&&url.pathname==='/api/guardar'){
   if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return json({error:'Origen de solicitud inválido.'},403);
   if(req.headers.get('sec-fetch-site')==='cross-site'||!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'Formato de solicitud inválido.'},415);
   if(Number(req.headers.get('content-length'))>32768)return json({error:'Los datos superan el tamaño permitido.'},413);
   const str=await req.text();if(str.length>32768)return json({error:'Los datos superan el tamaño permitido.'},413);
   let body;try{body=JSON.parse(str)}catch{return json({error:'Revisá los datos enviados.'},400)}
   return json(await save(db,body));
  }
  return json({error:'Ruta no disponible.'},404);
 }catch(e){if(e instanceof InputError)return json({error:e.message},e.status);console.error('No se completó la operación de base de datos.',e.name);return json({error:'No se pudo guardar o leer la ficha. Volvé a intentar.'},503)}
}
