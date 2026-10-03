import test from 'node:test';
import assert from 'node:assert/strict';
import {extractImageCandidates,imageModelMatches,extractDevice} from '../online-parser.mjs';
import {loadProductImage} from '../device-images.mjs';
import {imageMime} from '../remote.mjs';
import {validateStore} from '../core.mjs';

const name='Samsung Galaxy S25',source='https://example.com/galaxy-s25';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
const html='<title>Samsung Galaxy S25 - Specifications</title><meta property="og:image" content="/s25.png"><h1>Samsung Galaxy S25</h1><table><tr><th>Display</th><td>OLED</td></tr></table>';
test('Modelle unterscheiden Generationen und Pro/Max/Ultra; Speicher ist für das Bild egal',()=>{
  assert.ok(imageModelMatches('iPhone 18 Pro · 256 GB','Apple iPhone 18 Pro'));
  assert.ok(imageModelMatches('Galaxy S25 256 GB','Samsung Galaxy S25'));
  for(const candidate of ['iPhone 17 Pro','iPhone 18 Pro Max','iPhone 18'])assert.equal(imageModelMatches('iPhone 18 Pro',candidate),false);
  assert.equal(imageModelMatches('Galaxy S25','Galaxy S25 Ultra'),false);
  assert.equal(imageModelMatches('Galaxy S25+','Galaxy S25'),false);
  assert.equal(imageModelMatches('GeForce RTX 5080','Gigabyte AORUS GeForce RTX 5080 Master'),false);
  assert.equal(imageModelMatches('GeForce RTX 5080','PNY GeForce RTX 5080 ARGB Overclocked Triple Fan'),false);
  assert.equal(imageModelMatches('GeForce RTX 5080','NVIDIA GeForce RTX 5080 Specs'),true);
});
test('Passendes Product-JSON-LD, relative URLs und Modellbilder werden priorisiert',()=>{
  const json=[{'@type':'Product',name:'Galaxy S25 Ultra',image:'https://example.com/ultra.jpg'},{'@type':'Product',name,image:{contentUrl:'/correct.png'}}];
  const candidates=extractImageCandidates(`<script type="application/ld+json">${JSON.stringify(json)}</script>`+html,source,{name});
  assert.equal(candidates[0].url,'https://example.com/correct.png');assert.ok(!candidates.some(c=>c.url.includes('ultra')));
});
test('Keine Logos, Chipsymbole, internen Schemas oder Bilder fremder Modelle',()=>{
  const bad='<title>Galaxy S25 Ultra</title><meta property="og:image" content="/ultra.png"><img alt="Galaxy S25" src="javascript:alert(1)"><img alt="Galaxy S25" src="/logo.png"><img alt="Galaxy S25" src="/icon_chip.png"><nav><img alt="Galaxy S25" src="/navigation.png"></nav><img src="/galaxy-s25/specs/unrelated-photo.png"><img alt="Galaxy S25" src="/site/localnav/duo.png">';
  assert.deepEqual(extractImageCandidates(bad,source,{name}),[]);
});
test('Ausgeschlossene Quellen liefern auch keine Produktbilder',()=>{
  const doc='<title>PlayStation 5 - Wikipedia</title><img src="/navigation.png"><table class="infobox"><tr><td><img src="//upload.wikimedia.org/model.png" width="250"></td></tr></table>';
  assert.deepEqual(extractImageCandidates(doc,'https://en.wikipedia.org/wiki/PlayStation_5',{name:'PlayStation 5',provider:'wikipedia'}),[]);
});
test('Bilddownload speichert Binärdaten mit Quelle offline; erster Fehler erlaubt Fallback',async()=>{
  const doc=html+'<img alt="Samsung Galaxy S25" src="/second.png">';let requests=0;
  const image=await loadProductImage(doc,source,{name},'website',async url=>{requests++;if(requests===1)throw Error('blocked');return {bytes:png,contentType:'image/png',url};});
  assert.equal(requests,2);assert.equal(image.data,'data:image/png;base64,'+png.toString('base64'));assert.equal(image.source,source);
  const device=extractDevice(html,source);device.image=image;validateStore({version:1,devices:[device],trades:[],savedComparisons:[{id:'saved',name:'Vergleich',date:'2026-10-03',devices:[structuredClone(device)]}]});
});
test('Fehlende oder gesperrte Bilder lassen Gerätedaten erhalten',async()=>{
  assert.equal(await loadProductImage(html,source,{name},'website',async()=>{throw Error('403');}),null);
  const device=extractDevice(html,source);validateStore({version:1,devices:[device],trades:[]});assert.ok(!device.image);
});
test('Nur Rasterdateien und begrenzte sichere Bildmetadaten sind im Backup erlaubt',()=>{
  assert.equal(imageMime(png),'image/png');assert.equal(imageMime(Buffer.from('<svg onload="alert(1)"></svg>')),null);
  const device=extractDevice(html,source);const image={data:'data:image/png;base64,'+png.toString('base64'),url:source+'/photo.png',source,alt:name};
  for(const change of [{data:'data:image/svg+xml;base64,PHN2Zz4='},{data:'data:image/png;base64,'+'A'.repeat(700001)},{source:''},{source:'https://user:secret@example.com'},{url:'javascript:alert(1)'}]){
    device.image={...image,...change};assert.throws(()=>validateStore({version:1,devices:[device],trades:[]}),/Produktbild/);
  }
});
