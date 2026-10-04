import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {extractDevice} from '../online-parser.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const dir=fs.mkdtempSync(path.join(root,'tests','browser-data-'));
const server=await launch(dir);
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1050},locale:'de-DE'});
const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
const click=async action=>page.locator(`[data-action="${action}"]`).first().click();
const stored=async()=>await (await page.request.get(server.base+'/api/store')).json();
const fixture=extractDevice('<h1>Steam Deck</h1><table class="infobox"><tr><th>Processor</th><td>Test-Prozessor</td></tr><tr><th>RAM</th><td>16 GB</td></tr></table>','https://www.steamdeck.com/en/tech',{title:'Steam Deck',provider:'manufacturer'});
let networkCalls=0,failSearch=false;
await page.route('**/api/online/**',async route=>{
  networkCalls++;
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('/search'))return route.fulfill({status:failSearch?502:200,contentType:'application/json',body:JSON.stringify(failSearch?{error:'Online-Abruf fehlgeschlagen. Testfehler.'}:{results:[{title:fixture.name,url:fixture.source,description:'Öffentliche Gerätequelle',provider:'manufacturer',language:'en'}],warnings:[]})});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({device:fixture,warnings:['Die Quelle kann mehrere Modellvarianten beschreiben.']})});
});
try {
  await page.goto(server.url);await page.getByRole('heading',{name:'Was passt zu deinem nächsten Tausch?'}).waitFor();
  await click('new');await page.locator('[name="name"]').fill('Nur ein Gerätename');await page.locator('[type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal((await stored()).devices.length,18);assert.equal(await page.locator('.catalog-card').count(),1);
  await click('new');await page.locator('[name="name"]').fill('Eigener Fernseher');await page.locator('[name="category"]').fill('Fernseher');await click('template');await page.locator('.spec-value').first().fill('OLED');await page.locator('[name="value"]').fill('1.500,50');await page.locator('[name="source"]').fill('example.com/tv');await page.locator('[type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});let data=await stored();const tv=data.devices.find(d=>d.name==='Eigener Fernseher');assert.equal(tv.value,1500.5);assert.equal(tv.specs.length,1);assert.equal(tv.source,'https://example.com/tv');
  await page.locator('.catalog-card [data-action="edit"]').click();await page.locator('.spec-key').fill('');await page.locator('[type="submit"]').click();await page.locator('#modal .dialog-notice.error').waitFor();assert.ok((await page.locator('#modal .dialog-notice').textContent()).includes('braucht einen Namen'));assert.ok(await page.locator('#modal .dialog-notice').isVisible());assert.equal((await stored()).devices.find(d=>d.name==='Eigener Fernseher').specs[0].key,'Typ');await click('close-modal');
  assert.equal(networkCalls,0,'Offline-Modus darf keine Online-Recherche starten');
  await page.locator('[data-action="mode"][data-mode="online"]').click();await page.getByRole('heading',{name:'Was möchtest du vergleichen?'}).waitFor();assert.equal(networkCalls,0,'Moduswechsel allein übermittelt keine Suchanfrage');
  await page.locator('#online-query').fill('Steam Deck');await page.locator('#online-search-form [type="submit"]').click();await page.locator('.online-result').waitFor();await click('online-fetch');await page.locator('.online-preview').waitFor();assert.ok((await page.locator('.online-preview').textContent()).includes('Quelle:'));assert.equal((await stored()).devices.length,19,'Online-Vorschau verändert den Offline-Katalog nicht');
  await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:path.join(root,'tests','Online-Recherche.png'),fullPage:true});
  await click('online-compare');assert.equal(await page.locator('.device-card').count(),4);assert.ok((await page.locator('.device-card').last().textContent()).includes('Steam Deck'));assert.equal((await stored()).devices.length,19);
  await page.locator('[data-action="view"][data-view="online"]').click();await click('online-save');await page.locator('#device-form [type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});data=await stored();assert.equal(data.devices.length,20);assert.equal(data.devices.find(d=>d.id===fixture.id).sourceType,'manufacturer');assert.ok(data.devices.find(d=>d.id===fixture.id).specs.every(s=>s.source===fixture.source));assert.equal(data.devices.find(d=>d.id===fixture.id).provenance.needsReview,false);
  await page.locator('[data-action="mode"][data-mode="offline"]').click();await page.getByRole('heading',{name:'Ein Katalog, der mit dir wächst.'}).waitFor();await page.getByRole('heading',{name:'Steam Deck',exact:true}).waitFor();const priorCalls=networkCalls;await page.reload();await page.getByRole('heading',{name:'Ein Katalog, der mit dir wächst.'}).waitFor();assert.equal(networkCalls,priorCalls);
  await page.locator('[data-action="mode"][data-mode="online"]').click();await page.getByRole('heading',{name:'Was möchtest du vergleichen?'}).waitFor();failSearch=true;await page.locator('#online-query').fill('Fehlerprobe');await page.locator('#online-search-form [type="submit"]').click();await page.locator('.online-alert.error').waitFor();assert.ok((await page.locator('.online-alert.error').textContent()).includes('Testfehler'));assert.equal(await page.locator('.online-result').count(),0);
  await page.locator('[data-action="mode"][data-mode="offline"]').click();await page.getByRole('heading',{name:'Ein Katalog, der mit dir wächst.'}).waitFor();
  assert.deepEqual(jsErrors,[]);console.log('Neue Funktionen geprüft: Anlegen minimal/teilweise ausgefüllt, Dezimalpreise, sichtbare Formularfehler, Online-/Offline-Modus, Quellen, Online-Vergleich ohne Speicherung, bewusstes Offline-Speichern, Neustart und Netzwerkfehler.');
}finally{await browser.close();await server.stop();}
