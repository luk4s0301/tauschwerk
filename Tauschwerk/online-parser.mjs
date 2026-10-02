// Parses fetched documents as data. No website scripts are executed.
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
  cores:'Kerne',threads:'Threads',cache:'Cache',architecture:'Architektur',architektur:'Architektur',tdp:'TDP'
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
  if(node.tag==='#text')return decodeEntities(node.text);
  if(node.tag==='br')return '; ';
  return (node.children||[]).map(nodeText).join(['li','p','div'].includes(node.tag)?' ':'')+(['li','p'].includes(node.tag)?'; ':'');
}
function cleanNode(node){return nodeText(node).replace(/\s+/g,' ').replace(/(?:;\s*)+/g,'; ').replace(/^;\s*|;\s*$/g,'').trim();}
function ancestor(node,tag){let p=node.parent;while(p){if(p.tag===tag)return p;p=p.parent;}return null;}
function attr(node,name){const m=node.attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));return decodeEntities(m?.[1] || m?.[2] || m?.[3] || '');}
function flattenJSON(value,products=[],depth=0){if(depth>15||!value||typeof value!=='object')return products;if(Array.isArray(value)){for(const v of value)flattenJSON(v,products,depth+1);return products;}if([value['@type']].flat().some(t=>t==='Product'||t==='ProductModel'))products.push(value);for(const [key,v] of Object.entries(value))if(key!=='@context')flattenJSON(v,products,depth+1);return products;}
function schemaValue(value){if(value===null||value===undefined)return '';if(typeof value!=='object')return String(value);if(Array.isArray(value))return value.map(schemaValue).filter(Boolean).join(' / ');if(value.value!==undefined)return `${schemaValue(value.value)} ${value.unitText || value.unitCode || ''}`.trim();return value.name || '';}
function guessCategory(name,description,specs){
  const text=(name+' '+description+' '+specs.map(s=>s.key+' '+s.value).join(' ')).toLowerCase();
  if(/smartwatch|apple watch|galaxy watch|armbanduhr|fitbit/.test(text))return 'Uhren';
  if(/geforce|radeon|graphics card|grafikkarte/.test(text))return 'Grafikkarten';
  if(/ryzen|core i[3579]|core ultra|desktop processor/.test(text))return 'Prozessoren';
  if(/iphone|smartphone|galaxy s\d|pixel \d|mobiltelefon/.test(text))return 'Handys';
  if(/playstation|xbox|nintendo|steam deck|game console|spielkonsole/.test(text))return 'Konsolen';
  if(/macbook|laptop|notebook|thinkpad/.test(text))return 'Laptops';
  if(/ipad|tablet/.test(text))return 'Tablets';
  if(/airpods|headphone|kopfhörer|earbud|loudspeaker|lautsprecher/.test(text))return 'Audio';
  if(/monitor|fernseher|television/.test(text))return 'Monitore';
  return 'Sonstiges';
}
function guessBrand(name,specs){const brands=[[/iphone|ipad|macbook|airpods|apple watch/i,'Apple'],[/galaxy|samsung/i,'Samsung'],[/geforce|nvidia/i,'NVIDIA'],[/ryzen|radeon|amd/i,'AMD'],[/intel|core i[3579]|core ultra/i,'Intel'],[/playstation|sony/i,'Sony'],[/xbox/i,'Microsoft'],[/nintendo|switch/i,'Nintendo'],[/steam deck/i,'Valve'],[/pixel/i,'Google']];const known=brands.find(([re])=>re.test(name))?.[1];const brand=known || specs.find(s=>['Marke','Entwickler','Hersteller'].includes(s.key))?.value || '';return brand.slice(0,300);}

export function extractDevice(html,url,{title='',provider='website',description=''}={}) {
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
  const tables=[...descendants(tree,'table')];const info=tables.filter(t=>/infobox|infotable|hintergrundfarbe5/i.test(attr(t,'class')));
  const candidates=provider==='wikipedia'?info:(info.length?info:tables);
  for(const table of candidates){
    for(const row of descendants(table,'tr')){if(ancestor(row,'table')!==table)continue;const cells=(row.children||[]).filter(n=>['td','th'].includes(n.tag));if(cells.length!==2)continue;const key=cleanNode(cells[0]),value=cleanNode(cells[1]);if(key.length<=100&&key.length>0&&value&&!/^(?:price|preis|buy|kaufen)$/i.test(key))add(key,value);}
  }
  // Public manufacturer support pages often use headings and lists rather than tables.
  if(provider!=='wikipedia') {
    const headings=[...html.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
    for(let i=0;i<headings.length;i++){
      const m=headings[i],key=canonicalKey(m[2]);
      if(!aliases.has(textOnly(m[2]).toLowerCase().trim())&&!/^(?:technische daten|technical specifications|specifications|anschlüsse|schutz vor wasser und staub|drahtlose technologien)$/i.test(textOnly(m[2])))continue;
      const section=html.slice(m.index+m[0].length,headings[i+1]?.index ?? Math.min(html.length,m.index+15000));
      const clean=textOnly(section);if(clean&&clean.length<12000)add(key,clean);
    }
  }
  title=textOnly(title || cleanNode([...descendants(tree,'h1')][0] || {children:[]}) || textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')).replace(/\s*[–|]\s*(?:Wikipedia|Apple Support).*$/i,'').slice(0,300);
  if(!title)throw new Error('Auf dieser Seite wurde kein Gerätename gefunden. Versuche ein direktes Datenblatt.');
  if(!specs.length)throw new Error('Die Seite liefert keine auslesbaren technischen Merkmale. Versuche eine andere Quelle oder ergänze das Gerät manuell.');
  const brand=guessBrand(title,specs),category=guessCategory(title,description,specs);
  const retrievedAt=new Date().toISOString();
  return {id:'web-'+crypto.createHash('sha256').update(url).digest('hex').slice(0,20),name:title,brand,category,source:url,sourceType:provider,
    specs,notes:description?description+'\n\nAutomatisch aus der verlinkten Quelle übernommen. Modell und Varianten vor einem Tausch prüfen.':'Automatisch aus der verlinkten Quelle übernommen. Modell und Varianten prüfen.',value:null,offers:[],checked:retrievedAt.slice(0,10),
    provenance:{provider,retrievedAt,attribution:provider==='wikipedia'?'Wikipedia-Mitwirkende, CC BY-SA; siehe Quelle und Versionsgeschichte.':'Quelle: '+new URL(url).hostname,needsReview:true}};
}
