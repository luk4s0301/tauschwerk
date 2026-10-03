import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {root} from './helper.mjs';
import {launchIngress} from './ingress-helper.mjs';
import {isIngressRequest,ingressBase} from '../server-policy.mjs';
import {validateStore,mergeDeviceDraft} from '../core.mjs';
test('Gleichzeitige Geräteänderungen erhalten andere Felder und melden echte Konflikte',()=>{
  const original={id:'a',name:'Handy',notes:'',value:null,specs:[]};
  const draft={...original,value:123};const current={...original,notes:'Vom anderen Gerät'};
  assert.deepEqual(mergeDeviceDraft(original,draft,current),{...current,value:123});
  assert.throws(()=>mergeDeviceDraft(original,draft,{...current,value:456}),/gleiche Gerätefeld/);
  assert.throws(()=>mergeDeviceDraft(original,draft,null),/entfernt/);
});
test('Ingress akzeptiert nur die echte Supervisor-Verbindung und sichere Pfade',()=>{
  assert.equal(isIngressRequest({socket:{remoteAddress:'172.30.32.2'}}),true);
  assert.equal(isIngressRequest({socket:{remoteAddress:'::ffff:172.30.32.2'}}),true);
  for(const ip of ['127.0.0.1','192.168.1.5','172.30.32.3'])assert.equal(isIngressRequest({socket:{remoteAddress:ip},headers:{'x-forwarded-for':'172.30.32.2'}}),false);
  assert.equal(ingressBase('/api/hassio_ingress/abc_def-12'),'/api/hassio_ingress/abc_def-12/');
  for(const value of ['https://evil.example','//evil.example','/api/hassio_ingress/a"','/api/hassio_ingress/a/../../'])assert.equal(ingressBase(value),null);
});
test('Gemeinsamer Server: Anmeldung über Ingress, zwei Geräte, Konflikte und Neustart',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'tests','server-data-'));let s=await launchIngress(dir);
  const get=()=>fetch(s.base+'/api/store');
  const put=(data,etag)=>fetch(s.base+'/api/store',{method:'PUT',headers:{'Content-Type':'application/json',...(etag?{'If-Match':etag}:{})},body:JSON.stringify(data)});
  try{
    assert.equal((await fetch(s.origin+'/api/store',{headers:{'X-Forwarded-For':'172.30.32.2'}})).status,403);
    assert.equal((await (await fetch(s.base+'/api/meta')).json()).shared,true);
    const page=await fetch(s.url);assert.match(await page.text(),/<base href="\/api\/hassio_ingress\/test\/">/);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'self'/);
    const first=await get();const a=await first.json();const etag=first.headers.get('etag');
    const second=await get();const b=await second.json();
    assert.equal((await put(a)).status,428);
    a.devices[0].value=711;a.ui={mode:'offline'};
    a.savedComparisons=[{id:'compare-test',name:'Gemerkter Vergleich',date:'2026-10-02',devices:[structuredClone(a.devices[0]),structuredClone(a.devices[1])]}];
    const saved=await put(a,etag);assert.equal(saved.status,200);
    b.devices[1].value=999;assert.equal((await put(b,second.headers.get('etag'))).status,409);
    const latest=await get();const data=await latest.json();assert.equal(data.devices[0].value,711);assert.equal(data.devices[1].value,null);assert.equal(data.ui,undefined);assert.equal(data.savedComparisons.length,1);
    data.devices[1].value=999;assert.equal((await put(data,latest.headers.get('etag'))).status,200);
    assert.equal((await fetch(s.base+'/api/online/device?url=https://127.0.0.1')).status,409);
    assert.equal((await fetch(s.base+'/api/online/device?url=https://127.0.0.1',{headers:{'X-Tauschwerk-Mode':'online'}})).status,502);
    await s.stop();s=await launchIngress(dir);const restored=await (await get()).json();assert.equal(restored.devices[1].value,999);assert.equal(restored.savedComparisons[0].devices[1].value,null);
    await s.stop();
    fs.writeFileSync(path.join(dir,'online-cache.json'),JSON.stringify([{url:'https://example.com/specs',time:Date.now(),device:restored.devices[0],imageVersion:2}]));
    s=await launchIngress(dir);
    const cached=await (await fetch(s.base+'/api/online/device?url=https://example.com/specs',{headers:{'X-Tauschwerk-Mode':'online'}})).json();
    assert.equal(cached.cached,true);assert.equal(cached.device.name,restored.devices[0].name);
    const bad=structuredClone(restored);bad.savedComparisons[0].devices[0].name='';assert.throws(()=>validateStore(bad));
  }finally{await s.stop();}
});
