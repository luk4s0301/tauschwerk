import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDeviceQuery,classifySource} from '../online-sources.mjs';
import {matchesQuery,parseGoogle} from '../online-search.mjs';
import {searchOnline,retrieveOnline,findDeviceImage} from '../online.mjs';
import {extractImageCandidates,imageModelMatches,extractDevice} from '../online-parser.mjs';
import {validateStore} from '../core.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
const image=async url=>({url,bytes:png,contentType:'image/png'});
const rss=rows=>'<rss>'+rows.map(([title,url])=>`<item><title>${title}</title><link>${url}</link></item>`).join('')+'</rss>';
const row=title=>({title,url:'https://example.com/',description:''});

test('Switch 1 und RTX-Schreibweisen werden normalisiert, Generationen bleiben getrennt',()=>{
  assert.equal(normalizeDeviceQuery('Switch 1'),'Nintendo Switch');assert.equal(normalizeDeviceQuery('Nintendo Switch 1'),'Nintendo Switch');
  assert.equal(normalizeDeviceQuery('RTX40 60'),'RTX 4060');assert.equal(normalizeDeviceQuery('RTX4060'),'RTX 4060');
  assert.ok(matchesQuery(row('Nintendo Switch'),'Switch 1'));assert.ok(matchesQuery(row('NVIDIA GeForce RTX 4060'),'RTX40 60'));
  for(const variant of ['Nintendo Switch 2','Nintendo Switch OLED','Nintendo Switch Lite']){
    assert.equal(matchesQuery(row(variant),'Nintendo Switch 1'),false);assert.equal(imageModelMatches('Nintendo Switch 1',variant),false);
  }
  assert.ok(matchesQuery(row('Nintendo Switch 2'),'Switch 2'));assert.equal(matchesQuery(row('Nintendo Switch'),'Switch 2'),false);
  assert.equal(normalizeDeviceQuery('Nintendo Switch2'),'Nintendo Switch 2');
  for(const variant of ['NVIDIA GeForce RTX 4060 Ti','NVIDIA GeForce RTX 4060 Super']){assert.equal(matchesQuery(row(variant),'RTX4060'),false);assert.equal(imageModelMatches('GeForce RTX 4060',variant),false);}
  assert.equal(matchesQuery(row('PlayStation 4'),'PS5'),false);
});
test('Nintendo-Regionaldomains sind offizielle Quellen; Namensähnlichkeit reicht nicht',()=>{
  for(const host of ['www.nintendo.com','www.nintendo.de','www.nintendo.co.uk','www.nintendo.co.jp'])assert.equal(classifySource('https://'+host+'/hardware').manufacturer,'nintendo');
  assert.equal(classifySource('https://nintendo.co.uk.example.com/hardware').kind,'website');
});
test('Auch freie Katalogbegriffe lösen echte Webanbieter-Anfragen aus',async()=>{
  const requests=[];const answer=await searchOnline('Unbekanntes Messgerät QX900','en',{},async url=>{
    const u=new URL(url);requests.push(u);return {text:rss([['Unbekanntes Messgerät QX900','https://unknown-maker.example/qx900']])};
  });
  assert.ok(requests.some(u=>u.hostname.includes('bing.com')));assert.ok(requests.some(u=>u.hostname.includes('duckduckgo.com')));
  assert.equal(answer.results.length,1);assert.equal(answer.results[0].browserOnly,false);
});
test('Google-Fallback lädt nach dem Ausfall beider Webanbieter und behält Sperrhinweise',async()=>{
  const answer=await searchOnline('Nintendo Switch 1','en',{source:'web'},async url=>{
    if(new URL(url).hostname==='www.google.com')return {text:'<a href="/url?q=https%3A%2F%2Fwww.nintendo.co.uk%2Fswitch%2Fhardware"><h3>Nintendo Switch</h3></a>'};
    throw Error('Test: Webanbieter nicht erreichbar');
  });
  assert.equal(answer.results[0].provider,'manufacturer');assert.equal(answer.query,'Nintendo Switch');assert.ok(answer.warnings.some(w=>w.includes('nicht erreichbar')));
  assert.deepEqual(parseGoogle('<a href="https://127.0.0.1"><h3>Privat</h3></a><a href="https://en.wikipedia.org/wiki/Switch"><h3>Wiki</h3></a>'),[]);
});
test('Auch unpassende Treffer der ersten Suchanbieter lösen die Ersatz-Websuche aus',async()=>{
  const answer=await searchOnline('RTX4060','en',{source:'web'},async url=>({text:new URL(url).hostname==='www.google.com'?'<a href="https://www.nvidia.com/rtx-4060/"><h3>NVIDIA GeForce RTX 4060</h3></a>':rss([['GeForce RTX 4090','https://nvidia.com/rtx-4090/']])}));assert.equal(answer.results[0].title,'NVIDIA GeForce RTX 4060');
});
test('Nintendo-Divtabellen lassen sich direkt im Programm auslesen',async()=>{
  const url='https://www.nintendo.co.uk/Hardware/Nintendo-Switch-2/Specifications.html';
  const html='<h1>Nintendo Switch 2</h1><div class="table-row"><div>CPU/GPU</div><div>Custom NVIDIA processor</div></div><div class="table-row"><div>Internal storage</div><div>256 GB</div></div><meta property="og:image" content="/switch2.png">';
  const {device}=await retrieveOnline(url,{expectedModel:'Switch 2',fetchImage:image},async()=>({text:html,url}));
  assert.equal(device.category,'Konsolen');assert.equal(device.specs.find(s=>s.key==='Speicher').value,'256 GB');assert.ok(device.image);validateStore({version:1,devices:[device],trades:[]});
});
test('Produktseite ohne Daten verfolgt technischen Herstellerlink; kein separater Browser nötig',async()=>{
  const url='https://www.nintendo.com/switch2/';const linked='https://www.nintendo.com/switch2/tech-specs/';
  const {device,warnings}=await retrieveOnline(url,{expectedModel:'Switch 2',fallback:true,fetchImage:image},async input=>({url:input,text:input===url?'<h1>Nintendo Switch 2</h1><a href="tech-specs/">Technical specifications</a>':'<h1>Nintendo Switch 2</h1><dl><dt>Storage</dt><dd>256 GB</dd></dl>'}));
  assert.equal(device.source,linked);assert.ok(warnings.some(w=>w.includes(linked)));assert.ok(device.specs.every(s=>s.source===linked));
});
test('Gesperrte Quelle fällt auf auslesbare Daten desselben Modells zurück und kennzeichnet sie',async()=>{
  const url='https://www.nintendo.com/switch2/';const alternative='https://geizhals.de/nintendo-switch-2-a123.html';
  const answer=await retrieveOnline(url,{expectedModel:'Nintendo Switch 2',fallback:true,fetchImage:image},async input=>{
    if(input===url)throw Error('403');
    if(input===alternative)return {url:input,text:'<h1>Nintendo Switch 2</h1><dl><dt>Storage</dt><dd>256 GB</dd></dl>'};
    return {text:rss([['Nintendo Switch 2',alternative]])};
  });
  assert.equal(answer.device.source,alternative);assert.ok(answer.warnings.some(w=>w.includes('stattdessen')));
});
test('Fallback nimmt keine andere Switch-Generation und umgeht keine ausgeschlossenen Links',async()=>{
  let calls=0;
  await assert.rejects(()=>retrieveOnline('https://en.wikipedia.org/wiki/Switch',{expectedModel:'Switch',fallback:true},async()=>{calls++;}),/ausgeschlossen/);assert.equal(calls,0);
  await assert.rejects(()=>retrieveOnline('https://nintendo.com/switch/',{expectedModel:'Switch 1',fallback:true},async url=>({url,text:url.includes('nintendo.com')?'<h1>Nintendo Switch 2</h1><dl><dt>Storage</dt><dd>256 GB</dd></dl>':rss([['Nintendo Switch 2','https://nintendo.com/switch2/']])})),/nicht eindeutig/);
});
test('Responsive Modellbilder und H1 funktionieren bei allgemeinem Social-Titel',()=>{
  const html='<title>Nintendo Hardware</title><meta property="og:title" content="Nintendo Hardware"><h1>Nintendo Switch</h1><div class="product-gallery"><picture><source srcset="/small.png 400w, /large.png 1600w"><img src="/large.png" alt=""></picture></div><aside><img alt="Nintendo Switch" src="/recommended.png"></aside>';
  const candidates=extractImageCandidates(html,'https://www.nintendo.com/switch/',{name:'Switch 1'});assert.equal(candidates[0].url,'https://www.nintendo.com/small.png');assert.ok(!candidates.some(c=>c.url.includes('recommended')));
});
test('Webbildsuche prüft weitere passende Quellen, auch bisherige Browser-only-Webtreffer',async()=>{
  const urls=[1,2,3,4].map(i=>'https://manufacturer'+i+'.example/switch');
  const answer=await findDeviceImage('Nintendo Switch 1','',{fetchImage:image,fetchText:async input=>{
    if(urls.includes(input))return {url:input,text:'<h1>Nintendo Switch</h1>'+(input===urls[3]?'<img alt="Nintendo Switch" src="/model.png">':'')};
    return {text:rss(urls.map(url=>['Nintendo Switch',url]))};
  }});
  assert.equal(answer.image.source,urls[3]);
});
test('Geräteimport ergänzt fehlendes Quellenbild automatisch aus weiteren Webquellen',async()=>{
  const url='https://nintendo.com/switch/';const pictures='https://retailer.example/nintendo-switch';
  const answer=await retrieveOnline(url,{expectedModel:'Switch 1',enrichImages:true,fetchImage:image},async input=>{
    if(input===url)return {url:input,text:'<h1>Nintendo Switch</h1><dl><dt>Storage</dt><dd>32 GB</dd></dl>'};
    if(input===pictures)return {url:input,text:'<h1>Nintendo Switch</h1><meta property="og:image" content="/product.png">'};
    return {text:rss([['Nintendo Switch',pictures]])};
  });assert.equal(answer.device.source,url);assert.equal(answer.device.image.source,pictures);
});
test('Technische Definitionen unbekannter Geräte sind ohne feste Kategorie auslesbar',()=>{
  const d=extractDevice('<h1>QX900 Sensor</h1><dl><dt>Messbereich</dt><dd>0–100 °C</dd></dl>','https://unknown-maker.example/qx900');assert.equal(d.specs[0].key,'Messbereich');assert.equal(d.category,'Sonstiges');
});
