import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {launch,root} from './helper.mjs';
test('Lokaler Server: Zugriffsschutz, Persistenz, Backup und Neustart',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'tests','server-data-'));
  let s=await launch(dir);
  try {
    assert.equal((await fetch(s.base+'/api/store')).status,401);
    assert.equal((await fetch(s.base+'/api/store',{headers:{Cookie:s.cookie,Origin:'https://fremde-seite.example'}})).status,403);
    const data=await (await fetch(s.base+'/api/store',{headers:{Cookie:s.cookie}})).json();assert.equal(data.devices.length,17);
    assert.equal((await fetch(s.base+'/api/online/search?q=iphone',{headers:{Cookie:s.cookie}})).status,409);
    const put=payload=>fetch(s.base+'/api/store',{method:'PUT',headers:{Cookie:s.cookie,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    assert.equal((await put({version:1,devices:[],trades:'invalid'})).status,400);
    data.devices[0].value=625;assert.equal((await put(data)).status,200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'tauschwerk.json'),'utf8')).devices[0].value,625);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'tauschwerk.json.bak'),'utf8')).devices[0].value,null);
    data.ui={mode:'online'};assert.equal((await put(data)).status,200);
    assert.equal((await fetch(s.base+'/api/online/device?url='+encodeURIComponent('https://127.0.0.1'),{headers:{Cookie:s.cookie}})).status,502);
    assert.equal((await fetch(s.base+'/../../catalog.json',{headers:{Cookie:s.cookie}})).status,404);
    assert.equal((await fetch(s.base+'/core.mjs',{headers:{Cookie:s.cookie}})).status,200);
    await s.stop();s=await launch(dir);
    assert.equal((await (await fetch(s.base+'/api/store',{headers:{Cookie:s.cookie}})).json()).devices[0].value,625);
  } finally {await s.stop();}
});
