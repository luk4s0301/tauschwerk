import {extractDevice,imageModelMatches,decodeEntities,textOnly} from './online-parser.mjs';
import {loadProductImage} from './device-images.mjs';
import {fetchPublicText,fetchPublicImage,validateRemoteURL} from './remote.mjs';
import {searchWeb,searchLaptops,rankResults,matchesQuery} from './online-search.mjs';
import {sourceOptions,manufacturers,classifySource,deviceKinds,detectDeviceKind,specialistSources,normalizeDeviceQuery} from './online-sources.mjs';
import {searchCatalog,searchManufacturerCatalog} from './online-catalogs.mjs';
export {fetchPublicText,validateRemoteURL,isPublicAddress} from './remote.mjs';
export async function searchOnline(query,language='all',{source='all',manufacturer='all',kind='all'}={},fetchText=fetchPublicText) {
  query=String(query || '').trim();if(query.length<2||query.length>160)throw new Error('Gib einen Gerätenamen zwischen 2 und 160 Zeichen ein.');
  const originalQuery=query;query=normalizeDeviceQuery(query);
  if(!['all','de','en'].includes(language))throw new Error('Ungültige Sprache.');
  if(!sourceOptions.some(([id])=>id===source))throw new Error('Ungültige Suchquelle.');
  if(manufacturer!=='all'&&!manufacturers.some(m=>m.id===manufacturer))throw new Error('Ungültiger Hersteller.');
  if(!deviceKinds.some(([id])=>id===kind))throw new Error('Ungültige Geräteart.');
  const resolvedKind=kind==='all'?detectDeviceKind(query):kind;
  const tasks=[];
  if(['all','web','manufacturer'].includes(source))tasks.push({label:'Websuche',run:()=>searchWeb(query,language,{source,manufacturer},fetchText)});
  if(source==='laptopmedia'||source==='all'&&resolvedKind==='laptops')tasks.push({label:'LaptopMedia',run:()=>searchLaptops(query,fetchText)});
  for(const specialist of specialistSources.filter(s=>s.id!=='laptopmedia')){
    // Search every relevant specialist; recover unavailable direct catalogs with domain-restricted web search.
    if(source===specialist.id||source==='all'&&specialist.kinds.includes(resolvedKind))tasks.push({label:specialist.name,run:async()=>{try{const found=await searchCatalog(specialist.id,query,language,fetchText);if(found.results.length)return found;}catch{}return searchWeb(query,language,{domains:specialist.domains},fetchText);}});
  }
  if(['all','manufacturer'].includes(source))tasks.push({label:'Herstellerkatalog',run:()=>searchManufacturerCatalog(query,language,manufacturer,fetchText)});
  const responses=await Promise.allSettled(tasks.map(t=>t.run()));
  const fulfilled=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const rows=fulfilled.flatMap(r=>r.results);
  const results=rankResults(rows,query,{source,manufacturer});
  const warnings=[...new Set([...fulfilled.flatMap(r=>r.warnings || []),...responses.flatMap((r,i)=>r.status==='rejected'?[tasks[i].label+': '+r.reason.message]:[])])];
  return {results,warnings,query,originalQuery,source,manufacturer,kind:resolvedKind,searchedSources:tasks.map(t=>t.label)};
}
async function deviceDocument(input,fetchText=fetchPublicText) {
  const url=validateRemoteURL(input);
  const response=await fetchText(url.href);
  if(/(?:cf-turnstile|challenge-form|anomaly-modal|verify you are human|captcha)/i.test(response.text)&&!/<table|lm-specs-table|application\/ld\+json/i.test(response.text))throw new Error('Diese Quelle blockiert den automatischen Abruf.');
  const source=classifySource(response.url||url.href);
  return {html:response.text,source:response.url||url.href,provider:source.kind==='manufacturer'?'manufacturer':specialistSources.find(s=>s.name===source.name)?.id||'website'};
}
function specificationLinks(doc){
  const origin=new URL(doc.source),maker=classifySource(doc.source).manufacturer,links=[];
  for(const m of doc.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=decodeEntities(m[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'');
    if(!/tech|spec|hardware|technisch/i.test(href+' '+textOnly(m[2])))continue;
    try{const url=validateRemoteURL(new URL(href,doc.source).href);if(url.href===doc.source||url.pathname.match(/\.pdf$/i))continue;if(url.hostname===origin.hostname||maker&&classifySource(url.href).manufacturer===maker)links.push(url.href);}catch{}
  }
  return [...new Set(links)].slice(0,4);
}
function nintendoSpecificationURLs(model){
  const name=normalizeDeviceQuery(model).toLowerCase();
  if(!/^nintendo switch(?: 2| oled(?: model)?| lite)?$/.test(name))return [];
  if(name.endsWith(' 2'))return ['https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/'];
  if(name.includes('oled'))return ['https://www.nintendo.com/us/gaming-systems/switch/oled-model/tech-specs/'];
  if(name.endsWith(' lite'))return ['https://www.nintendo.com/us/gaming-systems/switch/lite/tech-specs/'];
  return ['https://www.nintendo.com/us/gaming-systems/switch/tech-specs/','https://www.nintendo.com/en-gb/Hardware/Nintendo-Switch-Family/Nintendo-Switch/Technical-specifications-1176277.html'];
}
export async function retrieveOnline(input,{expectedModel='',fallback=false,enrichImages=false,fetchImage=fetchPublicImage}={},fetchText=fetchPublicText) {
  // Validate before recovery: an excluded or private URL must never trigger a search.
  input=validateRemoteURL(input).href;expectedModel=normalizeDeviceQuery(expectedModel);
  let initialDoc;const attempts=[];
  const read=async url=>{
    let doc,stage='Abruf';
    try{
      doc=await deviceDocument(url,fetchText);if(url===input)initialDoc=doc;stage='Daten auslesen';
      const device=extractDevice(doc.html,doc.source,{provider:doc.provider});stage='Modell prüfen';
      if(expectedModel&&!matchesQuery({title:device.brand+' '+device.name,url:'',description:''},expectedModel))throw new Error('Das Datenblatt nennt „'+device.name+'“ und passt nicht eindeutig zu „'+expectedModel+'“.');
      return {doc,device};
    }catch(error){attempts.push({url:doc?.source||url,stage,error:error.message});throw error;}
  };
  let loaded,primaryError;
  try{loaded=await read(input);}catch(error){primaryError=error;}
  if(!loaded&&fallback&&expectedModel){
    const tried=new Set([input]);
    const linked=initialDoc?specificationLinks(initialDoc):[];
    const official=classifySource(input).manufacturer==='nintendo'?nintendoSpecificationURLs(expectedModel):[];
    for(const url of [...new Set([...linked,...official])].filter(url=>!tried.has(url)).slice(0,5)){tried.add(url);try{loaded=await read(url);break;}catch{}}
    if(!loaded){
      const search=await searchOnline(expectedModel,'all',{},fetchText);
      for(const row of search.results.filter(r=>!r.isPDF&&!tried.has(r.url)).slice(0,4)){try{loaded=await read(row.url);break;}catch{}}
    }
  }
  if(!loaded){const error=new Error(primaryError.message+(fallback&&expectedModel?' Auch die alternativen Quellen lieferten kein lesbares Datenblatt für dieses Modell.':''));error.attempts=attempts;error.source=input;error.expectedModel=expectedModel;throw error;}
  const {doc,device}=loaded;
  let image=await loadProductImage(doc.html,doc.source,device,doc.provider,fetchImage);
  if(!image&&enrichImages)image=(await findDeviceImage(device.name,'',{fetchText,fetchImage,skip:[doc.source]})).image;
  if(image)device.image=image;
  const warnings=['Die Merkmale wurden automatisch aus der Webseite ausgelesen. Prüfe Modell, Einheiten und Varianten vor der Übernahme.'];
  if(primaryError||doc.source!==input)warnings.push('Die ausgewählte Seite konnte nicht direkt als Datenblatt genutzt werden. Geladen wurde stattdessen: '+doc.source+'. Alle technischen Angaben sind dieser Quelle zugeordnet.');
  if(device.provenance.conflicts?.length)warnings.push('Widersprüchliche Angaben wurden ausgelassen: '+device.provenance.conflicts.map(c=>c.key).join(', ')+'. Prüfe die konkrete Variante auf der Originalseite.');
  if(!image)warnings.push('Diese Quelle liefert kein passendes ladbares Produktbild. Du kannst im Geräte-Editor nach einem Bild aus weiteren Quellen suchen.');
  return {device,warnings,attempts};
}
export async function findDeviceImage(name,source='',{fetchText=fetchPublicText,fetchImage=fetchPublicImage,skip=[]}={}) {
  name=String(name||'').trim();if(name.length<2||name.length>300)throw new Error('Gib zuerst einen konkreten Modellnamen ein.');
  name=normalizeDeviceQuery(name);
  const tryPage=async url=>{try{const doc=await deviceDocument(url,fetchText);return await loadProductImage(doc.html,doc.source,{name},doc.provider,fetchImage);}catch{return null;}};
  if(source){const image=await tryPage(source);if(image)return {image};}
  const query=name.split(/\s*·\s*/)[0].replace(/\b\d+\s*(?:GB|TB)\b/ig,'').trim().slice(0,160);
  const {results,warnings}=await searchOnline(query,'all',{},fetchText);
  const priority=r=>r.provider==='manufacturer'?3:r.sourceName==='Geizhals'?2:r.provider==='database'?1:0;
  const rows=results.filter(r=>!r.isPDF&&r.url!==source&&!skip.includes(r.url)&&imageModelMatches(query,r.title)).sort((a,b)=>priority(b)-priority(a)).slice(0,6);
  for(let i=0;i<rows.length;i+=2){
    const images=await Promise.all(rows.slice(i,i+2).map(row=>tryPage(row.url)));const image=images.find(Boolean);if(image)return {image};
  }
  return {image:null,warnings,message:'Die Web-Bildsuche hat kein eindeutig passendes ladbares Produktbild gefunden. Das Kategorie-Symbol bleibt erhalten.'};
}
