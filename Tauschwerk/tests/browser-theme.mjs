import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
import {launchIngress} from './ingress-helper.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const server=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const ha=await launchIngress(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const theme=()=>page.locator('[role="switch"][aria-label="Dunkle Darstellung"]');
const ready=async p=>p.locator('#sidebar .nav').waitFor();
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
// Check contrast against each gradient endpoint and the composited parent surfaces.
async function contrast(selector,min=4.5,pseudo=null){
 const values=await page.locator(selector).evaluateAll((elements,pseudo)=>{
  const rgba=value=>{const nums=value.match(/[\d.]+/g)?.map(Number)||[];return [nums[0]||0,nums[1]||0,nums[2]||0,nums[3]??1];};
  const over=(top,bottom)=>top.slice(0,3).map((n,i)=>n*top[3]+bottom[i]*(1-top[3]));
  const luminance=color=>color.reduce((sum,n,i)=>{const x=n/255;return sum+[.2126,.7152,.0722][i]*(x<=.04045?x/12.92:((x+.055)/1.055)**2.4);},0);
  return elements.filter(el=>el.getClientRects().length).map(el=>{
   const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);let backgrounds=[[255,255,255]];
   for(const node of chain){const style=getComputedStyle(node);backgrounds=backgrounds.map(bg=>over(rgba(style.backgroundColor),bg));const stops=style.backgroundImage.match(/rgba?\([\d.,\s]+\)/g);if(stops)backgrounds=backgrounds.flatMap(bg=>stops.map(c=>over(rgba(c),bg)));}
   const foreground=rgba(getComputedStyle(el,pseudo).color);return {text:(el.textContent||el.getAttribute('placeholder')||el.tagName).slice(0,50),ratio:Math.min(...backgrounds.map(bg=>{const a=luminance(over(foreground,bg)),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);} ))};
  });
 },pseudo);
 for(const value of values)assert.ok(value.ratio>=min,selector+' '+value.text+' Kontrast '+value.ratio.toFixed(2)+' < '+min);
}
try{
 await page.goto(server.url);await ready(page);assert.equal(await theme().getAttribute('aria-checked'),'false');
 // Follow the OS until an explicit selection, then preserve the user's choice.
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await theme().focus();await page.keyboard.press('Space');assert.equal(await theme().getAttribute('aria-checked'),'false');assert.ok(await theme().evaluate(el=>el===document.activeElement));
 await page.emulateMedia({colorScheme:'dark'});assert.equal(await theme().getAttribute('aria-checked'),'false');
 const storeBefore=await(await page.request.get(server.base+'/api/store')).json();
 await theme().click();await page.reload();await ready(page);assert.equal(await theme().getAttribute('aria-checked'),'true');assert.equal((await(await page.request.get(server.base+'/api/store')).json()).devices.length,storeBefore.devices.length);
 const other=await context.newPage();await other.goto(server.url);await ready(other);await theme().click();await other.waitForFunction(()=>document.documentElement.dataset.theme==='light');await other.close();await theme().click();
 for(const width of [1440,1050,800,760,390,320]){
  await page.setViewportSize({width,height:width<760?844:1000});
  for(const view of ['compare','catalog','trade','history','settings']){await page.locator('#sidebar [data-view="'+view+'"]').click();await noOverflow();await contrast('h1, .subtitle, .device-name, .device-sub, .spec-table th, .spec-table td, .help, .card-value small, .pill, .result-panel p, .warning-note, .code-path, .btn');}
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#sidebar [data-view="compare"]').click();await page.screenshot({path:path.join(root,'tests','Swivo-Dark-PC.png')});
 await page.locator('.btn.primary').first().hover();await contrast('.btn.primary');await page.mouse.move(0,0);
 await page.locator('[data-action="new"]').first().click();await page.locator('#device-form').waitFor();await contrast('dialog h2, dialog .help, dialog .field, dialog input');await contrast('dialog input',4.5,'::placeholder');await page.locator('[name="name"]').fill('Ungespeicherte Eingabe');
 // The switch changes only chrome/styles: unsubmitted inputs remain intact.
 await page.evaluate(()=>window.SwivoTheme.toggle());assert.equal(await page.locator('[name="name"]').inputValue(),'Ungespeicherte Eingabe');await contrast('dialog h2, dialog .help, dialog .field, dialog input');await page.evaluate(()=>window.SwivoTheme.toggle());await page.screenshot({path:path.join(root,'tests','Swivo-Dark-Editor.png')});await page.locator('[data-action="close-modal"]').first().click();
 await page.locator('#sidebar [data-view="trade"]').click();for(const side of ['give','receive'])await page.locator('[data-action="value-mode"][data-side="'+side+'"][data-mode="manual"]').click();
 for(const [give,receive,state] of [[600,800,'positive'],[800,600,'negative'],[600,600,'balanced']]){await page.locator('[data-trade="giveBase"]').fill(String(give));await page.locator('[data-trade="receiveBase"]').fill(String(receive));await page.locator('.result-panel.'+state).waitFor();await contrast('.result-panel .big-value, .result-panel p, .warning-note, .pill');}
 await page.screenshot({path:path.join(root,'tests','Swivo-Dark-Tausch.png')});
 await page.route('**/api/online/search**',route=>route.fulfill({status:502,json:{error:'HTTP 403: Quelle blockiert den Abruf.',attempts:[{url:'https://www.nintendo.com/specs/',stage:'Abruf',error:'HTTP 403'}]}}));
 await page.locator('[data-mode="online"]').click();await page.locator('#online-query').fill('Switch 2');await page.locator('#online-search-form [type="submit"]').click();await page.locator('.online-alert.error').waitFor();await page.locator('.import-diagnostics summary').click();await contrast('.online-alert, .import-diagnostics p, .import-diagnostics .pill, .source-hint');
 await page.setViewportSize({width:390,height:844});await noOverflow();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(root,'tests','Swivo-Dark-Handy.png')});
 await theme().focus();await page.keyboard.press('Enter');assert.equal(await theme().getAttribute('aria-checked'),'false');await noOverflow();await contrast('.online-alert, .import-diagnostics p');await page.locator('[data-mode="offline"]').click();await page.locator('#sidebar [data-view="compare"]').click();await contrast('.device-name, .device-sub, .spec-table th, .spec-table td, .pill');
 // HA browsers keep separate preferences; the theme file is served inside ingress.
 const darkContext=await browser.newContext({colorScheme:'dark'}),lightContext=await browser.newContext({colorScheme:'light'});const a=await darkContext.newPage(),b=await lightContext.newPage();
 await a.goto(ha.url);await b.goto(ha.url);await ready(a);await ready(b);assert.equal(await a.locator('.theme-switch').getAttribute('aria-checked'),'true');assert.equal(await b.locator('.theme-switch').getAttribute('aria-checked'),'false');await a.locator('.theme-switch').click();await a.reload();await ready(a);assert.equal(await a.locator('.theme-switch').getAttribute('aria-checked'),'false');
 // Blocked browser storage must not prevent startup or switching.
 const blocked=await browser.newContext({colorScheme:'dark'});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError');}});});const p=await blocked.newPage();await p.goto(server.url);await ready(p);assert.equal(await p.locator('.theme-switch').getAttribute('aria-checked'),'true');await p.locator('.theme-switch').click();assert.equal(await p.locator('.theme-switch').getAttribute('aria-checked'),'false');
 assert.deepEqual(errors,[]);console.log('Themes: Systemvorgabe, Tastatur, Persistenz, Tab-Abgleich, sechs Breiten, Kontraste, Formulare, Tauschzustände, Fehlerdetails, getrennte HA-Browser und blockierter Speicher geprüft.');
}finally{await browser.close();await server.stop();await ha.stop();}
