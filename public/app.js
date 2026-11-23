const main=document.getElementById('main');
const nav=document.querySelector('nav');
const symbols={
  box:'<path d="m3 7 9-5 9 5v10l-9 5-9-5zM3 7l9 5 9-5m-9 5v10M7.5 4.5l9 5"/>',
  bag:'<path d="M5 8h14l1 13H4L5 8Z M8 9V6a4 4 0 0 1 8 0v3m-7 5 2 2 4-4"/>',
  search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',back:'<path d="m15 5-7 7 7 7"/>',
  chat:'<path d="M4 4h16v13H9l-5 4V4Z"/><path d="M8 9h8m-8 4h5"/>',
  truck:'<path d="M2 5h12v12H2zM14 10h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8m-10 4h6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'
};
function icon(name,classes=''){return '<svg viewBox="0 0 24 24" class="ic '+classes+'" aria-hidden="true">'+symbols[name]+'</svg>'}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const states={consulta:'Consulta',senado:'Señado',encargado:'Pedido al proveedor',listo:'Listo para entregar',entregado:'Entregado y cobrado',cerrado:'Cerrado sin venta'};
const tz='America/Argentina/Buenos_Aires';
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:n%100?2:0,maximumFractionDigits:2}).format(n/100);
const fmt=(v,opts={day:'numeric',month:'short',year:'numeric'})=>new Intl.DateTimeFormat('es-AR',{timeZone:tz,...opts}).format(new Date(v.length===10?v+'T12:00:00Z':v));
const upper=s=>s.charAt(0).toLocaleUpperCase('es-AR')+s.slice(1);
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const initials=name=>name.trim().split(/\s+/).filter((_,i,a)=>i===0||i===a.length-1).map(w=>w[0]).join('').toUpperCase();
let collection={orders:[],contacts:[],today:'',demo:false};
let viewCode=0;
document.querySelector('.searchnav').innerHTML=icon('search');
function btnNew(){return '<a href="#/nueva" class="btn primary">'+icon('plus')+'Nueva consulta</a>'}
function orderRow(o,kind=''){const lists=kind==='all';return '<a class="row '+(lists?'list-order':'')+'" href="#/ficha/'+o.id+'"><span class="avatar">'+esc(initials(o.nombre))+'</span><span class="rowcopy"><strong>'+esc(o.nombre)+'</strong><small>'+esc(o.detalle||'Sin detalle del pedido')+'</small>'+(lists?'<small>'+fmt(o.creado,{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+'</small>':'')+'</span>'+(kind==='listo'?'<span class="money" aria-label="Saldo a cobrar">'+(o.saldo===0?'Ya está pago':money(o.saldo))+'</span>':'')+(lists?'<span class="status">'+states[o.estado]+'</span>':'')+icon('chevron','chev')+'</a>'}
const grouped=(orders,key)=>orders.filter(o=>key==='cerrados'?['cerrado','entregado'].includes(o.estado):o.estado===key);
function queue(key,title,empty,label){const orders=grouped(collection.orders,key);return '<section class="panel"><div class="phead '+(key==='listo'?'mint':'')+'"><span class="iconbox">'+icon(key==='listo'?'bag':'box')+'</span><h3>'+title+'</h3><span class="count">'+orders.length+'</span></div><div>'+(orders.slice(0,3).map(o=>orderRow(o,key)).join('')||'<p class="empty">'+empty+'</p>')+'</div><a class="foot" href="#/pedidos/'+key+'">'+label+'</a></section>'}
function frows(rows){return rows.map(o=>'<a class="followrow" href="#/ficha/'+o.id+'"><span class="rowcopy"><strong>'+esc(o.nombre)+'</strong><small>'+esc(o.proxima||'Seguimiento de consulta')+'</small></span><span class="status '+(o.fecha<collection.today?'late':o.fecha===collection.today?'today':'')+'">'+(o.fecha<collection.today?'Vencido · ':o.fecha===collection.today?'Hoy':'')+(o.fecha!==collection.today?fmt(o.fecha,{day:'numeric',month:'short'}):'')+'</span>'+icon('chevron','chev')+'</a>').join('')}
function follows(){return collection.orders.filter(o=>o.estado==='consulta'&&o.fecha).sort((a,b)=>a.fecha.localeCompare(b.fecha))}
function home(){const due=follows().filter(o=>o.fecha<=collection.today);
  return '<div class="hero"><div class="hero-inner"><div class="date">'+icon('cal')+upper(fmt(collection.today,{weekday:'long',day:'numeric',month:'long'}))+'</div><h1>Panel del consultorio</h1>'+btnNew()+'</div><img src="/plantillas.webp" alt=""></div><section class="section"><div class="section-title"><h2>Pendientes de gestión</h2></div><div class="twocol">'+queue('senado','Por pedir al proveedor','No hay pedidos para encargar.','Ver pedidos por encargar')+queue('listo','Por entregar y cobrar','No hay entregas pendientes.','Ver entregas pendientes')+'</div></section><section class="section"><div class="section-title"><h2>Seguimientos</h2><a class="textlink" href="#/seguimientos">Ver todos</a></div><div class="surface">'+(frows(due.slice(0,4))||'<p class="empty">No tenés seguimientos para hoy ni vencidos.</p>')+'</div></section><section class="section"><div class="section-title"><h2>Más pedidos</h2></div><div class="smallgrid">'+[['consulta','Consultas','chat'],['encargado','En espera del proveedor','truck'],['cerrados','Cerrados','archive']].map(([k,n,i])=>{const count=grouped(collection.orders,k).length;return '<a class="smallcard" href="#/pedidos/'+k+'"><span class="smallicon">'+icon(i)+'</span><span><strong>'+n+'</strong><small>'+count+' pedido'+(count===1?'':'s')+'</small></span>'+icon('chevron','chev')+'</a>'}).join('')+'</div></section>'+(collection.demo?'<p class="demo-note">Prototipo con datos ficticios.</p>':'')}
function back(){return '<a class="back" href="#/">'+icon('back')+'Inicio</a>'}
function header(title,newBtn=false){return '<div class="pagehead"><h1>'+esc(title)+'</h1>'+(newBtn?btnNew():'')+'</div>'}
function listView(filter,search){const opts=[['','Todos los estados'],...Object.entries(states),['cerrados','Todos los cerrados']];return back()+header(search?'Buscar pedidos':'Pedidos',true)+'<div class="field-filter"><label class="field">Buscar por contacto<input type="search" id="query" placeholder="Nombre, teléfono o Instagram" autocomplete="off"></label><label class="field">Estado<select id="filter">'+opts.map(([k,n])=>'<option value="'+k+'" '+(k===filter?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div><div id="matches" class="surface" aria-live="polite"></div>'}
function match(c,q){const text=norm(q.trim()).replace(/^@/,'');const digits=q.replace(/\D/g,'');return [c.nombre,c.instagram,c.telefono].some(v=>norm(v).includes(text))||(/^[+\d\s()-]+$/.test(q)&&digits&&String(c.telefono).replace(/\D/g,'').includes(digits))}
function updateList(){const q=document.getElementById('query').value,f=document.getElementById('filter').value;const rows=(f?grouped(collection.orders,f):collection.orders).filter(o=>match(o,q));document.getElementById('matches').innerHTML=rows.map(o=>orderRow(o,'all')).join('')||'<p class="empty">No se encontraron pedidos.</p>'}
function showToast(msg){const t=document.querySelector('.toast');t.textContent=msg;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.textContent='',3500)}
async function api(path,body){let response;try{response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'})}catch{throw Error('Se cortó la conexión. Revisala y volvé a intentar.')}let data;try{data=await response.json()}catch{throw Error('No pudimos conectar con el consultorio. Volvé a intentar.')}if(!response.ok)throw Error(data.error||'No se pudo guardar. Volvé a intentar.');return data}
async function render(){const code=++viewCode;const [,route='',arg='']=(location.hash.slice(1)||'/').split('/');const current=route==='seguimientos'?route:(!route?'inicio':'pedidos');nav.querySelectorAll('a').forEach(a=>a.dataset.nav===current?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));try{const data=await api('datos');if(code!==viewCode)return;collection=data;let html;let after=()=>{};
 if(!route)html=home();
 else if(route==='pedidos'||route==='buscar'){html=listView(arg,route==='buscar');after=()=>{updateList();document.getElementById('query').oninput=updateList;document.getElementById('filter').onchange=updateList;if(route==='buscar')document.getElementById('query').focus()}}
 else if(route==='seguimientos'){const rows=follows();html=back()+header('Seguimientos')+'<div class="surface">'+(frows(rows)||'<p class="empty">No hay consultas con seguimiento programado.</p>')+'</div>'}
 else if(route==='nueva'){html=newForm(arg);after=()=>bindNew(arg)}
 else if(route==='ficha'){const o=data.orders.find(v=>v.id===arg);html=o?detail(o):back()+header('Pedido no encontrado');if(o)after=()=>bindDetail(o)}
 else html=back()+header('Página no encontrada');
 main.innerHTML=html;main.setAttribute('aria-busy','false');after();document.title=(main.querySelector('h1')?.textContent||'Consultorio')+' · OyP Esquel';window.scrollTo(0,0)
 }catch(err){if(code!==viewCode)return;main.innerHTML='<p class="error">'+esc(err.message)+'</p><button class="btn space" id="retry">Reintentar</button>';document.getElementById('retry').onclick=render;main.setAttribute('aria-busy','false')}}
window.addEventListener('hashchange',render);render();
function field(name,title,{type='text',value='',max=120,optional=false,extra='',hint=''}={}){
 const lbl='<span>'+title+(optional?' <em>(opcional)</em>':'')+'</span>';
 const input=type==='textarea'?'<textarea name="'+name+'" maxlength="'+max+'" '+extra+'>'+esc(value)+'</textarea>':'<input type="'+type+'" name="'+name+'" maxlength="'+max+'" value="'+esc(value)+'" '+extra+'>';
 return '<label>'+lbl+input+(hint?'<em>'+hint+'</em>':'')+'</label>';
}
function saveButton(text){return '<div class="error" role="alert"></div><button type="submit" class="btn primary">'+esc(text)+'</button>'}
function newForm(arg){return '<div class="narrow">'+back()+header('Nueva consulta')+'<form class="surface form" id="new-form"><div class="options" aria-label="Tipo de contacto"><button type="button" data-mode="new">Nuevo contacto</button><button type="button" data-mode="existing">Contacto existente</button></div><div id="new-fields" class="details">'+field('nombre','Nombre',{extra:'autocomplete="name" required'})+field('telefono','WhatsApp',{type:'tel',max:32,extra:'autocomplete="tel" placeholder="+54 9 2945…"'})+field('instagram','Instagram',{max:31,extra:'autocapitalize="none" autocorrect="off" placeholder="@usuario"'} )+'<p class="secondary">Con WhatsApp o Instagram alcanza.</p></div><div id="existing-fields" class="details" hidden><label>Buscar contacto<input id="contact-search" type="search" placeholder="Nombre, teléfono o Instagram" autocomplete="off"></label><div id="contacts" class="results"></div><p id="chosen" class="contactpicked"></p></div>'+field('detalle','Detalle del pedido',{type:'textarea',optional:true,max:2500})+saveButton('Guardar consulta')+'</form></div>'}
function newKey(){
 if(crypto.randomUUID)return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
 return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function bindSubmit(form,make,message){
 const key=newKey();let pending=false;
 form.onsubmit=async e=>{
  e.preventDefault();if(pending)return;const error=form.querySelector('.error'),button=form.querySelector('[type=submit]');error.textContent='';
  try{const body=make(Object.fromEntries(new FormData(form)));pending=true;button.disabled=true;form.setAttribute('aria-busy','true');
    const result=await api('guardar',{...body,clave:key});if(!form.isConnected)return;
    const target='#/ficha/'+result.id;showToast(message);if(location.hash===target)await render();else location.hash=target;
  }catch(err){error.textContent=err.message}finally{pending=false;button.disabled=false;form.removeAttribute('aria-busy')}
 };
}
function bindNew(arg){
 const f=document.getElementById('new-form'),newFields=document.getElementById('new-fields'),existing=document.getElementById('existing-fields'),search=document.getElementById('contact-search'),rows=document.getElementById('contacts'),chosen=document.getElementById('chosen');
 let mode=arg?'existing':'new',contact=collection.contacts.find(c=>c.id===arg);
 const pick=c=>{contact=c;chosen.textContent=c?'Contacto elegido · '+c.nombre:'';if(c){rows.innerHTML='';search.value=c.nombre}};
 function matches(){const filtered=collection.contacts.filter(c=>match(c,search.value)).slice(0,12);rows.innerHTML=filtered.map(c=>'<button type="button" data-c="'+c.id+'">'+esc(c.nombre)+'<small>'+esc([c.telefono,c.instagram&&'@'+c.instagram].filter(Boolean).join(' · '))+'</small></button>').join('')||'<p class="empty">Sin coincidencias.</p>'}
 function setMode(m){mode=m;newFields.hidden=m!=='new';existing.hidden=m!=='existing';newFields.querySelectorAll('input').forEach(el=>el.disabled=m!=='new');f.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===m)));if(m==='existing'){if(contact)pick(contact);else matches()}}
 f.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));search.oninput=()=>{pick(null);matches()};rows.onclick=e=>{const b=e.target.closest('button');if(b)pick(collection.contacts.find(c=>c.id===b.dataset.c))};setMode(mode);
 bindSubmit(f,fields=>{if(mode==='existing'&&!contact)throw Error('Elegí un contacto de la lista.');return {accion:'crear',...fields,...(mode==='existing'?{contacto_id:contact.id}:{})}},'Consulta guardada');
}
function amounts(o){
 if(o.total==null)return '<p class="secondary space">Todavía no se registraron importes.</p>';
 const items=[['Precio total',money(o.total)],['Seña recibida',money(o.sena)]];
 if(o.final>0)items.push(['Cobro final',money(o.final)]);
 items.push(['Saldo pendiente',money(o.saldo)]);
 return '<dl class="amounts">'+items.map(([a,b])=>'<div><dt>'+a+'</dt><dd>'+b+'</dd></div>').join('')+'</dl>';
}
const actionWords={senado:['encargar','Encargo al proveedor','Confirmá que ya encargaste este producto.','Marcar como pedido al proveedor'],encargado:['recibir','Recepción del pedido','Confirmá que el producto llegó al consultorio.','Marcar como recibido'],listo:['entregar','Entrega y cobro','','Confirmar entrega y cobro']};
function actionForm(o){
 if(o.estado==='consulta')return '<form class="surface form" id="advance"><h2>Registrar seña</h2>'+field('detalle','Detalle del pedido',{type:'textarea',value:o.detalle,max:2500,extra:'required'})+field('total','Precio total ($)',{extra:'inputmode="decimal" placeholder="80.000,00" required'})+field('sena','Seña recibida ($)',{extra:'inputmode="decimal" placeholder="30.000,00" required'})+saveButton('Registrar seña')+'</form>';
 const words=actionWords[o.estado];if(!words)return '';
 let info='<p>'+words[2]+'</p>',label=words[3];
 if(o.estado==='listo'){info='<div><p class="desc">'+esc(o.detalle)+'</p>'+amounts(o)+'</div><p>'+(o.saldo?'Al confirmar, registrás la entrega y el cobro de <strong>'+money(o.saldo)+'</strong>.':'<strong>Ya está pago.</strong> Confirmá que entregaste el producto.')+'</p>';if(!o.saldo)label='Confirmar entrega'}
 return '<form class="surface form" id="advance"><h2>'+words[1]+'</h2>'+info+saveButton(label)+'</form>';
}
function phoneLink(phone){let n=phone.replace(/\D/g,'');if(n.startsWith('00'))return n.slice(2);if(phone.trim().startsWith('+')||n.startsWith('54'))return n;n=n.replace(/^0/,'');return '549'+n.replace(/^(\d{2,4})15(?=\d{6,8}$)/,'$1')}
function detail(o){
 const contact=collection.orders.filter(p=>p.contacto_id===o.contacto_id&&p.id!==o.id);
 const milestones=[['creado','Consulta guardada'],['senado','Seña registrada'],['encargado','Pedido al proveedor'],['recibido','Recibido en consultorio'],['entregado','Entregado y cobrado'],['cerrado','Cerrado sin venta']];
 const summary='<section class="surface box"><h2>Pedido</h2><p class="desc">'+esc(o.detalle||'Sin detalle del producto.')+'</p>'+(o.estado==='listo'?'':amounts(o))+'</section>';
 const follow=o.estado==='consulta'?'<form class="surface form" id="follow"><h2>Seguimiento</h2>'+field('proxima','Próxima acción',{value:o.proxima,optional:true,max:500})+field('fecha','Fecha',{type:'date',value:o.fecha,optional:true})+saveButton('Guardar seguimiento')+'</form>':'';
 const timeline='<section class="surface box"><h2>Historial del pedido</h2><ul class="timeline">'+milestones.filter(([k])=>o[k]).map(([k,s])=>'<li><span>'+s+'</span><span class="secondary">'+fmt(o[k])+'</span></li>').join('')+'</ul></section>';
 const closing=o.estado==='consulta'?'<details class="surface box"><summary>Cerrar sin venta</summary><form class="form" id="close"><p>¿El cliente desistió de este pedido?</p>'+saveButton('Confirmar cierre sin venta')+'</form></details>':'';
 return '<div class="narrow">'+back()+'<div class="pagehead"><div><span class="status spaced">'+states[o.estado]+'</span><h1>'+esc(o.nombre)+'</h1><div class="contactlinks">'+(o.telefono?'<a rel="noreferrer" target="_blank" href="https://wa.me/'+phoneLink(o.telefono)+'">WhatsApp · '+esc(o.telefono)+'</a>':'')+(o.instagram?'<a rel="noreferrer" target="_blank" href="https://www.instagram.com/'+encodeURIComponent(o.instagram)+'/">Instagram · @'+esc(o.instagram)+'</a>':'')+'</div></div></div><div class="details">'+(o.estado==='listo'?'':summary)+actionForm(o)+follow+timeline+closing+'<section class="surface box"><h2>Otros pedidos del contacto</h2>'+(contact.map(p=>orderRow(p,'all')).join('')||'<p class="secondary space">Es su único pedido.</p>')+'<a class="btn space" href="#/nueva/'+o.contacto_id+'">'+icon('plus')+'Nueva consulta de este contacto</a></section></div></div>';
}
function bindDetail(o){
 const basis={id:o.id,version:o.version};
 const f=document.getElementById('advance');
 if(f){const action=o.estado==='consulta'?'senar':actionWords[o.estado][0];bindSubmit(f,fields=>({...basis,accion:action,...fields,confirmado:true}),{senar:'Seña registrada',encargar:'Encargo registrado',recibir:'Recepción registrada',entregar:'Entrega confirmada'}[action])}
 const follow=document.getElementById('follow');if(follow)bindSubmit(follow,fields=>({...basis,accion:'seguir',...fields}),'Seguimiento guardado');
 const close=document.getElementById('close');if(close)bindSubmit(close,()=>({...basis,accion:'cerrar',confirmado:true}),'Consulta cerrada sin venta');
}

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['','#/','#/seguimientos'].includes(location.hash))render()});
