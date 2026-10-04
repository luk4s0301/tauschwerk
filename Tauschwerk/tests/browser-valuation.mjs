import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {launch,root} from './helper.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const s=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=[];
const answer=profile=>{
 const give=profile.variant==='256GB',value=give?500:700;
 const evidence=[1,2,3].map(i=>({title:profile.name+' '+profile.variant,url:'https://www.kleinanzeigen.de/s-anzeige/test/'+i,price:value+i*5,source:'Kleinanzeigen',kind:'private-asking',condition:profile.condition}));
 return {profile,checked:new Date().toISOString(),kind:'Private Angebotspreise',estimate:{value,low:value-50,high:value+50,confidence:'mittel'},message:'Set aus Gerät und separat bewerteten Extras.',base:{estimate:{value,count:3},reason:'Median privater Angebote',sources:[{source:'Kleinanzeigen',url:'https://www.kleinanzeigen.de',status:'ok',count:3},{source:'reBuy',url:'https://www.rebuy.de',status:'empty',message:'Keine passenden Angebote'},{source:'idealo',url:'https://www.idealo.de',status:'error',message:'Quelle gesperrt'}],evidence,used:evidence.map(r=>r.url)},accessories:profile.accessories.map(a=>({...a,estimate:{value:50,count:3},evidence:[],sources:[],used:[],reason:'Geprüft'})),warnings:['Angebotspreise, keine Verkaufspreise.']};
};
await page.route('**/api/online/valuation',async route=>{const p=route.request().postDataJSON();requests.push(p);await new Promise(r=>setTimeout(r,150));await route.fulfill({json:answer(p)});});
try{
 await page.goto(s.url);await page.locator('.device-card').first().waitFor();await page.locator('[data-action="view"][data-view="trade"]').click();
 assert.equal(await page.locator('[data-action="save-trade"]').count(),0);
 for(const side of ['give','receive']){await page.locator(`[data-trade="${side}Condition"]`).selectOption('Sehr gut');await page.locator(`[data-trade="${side}Variant"]`).fill(side==='give'?'256GB':'512GB');}
 await page.locator('.trade-more summary').first().click();await page.locator('[data-trade="giveContents"]').fill('OVP; Rechnung');await page.locator('[data-trade="giveAccessories"]').fill('2x Sony DualSense');
 await page.locator('[data-action="value-set"][data-side="give"]').click();await page.locator('#give-valuation').getByText('Private Angebotspreise · Sicherheit: mittel').waitFor();
 assert.equal(await page.locator('[data-action="mode"][data-mode="online"]').getAttribute('aria-pressed'),'true');assert.equal(requests[0].contents,'OVP; Rechnung');assert.equal(requests[0].accessories[0].quantity,2);
 assert.equal(await page.locator('[data-action="save-trade"]').count(),0);
 await page.locator('[data-action="value-set"][data-side="receive"]').click();await page.locator('#receive-valuation').getByText('Private Angebotspreise · Sicherheit: mittel').waitFor();
 assert.equal(await page.locator('#give-total').textContent(),'500 €');assert.equal(await page.locator('#receive-total').textContent(),'700 €');assert.ok((await page.locator('.range-note').textContent()).includes('100'));
 await page.locator('#give-valuation summary').first().click();assert.equal(await page.locator('#give-valuation .market-offer').count(),3);
 await page.locator('[data-action="save-trade"]').click();await page.getByText('Tauschbewertung lokal gespeichert.',{exact:true}).waitFor();
 const stored=await(await page.request.get(s.base+'/api/store')).json();assert.equal(stored.trades[0].details.giveValuation.answer.base.evidence.length,3);assert.equal(stored.trades[0].details.giveAccessories,'2x Sony DualSense');assert.equal(stored.trades[0].range.low,100);
 await page.locator('[data-trade="giveCondition"]').selectOption('Gut');assert.equal(await page.locator('#give-total').textContent(),'—');assert.equal(await page.locator('[data-action="save-trade"]').count(),0);
 await page.locator('[data-trade="giveVariant"]').fill('1TB');await page.locator('[data-action="value-set"][data-side="give"]').click();await page.locator('[data-trade="giveIssues"]').fill('Displaybruch');await page.locator('[data-action="value-set"][data-side="give"]:not([disabled])').waitFor();assert.equal(await page.locator('#give-total').textContent(),'—');
 await page.locator('[data-action="value-set"][data-side="give"]').click();await page.locator('[data-action="trade-cancel"][data-side="give"]').click();await page.getByText('Preisabgleich abgebrochen.',{exact:true}).first().waitFor();assert.equal(await page.locator('#give-total').textContent(),'—');
 await page.locator('[data-action="view"][data-view="history"]').click();await page.locator('[data-action="trade-details"]').click();assert.ok((await page.locator('#modal').textContent()).includes('2x Sony DualSense'));assert.equal(await page.locator('#modal .market-offer').count(),6);await page.locator('[data-action="close-modal"]').first().click();
 await page.locator('[data-action="view"][data-view="trade"]').click();await page.setViewportSize({width:760,height:1100});await page.screenshot({path:path.join(root,'tests','Tauschrechner-1.6-Test.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('Wertschätzung-Browsertest: beide Seiten, Zustand/Set, Quellen, Intervall, Snapshot, veraltete Antworten, mobile Ansicht bestanden.');
}finally{await browser.close();await s.stop();}
