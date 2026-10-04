import {fetchPublicText,validateRemoteURL} from './remote.mjs';
import {decodeEntities,textOnly} from './online-parser.mjs';

const norm=s=>String(s||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\bps([345])\b/g,'playstation $1').replace(/(\d)\s*(gb|tb|mm|mb|hz)\b/g,'$1$2').replace(/([a-z]\d+)\+/g,'$1 plus').replace(/[^a-z0-9]+/g,' ').trim();
const tokens=s=>norm(s).split(' ').filter(Boolean);
const attr=(s,k)=>decodeEntities(s.match(new RegExp('\\b'+k+'=["\x27]([^"\x27]*)["\x27]','i'))?.[1]||'');
const euro=s=>{const m=textOnly(s).match(/(\d+(?:\.\d{3})*(?:,\d{1,2})?)\s*€/);return m?Number(m[1].replaceAll('.','').replace(',','.')):null;};
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?a.length%2?a[i]:(a[i-1]+a[i])/2:null;};
const round=n=>Math.round(n/5)*5;
const validPrice=p=>Number.isFinite(p)&&p>1&&p<=10000000;
const variants=['pro','max','ultra','plus','edge','fe','mini','lite','oled','slim','digital','super','ti'];
const color=t=>({schwarz:'black',blau:'blue',grun:'green',silber:'silver',weiss:'white',grau:'grey',gray:'grey',golden:'gold',rot:'red'}[t]||t);
export function modelMatches(title,name,variant=''){
  const have=new Set(tokens(title)),want=tokens(name).filter(t=>!['apple','samsung','sony','microsoft','nintendo','geforce'].includes(t)),detail=tokens(variant);
  if(!want.length||!want.every(t=>have.has(t)))return false;
  // A price for two controllers or a bundle must not become a unit price.
  if(/\b(?:bundle|konvolut|paket|set|[2-9]x|[2-9] stuck)\b/.test(norm(title))&&!/\b(?:bundle|paket|set)\b/.test(norm(name)))return false;
  if(variants.some(t=>have.has(t)!==want.includes(t)&&!detail.includes(t)))return false;
  // Numeric configuration must be explicit, and conflicting capacities rejected.
  const capacities=detail.filter(t=>/\d+(?:gb|tb|mm|mb|hz)$/.test(t));
  if(!capacities.every(t=>have.has(t)))return false;
  const words=detail.filter(t=>!/^\d+(?:gb|tb|mm|mb|hz)$/.test(t)&&!['ram','ssd','hdd','speicher','speicherplatz','farbe','mit','z','b'].includes(t));
  const available=new Set([...have].map(color));if(!words.every(t=>available.has(color(t))))return false;
  for(const unit of ['gb','tb','mm']){const requested=[...want,...capacities].filter(t=>t.endsWith(unit)&&/^\d/.test(t));if(requested.length&&[...have].some(t=>t.endsWith(unit)&&/^\d/.test(t)&&!requested.includes(t)))return false;}
  return true;
}
export function conditionOf(text){
  const t=norm(text);
  if(/\b(defekt|bastler|kaputt|displaybruch|gesprungen)\b/.test(t)&&!/(?:nicht|kein|keine) (?:defekt|defekte|displaybruch)/.test(t))return 'Defekt';
  if(/\b(stark genutzt|stark gebraucht|starke gebrauchsspuren|in ordnung)\b/.test(t))return 'Stark gebraucht';
  if(/\b(neuwertig|wie neu|exzellent|neuzustand)\b/.test(t))return 'Wie neu';
  if(/\b(sehr gut|top zustand|topzustand)\b/.test(t))return 'Sehr gut';
  if(/\b(gut|guter zustand)\b/.test(t))return 'Gut';
  if(/\b(neu|unbenutzt|versiegelt|ungeoffnet)\b/.test(t))return 'Neu';
  return 'Nicht angegeben';
}
const unsafeTitle=t=>/\b(?:suche|gesuch|ankauf|kaufe|miete|vertrag|monatlich|hulle|schutzfolie|ersatzteil|displayeinheit|leerverpackung|nur ovp)\b/i.test(norm(t));
export function parseClassifieds(html,base='https://www.kleinanzeigen.de'){
  const rows=[];
  for(const m of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)){
    const block=m[2],title=textOnly(block.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i)?.[1]||'');
    const plain=textOnly(block),url=attr(m[1],'data-href')||attr(block.match(/<a\b[^>]*href=["']\/s-anzeige\/[^>]*>/)?.[0]||'','href');
    if(!title||!url||unsafeTitle(title)||/\bGesuch\b|(?:^|;)\s*PRO\s*(?:;|$)/.test(plain)||/>\s*PRO\s*</.test(block))continue;
    const prices=[...block.replace(/<s\b[^>]*>[\s\S]*?<\/s>/gi,'').matchAll(/>([^<>]*€[^<>]*)</g)].map(m=>euro(m[1])).filter(validPrice);
    const price=prices[0];if(!validPrice(price))continue;
    rows.push({title,url:new URL(url,base).href,price,source:'Kleinanzeigen',kind:'private-asking',condition:conditionOf(title),description:'',verified:false});
  }
  return [...new Map(rows.map(r=>[r.url,r])).values()];
}
export function readClassified(html,row){
  const title=textOnly(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
  const description=textOnly(html.match(/<p\b[^>]*id=["']viewad-description-text["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]||'');
  const condition=textOnly(html.match(/Zustand\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
  const price=euro(html.match(/<h2\b[^>]*id=["']viewad-price["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]||'');
  if(!title||!validPrice(price)||!description||!html.includes('Privater Nutzer')||unsafeTitle(title)||/\b(?:reserviert|verkauft)\b/.test(norm(title)))return null;
  const specific=conditionOf(title+' '+description);
  return {...row,title,price,description:description.slice(0,8000),condition:specific==='Nicht angegeben'?conditionOf(condition):specific,verified:true};
}
export function parseRebuy(html){
  let data;try{data=JSON.parse(html.match(/<script\b[^>]*id=["']ry-inject["'][^>]*>([\s\S]*?)<\/script>/i)?.[1]||'');}catch{return [];}
  const docs=data.productListViewDto?.searchResponse?.products?.docs;
  if(!Array.isArray(docs))return [];
  const conditions={A0:'Neu',A1:'Wie neu',A2:'Sehr gut',A3:'Gut',A4:'Stark gebraucht'};
  return docs.flatMap(p=>!p.name||!Number.isSafeInteger(p.id)||!p.product_sanitized_name?[]:(p.variants||[]).filter(v=>v.quantity>0&&conditions[v.label]&&validPrice(v.price/100)).map(v=>({title:p.name,url:'https://www.rebuy.de/i,'+p.id+'/'+encodeURIComponent(p.category_sanitized_name||'elektronik')+'/'+encodeURIComponent(p.product_sanitized_name)+'?variant='+v.label,price:v.price/100,source:'reBuy',kind:'dealer-used',condition:conditions[v.label],description:'Generalüberholtes Händlergerät mit Garantie; kein privater Verkaufspreis.',verified:true})));
}
export function idealoLinks(html,query,variant){
  return [...new Map([...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>{try{const u=new URL(attr(m[1],'href'),'https://www.idealo.de');const title=textOnly(m[2]);return u.hostname==='www.idealo.de'&&u.pathname.startsWith('/preisvergleich/OffersOfProduct/')&&modelMatches(title,query,variant)?[u.href,{url:u.href,title}]:null;}catch{return null;}}).filter(Boolean)).values()].slice(0,2);
}
export function parseIdealo(html,row){
  const title=textOnly(html.match(/<h1\b[^>]*id=["']oopStage-title["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
  if(!title)return [];
  const rows=[];
  for(const [id,kind]of [['used','dealer-reference'],['new','new-reference']]){
    const block=html.split('id="oopStage-conditionButton-'+id+'"')[1]?.split('oopStage-conditionButton-arrow')[0];const price=euro(block||'');
    if(validPrice(price))rows.push({...row,title,price,source:'idealo',kind,condition: id==='new'?'Neu':'Nicht angegeben',description:id==='used'?'Ab-Preis für B-Ware/Gebraucht; Zustand und Einzelangebot noch ungeprüft.':'Neupreis als Orientierung; fließt nicht in den Gebrauchtwert ein.',verified:true});
  }
  return rows;
}
function normalizeRequest(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Gerätedaten fehlen.');
  const out={};for(const [key,max]of Object.entries({name:160,variant:160,condition:40,contents:300,issues:300})){if(input[key]!==undefined&&typeof input[key]!=='string')throw Error('Ungültige Gerätebeschreibung.');out[key]=(input[key]||'').trim();if(out[key].length>max)throw Error('Gerätebeschreibung ist zu lang.');}
  if(out.name.length<2||!['Wie neu','Sehr gut','Gut','Stark gebraucht','Defekt'].includes(out.condition))throw Error('Wähle ein Gerät und gib seinen Zustand an.');
  if(input.quantity!==undefined&&(!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>8))throw Error('Anzahl gleicher Geräte muss zwischen 1 und 8 liegen.');
  out.quantity=input.quantity||1;
  if(input.accessories!==undefined&&(!Array.isArray(input.accessories)||input.accessories.length>8))throw Error('Maximal acht verschiedene Zusatzgeräte pro Set.');
  const conditions=['Wie neu','Sehr gut','Gut','Stark gebraucht','Defekt'];
  out.accessories=(input.accessories||[]).map(a=>{
    if(!a||typeof a.name!=='string'||a.name.trim().length<3||a.name.length>120||!Number.isInteger(a.quantity)||a.quantity<1||a.quantity>8)throw Error('Zubehör mit Modellname und Anzahl (1–8) angeben.');
    if(a.condition!==undefined&&!conditions.includes(a.condition))throw Error('Ungültiger Zustand eines Zusatzgeräts.');
    if(a.variant!==undefined&&(typeof a.variant!=='string'||a.variant.length>160))throw Error('Ungültige Variante eines Zusatzgeräts.');
    if(a.manualValue!==undefined&&(!Number.isFinite(a.manualValue)||a.manualValue<0||a.manualValue>10000000))throw Error('Eigener Stückwert muss zwischen 0 und 10 Mio. € liegen.');
    return {name:a.name.trim(),quantity:a.quantity,condition:a.condition||out.condition,variant:(a.variant||'').trim(),...(a.manualValue!==undefined?{manualValue:a.manualValue}:{})};
  });
  if(input.comparisons!==undefined&&(!Array.isArray(input.comparisons)||input.comparisons.length>20))throw Error('Maximal 20 eigene Vergleichsangebote.');
  out.comparisons=(input.comparisons||[]).map(r=>{
    if(!r||typeof r.title!=='string'||r.title.length>300||!r.title.trim()||!validPrice(r.price)||!conditions.includes(r.condition)||typeof r.description!=='string'||r.description.length>2000)throw Error('Vergleichsangebot mit Modell, gültigem Preis, Zustand und Beschreibung angeben.');
    return {title:r.title.trim(),price:r.price,condition:r.condition,description:r.description,url:validateRemoteURL(r.url).href,source:'Eigener Vergleich',kind:'user-reference',verified:true};
  });

  return out;
}
const aliases=s=>norm(s).replace(/originalverpackung/g,'ovp').replace(/ladegerat|netzteil|charger/g,'netzteil').replace(/ladekabel|usb c kabel|usb kabel/g,'kabel').replace(/rechnungsnachweis/g,'rechnung');
function containsAll(text,requested){
  const have=aliases(text);return requested.split(/[;,\n]/).map(aliases).filter(Boolean).every(part=>part.split(' ').every(t=>new Set(have.split(' ')).has(t)&&!new RegExp('(?:ohne|kein|keine|keinen|nicht|fehlt) (?:\\w+ )?'+t+'\\b').test(have)));
}
export function summarizePrices(rows,profile){
  // Deduplicate before counting offers or choosing the market tier.
  const offerKey=r=>{try{const u=new URL(r.url);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(?:fbclid|gclid|ref)$/i.test(key))u.searchParams.delete(key);return u.href;}catch{return r.url;}};
  const uniqueRows=[...new Map(rows.filter(r=>validPrice(r.price)).map(r=>[offerKey(r),r])).values()];
  const review=r=>{
    if(!modelMatches(r.title,profile.name,profile.variant||''))return 'Anderes Modell oder andere Variante';
    if(!r.verified)return 'Angebot nicht vollständig geprüft';
    if(!['private-asking','dealer-used','user-reference'].includes(r.kind))return 'Nur Preisorientierung; kein passendes Gebrauchtangebot';
    if(r.condition!==profile.condition)return 'Anderer oder unbekannter Zustand';
    if(!containsAll(r.description||'',profile.contents||''))return 'Lieferumfang nicht bestätigt';
    if(!containsAll(r.description||'',profile.issues||''))return 'Mängel oder Besonderheiten nicht bestätigt';
    if((profile.accessories||[]).some(a=>modelMatches(r.title+' '+r.description,a.name)))return 'Zusatzgerät bereits im Angebot enthalten';
    return '';
  };
  const eligible=uniqueRows.filter(r=>!review(r));
  let chosen=[],basis=null,reason='Weniger als drei passende Angebote. Nutze die Suchlinks oder ergänze eigene Vergleichsangebote.';
  for(const kind of ['private-asking','dealer-used','user-reference']){
    const candidates=eligible.filter(r=>r.kind===kind),middle=median(candidates.map(r=>r.price));
    const clean=middle===null?[]:candidates.filter(r=>r.price>=middle*.5&&r.price<=middle*1.8);
    const configurations=new Set(clean.map(r=>tokens(r.title).filter(t=>/^\d+(?:gb|tb|mm)$/.test(t)).sort().join('/')).filter(Boolean));
    if(!/\d+\s*(?:gb|tb|mm)\b/i.test(profile.name+' '+(profile.variant||''))&&configurations.size>1){reason='Die Angebote enthalten verschiedene Speicher- oder Größenvarianten. Bitte die konkrete Variante eintragen.';continue;}
    if(clean.length>=3){chosen=clean;basis=kind;break;}
  }
  const used=chosen.map(r=>r.url);
  const evidence=uniqueRows.slice(0,30).map(r=>({...r,used:used.includes(r.url),exclusion:review(r)||(!used.includes(r.url)?!chosen.length?'Für diese Preisbasis fehlen drei passende Angebote':r.kind!==basis?'Andere Preisbasis; wird getrennt betrachtet':'Preis weicht stark vom Median ab':'')}));
  if(!chosen.length)return {estimate:null,basis:null,evidence,used:[],reason};
  const prices=chosen.map(r=>r.price).sort((a,b)=>a-b);
  reason=basis==='dealer-used'?'Händler-Verkaufspreise: Garantie und Marge können den privaten Tauschwert übersteigen.':basis==='user-reference'?'Median deiner Vergleichsangebote. Preis, Modell und Zustand wurden von dir angegeben; nicht unabhängig bestätigt.':'Median privater Angebotspreise. Verhandelte Verkaufspreise sind nicht bekannt.';
  return {estimate:{value:round(median(prices)),low:round(prices[0]),high:round(prices.at(-1)),count:prices.length,confidence:basis==='private-asking'&&prices.length>=6&&prices.at(-1)/prices[0]<1.5?'mittel':'gering'},basis,evidence,used,reason};
}
async function collect(profile,fetchText){
  const q=profile.name+' '+(profile.variant||'');
  const endpoints=[{source:'Kleinanzeigen',url:'https://www.kleinanzeigen.de/s-suchanfrage.html?keywords='+encodeURIComponent(q)+'&adType=OFFER'},{source:'reBuy',url:'https://www.rebuy.de/kaufen/suchen?q='+encodeURIComponent(q)},{source:'idealo',url:'https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q='+encodeURIComponent(q)}];
  const all=await Promise.allSettled(endpoints.map(async s=>{
    const page=await fetchText(s.url);let rows=[];
    if(s.source==='Kleinanzeigen'){
      const next=[...page.text.matchAll(/href=["']([^"']*\/seite:[23]\/[^"']*)["']/g)].map(m=>new URL(decodeEntities(m[1]),page.url)).filter(u=>u.hostname==='www.kleinanzeigen.de'&&u.protocol==='https:');
      const more=await Promise.allSettled([...new Set(next.map(u=>u.href))].slice(0,2).map(u=>fetchText(u)));
      const pages=[page,...more.filter(r=>r.status==='fulfilled').map(r=>r.value)];
      const ads=[...new Map(pages.flatMap(p=>parseClassifieds(p.text,p.url)).filter(r=>modelMatches(r.title,profile.name,profile.variant)).map(r=>[r.url,r])).values()].slice(0,14);
      const details=await Promise.allSettled(ads.map(async r=>readClassified((await fetchText(r.url)).text,r)));
      rows=details.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);
    }else if(s.source==='reBuy')rows=parseRebuy(page.text).filter(r=>modelMatches(r.title,profile.name,profile.variant));
    else{const details=await Promise.allSettled(idealoLinks(page.text,profile.name,profile.variant).map(async r=>parseIdealo((await fetchText(r.url)).text,r)));rows=details.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);}
    return {...s,count:rows.length,status:rows.length?'ok':'empty',message:rows.length?'Öffentliche Preise gelesen.':'Keine passenden, auslesbaren Angebote gefunden.',rows};
  }));
  const sources=all.map((r,i)=>r.status==='fulfilled'?r.value:{...endpoints[i],count:0,status:'error',message:r.reason.message,rows:[]});
  const browserSources=[{source:'eBay gebraucht',url:'https://www.ebay.de/sch/i.html?_nkw='+encodeURIComponent(q)+'&LH_ItemCondition=3000',status:'browser',message:'Angebote im Browser vergleichen; keine automatische Preisübernahme.',count:0},{source:'eBay verkauft',url:'https://www.ebay.de/sch/i.html?_nkw='+encodeURIComponent(q)+'&LH_Sold=1&LH_Complete=1',status:'browser',message:'Verkaufte Angebote prüfen; ein akzeptierter Preisvorschlag kann verborgen sein.',count:0}];
  return {...summarizePrices([...sources.flatMap(s=>s.rows),...(profile.comparisons||[])],profile),sources:[...sources.map(({rows,...s})=>s),...browserSources]};
}
export async function valueSet(input,fetchText=fetchPublicText){
  const profile=normalizeRequest(input),checked=new Date().toISOString();
  const base=await collect(profile,fetchText);
  const accessories=[];
  // At most two accessory searches at once to bound load on low-memory HA hosts.
  for(let i=0;i<profile.accessories.length;i+=2){const results=await Promise.all(profile.accessories.slice(i,i+2).map(async a=>({...a,...(a.manualValue!==undefined?{estimate:{value:a.manualValue,low:a.manualValue,high:a.manualValue,count:0,confidence:'gering'},basis:'manual',sources:[],evidence:[],used:[],reason:'Dein eigener Stückwert; nicht durch Online-Angebote bestätigt.'}:await collect({name:a.name,condition:a.condition,variant:a.variant,contents:'',issues:''},fetchText))})));accessories.push(...results);}
  const complete=Boolean(base.estimate)&&accessories.every(a=>a.estimate);
  const components=[{...base,quantity:profile.quantity},...accessories];
  const sum=key=>round(components.reduce((n,c)=>n+c.estimate[key]*c.quantity,0));
  return {profile,checked,base,accessories,estimate:complete?{value:sum('value'),low:sum('low'),high:sum('high'),confidence:accessories.length||components.some(c=>c.estimate.confidence==='gering')?'gering':'mittel'}:null,kind:components.some(c=>c.basis==='manual')?'Online & eigene Stückwerte':components.some(c=>c.basis==='user-reference')?'Eigene Vergleichsangebote':components.some(c=>c.basis==='dealer-used')?'Händlerorientierung':'Private Angebotspreise',message:complete?'Set aus Gerät und separat bewerteten Extras. Standardzubehör erhält keinen pauschalen Aufschlag.':'Noch kein vollständiger Setwert. Sieh dir die einzelnen Geräte und Quellen an oder nutze eine eigene Einschätzung.',warnings:['Angebotspreise, keine nachgewiesenen Verkaufspreise.','Rechnung, Akku, Defekte und Lieferumfang nur berücksichtigt, wenn die verwendeten Angebotsbeschreibungen dazu passen.']};
}
