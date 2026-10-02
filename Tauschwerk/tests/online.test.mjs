import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDevice,textOnly,canonicalKey} from '../online-parser.mjs';
import {validateRemoteURL,isPublicAddress} from '../online.mjs';
import {parsePrice,validateStore} from '../core.mjs';
test('Deutsche Preise einschließlich Tausendertrennzeichen',()=>{
  assert.equal(parsePrice('1.500,50 €'),1500.5);assert.equal(parsePrice('1500,50'),1500.5);assert.equal(parsePrice('1500.50'),1500.5);assert.equal(parsePrice(''),null);assert.equal(parsePrice('0'),0);assert.ok(Number.isNaN(parsePrice('1,2,3')));assert.ok(Number.isNaN(parsePrice('-50')));
});
test('Wikipedia-Infobox liefert Merkmale, Einheiten, Quelle und Attribution',()=>{
  const html='<h1>Test Phone</h1><table class="infobox"><tbody><tr><th>Manufacturer</th><td>Testbrand</td></tr><tr><th>Display</th><td>6.1&quot; OLED<sup>[1]</sup></td></tr><tr><th>RAM</th><td>8&nbsp;GB</td></tr><tr><th>Storage</th><td>128 GB<br>256 GB</td></tr></tbody></table>';
  const d=extractDevice(html,'https://en.wikipedia.org/wiki/Test_Phone',{title:'Test Phone',provider:'wikipedia'});
  validateStore({version:1,devices:[d],trades:[]});assert.equal(d.brand,'Testbrand');assert.equal(d.specs.find(s=>s.key==='Arbeitsspeicher').value,'8 GB');assert.equal(d.specs.find(s=>s.key==='Display').value,'6.1" OLED');assert.ok(d.provenance.attribution.includes('CC BY-SA'));assert.equal(d.value,null);
});
test('JSON-LD Produktdaten werden ohne Händlerpreis als Gerätewert übernommen',()=>{
  const json={'@context':'https://schema.org','@graph':[{'@type':'Product',name:'GPU X',brand:{name:'Example'},additionalProperty:[{'@type':'PropertyValue',name:'memory',value:16,unitText:'GB'}],offers:{price:'999',priceCurrency:'EUR'}}]};
  const d=extractDevice(`<script type="application/ld+json">${JSON.stringify(json)}</script>`,'https://example.com/product');assert.equal(d.name,'GPU X');assert.equal(d.brand,'Example');assert.equal(d.specs[0].value,'16 GB');assert.equal(d.value,null);assert.deepEqual(d.offers,[]);
});
test('Hersteller-Abschnitte und zweispaltige Datenblätter werden ausgelesen',()=>{
  const d=extractDevice('<h1>MacBook Test</h1><h3>Display</h3><ul><li>OLED</li><li>2560 × 1600</li></ul><h3>Memory</h3><p>16 GB</p>','https://example.com/specs');assert.equal(d.category,'Laptops');assert.ok(d.specs.find(s=>s.key==='Display').value.includes('2560'));assert.equal(d.specs.find(s=>s.key==='Arbeitsspeicher').value,'16 GB');
  assert.throws(()=>extractDevice('<h1>Unbekannt</h1><p>Nur Marketing</p>','https://example.com/product'),/keine auslesbaren/);
});
test('Keine geratenen Modellwerte aus mehrspaltigen Vergleichstabellen',()=>{assert.throws(()=>extractDevice('<h1>Phones</h1><table><tr><th>Display</th><td>A</td><td>B</td></tr></table>','https://example.com/compare'),/keine auslesbaren/);});
test('Website-Skripte und Fußnoten werden nicht als Merkmale ausgewertet',()=>{assert.equal(textOnly('<script>alert(1)</script>Text<sup>[5]</sup>'),'Text');assert.equal(canonicalKey('Processor:'),'Prozessor');});
test('HTTPS-Quellen sind beschränkt auf öffentliche Adressen',()=>{
  for(const url of ['http://example.com','https://localhost','https://127.0.0.1','https://10.0.0.1','https://[::1]','https://user:pass@example.com','https://example.com:444','https://router.home'])assert.throws(()=>validateRemoteURL(url));
  assert.equal(validateRemoteURL('https://support.apple.com/en-us/123#section').hash,'');
  for(const ip of ['127.0.0.1','169.254.169.254','192.168.0.1','172.20.1.1','100.64.1.1','::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(isPublicAddress(ip),false,ip);
  for(const ip of ['8.8.8.8','208.80.154.224','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true,ip);
});
