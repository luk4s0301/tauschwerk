import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests','online-live-results.json'),'utf8'));
const server=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:960},locale:'de-DE'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let currentFixture=fixtures[0],requests=0;
await page.route('**/api/online/**',async route=>{
  requests++;const url=new URL(route.request().url());
  if(url.pathname.endsWith('/search')){
    currentFixture=fixtures.find(d=>d.name===url.searchParams.get('q')) || fixtures[0];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[{title:currentFixture.name,url:currentFixture.source,description:'Technische Gerätedaten',provider:currentFixture.sourceType,language:'en'}],warnings:[]})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({device:currentFixture,warnings:[]})});
});
async function chooseOnline(d){
  await page.locator('#online-query').fill(d.name);
  await page.locator('#online-search-form [type="submit"]').click();
  await page.locator('.online-result').waitFor();
  await page.locator('[data-action="online-fetch"]').click();
  await page.locator('.online-preview').waitFor();
  await page.locator('[data-action="online-compare"]').click();
}
try {
  await page.goto(server.url);await page.locator('.device-card').first().waitFor();
  while(await page.locator('[data-action="remove-select"]').count())await page.locator('[data-action="remove-select"]').first().click();
  await page.locator('[data-action="mode"][data-mode="online"]').click();await page.locator('#online-query').waitFor();
  await chooseOnline(fixtures[0]);assert.equal(await page.locator('.device-card').count(),1);
  await page.locator('.add-slot').click();
  assert.equal(await page.locator('#modal').evaluate(d=>d.open),false,'Zweites Online-Gerät darf keinen lokalen Picker öffnen');
  assert.equal(await page.locator('.online-selection-device').count(),1);
  assert.ok((await page.locator('.online-selection').textContent()).includes(fixtures[0].name));
  await chooseOnline(fixtures[1]);assert.equal(await page.locator('.device-card').count(),2);
  for(const d of fixtures.slice(2,4)){
    const priorCount=await page.locator('.device-card').count();
    await page.locator('[data-action="picker"]').first().click();
    assert.equal(await page.locator('#modal').evaluate(d=>d.open),false);
    assert.equal(await page.locator('.online-selection-device').count(),priorCount);
    assert.equal(await page.locator('#online-query').inputValue(),'');
    await chooseOnline(d);assert.equal(await page.locator('.device-card').count(),priorCount+1);
  }
  assert.deepEqual(await page.locator('.device-name').allTextContents(),fixtures.slice(0,4).map(d=>d.name));
  const stored=await (await page.request.get(server.base+'/api/store')).json();assert.equal(stored.devices.length,17,'Online-Auswahl darf den Offline-Katalog nicht verändern');
  await page.locator('[data-action="picker"]').first().click();
  await page.locator('#online-query').fill(fixtures[0].name);await page.locator('#online-search-form [type="submit"]').click();await page.locator('.online-result').waitFor();await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview').waitFor();await page.locator('[data-action="online-compare"]').click();assert.equal(await page.locator('.device-card').count(),4,'Dasselbe Online-Gerät nicht doppelt hinzufügen');
  await page.locator('[data-action="mode"][data-mode="offline"]').click();
  await page.locator('[data-action="mode"][data-mode="offline"][aria-pressed="true"]').waitFor();
  assert.equal(await page.locator('.device-card').count(),0);
  const previousRequests=requests;await page.locator('[data-action="picker"]').first().click();await page.locator('#picker-search').waitFor();assert.equal(await page.locator('.picker-row').count(),17);assert.equal(requests,previousRequests);
  assert.deepEqual(errors,[]);console.log('Online-Vergleich geprüft: erstes, zweites, drittes und viertes Gerät online auswählen; Auswahl erhalten; keine lokale Zwangsauswahl; keine doppelten Geräte; Offline-Auswahl unverändert.');
}finally{await browser.close();await server.stop();}
