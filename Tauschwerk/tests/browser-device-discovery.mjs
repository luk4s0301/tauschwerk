import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {searchOnline,retrieveOnline} from '../online.mjs';
import {extractDevice} from '../online-parser.mjs';
import {normalizeDeviceQuery} from '../online-sources.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const models=[
 ['Nintendo Switch','https://www.nintendo.co.uk/switch/hardware/','<dl><dt>Storage</dt><dd>32 GB</dd></dl>'],
 ['Nintendo Switch 2','https://www.nintendo.com/switch2/','<div class="table-row"><div>Internal storage</div><div>256 GB</div></div>'],
 ['NVIDIA GeForce RTX 4060','https://www.nvidia.com/rtx-4060/specs/','<dl><dt>Memory size</dt><dd>8 GB</dd></dl>'],
 ['Apple Watch Series 10','https://www.apple.com/apple-watch-series-10/specs/','<dl><dt>Chip</dt><dd>S10</dd></dl>'],
 ['Acme Sensor QX900','https://acme.example/qx900','<dl><dt>Messbereich</dt><dd>0–100 °C</dd></dl>']
];
const dir=fs.mkdtempSync(path.join(root,'tests','browser-data-'));
const initial=[models[0],models[2],models[3]].map(([name,url,specs])=>extractDevice('<h1>'+name+'</h1>'+specs,url));
fs.writeFileSync(path.join(dir,'tauschwerk.json'),JSON.stringify({version:1,devices:initial,trades:[],ui:{selected:[],mode:'offline',view:'catalog'}}));
const server=await launch(dir);const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const searches=[],images=[],external=[];let largeData='',holdQuery='',heldStarted,releaseHeld;
page.on('request',r=>{if(!r.url().startsWith(server.base)&&!r.url().startsWith('data:'))external.push(r.url());});
const document=(model,url)=>({url,text:'<h1>'+model[0]+'</h1>'+model[2]+'<meta property="og:image" content="/model.png">'});
const fetchFixture=async input=>{
 const url=new URL(input);
 if(url.hostname.includes('bing.com')||url.hostname.includes('duckduckgo.com')){
  const query=normalizeDeviceQuery(url.searchParams.get('q')||'');const model=[...models].sort((a,b)=>b[0].length-a[0].length).find(m=>query.toLowerCase().includes(m[0].toLowerCase()))||models.find(m=>query.toLowerCase().includes('rtx 4060')&&m[0].includes('4060'));
  return {url:input,text:model?'<rss><item><title>'+model[0]+'</title><link>'+model[1]+'</link></item></rss>':'<rss></rss>'};
 }
 if(input===models[1][1])return {url:input,text:'<h1>Nintendo Switch 2</h1><a href="tech-specs/">Technical specifications</a>'};
 if(input===models[1][1]+'tech-specs/')return document(models[1],input);
 const model=models.find(m=>m[1]===input);return model?document(model,input):{url:input,text:'<rss></rss>'};
};
await page.route('**/api/online/**',async route=>{
 const u=new URL(route.request().url());
 if(u.pathname.endsWith('/search')){const query=u.searchParams.get('q');searches.push(query);if(query===holdQuery){heldStarted();await new Promise(resolve=>releaseHeld=resolve);return route.fulfill({json:{results:[{title:'Nintendo Switch',url:models[0][1]}],warnings:[]}}).catch(()=>{});}return route.fulfill({json:await searchOnline(query,'en',{source:'web'},fetchFixture)});}
 if(u.pathname.endsWith('/image')){const name=u.searchParams.get('name');images.push(name);return route.fulfill({json:{image:{data:largeData,url:'https://photos.example/model.png',source:u.searchParams.get('source')||'https://photos.example/model',alt:name}}});}
 const answer=await retrieveOnline(u.searchParams.get('url'),{expectedModel:u.searchParams.get('model'),fallback:true,enrichImages:true,fetchImage:async url=>({url,bytes:Buffer.from(largeData.split(',')[1],'base64'),contentType:'image/png'})},fetchFixture);
 return route.fulfill({json:answer});
});
const stored=async()=>await(await page.request.get(server.base+'/api/store')).json();
try{
 await page.goto(server.url);await page.locator('.catalog-card').first().waitFor();assert.equal(images.length,0);
 largeData=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=600;canvas.height=600;const context=canvas.getContext('2d'),image=context.createImageData(600,600);let seed=17;for(let i=0;i<image.data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i]=i%4===3?255:seed>>>24;}context.putImageData(image,0,0);return canvas.toDataURL('image/png');});assert.ok(largeData.length>700000);
 await page.locator('[data-mode="online"]').click();await page.locator('[data-view="catalog"]').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('.catalog-card img').length===3);await page.waitForTimeout(150);
 const catalog=await stored();assert.deepEqual(new Set(images),new Set(initial.map(d=>d.name)));for(const d of catalog.devices){assert.ok(d.image.data.length<120000);assert.ok(d.image.data.startsWith('data:image/webp'));}
 await page.locator('#catalog-search').fill('Acme Sensor QX900');await page.locator('[data-action="catalog-web-fetch"]').waitFor();assert.equal(await page.locator('#catalog-search').inputValue(),'Acme Sensor QX900');assert.ok(searches.includes('Acme Sensor QX900'));
 await page.locator('[data-action="catalog-web-fetch"]').click();await page.locator('.online-preview img').waitFor();assert.match(await page.locator('.online-preview').innerText(),/Acme Sensor QX900/);assert.ok((await page.locator('.online-preview img').getAttribute('src')).length<120000);
 // Comparison of both generations, loaded and displayed inside this app.
 for(const query of ['Switch 1','Switch 2']){
  await page.locator('#online-query').fill(query);await page.locator('#online-search-form [type="submit"]').click();await page.locator('[data-action="online-fetch"]').waitFor();await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview img').waitFor();
  if(query==='Switch 2'){assert.ok((await page.locator('.online-preview-summary a').getAttribute('href')).endsWith('tech-specs/'));await page.locator('.source-notices summary').click();assert.match(await page.locator('.source-notices').innerText(),/stattdessen/);}
  await page.locator('[data-action="online-compare"]').click();if(query==='Switch 1')await page.locator('.add-slot').click();
 }
 assert.deepEqual(await page.locator('.device-name').allTextContents(),['Nintendo Switch','Nintendo Switch 2']);assert.equal(await page.locator('.device-card img').count(),2);assert.match(await page.locator('.spec-table').innerText(),/32 GB/);assert.match(await page.locator('.spec-table').innerText(),/256 GB/);
 await page.screenshot({path:path.join(root,'tests','Online-Geraete-1.8-PC.png'),fullPage:true});
 await page.locator('[data-view="catalog"]').first().click();await page.locator('#catalog-search').fill('RTX40 60');await page.locator('[data-action="catalog-web-fetch"]').waitFor();assert.match(await page.locator('.catalog-web').innerText(),/RTX 4060/);
 // Stale responses must never replace a new query, and offline typing never searches.
 holdQuery='Veraltete Probe';const oldStarted=new Promise(resolve=>heldStarted=resolve);await page.locator('#catalog-search').fill(holdQuery);await oldStarted;await page.locator('#catalog-search').fill('Apple Watch Series 10');await page.locator('[data-action="catalog-web-fetch"]').waitFor();assert.match(await page.locator('.catalog-web').innerText(),/Apple Watch Series 10/);releaseHeld();holdQuery='';await page.waitForTimeout(100);assert.doesNotMatch(await page.locator('.catalog-web').innerText(),/Nintendo/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'tests','Online-Geraete-1.8-Handy.png'),fullPage:true});
 await page.locator('[data-mode="offline"]').click();const count=searches.length;await page.locator('#catalog-search').fill('Neues unbekanntes Gerät');await page.waitForTimeout(750);assert.equal(searches.length,count);assert.equal(await page.locator('.catalog-web').count(),0);
 await page.locator('[data-mode="online"]').click();holdQuery='Abbruchprobe';const abortStarted=new Promise(resolve=>heldStarted=resolve);await page.locator('#online-query').fill(holdQuery);await page.locator('#online-search-form [type="submit"]').click();await abortStarted;await page.locator('[data-action="online-cancel"]').click();await page.locator('.online-alert.error').waitFor();assert.match(await page.locator('.online-alert.error').innerText(),/abgebrochen/);releaseHeld();holdQuery='';await page.locator('[data-mode="offline"]').click();await page.locator('#catalog-search').fill('');await page.reload();await page.locator('.catalog-card img').first().waitFor();assert.equal((await stored()).devices.filter(d=>d.image).length,3);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('Gerätesuche: freie Websuche im Katalog, automatische Bilder für Konsole/GPU/Watch, Verkleinerung großer Fotos, direkter Nintendo-Datenimport mit Alternativquelle, Switch-Generationen im Vergleich, Suchwechsel, Offlinebetrieb und Handyansicht geprüft.');
}finally{await browser.close();await server.stop();}
