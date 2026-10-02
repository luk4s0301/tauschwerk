// Optional network smoke test, independent of private user data.
import assert from 'node:assert/strict';
import {searchOnline,retrieveOnline} from '../online.mjs';
import {validateStore} from '../core.mjs';
for(const [query,manufacturer,brand] of [['ASUS Zenbook 14 UX3405','asus','ASUS'],['Dell XPS 13 9345','dell','Dell']]){
  const search=await searchOnline(query,'en',{source:'laptopmedia',manufacturer});
  const match=search.results.find(r=>r.url.includes('/laptop-specs/'));assert.ok(match,query+' muss eine konkrete Konfiguration liefern');
  const {device}=await retrieveOnline(match.url);validateStore({version:1,devices:[device],trades:[]});
  assert.equal(device.brand,brand);assert.equal(device.category,'Laptops');
  for(const key of ['Prozessor','Grafik','Display','Arbeitsspeicher','Speicher'])assert.ok(device.specs.some(s=>s.key===key),query+': '+key);
  console.log(JSON.stringify({query,results:search.results.length,source:device.source,name:device.name,specs:device.specs.length}));
}
