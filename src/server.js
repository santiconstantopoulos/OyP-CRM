import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash,timingSafeEqual} from 'node:crypto';
import {openDb} from './local-db.js';
import {seed} from './seed.js';
import {api} from './http.js';
const demo=process.argv.includes('--demo');
const arg=k=>{const i=process.argv.indexOf(k);return i<0?undefined:process.argv[i+1]};
const port=Number(arg('--port')||process.env.PORT||3000),host=arg('--host')||process.env.HOST||'127.0.0.1';
const password=process.env.CRM_PASSWORD;
if(!demo&&!password)throw Error('Configurá CRM_PASSWORD en .env antes de iniciar el consultorio. Consultá README.md.');
const db=openDb(demo?':memory:':process.env.CRM_DB||'data/consultorio.sqlite');
if(demo)await seed(db);
const types={'/':'text/html; charset=utf-8','/app.js':'text/javascript; charset=utf-8','/estilos.css':'text/css; charset=utf-8','/oyp.png':'image/png','/plantillas.webp':'image/webp'};
const digest=v=>createHash('sha256').update(v).digest();
const server=createServer(async (req,res)=>{
 try{
  const auth='Basic '+Buffer.from('consultorio:'+password).toString('base64');
  if(!demo&&!timingSafeEqual(digest(req.headers.authorization||''),digest(auth))){res.writeHead(401,{'WWW-Authenticate':'Basic realm="OyP Consultorio", charset="UTF-8"','Cache-Control':'no-store'});res.end('Ingresá con tu usuario del consultorio.');return}
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){
   const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>32768){res.writeHead(413);res.end();return}chunks.push(chunk)}
   const origin=req.headers.origin;let base='http://'+req.headers.host;
   if(origin){const u=new URL(origin);if(u.host!==req.headers.host){res.writeHead(403);res.end();return}base=u.origin}
   const request=new Request(new URL(path,base),{method:req.method,headers:req.headers,body:['POST','PUT'].includes(req.method)?Buffer.concat(chunks):undefined});
   const result=await api(request,db,demo);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());return
  }
  if(req.method!=='GET'||!Object.hasOwn(types,path)){res.writeHead(404);res.end();return}
  const file=await readFile(new URL('../public/'+(path==='/'?'index.html':path.slice(1)),import.meta.url));
  res.writeHead(200,{'Content-Type':types[path],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(file);
 }catch{res.writeHead(500);res.end('No se completó la solicitud.')}
});
server.listen(port,host,()=>console.log('OyP '+(demo?'· Prototipo ficticio ':'')+'· http://'+host+':'+port));
