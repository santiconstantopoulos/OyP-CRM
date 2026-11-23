export class InputError extends Error{constructor(message,status=422){super(message);this.status=status}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const todayAR=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const selectOrders='SELECT p.*, c.nombre,c.telefono,c.instagram, p.total-p.sena-p.final AS saldo FROM pedido p JOIN contacto c ON c.id=p.contacto_id';
export async function snapshot(db,demo=false){
  return {orders:await db.all(selectOrders+' ORDER BY p.creado DESC,p.id'),contacts:await db.all('SELECT * FROM contacto ORDER BY nombre'),today:todayAR(),demo};
}
function string(value,label,max){if(value==null)return '';if(typeof value!=='string'||value.trim().length>max)throw new InputError('Revisá '+label+' (máximo '+max+' caracteres).');return value.trim()}
export function cents(value,label){
  const s=String(value??'').trim();
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)&&!/^\d+\.\d{1,2}$/.test(s))throw new InputError('Revisá '+label+'. Ingresá pesos con hasta dos decimales.');
  const parts=(/^\d+\.\d{1,2}$/.test(s)?s:s.replaceAll('.','').replace(',','.')).split('.');
  const amount=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
  if(!Number.isSafeInteger(amount)||amount<=0)throw new InputError('El importe de '+label+' debe ser mayor que cero y estar dentro del rango admitido.');
  return amount;
}
function transition(p,body,now){
  const steps={senar:['consulta','senado'],encargar:['senado','encargado'],recibir:['encargado','listo'],entregar:['listo','entregado'],cerrar:['consulta','cerrado'],seguir:['consulta','consulta']};
  const step=Object.hasOwn(steps,body.accion)&&steps[body.accion];
  if(!step||step[0]!==p.estado)throw new InputError('La ficha cambió o la acción no corresponde al estado actual.',409);
  if(p.version!==body.version)throw new InputError('La ficha cambió. Abrila nuevamente para ver el último estado.',409);
  const fields={estado:step[1]};
  if(body.accion==='senar'){
    fields.detalle=string(body.detalle,'el producto',2500);
    if(!fields.detalle)throw new InputError('Completá el detalle del pedido antes de registrar la seña.');
    fields.total=cents(body.total,'precio total');fields.sena=cents(body.sena,'seña');
    if(fields.sena>fields.total)throw new InputError('La seña no puede superar el precio total.');
    fields.senado=now;
  }else if(body.accion==='seguir'){
    fields.proxima=string(body.proxima,'la próxima acción',500);fields.fecha=string(body.fecha,'la fecha',10)||null;
    if(fields.fecha){const date=new Date(fields.fecha+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.fecha)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==fields.fecha)throw new InputError('Ingresá una fecha válida.')}
  }else{
    if(body.confirmado!==true)throw new InputError('Confirmá la operación para guardarla.');
    const milestone={encargar:'encargado',recibir:'recibido',entregar:'entregado',cerrar:'cerrado'}[body.accion];fields[milestone]=now;
    if(body.accion==='entregar'&&p.saldo>0)fields.final=p.saldo;
  }
  return fields;
}
async function original(db,key,firma){
 const op=await db.one('SELECT pedido_id,firma FROM operacion WHERE clave=?',[key]);
 if(!op)return null;
 if(op.firma!==firma)throw new InputError('Esta operación ya se guardó con otros datos. Volvé a abrir la ficha.',409);
 return {id:op.pedido_id};
}
export async function save(db,body){
 if(!body||typeof body!=='object'||!uuid.test(body.clave||''))throw new InputError('Falta el identificador de la operación.');
 const key=body.clave;
 const canon=JSON.stringify(body,Object.keys(body).sort());
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canon));
 const firma=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
 const previous=await original(db,key,firma);if(previous)return previous;
 const now=new Date().toISOString(), stmts=[];
 let id=body.id;
 if(body.accion==='crear'){
   id=key;let contact=body.contacto_id;
   if(contact){if(typeof contact!=='string'||!await db.one('SELECT id FROM contacto WHERE id=?',[contact]))throw new InputError('Elegí un contacto existente.')}
   else{
     const nombre=string(body.nombre,'el nombre',120), tel=string(body.telefono,'WhatsApp',32);
     const instagram=string(body.instagram,'Instagram',80).replace(/^@/,'');
     if(!nombre)throw new InputError('Ingresá el nombre del contacto.');
     if(!tel&&!instagram)throw new InputError('Ingresá un WhatsApp o un usuario de Instagram.');
     if(tel&&(!/^[+\d ()-]+$/.test(tel)||!/^\d{7,15}$/.test(tel.replace(/\D/g,''))))throw new InputError('Revisá el teléfono e incluí el código de área.');
     if(instagram&&!/^[A-Za-z0-9._]{1,30}$/.test(instagram))throw new InputError('Revisá el usuario de Instagram.');
     contact=key;stmts.push(['INSERT INTO contacto(id,nombre,telefono,instagram) VALUES (?,?,?,?)',[contact,nombre,tel,instagram]]);
   }
   stmts.push(['INSERT INTO pedido(id,contacto_id,detalle,creado,ultima_clave) VALUES (?,?,?,?,?)',[id,contact,string(body.detalle,'el detalle',2500),now,key]]);
 }else{
   if(typeof id!=='string')throw new InputError('Seleccioná una ficha.');
   const p=await db.one(selectOrders+' WHERE p.id=?',[id]);if(!p)throw new InputError('No se encontró el pedido.',404);
   let fields;try{fields=transition(p,body,now)}catch(e){const done=await original(db,key,firma);if(done)return done;throw e}
   const columns=Object.keys(fields).map(c=>c+'=?').join(',');
   stmts.push(['UPDATE pedido SET '+columns+',version=version+1,ultima_clave=? WHERE id=? AND estado=? AND version=?',[...Object.values(fields),key,id,p.estado,p.version]]);
 }
 stmts.push(['INSERT INTO operacion(clave,pedido_id,tipo,firma) SELECT ?,id,?,? FROM pedido WHERE id=? AND ultima_clave=?',[key,body.accion,firma,id,key]]);
 try{await db.batch(stmts)}catch(e){const done=await original(db,key,firma);if(done)return done;throw e}
 const result=await original(db,key,firma);if(!result)throw new InputError('Otra operación actualizó esta ficha. Volvé a abrirla.',409);return result;
}
