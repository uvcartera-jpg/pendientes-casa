(function(){
"use strict";
// ---------- Config ----------
const CFG = window.APP_CONFIG || {};
const CATS = ["Casa","Bebé","Finanzas","Compras","Ventas","Trámites","Salud","Auto","Familia","Otros"];
const PRIOS = {alta:{l:"Urgente",c:"var(--bad)"},media:{l:"Normal",c:"var(--warn)"},baja:{l:"Cuando se pueda",c:"var(--line)"}};
const TEMPLATES = {
  "Vender algo":{cat:"Ventas",money:"ingreso",pts:["Definir precio","¿Dónde lo publicamos? (Marketplace, grupos, conocidos)","Sacar fotos para la publicación","Fecha límite para venderlo","¿En qué usamos ese dinero?"]},
  "Comprar algo":{cat:"Compras",money:"gasto",pts:["Presupuesto máximo","Comparar 2 o 3 opciones (adjuntar fotos o cotizaciones)","¿Quién lo compra y dónde?","¿Para cuándo lo necesitamos?","¿De qué dinero sale?"]},
  "Pago o cuenta":{cat:"Finanzas",money:"gasto",pts:["Monto exacto","Fecha de vencimiento","¿Quién paga?","Adjuntar comprobante de pago"]},
  "Trámite":{cat:"Trámites",money:"gasto",pts:["Requisitos","Documentos a reunir","Costo","¿Quién va y cuándo?","Adjuntar comprobante o constancia"]},
  "Reparación":{cat:"Casa",money:"gasto",pts:["Describir el problema (con foto)","Conseguir técnico y cotización","Acordar fecha","Costo final y comprobante"]},
  "Evento o visita":{cat:"Familia",money:"gasto",pts:["Fecha y hora","Presupuesto","Lista de compras","¿Quién se encarga de qué?"]}
};
const BUCKET = "respaldos";
const CAT_COLORS = {"Casa":"#ff9f1c","Bebé":"#ff70a6","Finanzas":"#2ec4b6","Compras":"#4cc9f0","Ventas":"#ffc145","Trámites":"#b388eb","Salud":"#3ddc97","Auto":"#7b9cff","Familia":"#ff6b6b","Otros":"#c9a7ff"};
const catColor = c=>CAT_COLORS[c]||"#c9a7ff";
function hashStr(t){let h=2166136261;for(const ch of String(t))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0}
function blobStyle(id){
  let h=hashStr(id);const v=()=>{const x=36+(h%29);h=Math.imul(h,1103515245)+12345>>>0;return x};
  const a=v(),b=v(),c=v(),d=v(),e=v(),f=v(),g=v(),k=v();
  const tilt=((hashStr(id+"t")%31)-15)/10;
  return `border-radius:${a}% ${100-a}% ${b}% ${100-b}% / ${c}% ${d}% ${100-d}% ${100-c}%;--tilt:${tilt}deg`;
}
function flowerSVG(total,done,pct){
  const n=Math.min(Math.max(total,0),12);const on=total>12?Math.round(pct*12/100):done;
  let petals="";
  if(n===0){petals=`<circle cx="50" cy="50" r="22" class="petal off"/>`}
  else{
    const rx=n<=3?16:n<=6?13:n<=9?10:8;
    for(let k=0;k<n;k++)petals+=`<g transform="rotate(${(360/n)*k} 50 50)"><ellipse class="petal ${k<on?"on":"off"}" cx="50" cy="27" rx="${rx}" ry="21"/></g>`;
  }
  return `<svg class="flower" viewBox="0 0 100 100" role="img" aria-label="${done} de ${total} resueltos">${petals}<circle class="core" cx="50" cy="50" r="17"/><text class="pct" x="50" y="51">${total?pct+"%":"+"}</text></svg>`;
}
function petalBurst(color){
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const box=document.createElement("div");box.className="petal-burst";
  const cols=[color,"#ff70a6","#ffc145","#4cc9f0","#3ddc97","#b388eb"];
  for(let k=0;k<40;k++){const i=document.createElement("i");i.style.left=(Math.random()*100)+"vw";i.style.background=cols[k%cols.length];i.style.animationDelay=(Math.random()*.8)+"s";i.style.animationDuration=(2+Math.random()*1.5)+"s";box.append(i)}
  document.body.append(box);setTimeout(()=>box.remove(),4000);
}
function checkBloom(cid){const p=prog(cid);if(p.total&&p.done===p.total){petalBurst(catColor((S.cases.get(cid)||{}).cat));toast("¡Caso completo! Floreció 🌸")}}

// ---------- State ----------
let sb=null, me=null, myUser="";
const S = {cases:new Map(), items:new Map(), members:new Map(), seen:{}, loaded:false};
const UI = {tab:"activos", cat:"", q:"", openCase:null, view:"case", editId:null, tpl:null, confirm:null, closing:false, composers:new Set(), pending:{}, drafts:{}, addAs:""};
const urlCache = new Map(); // storage path -> signed url

// ---------- Helpers ----------
const $ = s=>document.querySelector(s);
const esc = s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now = ()=>Date.now();
const ts = v=>v?Date.parse(v):0;
function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,3500)}
function fmtMoney(n){return "Bs "+Number(n||0).toLocaleString("es-BO",{maximumFractionDigits:2})}
function fmtWhen(ms){if(!ms)return"";const d=new Date(ms);const diff=(now()-ms)/60000;
  if(diff<1)return"recién";if(diff<60)return"hace "+Math.round(diff)+" min";if(diff<1440)return"hace "+Math.round(diff/60)+" h";
  return d.toLocaleDateString("es-BO",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("es-BO",{hour:"2-digit",minute:"2-digit"});}
function dueInfo(due,closed){
  if(!due||closed)return null;
  const t=new Date(due+"T23:59:59");const days=Math.ceil((t-new Date())/86400000);
  const label=new Date(due+"T12:00:00").toLocaleDateString("es-BO",{day:"numeric",month:"short"});
  if(days<0)return{cls:"bad",txt:"Venció "+label};
  if(days===0)return{cls:"bad",txt:"Vence hoy"};
  if(days<=3)return{cls:"warn",txt:"Vence en "+days+" día"+(days>1?"s":"")};
  return{cls:"",txt:"Para el "+label};
}
function nameOf(id){
  if(!id)return"Alguien";if(id==="ambos")return"Ambos";
  const m=S.members.get(id);if(m&&m.alias)return m.alias;
  return id===me?"Yo":"Pareja";
}
function itemsOf(cid){return [...S.items.values()].filter(i=>i.caso_id===cid).sort((a,b)=>(a.orden||0)-(b.orden||0)||a.created_at-b.created_at)}
function prog(cid){const its=itemsOf(cid);const d=its.filter(i=>i.done).length;return{total:its.length,done:d,pct:its.length?Math.round(d*100/its.length):0}}
function isMine(i){return !i.done && (i.assignee===me||i.assignee==="ambos")}
function hasNews(c){const seen=S.seen[c.id]||0;return c.updated_at>seen+1500 && c.updated_by && c.updated_by!==me}
function cleanLines(txt){return (txt||"").split(/\n+/).map(s=>s.replace(/^\s*([-*•·]|\d+[.)])\s*/,"").trim()).filter(Boolean)}
async function run(p){const r=await p;if(r&&r.error){console.error(r.error);toast("No se pudo guardar: "+(r.error.message||"error"));throw r.error}return r}

// ---------- Data ----------
async function loadAll(){
  const [c,p,r,h,m,v]=await Promise.all([
    sb.from("casos").select("*"),
    sb.from("puntos").select("*"),
    sb.from("respuestas").select("*").order("created_at"),
    sb.from("historial").select("*").order("created_at",{ascending:false}).limit(800),
    sb.from("miembros").select("*"),
    sb.from("vistos").select("*").eq("user_id",me)
  ]);
  const err=[c,p,r,h,m,v].find(x=>x.error);
  if(err){console.error(err.error);$("#statusLine").textContent="No se pudieron cargar los datos: "+err.error.message;return}
  const logs={};h.data.forEach(x=>{(logs[x.caso_id]=logs[x.caso_id]||[]).unshift({at:ts(x.created_at),by:x.author,msg:x.msg})});
  S.cases=new Map(c.data.map(x=>[x.id,Object.assign({},x,{created_at:ts(x.created_at),updated_at:ts(x.updated_at),closed_at:ts(x.closed_at),log:logs[x.id]||[]})]));
  const reps={};r.data.forEach(x=>{(reps[x.punto_id]=reps[x.punto_id]||[]).push({id:x.id,by:x.author,at:ts(x.created_at),text:x.text,files:x.files||[]})});
  S.items=new Map(p.data.map(x=>[x.id,Object.assign({},x,{created_at:ts(x.created_at),done_at:ts(x.done_at),replies:reps[x.id]||[]})]));
  S.members=new Map(m.data.map(x=>[x.id,x]));
  S.seen={};v.data.forEach(x=>S.seen[x.caso_id]=ts(x.seen_at));
  S.loaded=true;
  $("#statusLine").textContent="En línea · los cambios se ven al instante en ambos teléfonos.";
  await signUrls();
  scheduleRender();
}
let reloadT=null;
function reloadSoon(){clearTimeout(reloadT);reloadT=setTimeout(()=>loadAll().catch(console.error),250)}

async function touchCase(cid,msg){
  await run(sb.from("casos").update({updated_at:new Date().toISOString(),updated_by:me}).eq("id",cid));
  await run(sb.from("historial").insert({caso_id:cid,msg}));
  await markSeen(cid);
  reloadSoon();
}
async function markSeen(cid){
  S.seen[cid]=now()+2000;
  await sb.from("vistos").upsert({user_id:me,caso_id:cid,seen_at:new Date(now()+2000).toISOString()});
}

// ---------- Files ----------
function loadImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("img"));im.src=u;})}
async function compress(file){
  const im=await loadImg(file);
  const r=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));
  const cv=document.createElement("canvas");cv.width=Math.round(im.naturalWidth*r);cv.height=Math.round(im.naturalHeight*r);
  cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);
  return await new Promise(res=>cv.toBlob(res,"image/jpeg",.8));
}
async function storeFile(file,cid){
  const isImg=/^image\//.test(file.type)||/\.(jpe?g|png|webp|gif|heic)$/i.test(file.name);
  let blob=file,type=file.type||"application/octet-stream",ext=(file.name.split(".").pop()||"bin").toLowerCase();
  if(isImg){try{blob=await compress(file);type="image/jpeg";ext="jpg"}catch(e){/* subir original */}}
  if(blob.size>20*1024*1024)throw new Error(file.name+" pesa más de 20 MB.");
  const path=(cid||"general")+"/"+rid()+"."+ext;
  const {error}=await sb.storage.from(BUCKET).upload(path,blob,{contentType:type,upsert:false});
  if(error)throw new Error("No se pudo subir "+file.name+": "+error.message);
  return{kind:isImg?"img":"file",path,name:file.name,type};
}
function allPaths(){
  const out=[];
  S.cases.forEach(c=>{if(c.cover)out.push(c.cover)});
  S.items.forEach(i=>(i.replies||[]).forEach(r=>(r.files||[]).forEach(f=>out.push(f.path))));
  Object.values(UI.pending).forEach(arr=>arr.forEach(f=>out.push(f.path)));
  return out.filter(p=>p&&!urlCache.has(p));
}
async function signUrls(){
  const paths=allPaths();if(!paths.length)return;
  const {data,error}=await sb.storage.from(BUCKET).createSignedUrls(paths,60*60*12);
  if(error){console.error(error);return}
  data.forEach(d=>{if(d.signedUrl)urlCache.set(d.path,d.signedUrl)});
}
function urlOf(path){return urlCache.get(path)||""}
function fileHTML(f){
  if(!f)return"";const u=urlOf(f.path);
  if(f.kind==="img")return`<img src="${esc(u)}" alt="${esc(f.name||"foto")}" data-zoom="1" loading="lazy">`;
  return`<a class="file" href="${esc(u)}" target="_blank" rel="noopener">📄 ${esc(f.name||"archivo")}</a>`;
}

// ---------- Rendering ----------
function renderWho(){
  const w=$("#who");w.textContent="";
  if(!me)return;
  const g=$("#greet");g.textContent="Hola, "+nameOf(me);
  g.insertAdjacentHTML("beforeend",'<svg viewBox="0 0 260 16" preserveAspectRatio="none" aria-hidden="true"><path d="M2 10 C 30 2, 50 16, 80 8 S 130 2, 160 9 S 220 15, 258 6" fill="none" stroke="#ff70a6" stroke-width="5" stroke-linecap="round"/></svg>');
  const s=document.createElement("span");s.textContent="";
  const b=document.createElement("button");b.className="btn ghost sm";b.textContent="Nombre";b.type="button";b.onclick=()=>{UI.forceName=true;renderBanner()};
  const o=document.createElement("button");o.className="btn ghost sm";o.textContent="Salir";o.type="button";o.onclick=async()=>{await sb.auth.signOut();location.reload()};
  w.append(s,b,o);
}
function renderBanner(){
  const el=$("#nameBanner");const m=me&&S.members.get(me);
  if(!me||(!UI.forceName&&m&&m.alias)){el.innerHTML="";return}
  if(el.querySelector("#aliasInput"))return;
  el.innerHTML=`<form class="banner" id="aliasForm"><span>¿Cómo te mostramos en la app?</span><input id="aliasInput" maxlength="20" placeholder="Ej: Edgar, Amor" value="${esc((m&&m.alias)||myUser)}"><button class="btn primary sm" type="submit">Guardar</button></form>`;
  $("#aliasForm").onsubmit=async e=>{e.preventDefault();const v=$("#aliasInput").value.trim();if(!v)return;
    UI.forceName=false;await run(sb.from("miembros").upsert({id:me,alias:v}));el.innerHTML="";reloadSoon();};
}
function renderStats(){
  const open=[...S.cases.values()].filter(c=>c.status!=="cerrado");
  const all=[...S.items.values()].filter(i=>{const c=S.cases.get(i.caso_id);return c&&c.status!=="cerrado"});
  const mine=all.filter(isMine).length;
  const noAns=all.filter(i=>!i.done&&!(i.replies||[]).length).length;
  const overdue=open.filter(c=>{const d=dueInfo(c.due,false);return d&&d.cls==="bad"}).length;
  const news=open.filter(hasNews).length;
  let ing=0,gas=0;open.forEach(c=>{if(c.amount){if(c.money_type==="ingreso")ing+=+c.amount;else if(c.money_type==="gasto")gas+=+c.amount}});
  const done=all.filter(i=>i.done).length;const pct=all.length?Math.round(done*100/all.length):0;
  $("#stats").innerHTML=`
   <button class="stat" data-go="metoca"><div class="n">${mine}</div><div class="l">Puntos que me tocan</div></button>
   <button class="stat" data-go="nuevos"><div class="n">${news}</div><div class="l">Casos con novedades</div></button>
   <button class="stat" data-go="activos"><div class="n">${noAns}</div><div class="l">Puntos sin respuesta</div></button>
   <button class="stat ${overdue?"bad":""}" data-go="activos"><div class="n">${overdue}</div><div class="l">Casos vencidos</div></button>
   <button class="stat" data-go="activos"><div class="n">${pct}%</div><div class="l">Avance general (${done}/${all.length})</div></button>
   ${ing||gas?`<button class="stat" data-go="activos"><div class="n" style="font-size:20px">${ing?"+"+fmtMoney(ing):""}${ing&&gas?"<br>":""}${gas?"−"+fmtMoney(gas):""}</div><div class="l">Por cobrar / por pagar</div></button>`:""}`;
  $("#stats").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>setTab(b.dataset.go));
}
function setTab(t){UI.tab=t;document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tab===t)));renderGrid()}
function filteredCases(){
  let list=[...S.cases.values()];
  if(UI.tab==="activos")list=list.filter(c=>c.status!=="cerrado");
  else if(UI.tab==="cerrados")list=list.filter(c=>c.status==="cerrado");
  else if(UI.tab==="metoca")list=list.filter(c=>c.status!=="cerrado"&&itemsOf(c.id).some(isMine));
  else if(UI.tab==="nuevos")list=list.filter(hasNews);
  if(UI.cat)list=list.filter(c=>c.cat===UI.cat);
  if(UI.q){const qq=UI.q.toLowerCase();list=list.filter(c=>(c.title+" "+(c.descr||"")+" "+itemsOf(c.id).map(i=>i.text).join(" ")).toLowerCase().includes(qq))}
  const pr={alta:0,media:1,baja:2};
  list.sort((a,b)=>(hasNews(b)-hasNews(a))||((pr[a.prio]??1)-(pr[b.prio]??1))||((a.due||"9999")>(b.due||"9999")?1:(a.due||"9999")<(b.due||"9999")?-1:0)||(b.updated_at-a.updated_at));
  return list;
}
function renderGrid(){
  const g=$("#grid");
  if(!S.loaded){g.innerHTML=`<div class="empty">Cargando casos…</div>`;return}
  const list=filteredCases();
  if(!list.length){
    const msg=S.cases.size?"No hay casos en esta vista.":"Todavía no hay casos. Escribe arriba el primer tema, por ejemplo “Vender la cuna”.";
    g.innerHTML=`<div class="empty">${esc(msg)}</div>`;return;
  }
  g.innerHTML=list.map(c=>{
    const p=prog(c.id);const d=dueInfo(c.due,c.status==="cerrado");const mine=itemsOf(c.id).filter(isMine).length;const pending=p.total-p.done;
    return`<button class="card ${c.status==="cerrado"?"closed":""}" data-open="${esc(c.id)}" style="--c:${catColor(c.cat)};${blobStyle(c.id)}">
      <div class="head">${flowerSVG(p.total,p.done,p.pct)}${c.cover?`<img class="photo" src="${esc(urlOf(c.cover))}" alt="" loading="lazy">`:""}</div>
      <div class="chips">
        <span class="chip cat">${esc(c.cat||"Otros")}</span>
        ${hasNews(c)?`<span class="chip new">Novedades</span>`:""}
        ${c.status==="cerrado"?`<span class="chip good">Cerrado</span>`:""}
        ${d?`<span class="chip ${d.cls}">${esc(d.txt)}</span>`:""}
        ${mine?`<span class="chip me">${mine} me toca${mine>1?"n":""}</span>`:""}
      </div>
      <h3>${esc(c.title)}</h3>
      <div class="progress-l"><span>${p.total?p.done+" de "+p.total+" resueltos":"Sin puntos todavía"}</span><span>${pending?"Faltan "+pending:p.total?"Listo":""}</span></div>
      ${c.amount?`<div class="meta">${c.money_type==="ingreso"?"Ingreso":"Gasto"}: ${fmtMoney(c.amount)}</div>`:""}
      <div class="meta">${esc(fmtWhen(c.updated_at))} · ${esc(nameOf(c.updated_by))}</div>
    </button>`;
  }).join("");
  g.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openCase(b.dataset.open));
}
function renderCatFilter(){
  const sel=$("#catFilter");const used=new Set([...S.cases.values()].map(c=>c.cat).filter(Boolean));
  const cats=CATS.filter(c=>used.has(c)).concat([...used].filter(c=>!CATS.includes(c)));
  sel.innerHTML=`<option value="">Todas las categorías</option>`+cats.map(c=>`<option ${UI.cat===c?"selected":""}>${esc(c)}</option>`).join("");
}
function memberOptions(sel){
  const ids=[...S.members.keys()];if(me&&!ids.includes(me))ids.unshift(me);
  const opts=[`<option value="">Sin asignar</option>`].concat(ids.map(id=>`<option value="${esc(id)}" ${sel===id?"selected":""}>${esc(nameOf(id))}${id===me?" (yo)":""}</option>`));
  opts.push(`<option value="ambos" ${sel==="ambos"?"selected":""}>Ambos</option>`);
  return opts.join("");
}

// ---------- Case modal ----------
function openCase(id){UI.openCase=id;UI.view="case";UI.confirm=null;UI.closing=false;$("#overlay").hidden=false;renderModal();markSeen(id).then(()=>{renderGrid();renderStats()});}
function closeModal(){UI.openCase=null;UI.view="case";UI.editId=null;$("#overlay").hidden=true;$("#modal").innerHTML="";UI.composers.clear();renderGrid();}
function preserveFocus(fn){
  const a=document.activeElement;const id=a&&a.id;const st=a&&a.selectionStart,en=a&&a.selectionEnd;
  const scroller=$("#overlay");const sc=scroller.scrollTop;
  fn();
  scroller.scrollTop=sc;
  document.querySelectorAll("#modal [data-draft]").forEach(el=>{if(UI.drafts[el.id]!=null)el.value=UI.drafts[el.id]});
  if(id){const el=document.getElementById(id);if(el){el.focus();try{if(st!=null)el.setSelectionRange(st,en)}catch(e){}}}
}
function renderModal(){
  if(UI.view==="form")return;
  const c=S.cases.get(UI.openCase);
  if(!c){if(UI.openCase){$("#modal").innerHTML=`<button class="close" data-x>✕</button><div class="msec">Este caso ya no existe.</div>`;$("#modal [data-x]").onclick=closeModal}return}
  $("#modal").style.setProperty("--c",catColor(c.cat));
  preserveFocus(()=>{$("#modal").innerHTML=caseHTML(c);bindCase(c)});
}
function pointHTML(i){
  const reps=i.replies||[];const open=UI.composers.has(i.id);const pend=UI.pending[i.id]||[];
  return`<div class="point ${i.done?"done":""}">
    <input type="checkbox" ${i.done?"checked":""} data-toggle="${esc(i.id)}" aria-label="Marcar resuelto: ${esc(i.text)}">
    <div>
      <div class="ptext">${esc(i.text)}</div>
      <div class="pmeta">
        <span>Le toca a</span>
        <select data-assign="${esc(i.id)}" aria-label="Responsable">${memberOptions(i.assignee||"")}</select>
        <span>· agregado por ${esc(nameOf(i.created_by))} ${esc(fmtWhen(i.created_at))}</span>
        ${i.done?`<span class="chip good">✓ ${esc(nameOf(i.done_by))} ${esc(fmtWhen(i.done_at))}</span>`:reps.length?"":`<span class="chip warn">Sin respuesta</span>`}
      </div>
      ${reps.length?`<div class="replies">${reps.map(r=>`<div class="reply"><div class="rby">${esc(nameOf(r.by))} · ${esc(fmtWhen(r.at))}</div>${r.text?`<div class="rtext">${esc(r.text)}</div>`:""}${(r.files||[]).length?`<div class="thumbs">${r.files.map(fileHTML).join("")}</div>`:""}</div>`).join("")}</div>`:""}
      ${open?`<div class="composer">
          <textarea id="rep-${esc(i.id)}" data-draft placeholder="Respuesta, dato o acuerdo…" rows="2"></textarea>
          ${pend.length?`<div class="pending-files">${pend.map(f=>`<span>${f.kind==="img"?"📷":"📄"} ${esc(f.name)}</span>`).join("")}</div>`:""}
          <div class="row">
            <label class="btn sm attach">📎 Adjuntar respaldo<input type="file" accept="image/*,application/pdf" multiple data-attach="${esc(i.id)}"></label>
            <button class="btn primary sm" data-send="${esc(i.id)}" type="button">Enviar</button>
            <button class="btn sm" data-sendclose="${esc(i.id)}" type="button">Enviar y marcar ✓</button>
            <button class="btn ghost sm" data-cancel="${esc(i.id)}" type="button">Cancelar</button>
          </div></div>`
        :`<div class="actions" style="margin-top:6px"><button class="btn sm" data-reply="${esc(i.id)}" type="button">Responder / adjuntar</button><button class="btn ghost sm" data-delitem="${esc(i.id)}" type="button">Quitar punto</button></div>`}
    </div></div>`;
}
function caseHTML(c){
  const its=itemsOf(c.id);const p=prog(c.id);const d=dueInfo(c.due,c.status==="cerrado");
  const pend=its.filter(i=>!i.done),done=its.filter(i=>i.done);const closed=c.status==="cerrado";
  return`<button class="close" data-x aria-label="Cerrar ventana">✕</button>
  <div class="mhero">
    ${flowerSVG(p.total,p.done,p.pct)}
    <div style="display:grid;gap:8px">
      <div class="chips">
        <span class="chip cat">${esc(c.cat||"Otros")}</span>
        <span class="chip">${esc(PRIOS[c.prio]?PRIOS[c.prio].l:"Normal")}</span>
        ${d?`<span class="chip ${d.cls}">${esc(d.txt)}</span>`:""}
        ${closed?`<span class="chip good">Cerrado ${esc(fmtWhen(c.closed_at))}</span>`:""}
      </div>
      <h2>${esc(c.title)}</h2>
      <div class="progress-text">${p.done} de ${p.total} puntos resueltos${pend.length?" · falta"+(pend.length>1?"n ":" ")+pend.length:p.total?" · todo listo":""}</div>
    </div>
    ${c.cover?`<img class="photo" src="${esc(urlOf(c.cover))}" data-zoom="1" alt="Foto del caso">`:""}
  </div>
  <div class="msec">
    <div class="note">Creado por ${esc(nameOf(c.created_by))} ${esc(fmtWhen(c.created_at))}</div>
    ${c.descr?`<div class="desc" style="margin-top:6px">${esc(c.descr)}</div>`:""}
    ${c.amount||c.money_note?`<div class="money" style="margin-top:8px">${c.amount?`<span>${c.money_type==="ingreso"?"Ingreso esperado":"Gasto estimado"}: <b>${fmtMoney(c.amount)}</b></span>`:""}${c.money_note?`<span>Destino / origen: <b>${esc(c.money_note)}</b></span>`:""}</div>`:""}
    ${!closed&&p.total&&!pend.length?`<div class="closebox">Todo está resuelto. ¿Cerramos el caso? <button class="btn primary sm" data-closecase type="button">Cerrar caso</button></div>`:""}
    ${closed&&c.result?`<div class="closebox"><span><b>Resultado:</b> ${esc(c.result)}</span></div>`:""}
  </div>
  <div class="msec">
    <h3>Lo que falta <span class="count">${pend.length}</span></h3>
    ${pend.length?pend.map(pointHTML).join(""):`<div class="note">Nada pendiente.</div>`}
    ${done.length?`<details class="donelist" ${pend.length?"":"open"}><summary>Resueltos (${done.length})</summary>${done.map(pointHTML).join("")}</details>`:""}
  </div>
  <div class="msec addbox">
    <h3>Agregar puntos</h3>
    <textarea id="addPts-${esc(c.id)}" data-draft rows="3" placeholder="Uno por línea. Puedes pegar varios a la vez:&#10;Definir precio&#10;¿Dónde publicamos?"></textarea>
    <div class="row" style="margin-top:6px">
      <label class="note" for="addAs">Le toca a</label>
      <select id="addAs">${memberOptions(UI.addAs||"")}</select>
      <button class="btn primary sm" data-addpts type="button">Agregar</button>
    </div>
  </div>
  ${UI.closing?`<div class="msec"><h3>Cerrar caso</h3><textarea id="closeResult" data-draft rows="2" placeholder="¿Cómo terminó? Ej: Se vendió en Bs 800, el dinero fue al ahorro." class="plain"></textarea><div class="actions" style="margin-top:8px"><button class="btn primary sm" data-confirmclose type="button">Cerrar caso</button><button class="btn ghost sm" data-cancelclose type="button">Cancelar</button></div></div>`:""}
  <div class="msec">
    <h3>Historial</h3>
    <div class="log">${(c.log||[]).slice().reverse().map(l=>`<div><b>${esc(nameOf(l.by))}</b> ${esc(l.msg)} · ${esc(fmtWhen(l.at))}</div>`).join("")||"Sin movimientos."}</div>
  </div>
  <div class="msec">
    ${UI.confirm==="delete"?`<div class="confirm">¿Eliminar “${esc(c.title)}” con todos sus puntos? No se puede deshacer. <button class="btn danger sm" data-dodelete type="button">Sí, eliminar</button><button class="btn sm" data-nodelete type="button">No</button></div>`:
    `<div class="actions">
      <button class="btn sm" data-edit type="button">Editar caso</button>
      <button class="btn sm" data-copy type="button">Copiar resumen para WhatsApp</button>
      ${closed?`<button class="btn sm" data-reopen type="button">Reabrir</button>`:`<button class="btn sm" data-closecase type="button">Cerrar caso</button>`}
      <button class="btn ghost sm danger" data-delete type="button">Eliminar</button>
    </div>`}
  </div>`;
}
function bindCase(c){
  const m=$("#modal");
  m.querySelectorAll("[data-x]").forEach(b=>b.onclick=closeModal);
  m.querySelectorAll("[data-draft]").forEach(el=>el.oninput=()=>{UI.drafts[el.id]=el.value});
  m.querySelectorAll("[data-toggle]").forEach(cb=>cb.onchange=async()=>{
    const i=S.items.get(cb.dataset.toggle);if(!i)return;const v=cb.checked;
    i.done=v;i.done_by=v?me:null;i.done_at=v?now():0;renderModal();if(v)checkBloom(c.id);
    await run(sb.from("puntos").update(v?{done:true,done_by:me,done_at:new Date().toISOString()}:{done:false,done_by:null,done_at:null}).eq("id",i.id));
    await touchCase(c.id,(v?"marcó resuelto: ":"reabrió: ")+i.text);
  });
  m.querySelectorAll("[data-assign]").forEach(s=>s.onchange=async()=>{
    const i=S.items.get(s.dataset.assign);if(!i)return;i.assignee=s.value||null;
    await run(sb.from("puntos").update({assignee:s.value||null}).eq("id",i.id));
    await touchCase(c.id,"asignó “"+i.text+"” a "+(s.value?nameOf(s.value):"nadie"));
  });
  m.querySelectorAll("[data-reply]").forEach(b=>b.onclick=()=>{UI.composers.add(b.dataset.reply);renderModal();const t=document.getElementById("rep-"+b.dataset.reply);if(t)t.focus()});
  m.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>{const id=b.dataset.cancel;UI.composers.delete(id);delete UI.pending[id];delete UI.drafts["rep-"+id];renderModal()});
  m.querySelectorAll("[data-attach]").forEach(inp=>inp.onchange=async()=>{
    const id=inp.dataset.attach;const files=[...inp.files];if(!files.length)return;
    toast("Subiendo "+files.length+" archivo"+(files.length>1?"s":"")+"…");
    for(const f of files){try{const d=await storeFile(f,c.id);(UI.pending[id]=UI.pending[id]||[]).push(d)}catch(e){toast(e.message)}}
    await signUrls();renderModal();
  });
  const send=async(id,markDone)=>{
    const i=S.items.get(id);if(!i)return;const tid="rep-"+id;const text=(UI.drafts[tid]||"").trim();const files=UI.pending[id]||[];
    if(!text&&!files.length&&!markDone){toast("Escribe algo o adjunta un respaldo.");return}
    if(text||files.length)await run(sb.from("respuestas").insert({punto_id:id,caso_id:c.id,text,files}));
    if(markDone){await run(sb.from("puntos").update({done:true,done_by:me,done_at:new Date().toISOString()}).eq("id",id));i.done=true;checkBloom(c.id)}
    UI.composers.delete(id);delete UI.pending[id];delete UI.drafts[tid];
    await touchCase(c.id,(markDone?"respondió y resolvió: ":"respondió en: ")+i.text);
  };
  m.querySelectorAll("[data-send]").forEach(b=>b.onclick=()=>{b.disabled=true;send(b.dataset.send,false).finally(()=>b.disabled=false)});
  m.querySelectorAll("[data-sendclose]").forEach(b=>b.onclick=()=>{b.disabled=true;send(b.dataset.sendclose,true).finally(()=>b.disabled=false)});
  m.querySelectorAll("[data-delitem]").forEach(b=>b.onclick=async()=>{
    const i=S.items.get(b.dataset.delitem);if(!i)return;
    await run(sb.from("puntos").delete().eq("id",i.id));S.items.delete(i.id);
    await touchCase(c.id,"quitó el punto: "+i.text);
  });
  const addAs=m.querySelector("#addAs");if(addAs)addAs.onchange=()=>{UI.addAs=addAs.value};
  const addBtn=m.querySelector("[data-addpts]");if(addBtn)addBtn.onclick=async()=>{
    const tid="addPts-"+c.id;const lines=cleanLines(UI.drafts[tid]);
    if(!lines.length){toast("Escribe al menos un punto.");return}
    addBtn.disabled=true;
    try{await addPoints(c.id,lines,UI.addAs||"");delete UI.drafts[tid];await touchCase(c.id,"agregó "+lines.length+" punto"+(lines.length>1?"s":""))}finally{addBtn.disabled=false}
  };
  m.querySelectorAll("[data-closecase]").forEach(b=>b.onclick=()=>{UI.closing=true;renderModal();const t=$("#closeResult");if(t)t.focus()});
  const cc=m.querySelector("[data-cancelclose]");if(cc)cc.onclick=()=>{UI.closing=false;renderModal()};
  const cf=m.querySelector("[data-confirmclose]");if(cf)cf.onclick=async()=>{
    const result=(UI.drafts.closeResult||"").trim();UI.closing=false;delete UI.drafts.closeResult;
    await run(sb.from("casos").update({status:"cerrado",closed_at:new Date().toISOString(),result}).eq("id",c.id));
    await touchCase(c.id,"cerró el caso"+(result?": "+result:""));
  };
  const ro=m.querySelector("[data-reopen]");if(ro)ro.onclick=async()=>{
    await run(sb.from("casos").update({status:"abierto",closed_at:null}).eq("id",c.id));await touchCase(c.id,"reabrió el caso");
  };
  const ed=m.querySelector("[data-edit]");if(ed)ed.onclick=()=>openForm(c.id);
  const dl=m.querySelector("[data-delete]");if(dl)dl.onclick=()=>{UI.confirm="delete";renderModal()};
  const nd=m.querySelector("[data-nodelete]");if(nd)nd.onclick=()=>{UI.confirm=null;renderModal()};
  const dd=m.querySelector("[data-dodelete]");if(dd)dd.onclick=async()=>{
    dd.disabled=true;
    const {data:objs}=await sb.storage.from(BUCKET).list(c.id,{limit:1000});
    if(objs&&objs.length)await sb.storage.from(BUCKET).remove(objs.map(o=>c.id+"/"+o.name));
    await run(sb.from("casos").delete().eq("id",c.id));S.cases.delete(c.id);
    toast("Caso eliminado.");closeModal();reloadSoon();
  };
  const cp=m.querySelector("[data-copy]");if(cp)cp.onclick=()=>copySummary(c);
  m.querySelectorAll("img[data-zoom]").forEach(im=>im.onclick=()=>{if(im.src){$("#lightboxImg").src=im.src;$("#lightbox").hidden=false}});
}
async function addPoints(cid,lines,assignee){
  const base=itemsOf(cid).reduce((mx,i)=>Math.max(mx,i.orden||0),0);
  await run(sb.from("puntos").insert(lines.map((t,k)=>({caso_id:cid,text:t.slice(0,300),orden:base+k+1,assignee:assignee||null}))));
}
function copySummary(c){
  const its=itemsOf(c.id);const p=prog(c.id);
  const lines=["*"+c.title+"* ("+p.done+"/"+p.total+" resueltos)"];
  const pend=its.filter(i=>!i.done),done=its.filter(i=>i.done);
  if(pend.length){lines.push("","Falta:");pend.forEach(i=>lines.push("☐ "+i.text+(i.assignee?" → "+nameOf(i.assignee):"")))}
  if(done.length){lines.push("","Resuelto:");done.forEach(i=>{const last=(i.replies||[]).slice(-1)[0];lines.push("☑ "+i.text+(last&&last.text?": "+last.text:""))})}
  const txt=lines.join("\n");
  const fallback=()=>{const ta=document.createElement("textarea");ta.value=txt;document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand("copy")}catch(e){}ta.remove();toast(ok?"Resumen copiado.":"No se pudo copiar automáticamente.")};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast("Resumen copiado. Pégalo en WhatsApp."),fallback);else fallback();
}

// ---------- New / edit form ----------
function openForm(editId,title){
  UI.view="form";UI.editId=editId||null;UI.tpl=null;
  $("#modal").style.setProperty("--c",editId&&S.cases.get(editId)?catColor(S.cases.get(editId).cat):"#b388eb");
  const c=editId?S.cases.get(editId):null;
  $("#overlay").hidden=false;
  const tplBtns=Object.keys(TEMPLATES).map(k=>`<button type="button" data-tpl="${esc(k)}" aria-pressed="false">${esc(k)}</button>`).join("");
  $("#modal").innerHTML=`<button class="close" data-x aria-label="Cerrar ventana">✕</button>
  <form class="form" id="caseForm" autocomplete="off">
    <h2>${c?"Editar caso":"Nuevo caso"}</h2>
    <label for="fTitle">Tema principal<input id="fTitle" required maxlength="120" value="${esc(c?c.title:(title||""))}" placeholder="Ej: Vender la cuna"></label>
    ${c?"":`<div><div class="note" style="margin-bottom:6px;font-weight:600">Plantilla de puntos (opcional)</div><div class="tpls" id="tpls">${tplBtns}</div></div>`}
    <label for="fDesc">Detalle<textarea id="fDesc" rows="2" placeholder="Contexto, medidas, estado, lo que haga falta saber">${esc(c?c.descr||"":"")}</textarea></label>
    <div class="two">
      <label for="fCat">Categoría<select id="fCat">${CATS.map(k=>`<option ${c&&c.cat===k?"selected":""}>${esc(k)}</option>`).join("")}</select></label>
      <label for="fPrio">Prioridad<select id="fPrio">${Object.entries(PRIOS).map(([k,v])=>`<option value="${k}" ${(c?c.prio:"media")===k?"selected":""}>${esc(v.l)}</option>`).join("")}</select></label>
    </div>
    <div class="two">
      <label for="fDue">Fecha límite<input type="date" id="fDue" value="${esc(c?c.due||"":"")}"></label>
      <label for="fMoneyType">¿Hay dinero de por medio?<select id="fMoneyType"><option value="">No</option><option value="ingreso" ${c&&c.money_type==="ingreso"?"selected":""}>Sí, entra dinero</option><option value="gasto" ${c&&c.money_type==="gasto"?"selected":""}>Sí, sale dinero</option></select></label>
    </div>
    <div class="two">
      <label for="fAmount">Monto (Bs)<input type="number" id="fAmount" min="0" step="0.01" inputmode="decimal" value="${esc(c&&c.amount?c.amount:"")}"></label>
      <label for="fMoneyNote">¿A dónde va / de dónde sale?<input id="fMoneyNote" maxlength="120" value="${esc(c?c.money_note||"":"")}" placeholder="Ej: ahorro del bebé"></label>
    </div>
    <label for="fPhoto">Foto ${c&&c.cover?"(se reemplaza la actual)":"(opcional)"}<input type="file" id="fPhoto" accept="image/*"></label>
    ${c?"":`<label for="fPts">Puntos a resolver (uno por línea)<textarea id="fPts" rows="5" placeholder="Definir precio&#10;Fecha de venta&#10;¿En qué usamos el dinero?"></textarea></label>
    <label for="fAs">Los puntos le tocan a<select id="fAs">${memberOptions("")}</select></label>`}
    <div class="actions"><button class="btn primary" type="submit" id="fSave">${c?"Guardar cambios":"Plantar caso"}</button><button class="btn ghost" type="button" data-x>Cancelar</button></div>
  </form>`;
  $("#modal").querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{if(c){UI.view="case";renderModal()}else closeModal()});
  $("#modal").querySelectorAll("[data-tpl]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.tpl;const on=UI.tpl!==k;UI.tpl=on?k:null;
    $("#modal").querySelectorAll("[data-tpl]").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.tpl===UI.tpl)));
    if(on){const t=TEMPLATES[k];$("#fPts").value=t.pts.join("\n");$("#fCat").value=t.cat;$("#fMoneyType").value=t.money;$("#modal").style.setProperty("--c",catColor(t.cat))}
  });
  const fc=$("#fCat");fc.onchange=()=>$("#modal").style.setProperty("--c",catColor(fc.value));
  $("#fTitle").focus();
  $("#caseForm").onsubmit=async e=>{
    e.preventDefault();const btn=$("#fSave");btn.disabled=true;btn.textContent="Guardando…";
    try{
      const data={title:$("#fTitle").value.trim(),descr:$("#fDesc").value.trim(),cat:$("#fCat").value,prio:$("#fPrio").value,due:$("#fDue").value||null,
        money_type:$("#fMoneyType").value,amount:$("#fAmount").value?Number($("#fAmount").value):null,money_note:$("#fMoneyNote").value.trim()};
      const ph=$("#fPhoto").files[0];
      if(c){
        if(ph){const d=await storeFile(ph,c.id);data.cover=d.path}
        await run(sb.from("casos").update(data).eq("id",c.id));
        UI.view="case";await touchCase(c.id,"editó el caso");
      }else{
        const {data:row}=await run(sb.from("casos").insert(Object.assign(data,{created_by:me,updated_by:me})).select().single());
        const id=row.id;
        if(ph){try{const d=await storeFile(ph,id);await run(sb.from("casos").update({cover:d.path}).eq("id",id))}catch(err){toast(err.message)}}
        const lines=cleanLines($("#fPts").value);
        if(lines.length)await addPoints(id,lines,$("#fAs").value);
        await run(sb.from("historial").insert({caso_id:id,msg:"creó el caso"}));
        $("#quickInput").value="";
        await loadAll();
        openCase(id);
      }
    }catch(err){toast(err.message||"No se pudo guardar.");btn.disabled=false;btn.textContent="Reintentar"}
  };
}

function renderAll(){renderWho();renderBanner();renderStats();renderCatFilter();renderGrid();if(UI.openCase&&UI.view==="case")renderModal()}
let rafPending=false;
function scheduleRender(){if(rafPending)return;rafPending=true;requestAnimationFrame(()=>{rafPending=false;renderAll()})}

// ---------- Login ----------
function showLogin(msg){
  $("#app").hidden=true;$("#login").hidden=false;
  if(msg)$("#loginMsg").textContent=msg;
  $("#loginUser").focus();
}
$("#loginForm").onsubmit=async e=>{
  e.preventDefault();
  const u=$("#loginUser").value.trim().toLowerCase().replace(/\s+/g,"");const pin=$("#loginPin").value.trim();
  if(!u||!pin){$("#loginMsg").textContent="Escribe tu usuario y tu PIN.";return}
  const btn=$("#loginBtn");btn.disabled=true;btn.textContent="Entrando…";
  const {error}=await sb.auth.signInWithPassword({email:u+"@"+CFG.EMAIL_DOMAIN,password:pin+(CFG.PIN_SUFFIX||"")});
  btn.disabled=false;btn.textContent="Entrar";
  if(error){$("#loginMsg").textContent="Usuario o PIN incorrecto.";return}
  start();
};

// ---------- Wiring ----------
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]");if(b)setTab(b.dataset.tab)});
$("#catFilter").onchange=e=>{UI.cat=e.target.value;renderGrid()};
$("#search").oninput=e=>{UI.q=e.target.value.trim();renderGrid()};
$("#quickForm").onsubmit=e=>{e.preventDefault();openForm(null,$("#quickInput").value.trim())};
$("#overlay").addEventListener("click",e=>{if(e.target.id==="overlay"){if(UI.view==="form"&&UI.editId){UI.view="case";renderModal()}else closeModal()}});
$("#lightbox").onclick=()=>{$("#lightbox").hidden=true};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("#lightbox").hidden)$("#lightbox").hidden=true;else if(!$("#overlay").hidden)closeModal()}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&me)reloadSoon()});
setInterval(()=>{if(!document.hidden&&me)renderGrid()},60000);

// ---------- Boot ----------
let channel=null;
async function start(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){showLogin();return}
  me=session.user.id;myUser=(session.user.email||"").split("@")[0];
  myUser=myUser.charAt(0).toUpperCase()+myUser.slice(1);
  $("#login").hidden=true;$("#app").hidden=false;
  renderAll();
  const {data:mem}=await sb.from("miembros").select("id").eq("id",me).maybeSingle();
  if(!mem)await sb.from("miembros").insert({id:me,alias:((CFG.DEFAULT_NAMES||{})[myUser.toLowerCase()])||myUser});
  await loadAll();
  if(!channel){
    channel=sb.channel("cambios");
    ["casos","puntos","respuestas","historial","miembros"].forEach(t=>channel.on("postgres_changes",{event:"*",schema:"public",table:t},reloadSoon));
    channel.subscribe();
  }
}
(function boot(){
  if(!window.supabase||!CFG.SUPABASE_URL||/PEGAR/.test(CFG.SUPABASE_URL)){
    document.body.innerHTML='<div class="wrap"><div class="empty">Falta configurar Supabase en config.js.</div></div>';return;
  }
  sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  start().catch(e=>{console.error(e);showLogin("No se pudo conectar. Revisa tu internet.")});
})();
})();
