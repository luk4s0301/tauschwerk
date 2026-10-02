import {searchOnline,retrieveOnline} from '../online.mjs';
import {validateStore} from '../core.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {root} from './helper.mjs';
import path from 'node:path';
const results=[];
for(const query of ['iPhone 17 Pro','Steam Deck','Apple Watch Series 10']) {
  const search=await searchOnline(query,'en',{source:'wikipedia'});assert.ok(search.results.length>0);
  const first=search.results[0];const data=await retrieveOnline(first.url);validateStore({version:1,devices:[data.device],trades:[]});
  results.push(data.device);console.log(JSON.stringify({query,result:first.title,category:data.device.category,brand:data.device.brand,specs:data.device.specs.length,sample:data.device.specs.slice(0,6)}));
}
let support;
for(const url of ['https://support.apple.com/en-us/122209','https://support.apple.com/de-de/125090','https://support.apple.com/en-us/111834']){
  try{support=await retrieveOnline(url);console.log(JSON.stringify({source:url,name:support.device.name,specs:support.device.specs.length,sample:support.device.specs.slice(0,4)}));break;}catch(e){console.log('Quelle nicht erreichbar: '+url+' · '+e.message);}
}
assert.ok(support,'Mindestens ein echtes Hersteller-Datenblatt muss erreichbar sein.');validateStore({version:1,devices:[support.device],trades:[]});assert.ok(support.device.specs.length>=5);results.push(support.device);
fs.writeFileSync(path.join(root,'tests','online-live-results.json'),JSON.stringify(results,null,2));
console.log('Live-Prüfung bestanden: drei Gerätesuchen und ein Hersteller-Datenblatt.');
