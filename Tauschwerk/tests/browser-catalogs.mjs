import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {extractDevice} from '../online-parser.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const server=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const requests=[];
const models=[
  extractDevice('<h1>Apple iPhone 17 Pro</h1><h3>Display</h3><table class="specs-table"><tr><td>Size</td><td>6.3 inches</td></tr></table><h3>Performance</h3><table class="specs-table"><tr><td>Chipset</td><td>Apple A19 Pro</td></tr></table>','https://nanoreview.net/en/phone/apple-iphone-17-pro',{provider:'nanoreview'}),
  extractDevice('<h1>MSI GeForce RTX 5090</h1><dl><div><dt>Memory</dt><dd>32 GB GDDR7</dd></div><div><dt>Boost Clock</dt><dd>2.7 GHz</dd></div></dl>','https://www.gpu-monkey.com/en/gpu-msi_geforce_rtx_5090',{provider:'gpu-monkey'}),
  extractDevice('<title>Apple Watch Series 12</title><div role="table grid"><div role="row"><div role="rowheader">Chip</div><div role="cell">S11</div></div></div>','https://www.apple.com/de/apple-watch-series-12/specs/',{provider:'manufacturer'})
];
let model=0;
await page.route('**/api/online/**',async route=>{
  const u=new URL(route.request().url());requests.push(u);
  if(u.pathname.endsWith('/search')){model=u.searchParams.get('kind')==='gpu'?1:u.searchParams.get('kind')==='watches'?2:0;const d=models[model];return route.fulfill({json:{results:[{title:d.name+' · weitere Quelle',url:'https://example.com/model',sourceName:'Andere Quelle'},{title:d.name,url:d.source,sourceName:model===0?'NanoReview':model===1?'GPU-Monkey':'Apple',provider:model===2?'manufacturer':'database'},{title:d.name+' Test',url:'https://www.rtings.com/test',sourceName:'RTINGS',browserOnly:true}],warnings:[]}});}
  const found=models.find(d=>d.source===u.searchParams.get('url'));assert.ok(found,'Quellenfilter muss den Originalindex erhalten');return route.fulfill({json:{device:found,warnings:[]}});
});
try{
  await page.goto(server.url);await page.locator('.device-card').first().waitFor();while(await page.locator('[data-action="remove-select"]').count())await page.locator('[data-action="remove-select"]').first().click();
  await page.locator('[data-mode="online"]').click();await page.locator('.research-steps li').first().waitFor();assert.ok(!await page.locator('#online-source').isVisible());assert.equal(await page.locator('.research-steps li').count(),3);
  for(const [kind,query,source] of [['phones','iPhone 17 Pro','NanoReview'],['gpu','RTX 5090','GPU-Monkey'],['watches','Apple Watch Series 12','Apple']]){
    await page.locator('#online-kind').selectOption(kind);await page.locator('#online-query').fill(query);await page.locator('#online-search-form [type="submit"]').click();await page.locator('.online-result').first().waitFor();assert.equal(requests.at(-1).searchParams.get('kind'),kind);
    assert.equal(await page.getByRole('link',{name:'Testbericht öffnen'}).count(),1);await page.getByRole('button',{name:source,exact:true}).click();assert.equal(await page.locator('.online-result').count(),1);await page.locator('[data-action="online-fetch"]').click();await page.locator('.online-preview').waitFor();assert.ok(await page.locator('.spec-highlights').isVisible());await page.locator('.spec-details summary').click();assert.ok(await page.locator('.online-preview tbody tr').first().isVisible());assert.equal(await page.locator('.online-preview tbody tr').first().locator('td').count(),3);assert.equal(await page.locator('.online-preview tbody tr').first().getByRole('link').getAttribute('href'),models[model].source);
    await page.locator('[data-action="online-compare"]').click();await page.locator('[data-action="picker"]').first().click();
  }
  assert.equal(await page.locator('.online-selection-device').count(),3);
  await page.locator('#online-filters summary').click();for(const name of ['Geizhals','Notebookcheck','GSMArena','DisplaySpecifications','DPReview'])assert.equal(await page.locator('#online-source option').filter({hasText:name}).count(),1);
  await page.screenshot({path:path.join(root,'tests','Recherche-1.4-PC.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(root,'tests','Recherche-1.4-Handy.png'),fullPage:true});
  const data=await (await page.request.get(server.base+'/api/store')).json();assert.equal(data.devices.length,17);assert.deepEqual(errors,[]);
  console.log('Gerätearten, Quellenkarten, Originalindex nach Quellenfilter, Browser-Tests, technische Vorschau, drei verschiedene Geräte im Online-Vergleich und Handyansicht geprüft.');
}finally{await browser.close();await server.stop();}
