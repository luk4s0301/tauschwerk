import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './helper.mjs';
import {launchIngress} from './ingress-helper.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const dir=fs.mkdtempSync(path.join(root,'tests','browser-data-'));
const s=await launchIngress(dir);
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const a=await browser.newPage({viewport:{width:1440,height:960},locale:'de-DE'});
const b=await browser.newPage({viewport:{width:390,height:844},locale:'de-DE'});
const errors=[];for(const p of [a,b])p.on('pageerror',e=>errors.push(e.message));
const view=(p,v)=>p.locator(`[data-action="view"][data-view="${v}"]`).click();
const stored=async()=>await (await a.request.get(s.base+'/api/store')).json();
async function add(p,name){await p.locator('[data-action="new"]').first().click();await p.locator('[name="name"]').fill(name);await p.locator('#device-form [type="submit"]').click();await p.locator('#modal').waitFor({state:'hidden'});}
try{
  await a.goto(s.url);await b.goto(s.url);await a.locator('.device-card').first().waitFor();await b.locator('.device-card').first().waitFor();
  assert.ok((await a.locator('#sidebar').textContent()).includes('Home-Assistant-Server'));
  await view(b,'catalog');await add(a,'Gemeinsames Testgerät');
  await b.getByRole('heading',{name:'Gemeinsames Testgerät',exact:true}).waitFor({timeout:20000});
  assert.equal((await stored()).devices.length,18);
  await view(a,'compare');await a.locator('[data-action="remember-comparison"]').click();
  await view(b,'saved');await b.locator('[data-action="open-comparison"]').waitFor({timeout:20000});
  await b.locator('[data-action="open-comparison"]').click();assert.equal(await b.locator('.device-card').count(),3);
  assert.equal(await b.locator('[data-action="mode"][data-mode="online"]').getAttribute('aria-pressed'),'true');
  assert.equal(await a.locator('[data-action="mode"][data-mode="offline"]').getAttribute('aria-pressed'),'true','Datenmodus darf andere Geräte nicht umschalten');
  await b.reload();await b.locator('.device-card').first().waitFor();assert.equal(await b.locator('.device-card').count(),3,'Online-Auswahl bleibt bei Browser-Neustart erhalten');
  await view(a,'catalog');await a.locator('#catalog-search').fill('Gemeinsames Testgerät');await a.locator('.catalog-card [data-action="edit"]').click();
  await view(b,'catalog');await b.locator('#catalog-search').fill('Gemeinsames Testgerät');await b.locator('.catalog-card [data-action="edit"]').click();
  await a.locator('[name="notes"]').fill('Änderung vom PC');await a.locator('#device-form [type="submit"]').click();await a.locator('#modal').waitFor({state:'hidden'});
  await b.locator('[name="value"]').fill('123,50');await b.locator('#device-form [type="submit"]').click();await b.locator('#modal .dialog-notice.error').waitFor();
  assert.equal(await b.locator('[name="value"]').inputValue(),'123,50');assert.equal((await stored()).devices.find(d=>d.name==='Gemeinsames Testgerät').notes,'Änderung vom PC');
  // Retrying merges changed fields and retains the other device's untouched notes.
  await b.locator('#device-form [type="submit"]').click();await b.locator('#modal').waitFor({state:'hidden'});
  const latest=(await stored()).devices.find(d=>d.name==='Gemeinsames Testgerät');assert.equal(latest.value,123.5);assert.equal(latest.notes,'Änderung vom PC');
  await view(b,'saved');await b.locator('[data-action="open-comparison"]').click();await b.screenshot({path:path.join(root,'tests','Home-Assistant-Handy.png'),fullPage:true});
  await view(a,'saved');await a.locator('[data-action="open-comparison"]').waitFor({timeout:20000});await a.screenshot({path:path.join(root,'tests','Home-Assistant-Server.png'),fullPage:true});
  assert.deepEqual(errors,[]);console.log('Server-Oberfläche geprüft: Ingress-Unterpfad, PC und Handy mit gemeinsamem Katalog, automatische Aktualisierung, gemerkte Vergleiche auf beiden Geräten, getrennte Ansichten/Modi und Schutz bei gleichzeitigen Änderungen.');
}finally{await browser.close();await s.stop();}
