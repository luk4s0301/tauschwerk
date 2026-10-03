// Parses fetched documents as data. No website scripts are executed.
import {isExcludedSource} from './online-sources.mjs';
import crypto from 'node:crypto';

export function decodeEntities(s) {
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',thinsp:' ',ensp:' ',emsp:' ',ndash:'–',mdash:'—',times:'×',deg:'°',micro:'µ',Prime:'″',prime:'′',hellip:'…',trade:'™',reg:'®',copy:'©',auml:'ä',ouml:'ö',uuml:'ü',Auml:'Ä',Ouml:'Ö',Uuml:'Ü',szlig:'ß'};
  return String(s ?? '').replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi,(match,key)=>{
    if(key[0]==='#'){const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}
    return entities[key] ?? match;
  });
}
export function textOnly(html) {
  return decodeEntities(String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<(?:br|\/li|\/p|\/div)\b[^>]*>/gi,'; ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').replace(/\s*;\s*/g,'; ').replace(/(?:;\s*)+/g,'; ').replace(/^;\s*|;\s*$/g,'').trim();
}
const aliases = new Map(Object.entries({
  display:'Display',screen:'Display',bildschirm:'Display',displays:'Display',auflösung:'Auflösung',resolution:'Auflösung','display resolution':'Auflösung',
  cpu:'Prozessor',processor:'Prozessor',prozessor:'Prozessor',chip:'Prozessor',chipset:'Prozessor',soc:'Prozessor','system on chip':'Prozessor',
  gpu:'Grafik',graphics:'Grafik',grafik:'Grafik',ram:'Arbeitsspeicher',memory:'Arbeitsspeicher',arbeitsspeicher:'Arbeitsspeicher',
  storage:'Speicher',capacity:'Speicher',kapazität:'Speicher',speicher:'Speicher',datenspeicher:'Speicher',
  battery:'Akku',akku:'Akku',batterie:'Akku',weight:'Gewicht',gewicht:'Gewicht',mass:'Gewicht',
  dimensions:'Abmessungen',abmessungen:'Abmessungen','size and weight':'Abmessungen und Gewicht','abmessungen und gewicht':'Abmessungen und Gewicht',
  'operating system':'Betriebssystem',os:'Betriebssystem',betriebssystem:'Betriebssystem',
  connectivity:'Verbindungen',wireless:'Funkverbindungen',anschlüsse:'Anschlüsse',ports:'Anschlüsse',
  camera:'Kamera',rear:'Rückkamera','rear camera':'Rückkamera','front camera':'Frontkamera',front:'Frontkamera',kamera:'Kamera',
  'refresh rate':'Bildwiederholrate',bildwiederholrate:'Bildwiederholrate',clock:'Takt',speed:'Takt',socket:'Sockel',sockel:'Sockel',
  manufacturer:'Hersteller',hersteller:'Hersteller',developer:'Entwickler',entwickler:'Entwickler',brand:'Marke',marke:'Marke',
  type:'Typ',typ:'Typ',release:'Veröffentlichung','release date':'Veröffentlichung',veröffentlichung:'Veröffentlichung',
  'predecessor':'Vorgänger','successor':'Nachfolger','website':'Website','webseite':'Website',charging:'Laden',laden:'Laden',
  'audio technology':'Audiotechnik','dust, sweat, and water resistant':'Schutz',schutz:'Schutz','splash, water, and dust resistant':'Schutz',
  'battery and power':'Akku und Stromversorgung','power and battery life':'Akku und Laufzeit','battery life':'Laufzeit',
  cores:'Kerne',threads:'Threads',cache:'Cache',architecture:'Architektur',architektur:'Architektur',tdp:'TDP',
  'base clock':'Basistakt','boost clock':'Boosttakt','memory size':'Grafikspeicher','memory type':'Speichertyp','memory bus':'Speicherinterface',
  'cpu cores':'Kerne','cpu threads':'Threads','cpu frequency':'Basistakt','turbo frequency':'Boosttakt','memory capacity':'Speicherkapazität',
  'water resistance':'Wasserschutz','bluetooth version':'Bluetooth','sensor':'Sensor','sensors':'Sensoren','lens':'Objektiv',
  'hauptprozessor':'Prozessor','äußere abmessungen':'Abmessungen','speicherkapazität*':'Speicherkapazität','leistungsaufnahme':'Leistungsaufnahme',
  'main camera':'Hauptkamera','selfie camera':'Frontkamera','ram size':'Arbeitsspeicher','ram type':'RAM-Typ','storage size':'Speicher',
  'storage type':'Speichertyp','aspect ratio':'Seitenverhältnis','size':'Größe','aperture':'Blende','frequency':'Takt',
  'video recording':'Videoaufnahme','adaptive refresh rate':'Adaptive Bildwiederholrate','max rated brightness':'Maximale Helligkeit',
  'max rated brightness in hdr':'Maximale HDR-Helligkeit','pixel density':'Pixeldichte','charging power':'Ladeleistung',
  'wireless charging':'Kabelloses Laden','fast charging':'Schnellladen','reverse charging':'Umgekehrtes Laden','battery type':'Akkutyp'
}));
export function canonicalKey(key) {const k=textOnly(key).replace(/[:\s]+$/,'').trim();return aliases.get(k.toLocaleLowerCase('de-DE')) || k;}
function parseTree(html) {
  const root={tag:'#root',attrs:'',children:[],parent:null};const stack=[root];
  const source=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const tokens=source.match(/<[^>]*>|[^<]+/g) || [];
  const voidTags=new Set(['br','hr','img','input','meta','link','source','area','base','wbr','embed','param']);
  for(const token of tokens){
    if(token.startsWith('</')){const tag=token.match(/^<\/\s*([^\s>]+)/)?.[1].toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}}
    else if(token.startsWith('<')){const m=token.match(/^<\s*([a-z][\w:-]*)\b([^>]*)>/i);if(!m)continue;const node={tag:m[1].toLowerCase(),attrs:m[2],children:[],parent:stack.at(-1)};stack.at(-1).children.push(node);if(!voidTags.has(node.tag)&&!token.endsWith('/>'))stack.push(node);}
    else stack.at(-1).children.push({tag:'#text',text:token,parent:stack.at(-1)});
  }
  return root;
}
function* descendants(node,tag){for(const child of node.children || []){if(child.tag===tag)yield child;yield* descendants(child,tag);}}
function nodeText(node){
  if(['sup','style','script','nav','footer','noscript'].includes(node.tag))return '';
  if(/(?:^|\s)adj(?:\s|$)/.test(attr(node,'class')))return '';
  if(node.tag==='#text')return decodeEntities(node.text);
  if(node.tag==='br')return '; ';
  if(node.tag==='small')return ' '+(node.children||[]).map(nodeText).join('');
  return (node.children||[]).map(nodeText).join(['li','p','div'].includes(node.tag)?' ':'')+(['li','p'].includes(node.tag)?'; ':'');
}
function cleanNode(node){return nodeText(node).replace(/\s+/g,' ').replace(/(?:;\s*)+/g,'; ').replace(/^;\s*|;\s*$/g,'').trim();}
function ancestor(node,tag){let p=node.parent;while(p){if(p.tag===tag)return p;p=p.parent;}return null;}
function attr(node,name){const m=(node.attrs||'').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));return decodeEntities(m?.[1] || m?.[2] || m?.[3] || '');}
function flattenJSON(value,products=[],depth=0){if(depth>15||!value||typeof value!=='object')return products;if(Array.isArray(value)){for(const v of value)flattenJSON(v,products,depth+1);return products;}if([value['@type']].flat().some(t=>t==='Product'||t==='ProductModel'))products.push(value);for(const [key,v] of Object.entries(value))if(key!=='@context')flattenJSON(v,products,depth+1);return products;}
function schemaValue(value){if(value===null||value===undefined)return '';if(typeof value!=='object')return String(value);if(Array.isArray(value))return value.map(schemaValue).filter(Boolean).join(' / ');if(value.value!==undefined)return `${schemaValue(value.value)} ${value.unitText || value.unitCode || ''}`.trim();return value.name || '';}
function guessCategory(name,description,specs,url=''){
  const path=new URL(url||'https://example.com').pathname;
  if(/^\/en\/phone\//.test(path))return 'Handys';
  if(/^\/en\/cpu-/.test(path))return 'Prozessoren';
  if(/^\/en\/gpu-/.test(path))return 'Grafikkarten';
  if(/\/ps[345]\//.test(path))return 'Konsolen';
  const primary=name.toLowerCase();
  if(/watch|fenix|fēnix|forerunner|venu|vantage|suunto|fitbit/.test(primary))return 'Uhren';
  if(/ipad|tablet|galaxy tab/.test(primary))return 'Tablets';
  if(/airpods|headphone|kopfhörer|earbud|soundbar|wh-\d|wf-\d/.test(primary))return 'Audio';
  if(/fernseher|television|\btv\b/.test(primary))return 'Fernseher';
  if(/camera|kamera|canon|nikon|lumix|gopro|\bdji\b/.test(primary))return 'Kameras';
  if(/ssd|hdd|kingston|crucial|seagate|western digital/.test(primary))return 'Speicher';
  if(/keyboard|tastatur|mouse|maus|mainboard|router/.test(primary))return 'PC-Zubehör';
  if(/dyson|roborock|vacuum|staubsauger|waschmaschine/.test(primary))return 'Haushalt';
  const text=(name+' '+description+' '+specs.map(s=>s.key+' '+s.value).join(' ')).toLowerCase();
  if(/smartwatch|apple watch|galaxy watch|armbanduhr|fitbit/.test(text))return 'Uhren';
  if(/iphone|smartphone|galaxy s\d|pixel \d|mobiltelefon/.test(text))return 'Handys';
  if(/playstation|xbox|nintendo|steam deck|game console|spielkonsole/.test(text))return 'Konsolen';
  if(/macbook|laptop|notebook|thinkpad|zenbook|vivobook|elitebook|ideapad|yoga|xps|latitude/.test(text))return 'Laptops';
  if(/geforce|radeon|graphics card|grafikkarte/.test(text))return 'Grafikkarten';
  if(/ryzen|core i[3579]|core ultra|desktop processor/.test(text))return 'Prozessoren';
  if(/ipad|tablet/.test(text))return 'Tablets';
  if(/airpods|headphone|kopfhörer|earbud|loudspeaker|lautsprecher/.test(text))return 'Audio';
  if(/monitor|fernseher|television/.test(text))return 'Monitore';
  return 'Sonstiges';
}
function guessBrand(name,specs){const explicit=specs.find(s=>['Marke','Hersteller'].includes(s.key))?.value;if(explicit)return explicit.slice(0,300);const brands=[[/iphone|ipad|macbook|airpods|apple watch/i,'Apple'],[/galaxy|samsung/i,'Samsung'],[/asus|zenbook|vivobook/i,'ASUS'],[/lenovo|thinkpad|ideapad/i,'Lenovo'],[/dell|xps|latitude/i,'Dell'],[/\bhp\b|elitebook|probook/i,'HP'],[/acer|swift|predator/i,'Acer'],[/\bmsi\b/i,'MSI'],[/surface|xbox/i,'Microsoft'],[/framework/i,'Framework'],[/razer/i,'Razer'],[/geforce|nvidia/i,'NVIDIA'],[/ryzen|radeon|amd/i,'AMD'],[/intel|core i[3579]|core ultra/i,'Intel'],[/playstation|sony/i,'Sony'],[/nintendo|switch/i,'Nintendo'],[/steam deck/i,'Valve'],[/pixel/i,'Google']];return (brands.find(([re])=>re.test(name))?.[1] || specs.find(s=>s.key==='Entwickler')?.value || '').slice(0,300);}

// Match the actual model, ignoring storage/colour suffixes but retaining Pro/Max/Ultra.
export function imageModelMatches(requested,candidate) {
  const tokens=s=>textOnly(s).split(/\s*[·|]\s*/)[0].replace(/(\d+)\s*(?:gb|tb)\b/ig,'').replace(/\+/g,' plus ').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean);
  const wanted=tokens(requested).filter(t=>!['apple','samsung','sony','microsoft','google','nvidia','amd','intel','valve','technical','specifications','technische','daten'].includes(t));
  const actual=tokens(candidate);
  const variants=['pro','max','ultra','plus','mini','lite','air','fe'];
  const gpuVendors=['asus','msi','gigabyte','aorus','zotac','palit','gainward','sapphire','powercolor','xfx'];
  const genericGPU=wanted.length===3&&['geforce','radeon'].includes(wanted[0]);
  const gpuExact=!genericGPU||actual.every(t=>wanted.includes(t)||['nvidia','amd','graphics','card','cards','specs','specifications','technical','technische','daten','benchmark','benchmarks','and'].includes(t));
  return wanted.length>0&&wanted.every(t=>actual.includes(t))&&variants.every(t=>!actual.includes(t)||wanted.includes(t))&&gpuExact&&(!wanted.some(t=>['geforce','radeon'].includes(t))||gpuVendors.every(t=>!actual.includes(t)||wanted.includes(t)));
}
export function extractImageCandidates(html,url,{name,provider='website'}={}) {
  if(isExcludedSource(url)||provider==='wikipedia')return [];
  const tree=parseTree(html),candidates=[];
  const add=(value,alt='',score=0)=>{
    if(!value||/logo|favicon|sprite|banner|badge|chart|benchmark|graph|tracking|localnav|icon[_-]|size_and_weight|diagram|pixel\.gif|\.svg(?:\?|$)/i.test(value+' '+alt))return;
    let imageURL;try{imageURL=new URL(value,url);if(isExcludedSource(imageURL.href)||imageURL.protocol!=='https:'||imageURL.username||imageURL.password)return;}catch{return;}
    if(!candidates.some(c=>c.url===imageURL.href))candidates.push({url:imageURL.href,alt:alt||name,score});
  };
  for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{for(const p of flattenJSON(JSON.parse(script[1])))if(imageModelMatches(name,p.name||''))for(const img of [p.image||[]].flat()){add(typeof img==='string'?img:img?.contentUrl||img?.url,p.name,100);}}catch{}
  }
  const metas=[...descendants(tree,'meta')];
  const meta=key=>attr(metas.find(n=>attr(n,'property')===key||attr(n,'name')===key)||{},'content');
  const pageName=meta('og:title')||textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'')||cleanNode([...descendants(tree,'h1')][0]||{children:[]});
  const pageMatches=imageModelMatches(name,pageName);
  for(const img of descendants(tree,'img')){
    if(ancestor(img,'nav')||ancestor(img,'footer'))continue;
    const alt=attr(img,'alt');const src=attr(img,'data-src')||attr(img,'src');
    const isModel=imageModelMatches(name,alt)||imageModelMatches(name,src.split('/').at(-1));
    if(isModel){const width=Number(attr(img,'width')),height=Number(attr(img,'height'));if(width&&width<60||height&&height<60)continue;add(src,alt,90);}
  }
  if(pageMatches){add(meta('og:image:secure_url')||meta('og:image'),meta('og:image:alt')||name,80);add(meta('twitter:image'),meta('twitter:image:alt')||name,75);}
  return candidates.sort((a,b)=>b.score-a.score).slice(0,8);
}

export function extractDevice(html,url,{title='',provider='website',description=''}={}) {
  if(isExcludedSource(url)||provider==='wikipedia')throw new Error('Diese Quelle ist ausgeschlossen. Nutze eine Herstellerseite, Geizhals oder eine Fachquelle.');
  const specs=[];const add=(key,value)=>{key=canonicalKey(key).slice(0,100);value=textOnly(value).slice(0,2000);if(!key||!value||key.length>100||/^(?:edit|bearbeiten|references|einzelnachweise|contents|inhalt|navigation|privacy|datenschutz)$/i.test(key))return;const existing=specs.find(s=>s.key.toLowerCase()===key.toLowerCase());if(existing){if(existing.value!==value&&!existing.value.includes(value)&&existing.value.length+value.length<2000)existing.value+=' / '+value;}else if(specs.length<100)specs.push({key,value,source:url});};
  let product;
  for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{const products=flattenJSON(JSON.parse(script[1]));if(products.length){product=products.sort((a,b)=>((b.additionalProperty||b.specification)?1:0)-((a.additionalProperty||a.specification)?1:0))[0];break;}}catch{}
  }
  if(product){
    title=product.name || title;description=textOnly(product.description || description).slice(0,1500);
    for(const prop of [product.additionalProperty || [],product.specification || []].flat(2))if(prop&&typeof prop==='object')add(prop.name || prop.propertyID,schemaValue(prop.value)+(prop.unitText?' '+prop.unitText:''));
    if(product.brand)add('Hersteller',schemaValue(product.brand));
    for(const [key,label] of Object.entries({model:'Modell',weight:'Gewicht',height:'Höhe',width:'Breite',depth:'Tiefe',color:'Farbe',sku:'Modellnummer',gtin13:'EAN',material:'Material'}))if(product[key]!==undefined)add(label,schemaValue(product[key]));
  }
  const tree=parseTree(html);
  {
    // Definition lists used by manufacturer support and specification pages.
    for(const dl of descendants(tree,'dl')){
      if(provider==='gpu-monkey'&&/\bkpis\b/.test(attr(dl,'class')))continue;
      for(const dt of descendants(dl,'dt')){
        if(ancestor(dt,'dl')!==dl)continue;
        const siblings=dt.parent.children;const dd=siblings.slice(siblings.indexOf(dt)+1).find(n=>n.tag==='dd'||n.tag==='dt');
        const label=cleanNode(dt);
        if(dd?.tag==='dd'&&label.length<=100&&(aliases.has(label.toLowerCase().replace(/:$/,''))||['gpu-monkey','geizhals'].includes(provider)))add(provider==='gpu-monkey'&&label==='Memory'?'Grafikspeicher':label,cleanNode(dd));
      }
    }
  }
  if(provider==='laptopmedia'){
    const list=[...descendants(tree,'ul')].find(n=>/(?:^|\s)lm-specs-table(?:\s|$)/.test(attr(n,'class')));
    const labels={cpu:'Prozessor',gpu:'Grafik',display:'Display',storage:'Speicher',ram:'Arbeitsspeicher',weight:'Gewicht',battery:'Akku',os:'Betriebssystem'};
    for(const row of list?.children || []){const kind=attr(row,'class').match(/(?:^|\s)(\w+)-specs(?:\s|$)/)?.[1];if(labels[kind])add(labels[kind],cleanNode(row));}
    const pageTitle=textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s*\|\s*LaptopMedia\.com.*$/i,'');
    if(pageTitle)title=pageTitle;
  }
  const tables=[...descendants(tree,'table')];const info=tables.filter(t=>/infobox|infotable|hintergrundfarbe5/i.test(attr(t,'class')));
  const candidates=info.length?info:tables;
  const nanoSections=provider==='nanoreview'?[...html.matchAll(/<table\b[^>]*class=["'][^"']*specs-table[^"']*["'][^>]*>/gi)].map(m=>{const before=html.slice(0,m.index);return textOnly([...before.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].at(-1)?.[1]||'');}):[];
  let nanoIndex=0;
  for(const table of candidates){
    if(provider==='nanoreview'&&!/\bspecs-table\b/.test(attr(table,'class')))continue;
    const section=nanoSections[nanoIndex++]||'';
    for(const row of descendants(table,'tr')){if(ancestor(row,'table')!==table)continue;const cells=(row.children||[]).filter(n=>['td','th'].includes(n.tag));if(cells.length!==2||cells.every(c=>c.tag==='th'))continue;let key=cleanNode(cells[0]);const value=cleanNode(cells[1]);if(provider==='nanoreview'&&section&&/^(?:type|size|capacity|resolution|aperture|sensor|video recording|frequency|cores)$/i.test(key))key=canonicalKey(section)+' · '+canonicalKey(key);if(key.length<=100&&key.length>0&&value&&!/^(?:price|preis|buy|kaufen|property)$/i.test(key))add(key,value);}
  }
  // Accessible div tables (used by official console and accessory data sheets).
  let accessibleTable;
  for(const row of descendants(tree,'div')){
    if(attr(row,'role')!=='row')continue;
    const cells=(row.children||[]).filter(n=>['cell','rowheader','columnheader'].includes(attr(n,'role')));
    let container=row.parent;while(container&&!attr(container,'role').split(/\s+/).includes('table'))container=container.parent;
    if(cells.length!==2||!container)continue;
    accessibleTable||=container;if(container!==accessibleTable)continue;
    add(cleanNode(cells[0]),cleanNode(cells[1]));
  }
  // Public manufacturer support pages often use headings and lists rather than tables.
  if(!['nanoreview','gpu-monkey','cpu-monkey'].includes(provider)) {
    const headings=[...html.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
    for(let i=0;i<headings.length;i++){
      const m=headings[i],key=canonicalKey(m[2]);
      if(!aliases.has(textOnly(m[2]).toLowerCase().trim())&&!/^(?:technische daten|technical specifications|specifications|anschlüsse|schutz vor wasser und staub|drahtlose technologien)$/i.test(textOnly(m[2])))continue;
      const section=html.slice(m.index+m[0].length,headings[i+1]?.index ?? Math.min(html.length,m.index+15000));
      const clean=textOnly(section);if(clean&&clean.length<12000)add(key,clean);
    }
  }
  const pageTitle=textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  if(accessibleTable){const productName=specs.find(s=>s.key==='Produktname')?.value;if(productName&&/technische spezifikationen|technical specifications/i.test(pageTitle))title=productName;}
  title=textOnly(title || (provider==='manufacturer'?pageTitle:'') || cleanNode([...descendants(tree,'h1')][0] || {children:[]}) || pageTitle).replace(/\s*[–|]\s*Apple Support.*$/i,'').replace(/\s*;?\s*(?:Benchmarks?\s*(?:&|and)\s*Specs|Benchmark and Specs).*$/i,'').slice(0,300);
  if(!title)throw new Error('Auf dieser Seite wurde kein Gerätename gefunden. Versuche ein direktes Datenblatt.');
  if(!specs.length)throw new Error('Die Seite liefert keine auslesbaren technischen Merkmale. Versuche eine andere Quelle oder ergänze das Gerät manuell.');
  const brand=guessBrand(title,specs),category=guessCategory(title,description,specs,url);
  const retrievedAt=new Date().toISOString();
  return {id:'web-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,20),name:title,brand,category,source:url,sourceType:provider,
    specs,notes:description?description+'\n\nAutomatisch aus der verlinkten Quelle übernommen. Modell und Varianten vor einem Tausch prüfen.':'Automatisch aus der verlinkten Quelle übernommen. Modell und Varianten prüfen.',value:null,offers:[],checked:retrievedAt.slice(0,10),
    provenance:{provider,retrievedAt,attribution:'Quelle: '+new URL(url).hostname,needsReview:true}};
}
