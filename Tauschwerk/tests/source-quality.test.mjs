import test from 'node:test';
import assert from 'node:assert/strict';
import {extractDevice} from '../online-parser.mjs';
import {matchesQuery,parseBingRSS,rankResults} from '../online-search.mjs';
import {searchOnline,retrieveOnline} from '../online.mjs';
import {validateStore} from '../core.mjs';
const url='https://www.samsung.com/de/smartphones/galaxy-s25/specs/';
const block=(key,value)=>`<li class="specs__item"><strong class="specs__title">${key}</strong><div class="specs__text">${value}</div></li>`;
test('Samsung-Datenblöcke: technische Merkmale, genauer Name und Empfehlungen getrennt',()=>{
  const d=extractDevice('<title>Samsung Smartphones</title><h1>Samsung Galaxy S25</h1>'+block('CPU Type','Octa-Core')+block('Memory (GB)','12')+block('Storage (GB)','256')+'<aside class="recommended">'+block('Memory (GB)','16')+'</aside>',url,{provider:'manufacturer'});
  assert.equal(d.name,'Samsung Galaxy S25');
  assert.equal(d.specs.find(s=>s.key==='Arbeitsspeicher').value,'12 GB');
  assert.equal(d.specs.find(s=>s.key==='Speicher').value,'256 GB');
  assert.ok(d.specs.every(s=>s.source===url));validateStore({version:1,devices:[d],trades:[]});
});
test('Samsung-Varianten Ultra, Plus und FE werden bei Suche getrennt',()=>{
  for(const name of ['Samsung Galaxy S25 Ultra','Samsung Galaxy S25+','Samsung Galaxy S25 FE'])assert.equal(matchesQuery({title:name,url:'https://samsung.com/',description:''},'Samsung Galaxy S25'),false);
  assert.ok(matchesQuery({title:'Samsung Galaxy S25+',url:'',description:''},'Samsung Galaxy S25 Plus'));
});
test('JSON-LD einer empfohlenen Ultra-Variante ersetzt nicht das gesuchte Samsung-Gerät',()=>{
  const products=[{'@type':'Product',name:'Samsung Galaxy S25 Ultra',additionalProperty:[{name:'RAM',value:'16 GB'},{name:'CPU',value:'wrong'}]},{'@type':'Product',name:'Samsung Galaxy S25',additionalProperty:[{name:'RAM',value:'12 GB'}]}];
  const d=extractDevice('<h1>Samsung Galaxy S25</h1><script type="application/ld+json">'+JSON.stringify(products)+'</script>',url,{provider:'manufacturer'});
  assert.equal(d.name,'Samsung Galaxy S25');assert.equal(d.specs[0].value,'12 GB');
});
test('Widersprüche bleiben offen statt RAM unterschiedlicher Varianten zu verbinden',()=>{
  const d=extractDevice('<h1>Galaxy S25</h1><dl><dt>RAM</dt><dd>12 GB</dd><dt>RAM</dt><dd>16 GB</dd><dt>Weight</dt><dd>162 g</dd></dl>',url,{provider:'manufacturer'});
  assert.ok(!d.specs.some(s=>s.key==='Arbeitsspeicher'));
  assert.deepEqual(d.provenance.conflicts[0].values,['12 GB','16 GB']);
});
test('Produktidentität und Werbeblöcke allein ergeben kein technisches Datenblatt',()=>{
  assert.throws(()=>extractDevice('<h1>Samsung Galaxy S25</h1><script type="application/ld+json">{"@type":"Product","name":"Samsung Galaxy S25","brand":"Samsung","sku":"SM-S931"}</script>',url),/keine auslesbaren/);
});
test('GSMArena gruppiert dreispaltige Smartphone-Tabellen ohne Display-/Kameramischung',()=>{
  const d=extractDevice('<h1>Samsung Galaxy S25</h1><table><tr><th rowspan="2">Display</th><td>Type</td><td>AMOLED</td></tr><tr><td>Size</td><td>6.2 inches</td></tr><tr><th>Main Camera</th><td>Type</td><td>Triple</td></tr></table>','https://www.gsmarena.com/samsung_galaxy_s25-123.php',{provider:'gsmarena'});
  assert.equal(d.specs.length,3);assert.notEqual(d.specs[0].key,d.specs[2].key);assert.equal(d.specs[1].value,'6.2 inches');
});
test('Hersteller zuerst; weitere öffentliche Webseiten können direkt eingelesen werden',()=>{
  const rss='<rss><item><title>Samsung Galaxy S25 specs</title><link>https://random.example/galaxy-s25</link></item><item><title>Samsung Galaxy S25</title><link>https://www.samsung.com/galaxy-s25/</link></item></rss>';
  const rows=rankResults(parseBingRSS(rss),'Samsung Galaxy S25');assert.equal(rows[0].provider,'manufacturer');assert.equal(rows[1].browserOnly,false);
});
test('Ausfall einer direkten Fachsuche fällt auf die Websuche der Fachquelle zurück',async()=>{
  const requests=[];const answer=await searchOnline('Samsung Galaxy S25','en',{source:'gsmarena'},async input=>{const u=new URL(input);requests.push(u);if(u.hostname==='www.gsmarena.com')throw Error('403');return {text:'<rss><item><title>Samsung Galaxy S25</title><link>https://www.gsmarena.com/samsung_galaxy_s25-123.php</link></item></rss>'};});
  assert.equal(answer.results.length,1);assert.ok(requests.some(u=>u.searchParams.get('q')?.includes('site:gsmarena.com')));
});

test('Geladenes Datenblatt muss selbst zur Suche passen, nicht nur die URL',async()=>{
  await assert.rejects(()=>retrieveOnline(url,{expectedModel:'Samsung Galaxy S25'},async()=>({text:'<h1>Samsung Galaxy S25 Ultra</h1><dl><dt>RAM</dt><dd>16 GB</dd></dl>',url})),/nicht eindeutig/);
});
