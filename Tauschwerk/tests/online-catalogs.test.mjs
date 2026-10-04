import test from 'node:test';
import assert from 'node:assert/strict';
import {searchCatalog,searchManufacturerCatalog,catalogLinks} from '../online-catalogs.mjs';
import {searchOnline} from '../online.mjs';
import {extractDevice} from '../online-parser.mjs';
import {detectDeviceKind} from '../online-sources.mjs';
import {validateStore} from '../core.mjs';

test('Automatische Quellen richten sich nach dem Gerät, auch ohne Laptop',async()=>{
  const seen=[];
  const fetcher=async input=>{const u=new URL(input);seen.push(u);if(u.hostname==='nanoreview.net')return {text:JSON.stringify([{content_type:'phone',slug:'apple-iphone-17-pro',label:'Apple iPhone 17 Pro'},{content_type:'phone',slug:'apple-iphone-16-pro',label:'Apple iPhone 16 Pro'},{content_type:'phone',slug:'../../bad',label:'Apple iPhone 17 Pro'}])};return {text:'<html></html>'};};
  const answer=await searchOnline('iPhone 17 Pro','en',{},fetcher);
  assert.equal(answer.kind,'phones');assert.equal(answer.results.length,1);assert.equal(answer.results[0].sourceName,'NanoReview');assert.ok(seen.some(u=>u.pathname==='/api/search'));assert.ok(!seen.some(u=>u.hostname==='laptopmedia.com'));assert.ok(answer.searchedSources.includes('NanoReview'));
  assert.equal(detectDeviceKind('Apple Watch Series 12'),'watches');assert.equal(detectDeviceKind('Ryzen 7 9800X3D'),'cpu');assert.equal(detectDeviceKind('ASUS ROG Ally'),'consoles');assert.equal(detectDeviceKind('Canon EOS R5'),'cameras');
  await assert.rejects(()=>searchOnline('Testgerät','all',{kind:'unsafe'}),/Geräteart/);
});
test('Hardware-Suchformulare verwenden echte Parameter und konkrete Modellseiten',async()=>{
  let requested;
  const cpu=await searchCatalog('cpu-monkey','Ryzen 7 9800X3D','en',async url=>{requested=new URL(url);return {text:'<a href="/en/cpu-amd_ryzen_7_9800x3d">AMD Ryzen 7 9800X3D<span>8C 16T @ 4.70 GHz</span></a><a href="/en/cpu-amd_ryzen_7_7800x3d">AMD Ryzen 7 7800X3D</a>'};});
  assert.equal(requested.searchParams.get('suchwort'),'Ryzen 7 9800X3D');assert.equal(cpu.results.length,1);assert.equal(cpu.results[0].title,'AMD Ryzen 7 9800X3D');
  const gpu=await searchCatalog('gpu-monkey','RTX 5090','en',async url=>{requested=new URL(url);return {text:'<a href="/en/gpu-msi_geforce_rtx_5090">MSI GeForce RTX 5090</a><a href="/en/gpu-msi_geforce_rtx_5090">Specs</a><a href="https://evil.example/en/gpu-rtx_5090">RTX 5090</a>'};});
  assert.equal(requested.searchParams.get('q'),'RTX 5090');assert.equal(gpu.results.length,1);assert.equal(gpu.results[0].sourceName,'GPU-Monkey');
});
test('Produktverzeichnisse schließen fremde Domains und Ratgeber aus',async()=>{
  const r=await searchCatalog('rtings','Sony WH-1000XM5','en',async()=>({text:'<urlset><url><loc>https://www.rtings.com/headphones/reviews/sony/wh-1000xm5</loc></url><url><loc>https://evil.example/headphones/reviews/sony/wh-1000xm5</loc></url><url><loc>https://www.rtings.com/headphones/reviews/best/sony-wh-1000xm5</loc></url></urlset>'}));
  assert.equal(r.results.length,1);assert.equal(r.results[0].browserOnly,false);
  const maker=await searchManufacturerCatalog('Apple Watch Series 12','de','all',async()=>({text:'<urlset><loc>https://www.apple.com/de/apple-watch-series-12/specs/</loc><loc>https://www.apple.com/de/apple-watch-series-11/specs/</loc><loc>https://evil.example/de/apple-watch-series-12/specs/</loc></urlset>'}));
  assert.equal(maker.results.length,1);assert.equal(maker.results[0].manufacturer,'apple');
});
test('Grafikkarten: verschachtelte Merkmale, Einheiten und Abweichungs-Badges',()=>{
  const d=extractDevice('<h1>MSI GeForce RTX 5090</h1><dl><div><dt>Memory</dt><dd>32<small>GB GDDR7</small></dd></div><div><dt>Boost Clock</dt><dd>2.775 GHz<span class="adj up">+15 %</span></dd></div></dl>','https://www.gpu-monkey.com/en/gpu-msi_geforce_rtx_5090',{provider:'gpu-monkey'});
  assert.equal(d.category,'Grafikkarten');assert.equal(d.specs.find(s=>s.key==='Grafikspeicher').value,'32 GB GDDR7');assert.equal(d.specs.find(s=>s.key==='Boosttakt').value,'2.775 GHz');validateStore({version:1,devices:[d],trades:[]});
});
test('Smartphone-Tabellen trennen Display und Kameradaten',()=>{
  const d=extractDevice('<h1>Apple iPhone 17 Pro</h1><h3>Display</h3><table class="specs-table"><tr><td>Resolution</td><td>1206 x 2622</td></tr></table><h3>Main camera</h3><table class="specs-table"><tr><td>Resolution</td><td>48 MP</td></tr></table><table><tr><td>Ad</td><td>Advertisement</td></tr></table>','https://nanoreview.net/en/phone/apple-iphone-17-pro',{provider:'nanoreview'});
  assert.equal(d.specs.length,2);assert.equal(d.specs[0].value,'1206 x 2622');assert.equal(d.specs[1].value,'48 MP');assert.notEqual(d.specs[0].key,d.specs[1].key);
});
test('Konsolen-Datenblatt übernimmt nur ein Modell statt PS4, Pro und Controller zu mischen',()=>{
  const table=(name,weight)=>`<div role="table"><div role="row"><div role="columnheader">Produktname</div><div role="cell">${name}</div></div><div role="row"><div role="columnheader">Gewicht</div><div role="cell">${weight}</div></div></div>`;
  const d=extractDevice('<title>Technische Spezifikationen</title>'+table('PlayStation 4','2.1 kg')+table('PlayStation 4 Pro','3.3 kg'),'https://www.playstation.com/de-de/ps4/tech-specs/',{provider:'manufacturer'});
  assert.equal(d.name,'PlayStation 4');assert.equal(d.specs.find(s=>s.key==='Gewicht').value,'2.1 kg');assert.equal(d.category,'Konsolen');
});
test('Auch Uhren, Kameras, Speicher und Haushaltsgeräte haben eigene Kategorien',()=>{
  for(const [name,category] of [['Garmin Forerunner 965','Uhren'],['Canon EOS R5','Kameras'],['Crucial P3 SSD','Speicher'],['Dyson V15 Detect','Haushalt']]){
    const d=extractDevice(`<h1>${name}</h1><dl><dt>Weight</dt><dd>100 g</dd></dl>`,'https://example.com/specs');assert.equal(d.category,category);
  }
});
