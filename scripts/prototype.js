import { readFile, writeFile } from "node:fs/promises";
import { openDb } from "../src/local-db.js";
import { seed } from "../src/seed.js";
import { snapshot } from "../src/service.js";
const db = openDb(":memory:");
await seed(db);
const data = await snapshot(db, true);
db.close();
const read = (name) => readFile(new URL("../public/" + name, import.meta.url));
let html = String(await read("index.html"));
let js = String(await read("app.js"));
const domain = String(
  await readFile(new URL("../src/service.js", import.meta.url)),
)
  .split("async function original")[0]
  .replaceAll("export ", "");
const demo = `async function api(path,b){
 const state=window.demoState;
 if(path==='datos')return state;
 if(!b)throw Error('Operación inválida.');
 if(b.accion==='crear'){
  let c=state.contacts.find(c=>c.id===b.contacto_id);
  if(!c){if(!b.nombre?.trim()||!(b.instagram?.trim()||b.telefono?.trim()))throw Error('Ingresá el nombre y al menos un contacto.');c={id:b.clave,nombre:b.nombre,telefono:b.telefono,instagram:b.instagram.replace(/^@/,'')};state.contacts.push(c)}
  state.orders.unshift({...c,id:b.clave,contacto_id:c.id,estado:'consulta',creado:new Date().toISOString(),detalle:b.detalle,total:null,sena:null,final:0,saldo:null,version:1,fecha:null,proxima:''});return {id:b.clave}
 }
 const o=state.orders.find(o=>o.id===b.id);const changes=demoTransition(o,b,new Date().toISOString());Object.assign(o,changes);o.version++;o.saldo=o.total===null?null:o.total-o.sena-o.final;return {id:o.id}
}`;
js =
  js.slice(0, js.indexOf("async function api(")) +
  demo +
  "\n" +
  js.slice(js.indexOf("async function render()"));
const refreshDates = `const currentDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const delta=Date.parse(currentDay+'T12:00:00Z')-Date.parse(window.demoState.today+'T12:00:00Z');
window.demoState.today=currentDay;
for(const o of window.demoState.orders){for(const k of ['creado','senado','encargado','recibido','entregado','cerrado','fecha']){if(o[k]){const day=k==='fecha';const next=new Date(Date.parse(o[k]+(day?'T12:00:00Z':''))+delta).toISOString();o[k]=day?next.slice(0,10):next}}}`;
js =
  "window.demoState=" +
  JSON.stringify(data) +
  ";\n" +
  refreshDates +
  "\nconst demoTransition=(()=>{" +
  domain +
  ";return transition;})();\n" +
  js;
js = js.replace(
  "Prototipo con datos ficticios.",
  "Prototipo con datos ficticios. Los cambios se reinician al volver a abrirlo.",
);
const img = async (path, mime) =>
  "data:" + mime + ";base64," + (await read(path)).toString("base64");
const logo = await img("oyp.png", "image/png"),
  insoles = await img("plantillas.webp", "image/webp");
html = html
  .replace('<script type="module" src="/app.js"></script>', "")
  .replace(
    /<link\s+rel="stylesheet"\s+href="\/estilos\.css"\s*\/?>/,
    "<style>" + (await read("estilos.css")) + "</style>",
  )
  .replaceAll("/oyp.png", logo);
js = js.replaceAll("/plantillas.webp", insoles);
html = html.replace(
  "</body>",
  () =>
    '<script type="module">' +
    js.replaceAll("</script", "<\\/script") +
    "</script></body>",
);
await writeFile(process.argv[2] || "prototipo.html", html);
