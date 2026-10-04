import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDevice} from '../online-parser.mjs';
import {retrieveOnline} from '../online.mjs';
const source='https://www.nintendo.com/de-de/Hardware/Nintendo-Switch-2/Technische-Daten.html';
const sheet='<title>Nintendo Switch 2 | Nintendo</title><h1>Technische Daten</h1><div class="specifications__row"><div>CPU/GPU</div><div>NVIDIA-Prozessor</div></div><div class="hashed_7a"><div>Internal storage</div><div>256 GB</div></div>';
const memory=d=>d.specs.find(s=>s.key==='Speicher')?.value;
test('Nintendo: allgemeine Überschrift, BEM- und wechselnde CSS-Klassen',()=>{
 const d=extractDevice(sheet,source);assert.equal(d.name,'Nintendo Switch 2');assert.equal(memory(d),'256 GB');assert.equal(d.specs.find(s=>s.key==='Prozessor und Grafik').value,'NVIDIA-Prozessor');assert.ok(d.specs.every(s=>s.source===source));
});
test('Nintendo: zugängliches Grid und expliziter Produktname',()=>{
 const d=extractDevice('<title>Technische Spezifikationen | Nintendo</title><h1>Hardware</h1><div role="grid"><div role="row"><div role="rowheader">Produktname</div><div role="cell">Nintendo Switch</div></div><div role="row"><div role="rowheader">Internal storage</div><div role="cell">32 GB</div></div></div>',source);assert.equal(d.name,'Nintendo Switch');assert.equal(memory(d),'32 GB');
});
test('Nintendo: passende strukturierte Daten statt empfohlenem anderen Modell',()=>{
 const products=[{'@type':'Product',name:'Nintendo Switch',additionalProperty:[{name:'Storage',value:'32 GB'}]},{'@type':'Product',name:'Nintendo Switch 2',additionalProperty:[{name:'Storage',value:'256 GB'}]}];
 const d=extractDevice('<title>Nintendo Switch 2 | Nintendo</title><h1>Technische Daten</h1><script type="application/ld+json">'+JSON.stringify(products)+'</script>',source);assert.equal(d.name,'Nintendo Switch 2');assert.equal(memory(d),'256 GB');
});
test('Nintendo: Empfehlungen und mehrspaltige Vergleichswerte bleiben ausgeschlossen',()=>{
 const d=extractDevice(sheet+'<aside><div class="specifications__row"><div>Storage</div><div>32 GB</div></div></aside><div class="comparison"><div class="specifications__row"><div>Storage</div><div>64 GB</div></div></div><div class="specifications__row"><div>Storage</div><div>64 GB</div><div>32 GB</div></div>',source);assert.equal(memory(d),'256 GB');assert.equal(d.provenance.conflicts.length,0);
});
test('Nintendo: technische Daten einer anderen Generation nicht übernehmen',async()=>{
 await assert.rejects(()=>retrieveOnline(source,{expectedModel:'Switch 1'},async url=>({url,text:sheet})),e=>{assert.match(e.message,/Nintendo Switch 2.*Nintendo Switch/);assert.equal(e.attempts[0].stage,'Modell prüfen');assert.equal(e.attempts[0].url,source);return true;});
});
test('Nintendo: offizielle Ersatzseite auch nach blockiertem Erstabruf nutzen',async()=>{
 const requests=[];const official='https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/';
 const answer=await retrieveOnline(source,{expectedModel:'Switch 2',fallback:true},async url=>{requests.push(url);if(url===source)throw new Error('Quelle blockiert den Abruf');assert.equal(url,official);return {url,text:sheet};});
 assert.deepEqual(requests,[source,official]);assert.equal(answer.device.source,official);assert.equal(answer.attempts[0].stage,'Abruf');assert.match(answer.warnings.join(' '),/stattdessen/);assert.equal(memory(answer.device),'256 GB');
});
test('Nintendo: fehlgeschlagene Abrufe behalten URL, Ursache und erwartetes Modell',async()=>{
 await assert.rejects(()=>retrieveOnline(source,{expectedModel:'Switch 2'},async()=>{throw new Error('HTTP 403');}),e=>{assert.equal(e.source,source);assert.equal(e.expectedModel,'Nintendo Switch 2');assert.deepEqual(e.attempts,[{url:source,stage:'Abruf',error:'HTTP 403'}]);return true;});
});
