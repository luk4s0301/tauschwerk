import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {extractDevice} from '../online-parser.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const server=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const requests=[];
const devices=[extractDevice('<h1>ASUS Zenbook 14</h1><dl><dt>Processor</dt><dd>Core Ultra 5</dd><dt>Memory</dt><dd>16 GB</dd></dl>','https://www.asus.com/zenbook-14/',{provider:'manufacturer'}),extractDevice('<h1>Dell XPS 13 9345</h1><table><tr><th>Processor</th><td>Snapdragon X Elite</td></tr><tr><th>Memory</th><td>16 GB</td></tr></table>','https://laptopmedia.com/laptop-specs/dell-xps-13-9345/',{provider:'laptopmedia'})];
let current=0;
await page.route('**/api/online/**',async route=>{
  const u=new URL(route.request().url());requests.push(u);
  if(u.pathname.endsWith('/search')){current=u.searchParams.get('manufacturer')==='asus'?0:1;const d=devices[current];return route.fulfill({json:{results:[{title:d.name,url:d.source,provider:current?'database':'manufacturer',sourceName:current?'LaptopMedia':'ASUS',description:'Technische Gerätedaten'},{title:d.name+' Datenblatt',url:d.source+'specs.pdf',isPDF:true,sourceName:'PDF-Datenblatt'}],warnings:['Eine weitere Quelle ist nicht erreichbar.']}});}
  return route.fulfill({json:{device:devices[current],warnings:[]}});
});
try{
  await page.goto(server.url);await page.locator('.device-card').first().waitFor();while(await page.locator('[data-action="remove-select"]').count())await page.locator('[data-action="remove-select"]').first().click();
  await page.locator('[data-mode="online"]').click();await page.locator('#online-query').waitFor();assert.equal(requests.length,0);await page.locator('#online-filters summary').click();
  await page.locator('#online-source').selectOption('manufacturer');await page.locator('#online-manufacturer').selectOption('asus');await page.locator('#online-query').fill('ASUS Zenbook 14');await page.locator('#online-search-form button').click();await page.locator('.online-result').first().waitFor();
  assert.equal(requests[0].searchParams.get('source'),'manufacturer');assert.equal(requests[0].searchParams.get('manufacturer'),'asus');assert.match(await page.locator('.online-result').first().innerText(),/ASUS · www.asus.com/);assert.equal(await page.locator('[data-action="online-fetch"]').count(),1);assert.equal(await page.getByRole('link',{name:'PDF öffnen'}).count(),1);await page.locator('.source-notices summary').click();assert.match(await page.locator('.online-alert').innerText(),/weitere Quelle/);
  await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview').waitFor();await page.locator('[data-action="online-compare"]').click();assert.equal(await page.locator('.device-card').count(),1);
  await page.locator('.add-slot').click();assert.equal(await page.locator('#online-source').inputValue(),'manufacturer');await page.locator('#online-source').selectOption('laptopmedia');await page.locator('#online-manufacturer').selectOption('dell');await page.locator('#online-query').fill('Dell XPS 13 9345');await page.locator('#online-search-form button').click();await page.locator('.online-result').first().waitFor();assert.match(await page.locator('.online-result').first().innerText(),/LaptopMedia/);await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview').waitFor();await page.locator('[data-action="online-compare"]').click();assert.equal(await page.locator('.device-card').count(),2);
  await page.locator('[data-action="picker"]').first().click();await page.setViewportSize({width:390,height:844});await page.locator('#online-source').selectOption('geizhals');assert.ok(!await page.locator('#online-manufacturer').isDisabled());assert.equal(await page.locator('#online-source option[value="wikipedia"]').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile Ansicht ohne horizontalen Überlauf');
  await page.screenshot({path:path.join(root,'tests','Online-Quellen-Handy.png'),fullPage:true});
  const prior=requests.length;await page.locator('[data-mode="offline"]').click();await page.locator('[data-view="catalog"]').first().click();assert.equal(requests.length,prior);assert.deepEqual(errors,[]);
  console.log('Quellenfilter, Herstellerparameter, PDF-Link, Teilausfall, zwei Quellen im Vergleich und Handyansicht geprüft.');
}finally{await browser.close();await server.stop();}
