import {icon, categoryIcon} from './icons.js';
import {median, evaluateTrade, validateStore, parsePrice, mergeDeviceDraft} from './core.mjs';
import {sourceOptions, manufacturers, classifySource, deviceKinds, detectDeviceKind, specialistSources} from './online-sources.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => n === null || n === undefined ? '—' : new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const date = s => s ? new Date(s).toLocaleDateString('de-DE') : '—';
const uuid = () => { const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20); };
const today = () => new Date().toLocaleDateString('sv-SE');
const safeUrl = s => /^https?:\/\//i.test(s || '') ? esc(s) : '#';
const btn = (label,action,cls='',attrs='') => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const views = {compare:'Gerätevergleich',catalog:'Gerätekatalog',online:'Online-Recherche',trade:'Tauschrechner',history:'Meine Tausche',saved:'Gemerkte Vergleiche',settings:'Daten & Hilfe'};
const defaults = ['Handys','Konsolen','Grafikkarten','Prozessoren','Uhren','Laptops','Tablets','Audio','Monitore','Fernseher','Kameras','Speicher','PC-Zubehör','Haushalt','Sonstiges'];
const templates = {
  Handys:['Display','Bildwiederholrate','Auflösung','Prozessor','Speicher','Arbeitsspeicher','Hauptkamera','Akku','Gewicht','Schutz'],
  Konsolen:['Prozessor','Grafik','Arbeitsspeicher','Speicher','Display','Laufwerk','Netzwerk','Erweiterung'],
  Grafikkarten:['Architektur','Grafikspeicher','Speicherinterface','Boosttakt','Leistungsaufnahme','Anschlüsse'],
  Prozessoren:['Kerne','Threads','Boosttakt','Basistakt','L3-Cache','TDP','Sockel','Arbeitsspeicher'],
  Uhren:['Display','Gehäuse','Prozessor','Speicher','Laufzeit','Schutz','Kompatibilität','Gewicht'],
  Laptops:['Display','Auflösung','Prozessor','Grafik','Arbeitsspeicher','Speicher','Anschlüsse','Gewicht','Betriebssystem'],
  Audio:['Bauform','Geräuschunterdrückung','Laufzeit','Bluetooth','Schutz','Laden']
};
let store;
let shared=false,storeRevision;
const api = (url,options={}) => fetch(new URL(url.replace(/^\//,''),document.baseURI),{...options,headers:{...(shared?{'X-Tauschwerk-Mode':state.mode}:{}),...options.headers}});
const state = {view:'compare',mode:'offline',selected:[],onlyDiff:false,query:'',category:'Alle',pickerQuery:'',pickerCategory:'Alle',editing:null,trade:{},onlineDevices:[],onlineQuery:'',onlineLanguage:'all',onlineSource:'all',onlineManufacturer:'all',onlineKind:'all',onlineFiltersOpen:false,onlineResultSource:'all',onlineSearchedSources:[],onlineResults:[],onlineWarnings:[],onlineBusy:false,onlineError:'',onlinePreview:null};
let saveQueue = Promise.resolve();
let toastTimer;
function toast(message,error=false) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').className='visible'+(error?' error':'');if(modal.open){let notice=modal.querySelector('.dialog-notice');if(!notice){notice=document.createElement('div');notice.className='dialog-notice';notice.setAttribute('role','alert');modal.querySelector('.modal-content')?.prepend(notice);}if(notice){notice.hidden=false;notice.textContent=message;notice.classList.toggle('error',error);notice.scrollIntoView({block:'nearest'});}}toastTimer=setTimeout(()=>$('#toast').className='',5000);}
function device(id) {return store.devices.find(d=>d.id===id) || (state.mode==='online'?state.onlineDevices.find(d=>d.id===id):undefined);}
function categories() {return [...new Set([...defaults,...store.devices.map(d=>d.category)])];}
function estimated(d) {return d?.value ?? median(d?.offers?.map(o=>o.price) || []);}
function estimateLabel(d) {return d.value !== null ? 'Deine Preiseinschätzung' : d.offers.length ? 'Median deiner Angebotspreise' : 'Gebrauchtwert noch offen';}
function currentUI() {return structuredClone({view:state.view,mode:state.mode,selected:state.selected.filter(id=>store.devices.some(d=>d.id===id)),onlyDiff:state.onlyDiff,trade:state.trade});}
function save(mutator=()=>{},message='',rerender=false) {
  const task = saveQueue.catch(()=>{}).then(async()=>{
    const candidate=structuredClone(store);mutator(candidate);if(!shared)candidate.ui=currentUI();validateStore(candidate);
    $('.save-status').textContent='Wird gespeichert …';
    const response=await api('/api/store',{method:'PUT',headers:{'Content-Type':'application/json',...(storeRevision?{'If-Match':storeRevision}:{})},body:JSON.stringify(candidate)});
    if(response.status===409){const latest=await api('/api/store');if(latest.ok){store=validateStore(await latest.json());storeRevision=latest.headers.get('etag');}throw new Error('Auf einem anderen Gerät wurden Daten geändert. Der aktuelle Stand ist geladen; bitte deinen Eintrag erneut speichern.');}
    const answer=await response.json();if(!response.ok) throw new Error(answer.error || 'Speichern fehlgeschlagen');
    storeRevision=response.headers.get('etag');store=candidate;$('.save-status').textContent=shared?'Auf dem Server gespeichert':'Lokal gespeichert';
    if(rerender) render();if(message) toast(message);
  });
  saveQueue=task;
  task.catch(e=>{const status=$('.save-status');if(status) status.textContent='Nicht gespeichert';toast(e.message,true);});
  return task;
}
let uiTimer;
function saveUI() {clearTimeout(uiTimer);if(shared){try{localStorage.setItem('tauschwerk-ui',JSON.stringify({...currentUI(),selected:state.selected,onlineDevices:state.onlineDevices}));}catch{}return;}uiTimer=setTimeout(()=>save(),300);}
function normalizeSelection() {state.selected=state.selected.filter(id=>device(id)).slice(0,4);}
function selectedDevices() {return state.selected.map(device).filter(Boolean);}
function categoryOptions(selected,all=false) {return `${all?'<option>Alle</option>':''}${categories().map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}`;}
function deviceOptions(id) {return `<option value="">Gerät auswählen …</option>`+store.devices.map(d=>`<option value="${esc(d.id)}" ${id===d.id?'selected':''}>${esc(d.brand)} · ${esc(d.name)}</option>`).join('');}
function researchLinks(d) {
  const q=encodeURIComponent(`${d.brand} ${d.name}`);
  return `<a class="btn small ghost" data-research="kleinanzeigen" href="https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${q}" target="_blank" rel="noopener noreferrer">Angebote ${icon('link')}</a><a class="btn small ghost" data-research="ebay" href="https://www.ebay.de/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1" target="_blank" rel="noopener noreferrer">Verkaufte Artikel ${icon('link')}</a>`;
}
function renderChrome() {
  $('#sidebar').innerHTML=`<div class="brand"><div class="brand-icon">${icon('swap')}</div><div><div class="brand-name">tauschwerk</div><small>DEIN TECH. DEIN DEAL.</small></div></div><div class="nav-label">DEIN WORKSPACE</div><nav class="nav">${[['compare','compare'],['catalog','grid'],['trade','swap'],['history','history'],['settings','settings']].map(([v,i])=>`<button data-action="view" data-view="${v}" class="${state.view===v?'active':''}" title="${views[v]}">${icon(i)}<span>${views[v]}</span>${v==='catalog'?`<span class="count">${store.devices.length}</span>`:v==='history'&&store.trades.length?`<span class="count">${store.trades.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom">${icon('shield')}<strong>Alles auf deinem PC.</strong><p>Dein Katalog und deine Tausche werden lokal gespeichert.</p><p class="lime">● Offline bereit · v1.6</p></div>`;
  $('#topbar').innerHTML=`<div class="crumb">Workspace <span>/</span><b>${views[state.view]}</b></div><div class="top-right"><span class="save-status">Lokal gespeichert</span><span class="pill green"><span class="dot"></span> Lokale App</span><div class="avatar">TW</div></div>`;
  if(shared){$('#sidebar .sidebar-bottom strong').textContent='Dein gemeinsamer Katalog.';$('#sidebar .sidebar-bottom p').textContent='Geräte und Tausche werden auf deinem Home-Assistant-Server gespeichert.';$('.save-status').textContent='Auf dem Server gespeichert';$('.top-right .pill').innerHTML='<span class="dot"></span> Home Assistant';}
}
function heading(kicker,title,subtitle,actions='') {return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div><div class="actions">${actions}</div></div>`;}
function render() {
  normalizeSelection();renderChrome();
  $('.top-right').insertAdjacentHTML('afterbegin',`<div class="mode-toggle" aria-label="Datenmodus">${['offline','online'].map(mode=>`<button type="button" data-action="mode" data-mode="${mode}" aria-pressed="${state.mode===mode}" class="${state.mode===mode?'active':''}">${icon(mode==='offline'?'shield':'search')}${mode==='offline'?'Offline':'Online'}</button>`).join('')}</div>`);
  if(state.mode==='online') $('#sidebar .nav').insertAdjacentHTML('beforeend',`<button data-action="view" data-view="online" class="${state.view==='online'?'active':''}" title="Online-Recherche">${icon('search')}<span>Online-Recherche</span></button>`);
  $('#sidebar .sidebar-bottom .lime').textContent=state.mode==='online'?'● Online-Modus · v1.6':shared?'● Gespeicherter Katalog · v1.6':'● Offline bereit · v1.6';
  if(shared)$('#sidebar .nav').insertAdjacentHTML('beforeend',`<button data-action="view" data-view="saved" class="${state.view==='saved'?'active':''}">${icon('history')}<span>Gemerkte Vergleiche</span></button>`);
  const map={compare:renderCompare,catalog:renderCatalog,online:renderOnline,trade:renderTrade,history:renderHistory,saved:renderSaved,settings:renderSettings};
  $('#main').innerHTML=map[state.view]();
  if(shared&&state.view==='compare'&&state.selected.length)$('.toolbar-left').insertAdjacentHTML('beforeend',btn(icon('check')+' Vergleich merken','remember-comparison','small ghost'));
  if(shared&&state.view==='settings'){
    $('.eyebrow').textContent='GEMEINSAM. NACHVOLLZIEHBAR. DEINS.';$('.subtitle').textContent='Anmeldung über Home Assistant. Ein Katalog für deine Geräte.';
    $('.info-block .panel-body').insertAdjacentHTML('afterbegin','<h3>Tauschwerk auf deinem Server</h3><p>Geräte, Preise, gemerkte Vergleiche und Tausche werden zentral gespeichert. Andere Geräte sehen Änderungen innerhalb von etwa 15 Sekunden. Online-Datenblätter werden bis zu 24 Stunden zwischengespeichert. Mit „Vergleich merken“ kannst du eine Auswahl auf jedem Gerät wieder öffnen. Deine aktuelle Ansicht und dein Datenmodus gelten nur für diesen Browser.</p>');
    for(const p of $('.info-block').querySelectorAll('p')){if(p.textContent.startsWith('Im App-Ordner unter'))p.textContent='Die gemeinsame Datenbank liegt im dauerhaften Speicher der Home-Assistant-App. Exportiere regelmäßig ein JSON-Backup; auch Home-Assistant-App-Backups enthalten diese Daten.';if(p.textContent.startsWith('Tauschwerk.exe startet'))p.textContent='Öffne Tauschwerk in der Home-Assistant-Seitenleiste auf deinem PC, Handy oder Tablet. Im Modus „Offline“ arbeitest du mit dem gespeicherten Katalog ohne Webrecherche. Die Verbindung zu deinem Home-Assistant-Server bleibt für die gemeinsame Datenbank erforderlich.';}
  }
  if(state.view==='trade') renderTradeResult();
}
function productPicture(d,cls='') {
  const data=d.image?.data;
  return `<span class="product-picture ${cls} ${data?'has-image':''}">${icon(categoryIcon(d.category),'picture-fallback')}${data?`<img src="${esc(data)}" alt="Produktbild von ${esc(d.name)}" loading="lazy" decoding="async">`:''}</span>`;
}
function imageCredit(d) {return d.image?`<a class="image-credit" href="${safeUrl(d.image.source)}" target="_blank" rel="noopener noreferrer">Bildquelle: ${esc(new URL(d.image.source).hostname)} ${icon('link')}</a>`:'';}
function visual(d) {
  return `<div class="device-visual">${productPicture(d,'picture-large')}</div>${imageCredit(d)}`;
}
function compareCard(d,index) {
  const source=d.source?`<a href="${safeUrl(d.source)}" target="_blank" rel="noopener noreferrer">${esc(classifySource(d.source).name)} ${icon('link')}</a>`:'<span class="muted">Eigener Eintrag</span>';
  return `<article class="device-card"><div class="card-top"><span class="pill ${index===0?'amber':index===1?'':'green'}">${esc(d.category)} · ${String(index+1).padStart(2,'0')}</span>${btn(icon('close'),'remove-select','icon-only',`data-id="${esc(d.id)}" aria-label="${esc(d.name)} aus Vergleich entfernen"`)}</div>${visual(d)}<h2 class="device-name">${esc(d.name)}</h2><div class="device-sub">${esc(d.brand)}${d.checked?' · Datenstand '+date(d.checked):''}</div><div class="card-metrics"><div><strong>${money(estimated(d))}</strong><span>${estimateLabel(d)}</span></div><span class="pill">${d.offers.length} Preisbeispiele</span></div><div class="card-foot">${source}${btn('Daten & Preis '+icon('edit'),'edit','small ghost',`data-id="${esc(d.id)}"`)}</div></article>`;
}
function specRows(devices) {
  const keys=[...new Set(devices.flatMap(d=>d.specs.map(s=>s.key.trim())))];
  return keys.map(key=>{const values=devices.map(d=>d.specs.find(s=>s.key.trim()===key)?.value || '—');return {key,values,different:new Set(values.map(v=>v.trim().toLocaleLowerCase('de-DE'))).size>1};});
}
function renderCompare() {
  const devices=selectedDevices();const rows=specRows(devices);const visible=rows.filter(r=>!state.onlyDiff || r.different);
  const mixed=new Set(devices.map(d=>d.category)).size>1;
  return heading('VERGLEICHEN. ABWÄGEN. TAUSCHEN.','Was passt zu deinem nächsten Tausch?','Technische Daten nebeneinander. Gebrauchtwerte aus deinen eigenen Preisbeispielen.',btn(icon('plus')+(state.mode==='online'?' Geräte online auswählen':' Geräte auswählen'),'picker','primary'))+
  `<div class="toolbar"><div class="toolbar-left"><span class="chip active">${icon('compare')} ${devices.length} von 4 Geräten</span>${btn('Eigenes Gerät hinzufügen','new','small ghost')}</div><label class="switch"><input type="checkbox" id="only-diff" ${state.onlyDiff?'checked':''}> Nur Unterschiede</label></div>`+
  (devices.length?`<div class="compare-cards cols-${devices.length}">${devices.map(compareCard).join('')}${devices.length===1?`<button class="add-slot" data-action="picker">${icon('plus')}Zweites Gerät auswählen</button>`:''}</div>
  <section class="panel"><div class="panel-head"><h2>Die Details im Vergleich <span class="muted">/ ${visible.length} Merkmale</span></h2>${btn(icon('download')+' CSV exportieren','csv','small ghost')}</div><div class="table-wrap"><table class="spec-table"><thead><tr><th>Technische Merkmale</th>${devices.map(d=>`<th>${esc(d.name)}</th>`).join('')}</tr></thead><tbody>${visible.length?visible.map(r=>`<tr class="${r.different?'different':''}"><td>${esc(r.key)}</td>${r.values.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${devices.length+1}">Keine ${state.onlyDiff?'unterschiedlichen':'hinterlegten'} Merkmale.</td></tr>`}</tbody></table></div><div class="table-foot">${icon('info')}<span>${mixed?'Du vergleichst unterschiedliche Kategorien. Nicht gemeinsame Merkmale sind nur bei passenden Geräten aussagekräftig.':'Markierte Zeilen unterscheiden sich. Größere Zahlen bedeuten nicht automatisch ein besseres Gerät.'} Fehlende Angaben erscheinen als „—“. Herstellerdaten beschreiben das Modell, nicht den Zustand eines Angebots.</span></div></section>
  <div class="insight-banner">${icon('swap')}<div><h3>Gute Technik. Aber auch ein guter Tausch?</h3><p>Vergleiche die konkreten Gerätewerte, Zubehör, Mängel und eine Zuzahlung.</p></div>${btn('Tausch durchrechnen '+icon('arrow'),'go-trade','ghost')}</div>`:
  `<div class="panel empty">${icon('compare')}<h2>Dein Vergleich beginnt mit zwei Geräten.</h2><p>Wähle Modelle aus dem Katalog oder lege eigene Geräte an. Du kannst auch verschiedene Kategorien miteinander vergleichen.</p>${btn(icon('plus')+' Geräte auswählen','picker','primary')}</div>`);
}
function matches(d,q,cat) {return (cat==='Alle' || d.category===cat) && `${d.brand} ${d.name} ${d.category} ${d.specs.map(s=>s.value).join(' ')}`.toLocaleLowerCase('de-DE').includes(q.trim().toLocaleLowerCase('de-DE'));}
function catalogCards() {
  const found=store.devices.filter(d=>matches(d,state.query,state.category));
  if(!found.length) return `<div class="panel empty"><h2>Kein Gerät gefunden.</h2><p>Lege das gesuchte Modell selbst an oder ändere deinen Filter.</p>${btn(icon('plus')+' Eigenes Gerät','new','primary')}</div>`;
  return `<div class="catalog-grid">${found.map(d=>`<article class="catalog-card"><div class="card-top">${productPicture(d,'picture-catalog')}<span class="pill">${esc(d.category)}</span></div><h3>${esc(d.name)}</h3><div class="device-sub">${esc(d.brand)} · ${d.specs.length} Merkmale</div><p class="summary">${esc(d.specs.slice(0,2).map(s=>s.value).join(' · '))}</p><div class="card-value"><small>${estimateLabel(d)}</small><b>${money(estimated(d))}</b></div><div class="actions">${btn(state.selected.includes(d.id)?icon('check')+' Im Vergleich':icon('plus')+' Vergleichen','toggle-select','small '+(state.selected.includes(d.id)?'primary':'ghost'),`data-id="${esc(d.id)}"`)}${btn(icon('edit'),'edit','icon-only',`data-id="${esc(d.id)}" aria-label="${esc(d.name)} bearbeiten"`)}</div></article>`).join('')}</div>`;
}
function renderCatalog() {
  return heading('DEINE TECH-SAMMLUNG','Ein Katalog, der mit dir wächst.','Modelle, Varianten und beliebige Kategorien. Alle Einträge und Merkmale lassen sich bearbeiten.',(state.mode==='online'?btn(state.imagesBusy?'Bilder laden …':'Produktbilder ergänzen','catalog-images','ghost',state.imagesBusy?'disabled':''):'')+btn(icon('plus')+' Neues Gerät','new','primary'))+
  `<div class="stat-row"><span><strong>${store.devices.length}</strong> Geräte</span><span><strong>${new Set(store.devices.map(d=>d.category)).size}</strong> Kategorien</span><span><strong>${store.devices.filter(d=>estimated(d)!==null).length}</strong> mit Preisbasis</span></div><div class="toolbar"><div class="toolbar-left"><select id="catalog-category" aria-label="Kategorie filtern">${categoryOptions(state.category,true)}</select></div><div class="search-box">${icon('search')}<input id="catalog-search" value="${esc(state.query)}" placeholder="Gerät, Marke oder Merkmal suchen …" aria-label="Katalog durchsuchen"></div></div>${state.imageProgress?`<p class="help" role="status">${esc(state.imageProgress)}</p>`:''}<div id="catalog-results">${catalogCards()}</div>`;
}

function renderOnline() {
  if(state.mode!=='online')return heading('DEIN DATENMODUS','Online-Recherche einschalten.','Die Offline-Datenbank ist weiterhin verfügbar.',btn('Online-Modus aktivieren','mode','primary','data-mode="online"'));
  const preview=state.onlinePreview;
  const kind=state.onlineKind==='all'?detectDeviceKind(state.onlineQuery):state.onlineKind;
  const recommendations=specialistSources.filter(s=>s.kinds.includes(kind)).map(s=>s.name);
  return heading('DEIN NÄCHSTES GERÄT','Was möchtest du vergleichen?','Handys, Konsolen, Uhren, PC-Hardware und vieles mehr. Gib den Modellnamen ein – wir suchen passende Quellen.')+
    `<ol class="research-steps" aria-label="So funktioniert die Online-Suche"><li class="${!state.onlineSearched?'current':''}"><span>1</span><div><b>Gerät suchen</b><small>Modellnamen eingeben</small></div></li><li class="${state.onlineSearched&&!preview?'current':''}"><span>2</span><div><b>Quelle auswählen</b><small>Passendes Datenblatt laden</small></div></li><li class="${preview?'current':''}"><span>3</span><div><b>Daten prüfen & vergleichen</b><small>Zum Vergleich hinzufügen</small></div></li></ol>`+
    renderOnlineSelection()+
    `<section class="panel online-search-panel"><div class="panel-body"><form id="online-search-form" class="online-search-form"><label class="field">Geräteart<select id="online-kind">${deviceKinds.map(([id,name])=>`<option value="${id}" ${id===state.onlineKind?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label class="field">Gerät oder Modell<input id="online-query" value="${esc(state.onlineQuery)}" placeholder="z. B. iPhone 17 Pro, Ryzen 7 9800X3D, PlayStation 5" maxlength="160" minlength="2" required></label><button type="submit" class="btn primary" ${state.onlineBusy?'disabled':''}>${icon('search')} Online suchen</button><details id="online-filters" class="search-disclosure full" ${state.onlineFiltersOpen?'open':''}><summary>Suche verfeinern <span>${esc(sourceOptions.find(s=>s[0]===state.onlineSource)?.[1])}${state.onlineManufacturer!=='all'?' · '+esc(manufacturers.find(m=>m.id===state.onlineManufacturer)?.name):''}</span></summary><div class="advanced-filters"><label class="field">Suchquelle<select id="online-source">${sourceOptions.map(([id,name])=>`<option value="${id}" ${id===state.onlineSource?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label class="field">Hersteller<select id="online-manufacturer" ${state.onlineSource==='wikipedia'?'disabled':''}><option value="all">Alle Hersteller</option>${manufacturers.map(m=>`<option value="${m.id}" ${m.id===state.onlineManufacturer?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label><label class="field">Quellen-Sprache<select id="online-language"><option value="all" ${state.onlineLanguage==='all'?'selected':''}>Deutsch & Englisch</option><option value="de" ${state.onlineLanguage==='de'?'selected':''}>Deutsch</option><option value="en" ${state.onlineLanguage==='en'?'selected':''}>Englisch</option></select></label></div></details></form><p class="source-hint">${icon('shield')} Herstellerseiten & Websuche${recommendations.length?' · Fachquellen für diese Geräteart: '+esc(recommendations.join(', ')): ' · Freie Modell- und Quellenauswahl'}</p><details class="search-disclosure online-url-block" ${state.onlineError||state.onlineURL?'open':''}><summary>Du hast schon einen Produktlink?</summary><form id="online-url-form" class="online-url-form"><label class="field">Öffentliche Produkt- oder Datenblatt-Seite<input id="online-url" value="${esc(state.onlineURL || '')}" placeholder="https://…" maxlength="2000" required></label><button type="submit" class="btn ghost" ${state.onlineBusy?'disabled':''}>${icon('download')} Daten einlesen</button></form><p class="help">Die auslesbaren technischen Angaben erscheinen zuerst als Vorschau.</p></details></div></section>`+
    (state.onlineError?`<div class="online-alert error" role="alert">${icon('info')}<span>${esc(state.onlineError)}</span></div>`:'')+
    (state.onlineBusy?`<div class="online-alert" role="status"><span class="spinner"></span><span>${state.onlineBusy==='search'?'Geräte im Netz suchen …':'Datenblatt laden und technische Merkmale auslesen …'}</span></div>`:'')+
    (state.onlineWarnings.length?`<details class="online-alert source-notices"><summary>${state.onlineResults.length?'Hinweise zu den Quellen':'Einige Quellen konnten nicht helfen'} <span class="muted">(${state.onlineWarnings.length})</span></summary><div>${state.onlineWarnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div></details>`:'')+
    (preview?renderOnlinePreview(preview):'')+
    (state.onlineResults.length?renderOnlineResults():!preview&&!state.onlineBusy?`<section class="panel empty online-welcome">${icon('search')}<h2>${state.onlineSearched?'Noch kein passendes Datenblatt gefunden.':'Ein Modellname reicht für den Start.'}</h2><p>${state.onlineSearched?'Prüfe die Schreibweise oder wähle unter „Suche verfeinern“ eine andere Quelle. Du kannst auch einen Produktlink einlesen.':'Die automatische Suche wählt passende Fachquellen. Du entscheidest, welche Daten du vergleichst oder speicherst.'}</p>${!state.onlineSearched?`<div class="example-searches">${[['iPhone 17 Pro','phones'],['PlayStation 5','consoles'],['Ryzen 7 9800X3D','cpu'],['Apple Watch Series 12','watches']].map(([q,k])=>btn(esc(q),'online-example','small ghost',`data-query="${esc(q)}" data-kind="${k}"`)).join('')}</div>`:''}</section>`:'')+renderBrowserSearch();
}
function renderOnlineResults(){
  const names=[...new Set(state.onlineResults.map(r=>r.sourceName||classifySource(r.url).name))];
  const rows=state.onlineResults.map((r,i)=>({...r,index:i})).filter(r=>state.onlineResultSource==='all'||(r.sourceName||classifySource(r.url).name)===state.onlineResultSource);
  return `<section class="online-results"><div class="results-heading"><div><span class="eyebrow">SCHRITT 2 · QUELLE AUSWÄHLEN</span><h2>${state.onlineResults.length} Treffer aus ${names.length} Quellen</h2><p>Wähle das genaue Modell. Angaben verschiedener Varianten können abweichen.</p></div></div><div class="source-chips" aria-label="Ergebnisse nach Quelle filtern">${['all',...names].map(n=>btn(n==='all'?'Alle Treffer':esc(n),'online-result-source','chip '+(state.onlineResultSource===n?'active':''),`data-source="${esc(n)}" aria-pressed="${state.onlineResultSource===n}"`)).join('')}</div><div class="result-grid">${rows.map(r=>`<article class="online-result"><div class="result-type"><span class="pill ${r.provider==='manufacturer'?'green':''}">${esc(r.provider==='manufacturer'?'Offizieller Hersteller':r.browserOnly?'Testbericht':r.isPDF?'PDF-Datenblatt':'Gerätedaten')}</span>${state.onlinePreview?.source===r.url?'<span class="loaded-mark">✓ Geladen</span>':''}</div><div class="online-result-text"><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><a href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.sourceName || classifySource(r.url).name)}${r.language?' · '+(r.language==='de'?'Deutsch':'English'):''} · ${esc(new URL(r.url).hostname)} ${icon('link')}</a></div>${r.isPDF||r.browserOnly?`<a class="btn ghost" href="${safeUrl(r.url)}" target="_blank" rel="noopener noreferrer">${r.isPDF?'PDF öffnen':'Testbericht öffnen'} ${icon('link')}</a>`:btn('Daten laden '+icon('arrow'),'online-fetch','ghost',`data-index="${r.index}" ${state.onlineBusy?'disabled':''}`)}</article>`).join('')}</div></section>`;
}
function renderBrowserSearch() {
  if(!state.onlineSearched || !state.onlineQuery)return '';
  const maker=manufacturers.find(m=>m.id===state.onlineManufacturer);
  const specialist=specialistSources.find(s=>s.id===state.onlineSource);
  const domain=state.onlineSource==='manufacturer'?maker?.domains[0]:specialist?.domains[0];
  const q=encodeURIComponent(state.onlineQuery+' technische Daten'+(domain?' site:'+domain:''));
  return `<div class="browser-search"><span>Noch nicht das richtige Gerät dabei?</span><a href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer">In Google suchen ${icon('link')}</a><a href="https://www.bing.com/search?q=${q}" target="_blank" rel="noopener noreferrer">In Bing suchen ${icon('link')}</a><span>Den gefundenen Produktlink kannst du hier einlesen.</span></div>`;
}
function renderOnlineSelection() {
  const devices=selectedDevices();
  return `<section class="online-selection" aria-label="Geräte für den Vergleich"><div class="online-selection-head"><div><h2>Dein Vergleich · ${devices.length} von 4 Geräten</h2><p>${devices.length===0?'Wähle dein erstes Gerät aus dem Netz.':'Suche jetzt das nächste Gerät online. Deine bisherige Auswahl bleibt erhalten.'}</p></div>${btn('Vergleich ansehen '+icon('arrow'),'view','ghost',`data-view="compare" ${devices.length?'':'disabled'}`)}</div>${devices.length?`<div class="online-selection-devices">${devices.map(d=>`<div class="online-selection-device">${productPicture(d,'picture-thumb')}<span>${esc(d.name)}</span>${btn(icon('close'),'remove-select','icon-only',`data-id="${esc(d.id)}" aria-label="${esc(d.name)} aus Vergleich entfernen"`)}</div>`).join('')}</div>`:''}</section>`;
}
function renderOnlinePreview(d) {
  const cached=store.devices.some(x=>x.id===d.id);
  const highlights=d.specs.filter(s=>/^(?:Prozessor|Kerne|Threads|Grafikspeicher|Grafik|Display|Display · Größe|Arbeitsspeicher|Speicher|Akku|TDP|Gewicht|Sockel|Bildwiederholrate)$/.test(s.key)&&s.value.length<160).slice(0,6);
  return `<section class="panel online-preview"><div class="panel-head"><div><span class="eyebrow">SCHRITT 3 · DEIN GERÄT PRÜFEN</span><h2>${esc(d.name.toLowerCase().startsWith(d.brand.toLowerCase())?d.name:d.brand+' '+d.name)}</h2></div><span class="pill green">${d.specs.length} Merkmale</span></div><div class="panel-body">${d.image?`<div class="preview-product">${productPicture(d,'picture-preview')}${imageCredit(d)}</div>`:''}<div class="online-preview-summary"><span class="pill">${esc(d.category)}</span><span class="muted">Abruf: ${date(d.checked)}</span><a href="${safeUrl(d.source)}" target="_blank" rel="noopener noreferrer">${esc(classifySource(d.source).name)} öffnen ${icon('link')}</a></div><div class="spec-highlights">${highlights.map(s=>`<div><small>${esc(s.key)}</small><strong>${esc(s.value)}</strong></div>`).join('')}</div><div class="online-preview-actions">${btn(icon('compare')+' Online vergleichen','online-compare','primary')}${btn(icon('download')+(cached?' Als neue Offline-Variante speichern':' Offline speichern & bearbeiten'),'online-save','ghost')}<small class="muted">Vergleichen fügt das Gerät zu deiner Auswahl hinzu. Speichern öffnet den Editor für deinen Katalog.</small></div><details class="spec-details"><summary>Alle ${d.specs.length} technischen Merkmale ansehen</summary><div class="table-wrap"><table class="spec-table"><thead><tr><th>Merkmal</th><th>Ausgelesener Wert</th></tr></thead><tbody>${d.specs.map(s=>`<tr><td>${esc(s.key)}</td><td>${esc(s.value)}</td></tr>`).join('')}</tbody></table></div><small class="muted">${esc(d.provenance?.attribution || '')}</small></details></div></section>`;
}
let onlineController;
let onlineGeneration=0;
async function runOnline(kind,url) {
  if(state.mode!=='online')return toast('Schalte zuerst auf Online um.',true);
  onlineController?.abort();onlineController=new AbortController();const generation=++onlineGeneration;
  state.onlineBusy=kind;state.onlineError='';state.onlineWarnings=[];if(kind==='search'){state.onlinePreview=null;state.onlineResults=[];state.onlineResultSource='all';state.onlineSearchedSources=[];}render();
  try {
    await saveQueue;
    const response=await api(url,{signal:onlineController.signal});const data=await response.json();
    if(!response.ok)throw new Error(data.error || 'Online-Daten konnten nicht geladen werden.');
    if(generation!==onlineGeneration || state.mode!=='online')return;
    if(kind==='search'){state.onlineResults=data.results;state.onlineSearched=true;state.onlineSearchedSources=data.searchedSources||[];}else{validateStore({version:1,devices:[data.device],trades:[]});state.onlinePreview=data.device;}
    state.onlineWarnings=data.warnings || [];
  }catch(e){if(e.name!=='AbortError' && generation===onlineGeneration)state.onlineError=e.message;}
  finally {if(generation===onlineGeneration){state.onlineBusy=false;render();}}
}
async function setMode(mode) {
  if(!['offline','online'].includes(mode))return;
  const previous=state.mode;state.mode=mode;onlineController?.abort();onlineGeneration++;state.onlineBusy=false;
  if(mode==='online')state.view='online';else if(state.view==='online')state.view='catalog';
  normalizeSelection();
  try{if(shared)saveUI();else await save();render();}catch{state.mode=previous;render();}
}
function initTrade(force=false) {
  if(!state.trade || typeof state.trade!=='object') state.trade={};
  if(force || !state.trade.giveId) state.trade.giveId=state.selected[0] || '';
  if(force || !state.trade.receiveId) state.trade.receiveId=state.selected[1] || '';
  for(const side of ['give','receive']) {
    if(!device(state.trade[side+'Id'])) state.trade[side+'Id']='';
    if(force) for(const suffix of ['Base','Extra','Deduct','Variant','Condition','Contents','Issues','Accessories','Valuation','ValueMode']) delete state.trade[side+suffix];
    if(state.trade[side+'Variant']===undefined)state.trade[side+'Variant']=(device(state.trade[side+'Id'])?.name.split('·').slice(1).join('·')||'').trim();
  }
}
const valuationBusy={give:false,receive:false};
function manualTrade(side){return state.trade[side+'ValueMode']==='manual'||(!state.trade[side+'ValueMode']&&Object.hasOwn(state.trade,side+'Base'));}
function tradeProfile(side){
  const d=device(state.trade[side+'Id']);
  const extras=(state.trade[side+'Accessories']||'').split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{const m=line.match(/^(\d+)\s*[x×]\s*(.+)$/i);return {name:m?m[2]:line,quantity:m?Number(m[1]):1};});
  return {name:d?.name.split('·')[0].trim()||'',variant:state.trade[side+'Variant']||'',condition:state.trade[side+'Condition']||'Nicht angegeben',contents:state.trade[side+'Contents']||'',issues:state.trade[side+'Issues']||'',accessories:extras};
}
function valuationKey(side){return JSON.stringify({id:state.trade[side+'Id'],...tradeProfile(side)});}
function activeValuation(side){const v=state.trade[side+'Valuation'];return v?.key===valuationKey(side)&&Date.now()-Date.parse(v.answer?.checked)<86400000?v.answer:null;}
function tradeBase(side){return manualTrade(side)?state.trade[side+'Base']??estimated(device(state.trade[side+'Id']))??'':activeValuation(side)?.estimate?.value??'';}
function valuationHTML(v){
  if(!v)return '<p class="help">Noch keine Online-Bewertung. Modell, Zustand und Lieferumfang werden mit öffentlichen Angeboten abgeglichen.</p>';
  const parts=[{label:'Gerät',...v.base},...(v.accessories||[]).map(a=>({...a,label:a.quantity+' × '+a.name}))];
  return `<div class="valuation-answer"><div class="valuation-summary">${v.estimate?`<b>${money(v.estimate.low)} – ${money(v.estimate.high)}</b><span>${esc(v.kind)} · Sicherheit: ${esc(v.estimate.confidence)}</span>`:'<b>Wert noch offen</b>'}<small>Abruf: ${esc(new Date(v.checked).toLocaleString('de-DE'))}</small></div><p class="help">${esc(v.message)}</p>${parts.map(p=>`<details class="market-evidence"><summary>${esc(p.label)} · ${p.estimate?money(p.estimate.value):'keine Schätzung'}${p.estimate?' · '+p.estimate.count+' Angebote':''}</summary><p class="help">${esc(p.reason)}</p><div class="source-status">${(p.sources||[]).map(s=>`<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.source)}: ${s.status==='ok'?s.count+' Treffer':esc(s.message)}</a>`).join('')}</div>${(p.evidence||[]).map(e=>`<a class="market-offer" href="${safeUrl(e.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(e.title)}<small>${esc(e.source)} · ${esc(e.condition)} · ${e.kind==='private-asking'?'Privates Angebot':e.kind==='dealer-used'?'Händler / refurbished':e.kind==='new-reference'?'Neupreis / nur Kontext':'Gebraucht ab / nur Kontext'}${p.used?.includes(e.url)?' · eingerechnet':' · nicht eingerechnet'}</small></span><b>${money(e.price)}</b></a>`).join('')}</details>`).join('')}<p class="help">${(v.warnings||[]).map(esc).join(' ')}</p></div>`;
}
function renderValuation(side){const el=$('#'+side+'-valuation');if(el)el.innerHTML=valuationHTML(activeValuation(side));}
function invalidateValuation(key){
  const side=key.startsWith('give')?'give':key.startsWith('receive')?'receive':null;
  if(side&&/(?:Variant|Condition|Contents|Issues|Accessories)$/.test(key)){delete state.trade[side+'Valuation'];renderValuation(side);}
}
async function onlineValue(side){
  if(!['give','receive'].includes(side)||valuationBusy[side])return;
  const profile=tradeProfile(side),key=valuationKey(side);
  if(!profile.name||profile.condition==='Nicht angegeben')return toast('Wähle das Gerät und seinen Zustand aus.',true);
  if(profile.accessories.length>4)return toast('Gib höchstens vier verschiedene Extras an.',true);
  valuationBusy[side]=true;state.trade[side+'ValueMode']='auto';delete state.trade[side+'Valuation'];
  state.mode='online';render();
  try{
    if(shared)saveUI();else await save();
    const response=await api('/api/online/valuation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});
    const answer=await response.json();if(!response.ok)throw Error(answer.error||'Preisabgleich fehlgeschlagen.');
    if(state.mode!=='online'||key!==valuationKey(side))return toast('Die Eingaben wurden geändert. Bitte das Set erneut bewerten.',true);
    state.trade[side+'Valuation']={key,answer};saveUI();
    toast(answer.estimate?'Online-Werte für das Set übernommen.':answer.message,!answer.estimate);
  }catch(e){toast(e.message,true);}finally{valuationBusy[side]=false;if(state.view==='trade')render();}
}
function tradeRange(r){
  const interval=side=>manualTrade(side)?{low:r[side],high:r[side]}:activeValuation(side)?.estimate;
  const a=interval('give'),b=interval('receive');if(!a||!b||['give','receive'].every(manualTrade))return null;
  return {low:b.low-a.high-r.cash,high:b.high-a.low-r.cash};
}
function tradeSide(side,label){
  const d=device(state.trade[side+'Id']),manual=manualTrade(side);
  const options=[...new Map([...store.devices,...(state.mode==='online'?state.onlineDevices:[])].map(d=>[d.id,d])).values()];
  return `<section class="trade-side"><div class="eyebrow">${icon(side==='give'?'upload':'download')} ${label}</div>${d?productPicture(d,'picture-thumb'):''}<label class="field">Gerät<select data-trade="${side}Id" aria-label="${label}"><option value="">Gerät auswählen …</option>${options.map(d=>`<option value="${esc(d.id)}" ${state.trade[side+'Id']===d.id?'selected':''}>${esc(d.brand)} · ${esc(d.name)}</option>`).join('')}</select></label><div class="form-grid"><label class="field full">Konkrete Variante<input data-trade="${side}Variant" maxlength="160" value="${esc(state.trade[side+'Variant']||'')}" placeholder="z. B. 256 GB oder 16 GB RAM, 512 GB SSD"><small>Speicher, Modellnummer und Ausführung möglichst genau angeben.</small></label><label class="field full">Zustand<select data-trade="${side}Condition">${['Nicht angegeben','Wie neu','Sehr gut','Gut','Stark gebraucht','Defekt'].map(v=>`<option ${state.trade[side+'Condition']===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field full">Lieferumfang / Standardzubehör<input data-trade="${side}Contents" maxlength="300" value="${esc(state.trade[side+'Contents']||'')}" placeholder="z. B. OVP; Rechnung; Ladekabel"><small>Mit Semikolon trennen. Nur Angebote mit diesem Lieferumfang werden eingerechnet.</small></label><label class="field full">Mängel, Akku oder Besonderheiten<input data-trade="${side}Issues" maxlength="300" value="${esc(state.trade[side+'Issues']||'')}" placeholder="z. B. Displaybruch oder Akku 85 %"><small>Keinen pauschalen Abschlag raten: passende Beschreibungen sind erforderlich.</small></label><label class="field full">Zusätzliche Geräte / wertvolles Zubehör<textarea data-trade="${side}Accessories" maxlength="600" rows="2" placeholder="Ein Modell pro Zeile, z. B. 2x Sony DualSense">${esc(state.trade[side+'Accessories']||'')}</textarea><small>Bis zu vier Extras mit exaktem Modellnamen. Werden separat bewertet, nicht doppelt als Lieferumfang eintragen.</small></label></div><div class="actions trade-notes">${btn(valuationBusy[side]?'Angebote werden geprüft …':icon('search')+' Set online bewerten','value-set','primary',`data-side="${side}" ${valuationBusy[side]?'disabled':''}`)}</div><small class="help">Kleinanzeigen · reBuy · idealo. Der Klick aktiviert den Online-Modus und sucht Preise für die angegebenen Modelle.</small><div id="${side}-valuation" aria-live="polite">${valuationHTML(activeValuation(side))}</div><details class="manual-value" ${manual?'open':''}><summary>Eigene Einschätzung / Offline-Werte</summary><div class="actions">${btn('Eigene Werte verwenden','value-mode',manual?'small primary':'small ghost',`data-side="${side}" data-mode="manual"`)}${btn('Online-Werte verwenden','value-mode',!manual?'small primary':'small ghost',`data-side="${side}" data-mode="auto"`)}</div><div class="form-grid"><label class="field full">Gebrauchtwert (€)<input type="number" min="0" max="10000000" step="any" data-trade="${side}Base" value="${esc(state.trade[side+'Base']??estimated(d)??'')}"></label><label class="field">Zubehör zusätzlich (€)<input type="number" min="0" max="10000000" step="any" data-trade="${side}Extra" value="${esc(state.trade[side+'Extra']??0)}"></label><label class="field">Mängel / Aufwand (€)<input type="number" min="0" max="10000000" step="any" data-trade="${side}Deduct" value="${esc(state.trade[side+'Deduct']??0)}"></label></div><p class="help">Diese Beträge gelten nur, wenn du „Eigene Werte verwenden“ auswählst.</p></details><div class="adjusted"><span>${manual?'Eigene Einschätzung':'Online angesetzter Setwert'}</span><b id="${side}-total">—</b></div></section>`;
}

function renderTrade() {
  initTrade();
  return heading('DEIN NÄCHSTER DEAL','Passt der Tausch auch beim Wert?','Gerät und Set beschreiben, online vergleichen und beide Seiten mit aktuellen Angeboten bewerten.',btn('Geräte aus Vergleich übernehmen','use-comparison','ghost'))+
  `<div class="trade-layout"><div><div class="trade-sides">${tradeSide('give','ICH GEBE AB')}${tradeSide('receive','ICH BEKOMME')}</div><section class="panel cash-panel"><div class="panel-head"><h2>Zuzahlung & Notizen</h2>${icon('coin')}</div><div class="panel-body"><div class="cash-controls"><label class="field">Richtung<select data-trade="cashDirection"><option value="pay" ${state.trade.cashDirection!=='receive'?'selected':''}>Ich zahle zusätzlich</option><option value="receive" ${state.trade.cashDirection==='receive'?'selected':''}>Ich bekomme zusätzlich</option></select></label><label class="field">Betrag (€)<input type="number" data-trade="cashAmount" value="${esc(state.trade.cashAmount ?? 0)}" min="0" max="10000000" step="any"></label></div><label class="field trade-notes">Notizen zum Angebot<textarea data-trade="notes" maxlength="10000" placeholder="Zubehör, Rechnung, Akku, Defekte, offene Fragen …">${esc(state.trade.notes || '')}</textarea></label><div class="checklist"><h3>Vor dem Tausch prüfen</h3>${['Funktion vor Ort getestet','Konten und Aktivierungssperren entfernt','Rechnung / Herkunft und Modell geprüft','Zustand, Akku und Zubehör abgeglichen'].map((label,i)=>`<label><input type="checkbox" data-check="${i}" ${state.trade.checks?.[i]?'checked':''}>${label}</label>`).join('')}</div></div></section></div><aside id="trade-result"></aside></div>`;
}
function computeTrade() {
  if(!device(state.trade.giveId) || !device(state.trade.receiveId)) return {error:'Wähle beide Geräte aus.'};
  const values={};
  for(const side of ['give','receive']) {
    const base=tradeBase(side), extra=manualTrade(side)?state.trade[side+'Extra'] ?? 0:0, deduct=manualTrade(side)?state.trade[side+'Deduct'] ?? 0:0;
    if(base==='' || [base,extra,deduct].some(n=>!Number.isFinite(Number(n)) || Number(n)<0 || Number(n)>10000000)) return {error:'Bewerte beide Sets online oder wähle ausdrücklich eine eigene Einschätzung. Nach Änderungen ist eine neue Online-Bewertung nötig.'};
    values[side]=Number(base)+Number(extra)-Number(deduct);
    if(values[side]<0 || values[side]>10000000) return {error:'Der Gesamtwert muss zwischen 0 und 10 Mio. € liegen. Prüfe deine Abschläge.'};
  }
  const amount=Number(state.trade.cashAmount ?? 0);
  if(!Number.isFinite(amount) || amount<0 || amount>10000000) return {error:'Trage eine gültige Zuzahlung ein.'};
  return {result:evaluateTrade(values.give,values.receive,amount*(state.trade.cashDirection==='receive'?-1:1))};
}
function renderTradeResult() {
  const calculation=computeTrade();
  for(const side of ['give','receive']) {
    const base=tradeBase(side);const n=Number(base)+Number(manualTrade(side)?state.trade[side+'Extra'] ?? 0:0)-Number(manualTrade(side)?state.trade[side+'Deduct'] ?? 0:0);
    $('#'+side+'-total').textContent=base==='' || !Number.isFinite(n) || n<0 ? '—' : money(n);
  }
  if(calculation.error) {$('#trade-result').innerHTML=`<div class="result-panel"><span class="pill green">${icon('swap')} DEINE TAUSCHBILANZ</span><h2 class="result-title">Erst die Werte,<br>dann der Deal.</h2><p>${esc(calculation.error)}</p><div class="big-value">— €</div><p>Beschreibe Variante, Zustand und Lieferumfang auf beiden Seiten und klicke jeweils auf „Set online bewerten“.</p><div class="warning-note">Angebotspreise sind keine nachgewiesenen Verkaufspreise. Zustand und Variante müssen vergleichbar sein.</div></div>`;return;}
  const r=calculation.result;
  const range=tradeRange(r);
  const ambiguous=range&&range.low<0&&range.high>0;
  const dealer=['give','receive'].some(side=>!manualTrade(side)&&activeValuation(side)?.kind==='Händlerorientierung');
  const titles={balanced:'Rechnerisch ausgeglichen.',positive:'Rechnerisch zu deinem Vorteil.',negative:'Du gibst mehr Wert ab.'};
  const description=dealer?`Mindestens eine Seite beruht auf Händlerpreisen. Die Differenz von ${money(r.difference)} bestätigt keinen privaten Tauschvorteil.`:r.verdict==='balanced'?`Die Differenz liegt innerhalb der Rechentoleranz von ${money(r.tolerance)}.`:r.verdict==='positive'?`Du bekommst nach den angesetzten Werten ${money(r.difference)} mehr Wert.`:`Du gibst nach den angesetzten Werten ${money(-r.difference)} mehr Wert ab.`;
  const fair=r.fairCash===0?'Keine Zuzahlung zum Wertausgleich.':r.fairCash>0?`Zum Wertausgleich würdest du ${money(r.fairCash)} zahlen.`:`Zum Wertausgleich würdest du ${money(-r.fairCash)} bekommen.`;
  $('#trade-result').innerHTML=`<div class="result-panel ${r.verdict}"><span class="pill green">${icon('swap')} DEINE TAUSCHBILANZ</span><h2 class="result-title">${dealer?'Nur eine grobe Orientierung.':ambiguous?'Der Markt lässt Spielraum.':titles[r.verdict]}</h2><p>${description}</p><div class="big-value">${r.difference>0?'+':''}${money(r.difference)}</div><p>Wertdifferenz aus deiner Sicht</p><div class="result-lines"><div class="result-line"><span>Ich gebe ab</span><b>${money(r.give)}</b></div><div class="result-line"><span>Ich bekomme</span><b>${money(r.receive)}</b></div><div class="result-line"><span>${r.cash<0?'Ich bekomme dazu':'Ich zahle dazu'}</span><b>${money(Math.abs(r.cash))}</b></div></div><p>${fair}</p>${range?`<p class="range-note">Mögliche Wertdifferenz: <b>${money(range.low)} bis ${money(range.high)}</b>. Die Angebotsspannen beider Sets sind berücksichtigt.</p>`:''}${btn(icon('check')+' Tausch speichern','save-trade','primary')}<div class="warning-note">Online-Werte sind Angebotspreise mit Unsicherheit; Händlerorientierung ist kein bestätigter privater Tauschwert. Die Rechnung prüft weder Echtheit noch Funktion.</div></div>`;
}
function renderHistory() {
  return heading('FÜR DEINEN ÜBERBLICK','Deine gespeicherten Tausche.','Bewertungen mit den damals eingegebenen Preisen, Varianten und Notizen.')+(store.trades.length?`<div class="history-list">${[...store.trades].reverse().map(t=>`<article class="history-item"><div><div class="history-date">${date(t.date)} · ${esc(t.status || 'Bewertet')}</div><h3>${esc(t.giveName)} ${icon('swap')} ${esc(t.receiveName)}</h3><small class="muted">Abgabe ${money(t.result.give)} · Empfang ${money(t.result.receive)} · ${t.result.cash<0?'bekommen':'gezahlt'} ${money(Math.abs(t.result.cash))}</small>${t.notes?`<p>${esc(t.notes)}</p>`:''}</div><div><div class="history-value ${t.result.difference>=0?'lime':''}">${t.result.difference>0?'+':''}${money(t.result.difference)}</div><small class="muted">Wertdifferenz aus deiner Sicht</small><div class="actions trade-notes">${btn('Details','trade-details','small ghost',`data-id="${esc(t.id)}"`)}</div></div></article>`).join('')}</div>`:`<div class="panel empty">${icon('history')}<h2>Hier landen deine nächsten Deals.</h2><p>Speichere eine Bewertung im Tauschrechner. Die damaligen Werte bleiben erhalten, auch wenn du den Katalog später änderst.</p>${btn('Tausch durchrechnen '+icon('arrow'),'go-trade','primary')}</div>`);
}
function renderSaved(){
  const entries=store.savedComparisons||[];
  return heading('AUF ALLEN DEINEN GERÄTEN','Deine gemerkten Vergleiche.','Gespeicherte Auswahl mit den Gerätedaten zum Zeitpunkt des Merkens.')+(entries.length?`<div class="history-list">${[...entries].reverse().map(c=>`<article class="history-item"><div><div class="history-date">${date(c.date)}</div><h3>${esc(c.name)}</h3><p>${c.devices.length} Geräte · ${c.devices.reduce((n,d)=>n+d.specs.length,0)} Merkmale</p></div>${btn('Vergleich öffnen '+icon('arrow'),'open-comparison','ghost',`data-id="${esc(c.id)}"`)}</article>`).join('')}</div>`:'<div class="panel empty"><h2>Noch kein Vergleich gemerkt.</h2><p>Wähle Geräte und klicke im Vergleich auf „Vergleich merken“.</p></div>');
}
function renderSettings() {
  return heading('LOKAL. NACHVOLLZIEHBAR. DEINS.','Deine Daten bleiben bei dir.','Kein Konto, keine Cloud und kein API-Schlüssel. Die Kernfunktionen laufen ohne Internet.')+
  `<div class="settings-grid"><section class="panel"><div class="panel-body">${icon('download')}<h3 class="trade-notes">Ein Backup für deinen Katalog.</h3><p>Exportiert Geräte, Quellen, Preisbeispiele und deine gespeicherten Tausche als JSON-Datei.</p>${btn(icon('download')+' Backup exportieren','export','primary')}</div></section><section class="panel"><div class="panel-body">${icon('upload')}<h3 class="trade-notes">Backup oder Gerätekatalog importieren.</h3><p>Ein Backup kannst du wiederherstellen. Geräte aus einer passenden JSON-Datei lassen sich zusätzlich in deinen Katalog übernehmen.</p>${btn(icon('upload')+' JSON-Datei auswählen','import','ghost')}</div></section></div><section class="panel info-block"><div class="panel-body"><h3>So nutzt du Tauschwerk</h3><ol><li>Wähle bis zu vier Geräte im Vergleich aus.</li><li>Öffne „Daten & Preis“ und lege bei Bedarf eine konkrete Variante an.</li><li>Recherchiere passende Angebote oder tatsächlich verkaufte Artikel. Hinterlege Preise, Links und Datum.</li><li>Beschreibe beide Sets im Tauschrechner und klicke jeweils auf „Set online bewerten“. Zusätzliche Geräte mit Modellname separat angeben. Eigene Werte bleiben als Option verfügbar.</li><li>Speichere die Bewertung mit Notizen. Das ist eine Bewertung, keine automatisch bestätigte Transaktion.</li></ol><h3>Wo liegen meine Daten?</h3><p>Im App-Ordner unter <span class="code-path">data/tauschwerk.json</span>. Die letzte gespeicherte Fassung liegt zusätzlich als <span class="code-path">data/tauschwerk.json.bak</span> vor. Sichere den ganzen App-Ordner oder exportiere ein Backup.</p><h3>Wie aktuell sind die Daten?</h3><p>Der Startkatalog hat Datenstand 02.10.2026. Die Online-Suche findet passende Fachquellen anhand der Geräteart: NanoReview für Handys, CPU-Monkey für Prozessoren, GPU-Monkey für Grafikkarten und LaptopMedia für Laptops. Dazu kommen Herstellerseiten, Websuche und Wikipedia. GSMArena und TechPowerUp kannst du gezielt auswählen; RTINGS liefert Tests zum Öffnen im Browser. Unter „Suche verfeinern“ wählst du Quelle, Hersteller und Sprache. Die geladenen Angaben werden vor dem Vergleichen oder Speichern als Vorschau angezeigt. Zusätzlich kannst du öffentliche Hersteller-Datenblätter per HTTPS-Link einlesen. Jede Übernahme zeigt ihre Quelle und das Abrufdatum. Wikipedia kann Modellfamilien zusammenfassen; Webseiten können automatische Abrufe sperren. Kontrolliere Modell und Varianten. Der Tauschrechner liest öffentliche Preise von Kleinanzeigen, reBuy und idealo. Er verwendet mindestens drei passende private Angebote oder zeigt eine separate Händlerorientierung. idealo-Ab- und Neupreise dienen nur als Kontext. Gesuchte Artikel, abweichende Modelle und unpassende Zustände werden ausgeschlossen; ohne ausreichend passende Quellen bleibt der Wert offen.</p><h3>Alle Gerätearten möglich</h3><p>Neue Kategorien und frei benennbare Merkmale erlauben auch Fernseher, PC-Komponenten, Kameras, Haushaltsgeräte oder eigene Kombinationen. Klicke „Neues Gerät“ und gib eine beliebige Kategorie ein. Zum Anlegen reichen Gerätename und Kategorie; technische Merkmale, Quellen und Preise sind optional. Leere Vorlagenfelder werden ausgelassen. Preise akzeptieren z. B. 1500,50 und 1.500,50. Zur Unterscheidung gleicher Modelle kannst du einen Eintrag als neue Variante duplizieren.</p><h3>Desktop-Fenster & Offlinebetrieb</h3><p>Tauschwerk.exe startet die Oberfläche im App-Fenster des installierten Chrome oder Edge. Der lokale Dienst ist ausschließlich über 127.0.0.1 erreichbar. Zwei Minuten nach dem letzten Kontakt endet er automatisch. Oben wechselst du zwischen Offline und Online. Im Offline-Modus startet keine Datenrecherche. Der Online-Modus benötigt eine Internetverbindung; der Moduswechsel allein sendet noch keine Suche. Ein online geladenes Gerät lässt sich erst vergleichen und anschließend bewusst lokal speichern.</p><h3>JSON-Katalogformat</h3><p>Ein vollständiges Backup hat die Form <span class="code-path">{ version: 1, devices: [...], trades: [...] }</span>. Für einen zusätzlichen Katalog reicht eine Liste von Geräten im gleichen Format wie <span class="code-path">catalog.json</span> im App-Ordner.</p></div></section>`;
}

const modal=$('#modal');
function modalHead(title) {return `<div class="modal-head"><h2>${title}</h2>${btn(icon('close'),'close-modal','icon-only','aria-label="Dialog schließen"')}</div>`;}
function showModal(content) {modal.innerHTML=content;if(!modal.open) modal.showModal();}
function pickerRows() {
  const found=store.devices.filter(d=>matches(d,state.pickerQuery,state.pickerCategory));
  return found.length?found.map(d=>`<div class="picker-row">${productPicture(d,'picture-thumb')}<div class="info"><b>${esc(d.name)}</b><small>${esc(d.brand)} · ${esc(d.category)}</small></div>${btn(state.selected.includes(d.id)?icon('check')+' Gewählt':icon('plus')+' Wählen','picker-toggle',state.selected.includes(d.id)?'small primary':'small ghost',`data-id="${esc(d.id)}" ${state.selected.length>=4&&!state.selected.includes(d.id)?'disabled':''}`)}</div>`).join(''):`<div class="empty"><p>Kein passendes Gerät. Lege ein eigenes Modell an.</p>${btn('Eigenes Gerät','new','primary')}</div>`;
}
function openPicker() {
  if(state.mode==='online'){
    onlineController?.abort();onlineGeneration++;state.onlineBusy=false;
    state.view='online';state.onlineQuery='';state.onlineURL='';state.onlinePreview=null;state.onlineResults=[];state.onlineWarnings=[];state.onlineError='';state.onlineSearched=false;
    if(modal.open)modal.close();render();saveUI();$('#online-query').focus();return;
  }
  state.pickerQuery='';state.pickerCategory='Alle';showModal(modalHead('Geräte für deinen Vergleich')+`<div class="modal-content"><div class="picker-filters"><div class="search-box">${icon('search')}<input id="picker-search" placeholder="Modell oder Marke suchen …" aria-label="Gerät suchen"></div><select id="picker-category" aria-label="Kategorie">${categoryOptions('Alle',true)}</select></div><div class="picker-list" id="picker-results">${pickerRows()}</div></div><div class="modal-footer"><span class="picker-footer-text" id="picker-count">${state.selected.length} / 4 Geräte ausgewählt</span>${btn('Vergleich ansehen '+icon('arrow'),'finish-picker','primary')}</div>`);
}
function specEditorRow(s={key:'',value:''}) {return `<div class="spec-editor-row"><input class="spec-key" placeholder="Merkmal" maxlength="100" value="${esc(s.key)}" aria-label="Merkmal"><input class="spec-value" placeholder="Wert, z. B. 256 GB" maxlength="2000" value="${esc(s.value)}" aria-label="Merkmalswert">${btn(icon('close'),'remove-row','icon-only','aria-label="Merkmal entfernen"')}</div>`;}
function offerEditorRow(o={price:'',url:'',note:'',date:today()}) {return `<div class="offer-editor-row"><input class="offer-price" type="number" min="0.01" max="10000000" step="any" value="${esc(o.price)}" placeholder="Preis (€)" aria-label="Angebotspreis"><input class="offer-url" type="url" maxlength="2000" value="${esc(o.url)}" placeholder="Angebotslink (optional)" aria-label="Angebotslink">${btn(icon('close'),'remove-row','icon-only','aria-label="Preisbeispiel entfernen"')}<input class="offer-note" maxlength="2000" value="${esc(o.note)}" placeholder="Variante, Zustand, Angebot oder Verkaufspreis …" aria-label="Notiz zum Preis"><label class="field offer-date">Preisdatum<input type="date" class="offer-date-value" value="${esc(o.date)}"></label></div>`;}
function editorPicture() {
  const d=state.editorDraft;
  return `<div class="editor-product">${productPicture(d,'picture-editor')}<div><b>Produktbild</b><p class="help">${d.image?'Wird mit dem Gerät gespeichert – auch im Offline-Katalog und JSON-Backup.':'Lade das passende Modellbild aus deiner Produktquelle oder der Online-Suche.'}</p><div class="actions">${btn(d.image?'Bild aktualisieren':'Produktbild suchen','editor-image','small ghost',state.mode!=='online'?'disabled':'')}${d.image?btn('Bild entfernen','remove-image','small ghost'):''}</div>${state.mode!=='online'?'<small class="muted">Zum Suchen oben den Online-Modus einschalten.</small>':''}${imageCredit(d)}</div></div>`;
}
async function loadEditorPicture(button) {
  const draft=readEditor();button.disabled=true;button.textContent='Passendes Bild suchen …';
  try {const response=await api('/api/online/image?name='+encodeURIComponent(draft.name)+'&source='+encodeURIComponent(draft.source));const answer=await response.json();if(!response.ok)throw Error(answer.error);if(!$('#device-form')||state.editing!==draft.id)return;if($('#device-form').elements.name.value.trim()!==draft.name)throw Error('Der Modellname wurde geändert. Bitte erneut nach dem passenden Bild suchen.');if(!answer.image)return toast(answer.message,true);draft.image=answer.image;validateStore({version:1,devices:[draft],trades:[]});state.editorDraft.image=answer.image;$('#editor-picture').innerHTML=editorPicture();toast('Produktbild geladen. Mit Speichern übernehmen.');}
  catch(error){toast(error.message,true);}finally{if(button.isConnected){button.disabled=false;button.textContent='Produktbild suchen';}}
}
async function loadCatalogPictures() {
  if(state.mode!=='online'||state.imagesBusy)return;
  const missing=store.devices.filter(d=>!d.image).map(d=>({id:d.id,name:d.name,source:d.source}));
  if(!missing.length)return toast('Alle Geräte haben bereits ein Produktbild.');
  state.imagesBusy=true;let loaded=0,checked=0;state.imageProgress='Produktbilder werden gesucht …';render();
  try{for(const d of missing){
    if(state.mode!=='online')break;
    const response=await api('/api/online/image?name='+encodeURIComponent(d.name)+'&source='+encodeURIComponent(d.source||''));const answer=await response.json();
    if(state.mode!=='online')break;
    if(response.ok&&answer.image){let applied=false;await save(next=>{const current=next.devices.find(x=>x.id===d.id);if(current&&current.name===d.name&&!current.image){current.image=answer.image;applied=true;}});if(applied)loaded++;}
    checked++;state.imageProgress=`${checked} von ${missing.length} Geräten geprüft · ${loaded} Produktbilder gespeichert.`;render();
  }}catch(error){toast(error.message,true);}finally{state.imagesBusy=false;state.imageProgress=`${loaded} Produktbilder gespeichert. Für Geräte ohne passenden Treffer bleibt das Kategorie-Symbol.`;render();}
}
function newDevice() {return {id:uuid(),name:'',brand:'',category:state.category==='Alle'?'Handys':state.category,source:'',notes:'',value:null,checked:'',specs:[],offers:[]};}
function editDevice(id,draft) {
  const d=draft?structuredClone(draft):id?structuredClone(device(id)):newDevice();if(!d)return;
  state.editorDraft=structuredClone(d);
  state.editorOriginalSnapshot=id&&store.devices.some(x=>x.id===id)?structuredClone(d):null;
  state.editing=d.id;state.editOriginal=id || null;
  showModal(`<form id="device-form">${modalHead(id?'Gerät & Preise bearbeiten':'Neues Gerät anlegen')}<div class="modal-content"><div class="form-grid"><label class="field full">Modell / konkrete Variante<input name="name" value="${esc(d.name)}" maxlength="300" placeholder="z. B. iPhone 17 Pro · 256 GB" required></label><label class="field">Hersteller<input name="brand" value="${esc(d.brand)}" maxlength="300" placeholder="z. B. Apple"></label><label class="field">Kategorie<input name="category" list="category-list" value="${esc(d.category)}" maxlength="80" required><datalist id="category-list">${categoryOptions(d.category)}</datalist></label><label class="field full">Quelle für technische Daten<input type="url" name="source" value="${esc(d.source)}" maxlength="2000" placeholder="https://hersteller.de/technische-daten"></label><label class="field">Daten zuletzt geprüft<input type="date" name="checked" value="${esc(d.checked)}"></label><label class="field">Deine Preiseinschätzung (€)<input type="number" name="value" min="0" max="10000000" step="any" value="${d.value ?? ''}" placeholder="Optional: selbst einschätzen"></label></div><div class="section-label"><b>Technische Merkmale</b><div class="actions">${btn('Vorlage ergänzen','template','small ghost')}${btn(icon('plus')+' Merkmal','add-spec','small ghost')}</div></div><p class="help">Gleiche Merkmalsnamen werden im Vergleich in derselben Zeile angezeigt. Eigene Merkmale sind frei möglich.</p><div id="spec-editor">${(d.specs.length?d.specs:[{key:'',value:''}]).map(specEditorRow).join('')}</div><div class="section-label"><b>Deine Preisbeispiele</b>${btn(icon('plus')+' Preis','add-offer','small ghost')}</div><p class="help">Vergleiche gleiche Variante und ähnlichen Zustand. Angebotspreise und nachgewiesene Verkaufspreise unterscheiden. Ohne eigene Preiseinschätzung verwendet die App den Median deiner Preisbeispiele.</p><div id="offer-editor">${d.offers.map(offerEditorRow).join('')}</div><div class="actions">${researchLinks(d)}${btn('Median als Einschätzung übernehmen','apply-median','small ghost')}</div><label class="field trade-notes">Notizen / bekannte Besonderheiten<textarea name="notes" maxlength="10000">${esc(d.notes)}</textarea></label></div><div class="modal-footer"><div class="actions">${id?btn('Als neue Variante','duplicate','ghost'):btn('Abbrechen','close-modal','ghost')}</div><button class="btn primary" type="submit">${icon('check')} Speichern</button></div></form>`);
  if(id) modal.querySelector('.modal-footer>.actions').insertAdjacentHTML('beforeend',btn('Entfernen','confirm-remove-device','ghost danger',`data-id="${esc(id)}"`));
  modal.querySelectorAll('button:not([type])').forEach(b=>b.type='button');
  const form=$('#device-form');form.noValidate=true;
  form.elements.value.type='text';form.elements.value.inputMode='decimal';
  form.elements.value.placeholder='z. B. 1.500,50';
  const help=$('#spec-editor').previousElementSibling;help.textContent+=' Nur ausgefüllte Merkmale werden gespeichert; leere Vorlagenfelder sind optional.';
  for(const price of modal.querySelectorAll('.offer-price')){price.type='text';price.inputMode='decimal';}
  form.querySelector('.modal-content').insertAdjacentHTML('afterbegin','<div class="dialog-notice" role="alert" hidden></div><div id="editor-picture">'+editorPicture()+'</div>');
}
function normalizeSource(value) {value=String(value || '').trim();return value && !/^[a-z][a-z\d+.-]*:/i.test(value)?'https://'+value:value;}
function readEditor() {
  const form=$('#device-form'),data=new FormData(form);
  const rows=[...form.querySelectorAll('.spec-editor-row')].map(row=>({key:row.querySelector('.spec-key').value.trim(),value:row.querySelector('.spec-value').value.trim()}));
  if(rows.some(s=>!s.key && s.value)) throw new Error('Ein Merkmalswert braucht einen Namen. Ergänze den Namen links neben dem Wert.');
  const specs=rows.filter(s=>s.key && s.value);
  if(new Set(specs.map(s=>s.key.toLocaleLowerCase('de-DE'))).size!==specs.length) throw new Error('Merkmalsnamen müssen pro Gerät eindeutig sein.');
  const offers=[...form.querySelectorAll('.offer-editor-row')].filter(row=>row.querySelector('.offer-price').value || row.querySelector('.offer-url').value || row.querySelector('.offer-note').value).map(row=>({price:parsePrice(row.querySelector('.offer-price').value),url:normalizeSource(row.querySelector('.offer-url').value),note:row.querySelector('.offer-note').value.trim(),date:row.querySelector('.offer-date-value').value}));
  if(offers.some(o=>!Number.isFinite(o.price)||o.price<=0))throw new Error('Gib für jedes Preisbeispiel einen Preis größer als 0 ein oder entferne es.');
  const price=parsePrice(data.get('value'));if(price!==null&&(!Number.isFinite(price)||price>10000000))throw new Error('Ungültiger Preis. Möglich sind z. B. 1500,50 oder 1.500,50.');
  const previous=state.editorDraft || device(state.editing);
  const d={id:state.editing,name:String(data.get('name')).trim(),brand:String(data.get('brand')).trim(),category:String(data.get('category')).trim(),source:normalizeSource(data.get('source')),notes:String(data.get('notes')),checked:String(data.get('checked')),value:price,specs,offers};
  if(previous?.image&&(previous.name===d.name||previous.image.alt===d.name))d.image=structuredClone(previous.image);
  if(previous?.sourceType)d.sourceType=previous.sourceType;if(previous?.provenance)d.provenance={...previous.provenance,needsReview:false};
  if(!d.name)throw new Error('Gib einen Gerätenamen ein.');if(!d.category)throw new Error('Wähle eine Kategorie oder gib eine eigene ein.');
  validateStore({version:1,devices:[d],trades:[]});return d;
}
function download(content,name,type) {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function csvCell(s) {let text=String(s ?? '');if(/^[=+@\-\t\r]/.test(text)) text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
function exportCSV() {const ds=selectedDevices();const rows=[['Merkmal',...ds.map(d=>d.brand+' '+d.name)],...specRows(ds).map(r=>[r.key,...r.values]),['Eigene Preiseinschätzung (€)',...ds.map(d=>d.value ?? '')],['Median Angebotspreise (€)',...ds.map(d=>median(d.offers.map(o=>o.price)) ?? '')],['Quelle',...ds.map(d=>d.source)],['Datenstand',...ds.map(d=>d.checked)]];download('\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n'),'tauschwerk-vergleich-'+today()+'.csv','text/csv;charset=utf-8');}
async function saveTrade() {
  const c=computeTrade();if(c.error)return toast(c.error,true);
  const a=device(state.trade.giveId),b=device(state.trade.receiveId);
  const details=structuredClone(state.trade);for(const side of ['give','receive']){details[side+'ValueMode']=manualTrade(side)?'manual':'auto';if(manualTrade(side))delete details[side+'Valuation'];}
  const t={id:uuid(),date:new Date().toISOString(),giveName:a.brand+' '+a.name+(state.trade.giveVariant?' · '+state.trade.giveVariant:''),receiveName:b.brand+' '+b.name+(state.trade.receiveVariant?' · '+state.trade.receiveVariant:''),result:c.result,range:tradeRange(c.result),notes:state.trade.notes || '',status:'Bewertet',details};
  await save(s=>s.trades.push(t),'Tauschbewertung lokal gespeichert.',true);
}
function tradeDetails(id) {
  const t=store.trades.find(t=>t.id===id);if(!t)return;
  const labels=['Funktion vor Ort getestet','Konten und Sperren entfernt','Herkunft und Modell geprüft','Zustand und Zubehör abgeglichen'];
  showModal(modalHead('Gespeicherte Tauschbewertung')+`<div class="modal-content"><p class="muted">${date(t.date)} · ${esc(t.status || 'Bewertet')}</p><h3 class="trade-notes">${esc(t.giveName)} ${icon('swap')} ${esc(t.receiveName)}</h3><div class="result-lines"><div class="result-line"><span>Abgabe</span><b>${money(t.result.give)}</b></div><div class="result-line"><span>Empfang</span><b>${money(t.result.receive)}</b></div><div class="result-line"><span>Zuzahlung (${t.result.cash<0?'bekommen':'gezahlt'})</span><b>${money(Math.abs(t.result.cash))}</b></div><div class="result-line"><span>Wertdifferenz</span><b>${money(t.result.difference)}</b></div></div><p>${esc(t.notes || 'Keine Notizen.').replaceAll('\n','<br>')}</p>${['give','receive'].map(side=>`<h3>${side==='give'?'Abgegebenes':'Erhaltenes'} Set</h3><p>${esc(t.details?.[side+'Contents']||'Kein Lieferumfang angegeben')} · ${esc(t.details?.[side+'Accessories']||'Keine Extras')} · ${esc(t.details?.[side+'Issues']||'Keine Mängel angegeben')}</p>${valuationHTML(t.details?.[side+'Valuation']?.answer)}`).join('')}<div class="checklist"><h3>Damals dokumentiert</h3>${labels.map((label,i)=>`<p class="help">${t.details?.checks?.[i]?'✓':'○'} ${label}</p>`).join('')}<p class="help">Abgabe: ${esc(t.details?.giveCondition || 'Nicht angegeben')} · Empfang: ${esc(t.details?.receiveCondition || 'Nicht angegeben')}</p></div></div><div class="modal-footer"><span></span>${btn('Schließen','close-modal','primary')}</div>`);
}
let pendingImport;
function importPreview(parsed) {
  const full=!Array.isArray(parsed);
  const candidate=validateStore(full?parsed:{version:1,devices:parsed,trades:[]});
  pendingImport={candidate,full};
  showModal(modalHead('Import prüfen')+`<div class="modal-content"><h3>${candidate.devices.length} Geräte${full?' · '+candidate.trades.length+' gespeicherte Tausche':''}</h3><p class="help">${full?'„Backup wiederherstellen“ ersetzt deinen aktuellen Katalog und deine Tausche. Die bisherige Fassung wird vorher als .bak gesichert.':'Die Geräte werden als zusätzliche Einträge übernommen. Bei gleichen IDs erhält die importierte Variante eine neue ID.'}</p><p class="help">${esc(candidate.devices.slice(0,8).map(d=>d.name).join(' · '))}${candidate.devices.length>8?' …':''}</p></div><div class="modal-footer">${btn('Abbrechen','close-modal','ghost')}<div class="actions">${btn('Geräte hinzufügen','import-merge','ghost')}${full?btn('Backup wiederherstellen','import-replace','primary'):''}</div></div>`);
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target || target.disabled)return;
  const action=target.dataset.action,id=target.dataset.id;
  if(target.closest('form') && target.type!=='submit') event.preventDefault();
  try {
    if(action==='view') {state.view=target.dataset.view;render();saveUI();}
    else if(action==='mode') await setMode(target.dataset.mode);
    else if(action==='online-example'){state.onlineQuery=target.dataset.query;state.onlineKind=target.dataset.kind;state.onlineSource='all';state.onlineManufacturer='all';render();$('#online-query').focus();}
    else if(action==='online-result-source'){state.onlineResultSource=target.dataset.source;render();}
    else if(action==='remember-comparison'){
      const devices=structuredClone(selectedDevices());if(!devices.length)return;
      const comparison={id:uuid(),name:devices.map(d=>d.name).join(' vs. '),date:new Date().toISOString(),devices};
      await save(s=>{s.savedComparisons||=[];s.savedComparisons.push(comparison);},'Vergleich gespeichert. Auf allen deinen Geräten unter „Gemerkte Vergleiche“ verfügbar.');
    }
    else if(action==='open-comparison'){
      const c=store.savedComparisons?.find(c=>c.id===id);if(!c)return;
      state.mode='online';state.onlineDevices=structuredClone(c.devices).map((d,i)=>({...d,id:'remembered-'+c.id+'-'+i}));state.selected=state.onlineDevices.map(d=>d.id);state.view='compare';render();saveUI();
    }
    else if(action==='editor-image') await loadEditorPicture(target);
    else if(action==='remove-image') {delete state.editorDraft.image;$('#editor-picture').innerHTML=editorPicture();}
    else if(action==='catalog-images') await loadCatalogPictures();
    else if(action==='online-fetch') {const r=state.onlineResults[Number(target.dataset.index)];if(r)await runOnline('device','/api/online/device?url='+encodeURIComponent(r.url));}
    else if(action==='online-compare') {
      const d=state.onlinePreview;if(!d)return;
      if(!state.selected.includes(d.id)&&state.selected.length>=4)return toast('Es sind schon vier Geräte gewählt. Entferne im Vergleich zuerst eines.',true);
      state.onlineDevices=state.onlineDevices.filter(x=>x.id!==d.id);state.onlineDevices.push(structuredClone(d));
      if(!state.selected.includes(d.id))state.selected.push(d.id);state.view='compare';render();saveUI();
    }
    else if(action==='online-save') {
      if(!state.onlinePreview)return;const d=structuredClone(state.onlinePreview);
      if(store.devices.some(x=>x.id===d.id)){d.id=uuid();d.name+=' · neue Variante';}
      editDevice(null,d);
    }
    else if(action==='picker') openPicker();
    else if(action==='finish-picker') {modal.close();state.view='compare';render();saveUI();}
    else if(action==='close-modal') modal.close();
    else if(action==='new') editDevice();
    else if(action==='edit') {
      if(!store.devices.some(d=>d.id===id)&&device(id))editDevice(null,device(id));else editDevice(id);
    }
    else if(['toggle-select','picker-toggle','remove-select'].includes(action)) {
      if(state.selected.includes(id)) state.selected=state.selected.filter(x=>x!==id);
      else if(state.selected.length<4) state.selected.push(id);else return toast('Maximal vier Geräte. Entferne zuerst eines.',true);
      if(action==='picker-toggle') {$('#picker-results').innerHTML=pickerRows();$('#picker-count').textContent=state.selected.length+' / 4 Geräte ausgewählt';}
      render();saveUI();
    }
    else if(action==='go-trade') {initTrade(true);state.view='trade';render();saveUI();}
    else if(action==='use-comparison') {initTrade(true);render();saveUI();}
    else if(action==='add-spec') $('#spec-editor').insertAdjacentHTML('beforeend',specEditorRow());
    else if(action==='add-offer') {$('#offer-editor').insertAdjacentHTML('beforeend',offerEditorRow());const price=$('#offer-editor .offer-editor-row:last-child .offer-price');price.type='text';price.inputMode='decimal';}
    else if(action==='remove-row') target.closest('.spec-editor-row,.offer-editor-row').remove();
    else if(action==='confirm-remove-device') {
      const d=device(id);if(!d)return;
      showModal(modalHead('Gerät entfernen?')+`<div class="modal-content"><h3>${esc(d.brand)} ${esc(d.name)}</h3><p class="help">Dieser Eintrag und seine Preisbeispiele werden aus dem aktuellen Katalog entfernt. Gespeicherte Tauschbewertungen behalten ihre damaligen Werte. Noch nicht gespeicherte Änderungen im Editor werden verworfen.</p></div><div class="modal-footer">${btn('Zurück','edit','ghost',`data-id="${esc(id)}"`)}${btn('Gerät entfernen','remove-device','danger',`data-id="${esc(id)}"`)}</div>`);
    }
    else if(action==='remove-device') {
      target.disabled=true;await save(s=>{s.devices=s.devices.filter(d=>d.id!==id);},'Gerät aus dem Katalog entfernt.',true);modal.close();
    }
    else if(action==='template') {
      const cat=$('#device-form [name=category]').value;const existing=new Set([...modal.querySelectorAll('.spec-key')].map(i=>i.value.trim().toLocaleLowerCase('de-DE')));
      const keys=(templates[cat] || ['Typ','Abmessungen','Gewicht','Besonderheiten']).filter(k=>!existing.has(k.toLocaleLowerCase('de-DE')));
      const empty=[...modal.querySelectorAll('.spec-editor-row')].find(row=>!row.querySelector('.spec-key').value&&!row.querySelector('.spec-value').value);if(empty)empty.remove();
      $('#spec-editor').insertAdjacentHTML('beforeend',keys.map(key=>specEditorRow({key,value:''})).join(''));
    }
    else if(action==='apply-median') {
      const prices=[...modal.querySelectorAll('.offer-price')].map(i=>parsePrice(i.value));const m=median(prices);
      if(m===null)return toast('Trage zuerst gültige Preisbeispiele ein.',true);$('#device-form [name=value]').value=Math.round(m*100)/100;toast('Median übernommen. Speichern übernimmt die Änderung.');
    }
    else if(action==='duplicate') {
      const d=readEditor();d.id=uuid();d.name+=' · neue Variante';state.editing=d.id;state.editOriginal=null;state.editorDraft=d;$('#device-form [name=name]').value=d.name;toast('Wird beim Speichern als neue Variante angelegt.');
    }
    else if(action==='csv') exportCSV();
    else if(action==='value-set') await onlineValue(target.dataset.side);
    else if(action==='value-mode') {state.trade[target.dataset.side+'ValueMode']=target.dataset.mode;render();saveUI();}
    else if(action==='save-trade') {target.disabled=true;try{await saveTrade();}finally{target.disabled=false;}}
    else if(action==='trade-details') tradeDetails(id);
    else if(action==='export') {await saveQueue.catch(()=>{});download(JSON.stringify(store,null,2),'tauschwerk-backup-'+today()+'.json','application/json');}
    else if(action==='import') {$('#import-file').value='';$('#import-file').click();}
    else if(action==='import-merge') {
      if(!pendingImport)return;target.disabled=true;
      await save(s=>{const incoming=structuredClone(pendingImport.candidate.devices);for(const d of incoming){if(s.devices.some(x=>x.id===d.id))d.id=uuid();s.devices.push(d);}},'Geräte importiert.',true);pendingImport=null;modal.close();
    }
    else if(action==='import-replace') {
      if(!pendingImport?.full)return;target.disabled=true;const imported=structuredClone(pendingImport.candidate);
      await save(s=>{s.devices=imported.devices;s.trades=imported.trades;s.savedComparisons=imported.savedComparisons||[];},'Backup wiederhergestellt.',true);pendingImport=null;modal.close();
    }
  } catch(e) {toast(e.message,true);target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  if(event.target.id==='online-search-form'){
    event.preventDefault();state.onlineQuery=$('#online-query').value.trim();state.onlineLanguage=$('#online-language').value;
    await runOnline('search',`/api/online/search?q=${encodeURIComponent(state.onlineQuery)}&language=${state.onlineLanguage}&source=${state.onlineSource}&manufacturer=${state.onlineManufacturer}&kind=${state.onlineKind}`);
  }else if(event.target.id==='online-url-form'){
    event.preventDefault();state.onlineURL=normalizeSource($('#online-url').value);
    await runOnline('device','/api/online/device?url='+encodeURIComponent(state.onlineURL));
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='online-query')state.onlineQuery=el.value;
  if(el.id==='online-url')state.onlineURL=el.value;
  if(el.closest('#device-form') && ['name','brand'].includes(el.name)) {
    const form=$('#device-form'),q=encodeURIComponent(`${form.elements.brand.value} ${form.elements.name.value}`);
    for(const link of form.querySelectorAll('[data-research]')) link.href=link.dataset.research==='ebay'?`https://www.ebay.de/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`:`https://www.kleinanzeigen.de/s-suchanfrage.html?keywords=${q}`;
  }
  if(el.id==='catalog-search') {state.query=el.value;$('#catalog-results').innerHTML=catalogCards();}
  if(el.id==='picker-search') {state.pickerQuery=el.value;$('#picker-results').innerHTML=pickerRows();}
  if(el.dataset.trade && !el.matches('select')) {state.trade[el.dataset.trade]=el.value;invalidateValuation(el.dataset.trade);renderTradeResult();saveUI();}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='online-language')state.onlineLanguage=el.value;
  if(el.id==='online-manufacturer')state.onlineManufacturer=el.value;
  if(el.id==='online-kind'){state.onlineKind=el.value;render();}
  if(el.id==='online-source'){state.onlineSource=el.value;if(el.value==='wikipedia')state.onlineManufacturer='all';render();}
  if(el.id==='only-diff') {state.onlyDiff=el.checked;render();saveUI();}
  if(el.id==='catalog-category') {state.category=el.value;$('#catalog-results').innerHTML=catalogCards();}
  if(el.id==='picker-category') {state.pickerCategory=el.value;$('#picker-results').innerHTML=pickerRows();}
  if(el.dataset.trade && el.matches('select')) {
    const key=el.dataset.trade;state.trade[key]=el.value;
    if(key.endsWith('Id')) {const side=key.replace('Id','');for(const suffix of ['Base','Extra','Deduct','Condition','Variant','Contents','Issues','Accessories','Valuation','ValueMode']) delete state.trade[side+suffix];render();}else {invalidateValuation(key);renderTradeResult();}saveUI();
  }
  if(el.dataset.check) {state.trade.checks ||= {};state.trade.checks[el.dataset.check]=el.checked;saveUI();}
});
document.addEventListener('toggle',event=>{if(event.target.id==='online-filters')state.onlineFiltersOpen=event.target.open;},true);
modal.addEventListener('submit',async event=>{
  event.preventDefault();if(event.target.id!=='device-form')return;
  const submit=event.target.querySelector('[type=submit]');
  try {const d=readEditor(),original=state.editOriginal?state.editorOriginalSnapshot:null,isNew=!store.devices.some(x=>x.id===d.id);submit.disabled=true;await save(s=>{const i=s.devices.findIndex(x=>x.id===d.id);if(shared&&original&&i<0)throw new Error('Dieses Gerät wurde inzwischen entfernt. Bitte als neues Gerät anlegen.');if(i<0)s.devices.push(d);else s.devices[i]=shared?mergeDeviceDraft(original,d,s.devices[i]):d;},shared?'Gerät auf dem Server gespeichert.':'Gerät lokal gespeichert.');modal.close();if(isNew){state.view='catalog';state.category='Alle';state.query=d.name;}render();saveUI();}catch(e){toast(e.message,true);submit.disabled=false;}
});
$('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>12*1024*1024)throw new Error('Datei ist zu groß (maximal 12 MB).');importPreview(JSON.parse(await file.text()));}catch(e){toast(e.message,true);}});
window.addEventListener('beforeunload',()=> {clearTimeout(uiTimer);});
async function start() {
  try {
    const meta=await api('/api/meta');if(meta.ok)shared=Boolean((await meta.json()).shared);
    const response=await api('/api/store');if(!response.ok)throw new Error('Verbindung fehlt. Bitte Tauschwerk erneut öffnen.');store=validateStore(await response.json());storeRevision=response.headers.get('etag');
    let ui=store.ui;if(shared)try{ui=JSON.parse(localStorage.getItem('tauschwerk-ui')||'null');if(Array.isArray(ui?.onlineDevices)){validateStore({version:1,devices:ui.onlineDevices,trades:[]});state.onlineDevices=ui.onlineDevices;}}catch{ui=null;}
    if(Array.isArray(ui?.selected)) state.selected=ui.selected.filter(x=>typeof x==='string');else state.selected=store.devices.slice(0,3).map(d=>d.id);
    state.onlyDiff=Boolean(ui?.onlyDiff);state.mode=ui?.mode==='online'?'online':'offline';state.view=views[ui?.view]?ui.view:'compare';if(state.mode==='offline'&&state.view==='online')state.view='catalog';
    state.trade=ui?.trade && typeof ui.trade==='object' && !Array.isArray(ui.trade)?ui.trade:{};
    render();setInterval(async()=>{try{await api('/api/ping',{method:'POST'});if(shared&&!modal.open){await saveQueue.catch(()=>{});const next=await api('/api/store');if(next.ok&&next.headers.get('etag')!==storeRevision){store=validateStore(await next.json());storeRevision=next.headers.get('etag');render();}}}catch{toast('Server nicht erreichbar. Deine Eingaben bleiben geöffnet.',true);}},15000);
  } catch(e) {$('#main').innerHTML=`<div class="fatal"><h1>Tauschwerk konnte nicht starten.</h1><p>${esc(e.message)}</p></div>`;}
}
start();

// Broken or unsupported images retain the readable category symbol. No remote browser requests.
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&event.target.closest('.product-picture'))event.target.closest('.product-picture').classList.remove('has-image');},true);
