import {extractDevice,textOnly,imageModelMatches} from './online-parser.mjs';
import {loadProductImage} from './device-images.mjs';
import {fetchPublicText,validateRemoteURL} from './remote.mjs';
import {searchWeb,searchLaptops,rankResults} from './online-search.mjs';
import {sourceOptions,manufacturers,classifySource,deviceKinds,detectDeviceKind,specialistSources} from './online-sources.mjs';
import {searchCatalog,searchManufacturerCatalog} from './online-catalogs.mjs';
export {fetchPublicText,validateRemoteURL,isPublicAddress} from './remote.mjs';
async function wikiJSON(lang,params) {
  const url=new URL(`https://${lang}.wikipedia.org/w/api.php`);
  for(const [key,value] of Object.entries({...params,format:'json',formatversion:'2',utf8:'1'}))url.searchParams.set(key,value);
  const response=await fetchPublicText(url.href);const data=JSON.parse(response.text);
  if(data.error)throw new Error('Wikipedia: '+(data.error.info || data.error.code));return data;
}
export async function searchOnline(query,language='all',{source='all',manufacturer='all',kind='all'}={},fetchText=fetchPublicText) {
  query=String(query || '').trim();if(query.length<2||query.length>160)throw new Error('Gib einen Gerätenamen zwischen 2 und 160 Zeichen ein.');
  if(!['all','de','en'].includes(language))throw new Error('Ungültige Sprache.');
  if(!sourceOptions.some(([id])=>id===source))throw new Error('Ungültige Suchquelle.');
  if(manufacturer!=='all'&&!manufacturers.some(m=>m.id===manufacturer))throw new Error('Ungültiger Hersteller.');
  if(!deviceKinds.some(([id])=>id===kind))throw new Error('Ungültige Geräteart.');
  const resolvedKind=kind==='all'?detectDeviceKind(query):kind;
  const languages=language==='all'?['de','en']:[language];
  const tasks=[];
  if(['all','wikipedia'].includes(source))for(const lang of languages)tasks.push({label:'Wikipedia '+lang,run:async()=>{
    const endpoint=new URL(`https://${lang}.wikipedia.org/w/api.php`);
    for(const [k,v] of Object.entries({action:'query',list:'search',srsearch:query,srlimit:'8',srnamespace:'0',srprop:'snippet|timestamp',format:'json',formatversion:'2',utf8:'1'}))endpoint.searchParams.set(k,v);
    const data=JSON.parse((await fetchText(endpoint.href)).text);if(data.error)throw new Error(data.error.info || data.error.code);
    return {results:(data.query?.search || []).map(row=>({id:`wiki:${lang}:${row.pageid}`,title:row.title,description:textOnly(row.snippet).slice(0,700),provider:'wikipedia',sourceName:'Wikipedia',language:lang,url:`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(row.title.replaceAll(' ','_'))}`})),warnings:[]};
  }});
  if(['all','web','manufacturer'].includes(source))tasks.push({label:'Websuche',run:()=>searchWeb(query,language,{source,manufacturer},fetchText)});
  if(source==='laptopmedia'||source==='all'&&resolvedKind==='laptops')tasks.push({label:'LaptopMedia',run:()=>searchLaptops(query,fetchText)});
  for(const specialist of specialistSources.filter(s=>s.id!=='laptopmedia')){
    // Automatic search uses direct catalogs; rate-limited sources remain selectable.
    if(source===specialist.id||source==='all'&&['nanoreview','cpu-monkey','gpu-monkey','rtings'].includes(specialist.id)&&specialist.kinds.includes(resolvedKind))tasks.push({label:specialist.name,run:()=>searchCatalog(specialist.id,query,language,fetchText)});
  }
  if(['all','manufacturer'].includes(source))tasks.push({label:'Herstellerkatalog',run:()=>searchManufacturerCatalog(query,language,manufacturer,fetchText)});
  const responses=await Promise.allSettled(tasks.map(t=>t.run()));
  const fulfilled=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const rows=fulfilled.flatMap(r=>r.results);
  // Wikipedia-only retains its established broad model-family search.
  const results=source==='wikipedia'?rows:rankResults(rows,query.replace(/\bps([345])\b/ig,'PlayStation $1'),{source,manufacturer});
  const warnings=[...new Set([...fulfilled.flatMap(r=>r.warnings || []),...responses.flatMap((r,i)=>r.status==='rejected'?[tasks[i].label+': '+r.reason.message]:[])])];
  return {results,warnings,query,source,manufacturer,kind:resolvedKind,searchedSources:tasks.map(t=>t.label)};
}
async function deviceDocument(input) {
  const url=validateRemoteURL(input);const wiki=url.hostname.match(/^(de|en)\.wikipedia\.org$/i);
  if(wiki){
    let title;if(url.pathname.startsWith('/wiki/'))title=decodeURIComponent(url.pathname.slice(6)).replaceAll('_',' ');else title=url.searchParams.get('title');
    if(!title||title.length>300||title.includes(':'))throw new Error('Bitte eine konkrete Wikipedia-Geräteseite auswählen.');
    const lang=wiki[1].toLowerCase();
    const data=await wikiJSON(lang,{action:'parse',page:title,prop:'text|displaytitle',redirects:'1',disableeditsection:'1',disablelimitreport:'1'});
    const actualTitle=data.parse?.title || title;
    const source=`https://${lang}.wikipedia.org/wiki/${encodeURIComponent(actualTitle.replaceAll(' ','_'))}`;
    const html=typeof data.parse?.text==='string'?data.parse.text:data.parse?.text?.['*'];
    if(!html)throw new Error('Die Quelle liefert keine lesbaren Gerätedaten.');
    return {html,source,title:actualTitle,provider:'wikipedia'};
  }
  const response=await fetchPublicText(url.href);
  if(/(?:cf-turnstile|challenge-form|anomaly-modal|verify you are human|captcha)/i.test(response.text)&&!/<table|lm-specs-table|application\/ld\+json/i.test(response.text))throw new Error('Diese Quelle verlangt eine Browser-Prüfung. Öffne die Seite im Browser oder wähle eine andere Quelle.');
  const source=classifySource(response.url);
  return {html:response.text,source:response.url,provider:source.kind==='manufacturer'?'manufacturer':specialistSources.find(s=>s.name===source.name)?.id||'website'};
}
export async function retrieveOnline(input) {
  const doc=await deviceDocument(input);
  const device=extractDevice(doc.html,doc.source,{title:doc.title,provider:doc.provider});
  const image=await loadProductImage(doc.html,doc.source,device,doc.provider);
  if(image)device.image=image;
  const warnings=[doc.provider==='wikipedia'?'Wikipedia kann mehrere Modellvarianten gemeinsam beschreiben. Prüfe, welche Angaben zu deinem konkreten Gerät gehören.':'Die Merkmale wurden automatisch aus der Webseite ausgelesen. Prüfe Modell, Einheiten und Varianten vor der Übernahme.'];
  if(!image)warnings.push('Diese Quelle liefert kein passendes ladbares Produktbild. Du kannst im Geräte-Editor nach einem Bild aus weiteren Quellen suchen.');
  return {device,warnings};
}
export async function findDeviceImage(name,source='') {
  name=String(name||'').trim();if(name.length<2||name.length>300)throw new Error('Gib zuerst einen konkreten Modellnamen ein.');
  const tryPage=async url=>{try{const doc=await deviceDocument(url);return await loadProductImage(doc.html,doc.source,{name},doc.provider);}catch{return null;}};
  if(source){const image=await tryPage(source);if(image)return {image};}
  const query=name.split(/\s*·\s*/)[0].replace(/\b\d+\s*(?:GB|TB)\b/ig,'').trim().slice(0,160);
  const {results}=await searchOnline(query);
  const priority=r=>['NanoReview','GPU-Monkey'].includes(r.sourceName)?2:r.provider==='manufacturer'?1:0;
  for(const row of results.filter(r=>!r.isPDF&&!r.browserOnly&&r.url!==source&&imageModelMatches(query,r.title)).sort((a,b)=>priority(b)-priority(a)).slice(0,3)){
    const image=await tryPage(row.url);if(image)return {image};
  }
  return {image:null,message:'Kein eindeutig passendes Produktbild gefunden. Das Kategorie-Symbol bleibt erhalten. Versuche einen genaueren Modellnamen oder eine direkte Produktquelle.'};
}
