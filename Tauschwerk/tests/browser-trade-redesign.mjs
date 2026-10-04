import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {valueSet} from '../market-value.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const s=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));const requests=[];
await page.route('**/api/online/valuation',async route=>{
 const profile=route.request().postDataJSON();requests.push(profile);
 const answer=await valueSet(profile,async url=>{
   const u=new URL(url);
   if(u.hostname.includes('rebuy')&&u.searchParams.get('q')?.includes('Sony DualSense')){
     const docs=[1,2,3].map(id=>({id,name:'Sony DualSense V2',category_sanitized_name:'controller',product_sanitized_name:'dualsense-'+id,variants:[{quantity:1,label:'A3',price:5000}]}));
     return {url,text:'<script id="ry-inject">'+JSON.stringify({productListViewDto:{searchResponse:{products:{docs}}}})+'</script>'};
   }
   throw Error('Test: Anbieter gesperrt');
 });
 await route.fulfill({json:answer});
});
try{
 await page.goto(s.url);await page.locator('.device-card').first().waitFor();await page.locator('[data-view="trade"]').first().click();
 for(const side of ['give','receive']){
   await page.locator(`[data-trade="${side}Name"]`).fill(side==='give'?'Unlisted Device A':'Unlisted Device B');
   if(side==='give'){const card=page.locator('.trade-side').first();await card.getByText('Lieferumfang, Mängel & Zusatzgeräte',{exact:true}).click();await card.locator('[data-action="trade-row-add"][data-type="Items"]').click();assert.equal(await card.locator('[data-set-type="Items"][data-set-field="condition"]').inputValue(),'Gut');await card.locator('[data-action="trade-row-remove"][data-type="Items"]').click();}
   await page.locator(`[data-trade="${side}Condition"]`).selectOption('Sehr gut');
   const section=page.locator('.trade-side').nth(side==='give'?0:1);
   await section.getByText('Preisabgleich ergänzen: eigene Vergleichsangebote',{exact:true}).click();
   for(let i=0;i<3;i++){
     await section.locator('[data-action="trade-row-add"][data-type="Comparisons"]').click();
     // Optional details are deliberately re-opened after adding rows.
     const summary=section.getByText('Preisabgleich ergänzen: eigene Vergleichsangebote',{exact:true});
     await summary.click();
     const row=section.locator('.trade-item').nth(i);
     for(const [field,value]of Object.entries({title:side==='give'?'Unlisted Device A':'Unlisted Device B',price:String((side==='give'?500:1350)+i*50),url:`https://example.com/${side}/${i}`,description:''}))await row.locator(`[data-set-field="${field}"]`).fill(value);
   }
 }
 await page.locator('[data-trade="giveQuantity"]').fill('2');
 const give=page.locator('.trade-side').first();await give.getByText('Lieferumfang, Mängel & Zusatzgeräte',{exact:true}).click();
 await give.locator('[data-action="trade-row-add"][data-type="Items"]').click();
 await give.locator('[data-set-type="Items"][data-set-field="name"]').fill('Sony DualSense');
 await give.locator('[data-set-type="Items"][data-set-field="quantity"]').fill('2');
 await give.locator('[data-set-type="Items"][data-set-field="variant"]').fill('V2');
 await give.locator('[data-set-type="Items"][data-set-field="condition"]').selectOption('Gut');await give.locator('[data-set-type="Items"][data-set-field="manualValue"]').fill('50');
 await page.locator('[data-action="value-both"]').click();
 await page.locator('[data-action="save-trade"]').waitFor();
 assert.equal(requests.length,2);assert.equal(requests[0].accessories[0].condition,'Gut');assert.equal(requests[0].accessories[0].manualValue,50);
 assert.equal(await page.locator('#give-total').textContent(),'1.200 €');assert.equal(await page.locator('#receive-total').textContent(),'1.400 €');
 await page.locator('[data-action="trade-fair-cash"]').click();assert.equal(await page.locator('.big-value').textContent(),'0 €');assert.equal(await page.locator('[data-trade="cashAmount"]').inputValue(),'200');
 await page.locator('[data-action="trade-swap"]').click();assert.equal(await page.locator('[data-trade="giveName"]').inputValue(),'Unlisted Device B');assert.equal(await page.locator('[data-trade="cashDirection"]').inputValue(),'receive');assert.equal(await page.locator('.big-value').textContent(),'0 €');
 await page.locator('[data-action="save-trade"]').click();await page.getByText('Tauschbewertung lokal gespeichert.',{exact:true}).waitFor();
 const stored=await(await page.request.get(s.base+'/api/store')).json();assert.equal(stored.trades[0].giveName,'Unlisted Device B');assert.equal(stored.trades[0].details.receiveItems[0].condition,'Gut');assert.equal(stored.trades[0].details.receiveValuation.answer.base.basis,'user-reference');
 await page.screenshot({path:path.join(root,'tests','Tauschrechner-1.7-PC.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Handyansicht ohne horizontalen Überlauf');await page.screenshot({path:path.join(root,'tests','Tauschrechner-1.7-Handy.png'),fullPage:true});
 await page.locator('[data-action="value-mode"][data-side="give"][data-mode="manual"]').click();await page.locator('[data-action="value-mode"][data-side="receive"][data-mode="manual"]').click();
 await page.locator('[data-trade="giveBase"]').fill('1.400,50');await page.locator('[data-trade="receiveBase"]').fill('1.200,50');assert.equal(await page.locator('.big-value').textContent(),'0 €');assert.equal(await page.locator('#give-total').textContent(),'1.400,50 €');
 await page.locator('[data-trade="cashDirection"]').selectOption('none');assert.equal(await page.locator('.big-value').textContent(),'-200 €');assert.ok(await page.locator('[data-trade="cashAmount"]').isDisabled());
 assert.deepEqual(errors,[]);console.log('Neuer Tauschrechner: freie Modelle, eigene Vergleichsangebote, Extras mit eigenem Zustand/Variante, Mengen, beide Sets, faire Zuzahlung, Seitenwechsel, Dezimalwerte, Speicherung und mobile Ansicht bestanden.');
}finally{await browser.close();await s.stop();}
