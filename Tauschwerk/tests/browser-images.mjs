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
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const picture=name=>({data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=',url:'https://example.com/phone.png',source:'https://example.com/phone',alt:name,attribution:'Produktbild: example.com'});
const model=extractDevice('<h1>Samsung Galaxy S25</h1><table><tr><td>Display</td><td>OLED</td></tr></table>','https://example.com/s25');model.image=picture(model.name);
let calls=0,external=0;
page.on('request',r=>{if(!r.url().startsWith(server.base)&&!r.url().startsWith('data:'))external++;});
await page.route('**/api/online/**',async route=>{calls++;const u=new URL(route.request().url());
  if(u.pathname.endsWith('/search'))return route.fulfill({json:{results:[{title:model.name,url:model.source,sourceName:'Testquelle'}],warnings:[]}});
  if(u.pathname.endsWith('/image'))return route.fulfill({json:{image:picture(u.searchParams.get('name'))}});
  return route.fulfill({json:{device:model,warnings:[]}});
});
const stored=async()=>await (await page.request.get(server.base+'/api/store')).json();
try{
  await page.goto(server.url);await page.locator('.device-card').first().waitFor();
  await page.locator('[data-mode="online"]').click();await page.locator('#online-query').fill('Samsung Galaxy S25');await page.locator('#online-search-form [type="submit"]').click();await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview img').waitFor();
  assert.ok(await page.locator('.online-preview img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await page.locator('[data-action="online-compare"]').click();assert.ok(await page.locator('.device-card img').isVisible());
  await page.locator('[data-view="online"]').click();await page.locator('[data-action="online-save"]').click();await page.locator('#device-form [type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal((await stored()).devices.find(d=>d.id===model.id).image.data,model.image.data);
  await page.locator('[data-mode="offline"]').click();const before=calls;await page.reload();await page.locator('.catalog-card img').waitFor();assert.equal(calls,before);assert.equal(external,0);
  await page.locator(`[data-action="edit"][data-id="${model.id}"]`).click();assert.ok(await page.locator('#editor-picture img').isVisible());assert.ok(await page.locator('[data-action="editor-image"]').isDisabled());await page.locator('[data-action="remove-image"]').click();await page.locator('#device-form [type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal((await stored()).devices.find(d=>d.id===model.id).image,undefined);
  await page.locator('[data-mode="online"]').click();await page.locator('[data-view="catalog"]').click();await page.locator(`[data-action="edit"][data-id="${model.id}"]`).click();await page.locator('[data-action="editor-image"]').click();await page.locator('#editor-picture img').waitFor();await page.locator('#device-form [type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});assert.ok((await stored()).devices.find(d=>d.id===model.id).image);
  // Renaming to another actual model must not carry the old photo along.
  await page.locator(`[data-action="edit"][data-id="${model.id}"]`).click();await page.locator('[name="name"]').fill('Samsung Galaxy S26');await page.locator('#device-form [type="submit"]').click();await page.locator('#modal').waitFor({state:'hidden'});assert.equal((await stored()).devices.find(d=>d.id===model.id).image,undefined);
  await page.locator('[data-action="catalog-images"]').click();await page.getByRole('status').filter({hasText:'Produktbilder gespeichert'}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-action="catalog-images"]').disabled);
  assert.equal((await stored()).devices.filter(d=>d.image).length,18);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('Produktbilder: Vorschau, Vergleich, Speicherung, Offline-Neuladen ohne externe Requests, Editor-Suche/Entfernen, Modellwechsel, Katalog-Bildsuche und mobile Ansicht geprüft.');
}finally{await browser.close();await server.stop();}
