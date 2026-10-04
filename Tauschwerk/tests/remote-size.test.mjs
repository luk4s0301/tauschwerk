import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import dns from 'node:dns/promises';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import zlib from 'node:zlib';
import {fetchPublicText,fetchPublicImage} from '../remote.mjs';
import {extractDevice} from '../online-parser.mjs';

function responses(t,handler){
  t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
  t.mock.method(https,'request',(url,options,callback)=>{
    const request=new EventEmitter();request.destroy=()=>{};
    request.end=()=>queueMicrotask(()=>{
      const data=handler(url),response=new PassThrough();
      response.statusCode=data.code||200;
      response.headers={'content-type':data.type||'text/html',...data.headers};
      callback(response);response.end(data.body||'');
    });return request;
  });
}
const largeHTML='<h1>Samsung Galaxy S25</h1><script>'+ 'x'.repeat(7*1024*1024)+'</script><dl><dt>RAM</dt><dd>12 GB</dd></dl>';
test('Samsung-Datenblatt über 6 MB bleibt vollständig lesbar, auch gzip-komprimiert',async t=>{
  responses(t,()=>({headers:{'content-encoding':'gzip'},body:zlib.gzipSync(largeHTML)}));
  const url='https://www.samsung.com/de/galaxy-s25/specs/';
  const response=await fetchPublicText(url);
  assert.equal(response.text,largeHTML);
  const d=extractDevice(response.text,response.url,{provider:'manufacturer'});
  assert.equal(d.specs.find(s=>s.key==='Arbeitsspeicher').value,'12 GB');
});
test('Andere Quellen und ähnlich benannte Domains erhalten kein höheres Limit',async t=>{
  responses(t,()=>({body:largeHTML}));
  for(const url of ['https://example.com/specs','https://samsung.com.example.com/specs'])await assert.rejects(()=>fetchPublicText(url),/maximal 6 MB/);
});
test('Weiterleitung von Samsung auf andere Quelle prüft deren Limit',async t=>{
  responses(t,url=>url.hostname==='www.samsung.com'?{code:302,headers:{location:'https://example.com/specs'}}:{body:largeHTML});
  await assert.rejects(()=>fetchPublicText('https://www.samsung.com/specs'),/maximal 6 MB/);
});
test('Herstellerlimit gilt nach Dekomprimierung und Bilder bleiben begrenzt',async t=>{
  responses(t,()=>({headers:{'content-encoding':'gzip'},body:zlib.gzipSync('x'.repeat(24*1024*1024+1))}));
  await assert.rejects(()=>fetchPublicText('https://www.samsung.com/specs'),/maximal 24 MB/);
  t.mock.restoreAll();
  responses(t,()=>({type:'image/png',body:Buffer.alloc(512*1024+1)}));
  await assert.rejects(()=>fetchPublicImage('https://www.samsung.com/photo.png'),/maximal 512 KB/);
});
