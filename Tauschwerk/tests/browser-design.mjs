import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {extractDevice} from '../online-parser.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const server=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'de-DE'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const models=[];let fail=false;
const source='https://www.nintendo.com/us/gaming-systems/switch/tech-specs/';
const d=extractDevice('<title>Nintendo Switch | Nintendo</title><h1>Technical specifications</h1><dl><dt>Storage</dt><dd>32 GB</dd></dl>',source);
await page.route('**/api/online/**',route=>{
 const url=new URL(route.request().url());
 if(url.pathname.endsWith('/search'))return route.fulfill({json:{results:[{title:'Nintendo Switch',url:source,provider:'manufacturer',sourceName:'Nintendo'}],warnings:[]}});
 if(url.pathname.endsWith('/image'))return route.fulfill({json:{image:null}});
 models.push(url.searchParams.get('model'));
 if(fail)return route.fulfill({status:502,json:{error:'HTTP 403: Diese Quelle blockiert den automatischen Abruf.',attempts:[{url:source,stage:'Abruf',error:'HTTP 403'}],source}});
 return route.fulfill({json:{device:d,warnings:[]}});
});
const overflow=async label=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' ohne horizontalen Überlauf');
const view=async name=>{await page.locator('#sidebar [data-view="'+name+'"]').click();await overflow(name);};
try{
 await page.goto(server.url);await page.locator('.device-card').first().waitFor();
 await page.screenshot({path:path.join(root,'tests','Swivo-PC.png'),fullPage:true});
 for(const width of [1440,1050,760,390,320]){
  await page.setViewportSize({width,height:width<760?844:1000});
  for(const name of ['catalog','trade','history','settings','compare'])await view(name);
  await page.locator('[data-action="new"]').first().click();await page.locator('#device-form').waitFor();await overflow('Geräte-Editor '+width);await page.locator('#device-form [name="name"]').focus();assert.equal(await page.locator('#device-form [name="name"]').evaluate(el=>el===document.activeElement),true);await page.locator('[data-action="close-modal"]').first().click();
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'tests','Swivo-Handy.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-mode="online"]').click();await page.locator('#online-query').fill('Switch 1');await page.locator('#online-search-form [type="submit"]').click();await page.locator('[data-action="online-fetch"]').waitFor();
 // Editing the next search must not change the identity of already displayed results.
 await page.locator('#online-query').fill('Switch 2');await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview').waitFor();assert.equal(models.at(-1),'Switch 1');assert.match(await page.locator('.online-preview').innerText(),/32 GB/);
 fail=true;await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-alert.error').waitFor();assert.match(await page.locator('.online-alert.error').innerText(),/HTTP 403/);await page.locator('.import-diagnostics summary').click();assert.match(await page.locator('.import-diagnostics').innerText(),/Abruf/);assert.match(await page.locator('.import-diagnostics').innerText(),/nintendo.com/);
 await page.setViewportSize({width:320,height:844});await overflow('Fehlerdetails auf Handy');fail=false;await page.locator('[data-action="online-retry"]').click();await page.locator('.online-preview').waitFor();assert.equal(models.at(-1),'Switch 1');assert.equal(await page.locator('.online-alert.error').count(),0);await overflow('Nintendo-Vorschau');
 await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.locator('.btn').first().evaluate(el=>parseFloat(getComputedStyle(el).transitionDuration)<=0.00001));
 assert.deepEqual(errors,[]);console.log('Design: fünf Bildschirmbreiten, Vergleich/Katalog/Tausch/Historie/Einstellungen/Editor, Fokus, Nintendo-Trefferbindung, Importdiagnose, Wiederholen und reduzierte Bewegung geprüft.');
}finally{await browser.close();await server.stop();}
