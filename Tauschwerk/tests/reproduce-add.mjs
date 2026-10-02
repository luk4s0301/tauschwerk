import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {launch,root} from './helper.mjs';
const {chromium}=await import(pathToFileURL(process.env.TAUSCHWERK_PLAYWRIGHT).href);
const s=await launch(fs.mkdtempSync(path.join(root,'tests','browser-data-')));
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
try {
  const page=await browser.newPage();await page.goto(s.url);
  await page.locator('[data-action="new"]').click();await page.locator('[name="name"]').fill('Eigener Test');
  await page.locator('[data-action="template"]').click();await page.locator('.spec-value').first().fill('OLED');
  await page.locator('[type="submit"]').click();await page.waitForTimeout(500);
  console.log(JSON.stringify({modalStillOpen:await page.locator('#modal').evaluate(d=>d.open),error:await page.locator('#toast').textContent(),hasErrorInsideDialog:await page.locator('#modal [role="alert"]').count()}));
}finally{await browser.close();await s.stop();}
