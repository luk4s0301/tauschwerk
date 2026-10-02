import {fetchPublicText} from './remote.mjs';
import {textOnly,decodeEntities} from './online-parser.mjs';
import {result,matchesQuery,searchWeb} from './online-search.mjs';
import {specialistSources,detectManufacturer} from './online-sources.mjs';

// Only public catalog GET requests. A failed provider never discards other sources.
const cache=new Map();
async function catalogText(url,fetchText){
  if(fetchText!==fetchPublicText)return (await fetchText(url)).text;
  const prior=cache.get(url);if(prior&&Date.now()-prior.time<3600000)return prior.text;
  const text=(await fetchText(url)).text;
  if(cache.size>=12)cache.delete(cache.keys().next().value);
  cache.set(url,{time:Date.now(),text});return text;
}
const href=attrs=>decodeEntities(attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||'');
export function catalogLinks(html,base,query,pathPattern,description){
  const rows=[];
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    let u;try{u=new URL(href(m[1]),base);}catch{continue;}
    if(u.hostname!==new URL(base).hostname||!pathPattern.test(u.pathname))continue;
    const title=textOnly(m[2]).replace(/\d+C\s*\d+T\s*@.*$/,'').trim();
    const row=result(title,u.href,description,'Gerätekatalog');
    if(row?.title&&matchesQuery({...row,description:'',url:'https://example.com/'},query))rows.push(row);
  }
  return [...new Map(rows.map(r=>[r.url,r])).values()].slice(0,16);
}
export async function searchCatalog(id,query,language,fetchText=fetchPublicText){
  if(id==='nanoreview'){
    const url=new URL('https://nanoreview.net/api/search');url.search=new URLSearchParams({q:query,limit:'20',type:'phone'}).toString();
    const data=JSON.parse((await fetchText(url.href)).text);
    if(!Array.isArray(data))throw new Error('Der Handy-Katalog liefert keine lesbaren Treffer.');
    return {results:data.filter(r=>r.content_type==='phone'&&/^[a-z0-9-]+$/.test(r.slug||'')).map(r=>result(r.label||r.name,'https://nanoreview.net/en/phone/'+r.slug,'Smartphone-Datenblatt: Display, Kamera, Akku, Prozessor und Speicher.','NanoReview')).filter(r=>r&&matchesQuery(r,query)),warnings:[]};
  }
  if(id==='cpu-monkey'||id==='gpu-monkey'){
    const cpu=id==='cpu-monkey';const url=new URL('https://www.'+id+'.com/en/search');url.searchParams.set(cpu?'suchwort':'q',query);
    const html=(await fetchText(url.href)).text;
    return {results:catalogLinks(html,url.href,query,cpu?/^\/en\/cpu-[^/]+$/:/^\/en\/gpu-[^/]+$/,cpu?'Prozessor-Datenblatt mit Kernen, Takt, Sockel, Speicher und Leistungsaufnahme.':'Konkrete Grafikkarte mit Grafikspeicher, Takt, Anschlüssen und Leistungsaufnahme.'),warnings:[]};
  }
  if(id==='rtings'){
    const xml=await catalogText('https://www.rtings.com/sitemap.xml',fetchText);
    const rows=[];
    for(const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)){
      const url=decodeEntities(m[1]);let u;try{u=new URL(url);}catch{continue;}
      if(u.hostname!=='www.rtings.com'||!/^\/(?:tv|monitor|headphones|soundbar|camera|mouse|keyboard|printer|vacuum|speaker|laptop)\/reviews\/(?!best|by-)[^/]+\/[^/]+\/?$/.test(u.pathname))continue;
      const title=u.pathname.split('/').slice(3).join(' ').replace(/-/g,' ');
      const row=result(title,url,'Unabhängiger Testbericht. Messwerte und technische Angaben auf der Originalseite ansehen.','RTINGS');
      if(row&&matchesQuery(row,query))rows.push({...row,browserOnly:true});
    }
    return {results:rows.slice(0,12),warnings:[]};
  }
  if(id==='gsmarena'){
    const url=new URL('https://www.gsmarena.com/res.php3');url.searchParams.set('sSearch',query);
    return {results:catalogLinks((await fetchText(url.href)).text,url.href,query,/^\/[^/]+-\d+\.php$/,'Technische Daten für Handys und ausgewählte Wearables.'),warnings:[]};
  }
  const source=specialistSources.find(s=>s.id===id);
  if(!source)throw new Error('Unbekannte Fachquelle.');
  return searchWeb(query,language,{domains:source.domains},fetchText);
}

export async function searchManufacturerCatalog(query,language,manufacturer,fetchText=fetchPublicText){
  const maker=manufacturer==='all'?detectManufacturer(query)?.id:manufacturer;
  const locale=language==='en'?'en-us':'de-de';
  const endpoint=maker==='sony'?`https://www.playstation.com/${locale}/sitemap.xml`:maker==='apple'?`https://www.apple.com/autopush/sitemap/${language==='en'?'us':'de'}/sitemap.xml`:null;
  if(!endpoint)return {results:[],warnings:[]};
  const xml=await catalogText(endpoint,fetchText);const rows=[];
  for(const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)){
    const url=decodeEntities(m[1]);let u;try{u=new URL(url);}catch{continue;}
    if(u.hostname!==new URL(endpoint).hostname)continue;
    if(maker==='apple'&&!/\/specs\/?$/.test(u.pathname))continue;
    if(maker==='sony'&&!/^\/(?:de-de|en-us)\/(?:ps[345](?:\/ps[45]-pro)?(?:\/tech-specs)?|accessories\/[^/]+)\/$/.test(u.pathname))continue;
    const model=u.pathname.split('/').filter(Boolean).slice(1).join(' ').replace(/tech-specs|specs/g,'').replace(/ps([345])/g,'PlayStation $1').replace(/-/g,' ').trim();
    const row=result((maker==='apple'?'Apple ':'Sony ')+model,url,'Offizielle Produktseite. Modell und technische Angaben vor der Übernahme prüfen.','Herstellerkatalog');
    if(row&&matchesQuery(row,query.replace(/\bps([345])\b/ig,'PlayStation $1')))rows.push(row);
  }
  return {results:rows.slice(0,12),warnings:[]};
}
