import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySource} from '../online-sources.mjs';
import {parseBingRSS,parseDuckDuckGo,rankResults,extractLaptopLinks,readLaptopConfiguration,searchWeb} from '../online-search.mjs';
import {searchOnline,retrieveOnline} from '../online.mjs';
import {extractDevice} from '../online-parser.mjs';
import {validateStore} from '../core.mjs';

const rss=items=>'<rss><channel>'+items.map(([title,url,description=''])=>`<item><title><![CDATA[${title}]]></title><link>${url.replaceAll('&','&amp;')}</link><description>${description}</description></item>`).join('')+'</channel></rss>';
test('Webtreffer: offizielle Domains, unsichere Links und Modellgenauigkeit',()=>{
  assert.equal(classifySource('https://psref.lenovo.com/Product/test').manufacturer,'lenovo');
  assert.equal(classifySource('https://asus.com.attacker.example/').kind,'website');
  const rows=parseBingRSS(rss([['Dell Homepage','https://dell.com/'],['Dell XPS 13 9340','https://dell.com/xps-13-9340'],['Dell XPS 13 9345 Specs','https://dell.com/xps-13-9345'],['Dell XPS 13 9345','http://dell.com/unsafe'],['Dell XPS 13 9345','https://127.0.0.1/private']]));
  assert.equal(rows.length,3);assert.equal(rankResults(rows,'Dell XPS 13 9345').length,1);
  assert.equal(rankResults(rows,'Dell XPS 13 9345',{manufacturer:'asus'}).length,0);
  assert.equal(rankResults(parseBingRSS(rss([['iPhone - Apple','https://apple.com/iphone/','Alle Modelle: iPhone 17 Pro, iPhone 16 und viele mehr']])),'iPhone 17 Pro').length,0,'Modellnummer nur im allgemeinen Such-Snippet reicht nicht');
});
test('DuckDuckGo-Weiterleitungen und Bing-Snippets werden als Daten gelesen',()=>{
  const rows=parseDuckDuckGo('<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.asus.com%2Fzenbook-14">ASUS <b>Zenbook 14</b></a><a class="result__snippet">OLED &amp; RAM</a>');
  assert.equal(rows[0].url,'https://www.asus.com/zenbook-14');assert.equal(rows[0].description,'OLED & RAM');
  assert.equal(parseBingRSS(rss([['ASUS &amp; Dell','https://example.com/specs?a=1&b=2']]))[0].title,'ASUS & Dell');
});
test('Treffer werden dedupliziert, Hersteller bevorzugt und Filter respektiert',()=>{
  const rows=parseBingRSS(rss([['ASUS Zenbook 14','https://laptopmedia.com/series/asus-zenbook-14/'],['ASUS Zenbook 14 specs','https://www.asus.com/zenbook-14/'],['ASUS Zenbook 14 specs','https://www.asus.com/zenbook-14/?utm_source=bing']]));
  const ranked=rankResults(rows,'ASUS Zenbook 14');assert.equal(ranked.length,2);assert.equal(ranked[0].provider,'manufacturer');
  assert.equal(rankResults(rows,'ASUS Zenbook 14',{source:'manufacturer'}).length,1);
});
test('Websuche fällt bei gesperrtem Erst-Anbieter auf Bing zurück',async()=>{
  const requests=[];const answer=await searchWeb('Dell XPS 13 9345','en',{source:'manufacturer',manufacturer:'dell'},async url=>{requests.push(new URL(url));if(url.includes('duckduckgo'))return {text:'<form>captcha</form>'};return {text:rss([['Dell XPS 13 9345','https://dell.com/xps-13-9345']])};});
  assert.equal(answer.results.length,1);assert.equal(requests.length,2);assert.match(requests[1].searchParams.get('q'),/site:dell.com/);
});
test('Ausfall einzelner Quellen erhält Ergebnisse der anderen Quellen',async()=>{
  const answer=await searchOnline('ASUS Zenbook 14 UX3405','all',{},async url=>{
    assert.ok(!new URL(url).hostname.includes('wikipedia'));
    if(url.includes('duckduckgo'))throw new Error('Test: Sperrseite');
    if(url.includes('bing.com'))return {text:rss([['ASUS Zenbook 14 UX3405','https://asus.com/zenbook-14-ux3405']])};
    if(url.includes('wp-json'))return {text:JSON.stringify([{title:'ASUS Zenbook 14 UX3405 review',url:'https://laptopmedia.com/review/asus-zenbook-14-ux3405/'}])};
    return {text:'<a href="/laptop-specs/asus-zenbook-14-123/">ASUS Zenbook 14 OLED</a><a href="/laptop-specs/dell-xps-13/">Dell XPS 13</a>'};
  });
  assert.ok(answer.results.some(r=>r.provider==='manufacturer'));assert.ok(answer.results.some(r=>r.sourceName==='LaptopMedia'));assert.ok(!answer.warnings.some(w=>w.includes('Wikipedia')));assert.ok(!answer.results.some(r=>r.title==='Dell XPS 13'));
  await assert.rejects(()=>searchOnline('ASUS','all',{source:'unknown'}),/Ungültige Suchquelle/);
});
test('Verlinkte Laptop-Konfigurationen schließen fremde Geräte aus',()=>{
  const rows=extractLaptopLinks('<a href="/laptop-specs/asus-zenbook-14-541/">ASUS Zenbook 14</a><a href="/laptop-specs/asus-vivobook-15-32/">ASUS Vivobook 15</a><a href="https://evil.example/laptop-specs/asus-zenbook-14/">ASUS Zenbook 14</a>','https://laptopmedia.com/review/asus-zenbook-14-ux3405/','ASUS Zenbook 14 UX3405');
  assert.equal(rows.length,1);assert.match(rows[0].description,/Konfiguration und Modellgeneration/);
});
test('LaptopMedia: Hauptkonfiguration bleibt von Empfehlungsgeräten getrennt',()=>{
  const html='<title>ASUS Zenbook 14 OLED - Core Ultra 5 125H · 8GB RAM | LaptopMedia.com</title><script type="application/ld+json">{"@type":"Product","name":"ASUS Zenbook 14 OLED","brand":{"name":"ASUS"},"offers":{"price":699}}</script><ul class="lm-specs-table"><li class="cpu-specs">Intel Core Ultra 5 125H</li><li class="gpu-specs">NVIDIA GeForce RTX 4050</li><li class="ram-specs">8GB RAM</li><li class="storage-specs">2000GB SSD</li></ul><ul class="lm-specs-table"><li class="ram-specs">32GB RAM</li></ul>';
  const d=extractDevice(html,'https://laptopmedia.com/laptop-specs/asus-zenbook-14-541/',{provider:'laptopmedia'});
  assert.equal(d.category,'Laptops');assert.equal(d.brand,'ASUS');assert.equal(d.specs.find(s=>s.key==='Arbeitsspeicher').value,'8GB RAM');assert.equal(d.value,null);assert.match(d.name,/125H/);validateStore({version:1,devices:[d],trades:[]});
  const maker=extractDevice('<h1>Lenovo ThinkPad T14</h1><dl><dt>Processor</dt><dd>AMD Ryzen 7</dd><dt>Memory</dt><dd>16 GB</dd></dl>','https://lenovo.com/t14');assert.equal(maker.category,'Laptops');assert.equal(maker.brand,'Lenovo');
});
test('Konfiguration einer anderen Generation wird trotz gleichem Familiennamen abgewiesen',()=>{
  const html='<title>ASUS Zenbook 14 OLED · 16GB RAM</title><a href="/series/asus-zenbook-14-ux3407/">ASUS Zenbook 14 (UX3407)</a><a href="/series/asus-zenbook-14-ux3405/">Empfehlung: ASUS Zenbook 14 (UX3405)</a>';
  assert.equal(readLaptopConfiguration(html,'https://laptopmedia.com/laptop-specs/asus-zenbook-14-141/','ASUS Zenbook 14 UX3405'),null);
  assert.ok(readLaptopConfiguration(html,'https://laptopmedia.com/laptop-specs/asus-zenbook-14-141/','ASUS Zenbook 14 UX3407'));
});

test('Unbekannte Marken und Geräte werden im WWW in beiden Sprachen gefunden',async()=>{
  const requests=[];
  const answer=await searchOnline('Acme Sensor QZ900','all',{},async input=>{
    const u=new URL(input);requests.push(u);
    if(u.hostname.includes('duckduckgo'))return {text:'<a class="result__a" href="https://acme.example/products/qz900">Acme Sensor QZ900</a>'};
    return {text:rss([['Acme Sensor QZ900 technische Daten','https://geizhals.de/acme-sensor-qz900-a123.html'],['Acme Sensor QZ900','https://en.wikipedia.org/wiki/Acme_Sensor_QZ900']])};
  });
  assert.ok(answer.results.some(r=>r.host==='acme.example'));
  assert.equal(answer.results[0].sourceName,'Geizhals');
  assert.ok(requests.some(u=>u.searchParams.get('q').includes('technische Daten')));
  assert.ok(requests.some(u=>u.searchParams.get('q').includes('specifications')));
  assert.ok(requests.some(u=>u.searchParams.get('q').includes('site:geizhals.de')));
  assert.ok(!answer.results.some(r=>r.url.includes('wikipedia')));
});
test('Wikipedia ist auch über Direktimport und alte Quellenfilter ausgeschlossen',async()=>{
  for(const host of ['de.wikipedia.org','fr.wikipedia.org','www.wikidata.org','upload.wikimedia.org']){
    assert.throws(()=>extractDevice('<h1>Test</h1><dl><dt>RAM</dt><dd>8 GB</dd></dl>','https://'+host+'/test'),/ausgeschlossen/);
    await assert.rejects(()=>retrieveOnline('https://'+host+'/test'),/ausgeschlossen/);
    assert.deepEqual(parseBingRSS(rss([['Test','https://'+host+'/test']])),[]);
  }
  await assert.rejects(()=>searchOnline('Test','all',{source:'wikipedia'}),/Ungültige Suchquelle/);
});
test('Beide Suchanbieter tragen Treffer bei, auch wenn der erste erfolgreich ist',async()=>{
  const answer=await searchWeb('Samsung Galaxy S25','en',{},async input=>{
    if(input.includes('duckduckgo'))return {text:'<a class="result__a" href="https://example.com/galaxy-s25">Samsung Galaxy S25</a>'};
    return {text:rss([['Samsung Galaxy S25','https://samsung.com/galaxy-s25/']])};
  });
  assert.equal(answer.results[0].provider,'manufacturer');
  assert.ok(answer.results.some(r=>r.host==='example.com'));
});
test('Geizhals übernimmt technische Definitionen und keinen Händlerpreis als Gerätewert',()=>{
  const d=extractDevice('<h1>Acme Sensor QZ900</h1><dl><dt>Messbereich</dt><dd>0–100 °C</dd><dt>RAM</dt><dd>8 GB</dd></dl>','https://geizhals.de/acme-qz900-a123.html',{provider:'geizhals'});
  assert.equal(d.specs.find(s=>s.key==='Messbereich').value,'0–100 °C');assert.equal(d.value,null);
});
