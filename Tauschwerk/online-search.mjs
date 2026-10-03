import crypto from 'node:crypto';
import {fetchPublicText,validateRemoteURL} from './remote.mjs';
import {textOnly,decodeEntities} from './online-parser.mjs';
import {classifySource,manufacturers,detectManufacturer,domainMatches,isExcludedSource} from './online-sources.mjs';

const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function matchesQuery(row,query){
  const tokens=normalize(query).split(' ').filter(t=>t.length>1&&!['specs','specifications','technische','daten','laptop','notebook','gen','generation'].includes(t));
  const haystack=normalize(row.title+' '+(row.description || '')+' '+row.url);
  const identity=normalize(row.title+' '+row.url+' '+(row.modelSeries || ''));
  const modelTokens=tokens.filter(t=>/\d/.test(t));
  return tokens.length>0&&modelTokens.every(t=>identity.split(' ').includes(t))&&tokens.filter(t=>haystack.includes(t)||identity.includes(t)).length>=Math.ceil(tokens.length*0.7);
}
export function result(title,url,description,engine){
  if(isExcludedSource(url))return null;
  try{url=validateRemoteURL(url).href;}catch{return null;}
  const source=classifySource(url);
  return {id:'search-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,20),title:textOnly(title).slice(0,300),description:textOnly(description).slice(0,700),url,provider:source.kind,sourceName:source.name,manufacturer:source.manufacturer,host:source.host,engine,isPDF:/\.pdf(?:$|[?#])/i.test(url)};
}
function xmlValue(block,tag){const raw=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1] || '';return decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1'));}
export function parseBingRSS(xml){
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(m=>result(xmlValue(m[1],'title'),xmlValue(m[1],'link'),xmlValue(m[1],'description'),'Bing')).filter(Boolean);
}
function attribute(html,name){return decodeEntities(html.match(new RegExp('\\b'+name+'\\s*=\\s*(?:"([^"]*)"|\x27([^\x27]*)\x27)','i'))?.slice(1).find(Boolean)||'');}
export function parseDuckDuckGo(html){
  const results=[];
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    if(!/(?:^|\s)result__a(?:\s|$)/.test(attribute(m[1],'class')))continue;
    let url=attribute(m[1],'href');
    try{const link=new URL(url,'https://html.duckduckgo.com');url=domainMatches(link.hostname,'duckduckgo.com')?link.searchParams.get('uddg'):link.href;}catch{continue;}
    const tail=html.slice(m.index+m[0].length,m.index+m[0].length+5000);
    const snippet=tail.split(/class=["'][^"']*result__a/)[0].match(/<(?:a|div)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || '';
    const row=result(m[2],url,snippet,'DuckDuckGo');if(row?.title)results.push(row);
  }
  return results;
}
function canonicalURL(input){const u=new URL(input);for(const key of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|ref)$/i.test(key))u.searchParams.delete(key);return u.href.replace(/\/$/,'');}
export function rankResults(rows,query,{source='all',manufacturer='all'}={}){
  const unique=new Map();
  for(const row of rows){
    if(isExcludedSource(row.url)||!matchesQuery(row,query))continue;
    if(source==='manufacturer'&&row.provider!=='manufacturer')continue;
    if(manufacturer!=='all'&&row.provider==='manufacturer'&&row.manufacturer!==manufacturer)continue;
    if(manufacturer!=='all'&&row.provider!=='manufacturer'&&!matchesQuery(row,manufacturers.find(m=>m.id===manufacturer)?.id || ''))continue;
    const key=canonicalURL(row.url);if(!unique.has(key))unique.set(key,row);
  }
  const score=r=>(r.provider==='manufacturer'?40:r.sourceName==='Geizhals'?35:r.provider==='database'?25:10)+(/spec|tech|daten|psref|support|laptop-specs/i.test(r.title+' '+r.url)?15:0)+(r.url.includes('/laptop-specs/')?20:0)+(normalize(r.title).includes(normalize(query))?20:0)-(r.isPDF?10:0);
  return [...unique.values()].sort((a,b)=>score(b)-score(a)).slice(0,32);
}
export async function searchWeb(query,language,{source='all',manufacturer='all',domains=[]}={},fetchText=fetchPublicText){
  query=query.replace(/\bps([345])\b/ig,'PlayStation $1');
  const maker=manufacturers.find(m=>m.id===manufacturer) || detectManufacturer(query);
  const languages=language==='all'?['de','en']:[language];
  const restrictions=domains.length?domains:source==='manufacturer'&&maker?maker.domains:[''];
  const searches=languages.flatMap(lang=>restrictions.map(domain=>({lang,search:query+' '+(lang==='de'?'technische Daten':'specifications')+(domain?' site:'+domain:'')})));
  // A global query also covers products and brands absent from our local catalogs.
  if(!domains.length&&source!=='manufacturer'){
    for(const domain of maker?.domains || [])searches.push({lang:languages[0],search:query+' specifications site:'+domain});
    searches.push({lang:languages[0],search:query});
  }
  const responses=await Promise.allSettled(searches.map(async ({lang,search})=>{
    const rows=[],errors=[];
    // Merge both engines: one provider may omit the official specification page.
    const engines=[['DuckDuckGo','https://html.duckduckgo.com/html/',parseDuckDuckGo],['Bing','https://www.bing.com/search',parseBingRSS]];
    const answers=await Promise.allSettled(engines.map(async ([name,base,parse])=>{
      const url=new URL(base);url.searchParams.set('q',search+' -site:wikipedia.org -site:wikimedia.org -site:wikidata.org');
      if(name==='Bing'){url.searchParams.set('format','rss');url.searchParams.set('mkt',lang==='de'?'de-DE':'en-US');}
      else url.searchParams.set('kl',lang==='de'?'de-de':'us-en');
      return parse((await fetchText(url.href)).text);
    }));
    answers.forEach((answer,i)=>{if(answer.status==='fulfilled')rows.push(...answer.value);else errors.push(engines[i][0]+': '+answer.reason.message);});
    return {rows,errors};
  }));
  const fulfilled=responses.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const results=rankResults(fulfilled.flatMap(r=>r.rows),query,{source,manufacturer}).filter(r=>!domains.length||domains.some(d=>domainMatches(new URL(r.url).hostname,d)));
  const warnings=results.length?[]:['Die Websuche hat keine ausreichend passenden Treffer geliefert. Versuche die genaue Modellnummer oder einen direkten Hersteller-/Geizhals-Link.',...new Set(fulfilled.flatMap(r=>r.errors))];
  return {results,warnings};
}
export function extractLaptopLinks(html,base,query){
  const rows=[];
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    let url;try{url=new URL(attribute(m[1],'href'),base);}catch{continue;}
    if(url.hostname!=='laptopmedia.com'||!/^\/(?:laptop-specs|series|review)\//.test(url.pathname))continue;
    const title=textOnly(m[2]) || textOnly(attribute(m[2],'alt'));
    // Related-device widgets can contain other models. Require the model family
    // in the actual link; a long SKU may appear only in the containing article.
    const familyQuery=query.split(/\s+/).filter(t=>!(/^[a-z]{2,}\d{3,}$/i.test(t)||/^\d{4,}$/.test(t))).join(' ');
    const label=/^(?:detailed review|view all results)$/i.test(title)?query+' · '+(url.pathname.startsWith('/series/')?'Modellreihe':'Testbericht'):title;
    const row=result(label||query+' · '+url.pathname.split('/')[1],url.href,'Verlinkt im Artikel zu '+query+'. Konfiguration und Modellgeneration vor der Übernahme prüfen.','LaptopMedia');
    if(row&&matchesQuery({...row,description:''},familyQuery))rows.push(row);
  }
  return [...new Map(rows.map(r=>[r.url,r])).values()].slice(0,6);
}
export function readLaptopConfiguration(html,url,query){
  // The first series link belongs to the configuration's own model header.
  // Later links can be recommendations for other generations.
  const header=[...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find(m=>{
    try{return /^\/series\//.test(new URL(attribute(m[1],'href'),url).pathname);}catch{return false;}
  });
  if(!header)return null;
  const seriesURL=new URL(attribute(header[1],'href'),url).href;
  const series=textOnly(header[2]);
  if(!matchesQuery({title:series,description:'',url:seriesURL},query))return null;
  const title=textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*\|\s*LaptopMedia\.com.*$/i,'');
  return title?{...result(title,url,'Modellreihe: '+series+'. Konkrete RAM-, SSD- und CPU-Variante vor der Übernahme prüfen.','LaptopMedia'),modelSeries:series}:null;
}
export async function searchLaptops(query,fetchText=fetchPublicText){
  const endpoint=new URL('https://laptopmedia.com/wp-json/wp/v2/search');
  endpoint.searchParams.set('search',query);endpoint.searchParams.set('per_page','12');endpoint.searchParams.set('subtype','post');
  const data=JSON.parse((await fetchText(endpoint.href)).text);
  if(!Array.isArray(data))throw new Error('LaptopMedia liefert keine Suchergebnisse.');
  const rows=data.map(r=>result(r.title,r.url,'Laptop-Artikel mit technischen Daten und verlinkten Konfigurationen.','LaptopMedia')).filter(r=>r&&matchesQuery(r,query)&&/^\/(?:review|guides|series|laptop-specs)\//.test(new URL(r.url).pathname));
  const pages=await Promise.allSettled(rows.slice(0,2).map(async row=>extractLaptopLinks((await fetchText(row.url)).text,row.url,query)));
  const linked=[...new Map(pages.filter(p=>p.status==='fulfilled').flatMap(p=>p.value).map(r=>[r.url,r])).values()];
  const configurations=await Promise.allSettled(linked.filter(r=>r.url.includes('/laptop-specs/')).slice(0,6).map(async row=>readLaptopConfiguration((await fetchText(row.url)).text,row.url,query)));
  return {results:[...configurations.filter(p=>p.status==='fulfilled'&&p.value).map(p=>p.value),...linked.filter(r=>!r.url.includes('/laptop-specs/')),...rows],warnings:[...pages,...configurations].some(p=>p.status==='rejected')?['Einige verlinkte Laptop-Konfigurationen konnten nicht gelesen werden.']:[]};
}
