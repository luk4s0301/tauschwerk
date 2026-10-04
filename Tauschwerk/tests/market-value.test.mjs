import test from 'node:test';import assert from 'node:assert/strict';
import {modelMatches,conditionOf,parseClassifieds,readClassified,parseRebuy,parseIdealo,summarizePrices,valueSet} from '../market-value.mjs';
const profile={name:'Galaxy S25',variant:'256 GB',condition:'Sehr gut',contents:'',issues:''};
const row=(price,n,other={})=>({title:'Samsung Galaxy S25 256GB',url:'https://www.kleinanzeigen.de/s-anzeige/test/'+n,price,source:'Kleinanzeigen',kind:'private-asking',condition:'Sehr gut',description:'Mit OVP, Rechnung und USB-C-Kabel.',verified:true,...other});
test('exact model and numeric variants exclude similar phones, RAM/storage and Pro consoles',()=>{
 assert.ok(modelMatches('Samsung Galaxy S25 256GB Navy','Galaxy S25','256 GB'));
 assert.ok(modelMatches('Galaxy S25 256GB black','Galaxy S25','256GB Schwarz'));
 assert.equal(modelMatches('Galaxy S25 256GB navy','Galaxy S25','256GB Schwarz'),false);
 for(const title of ['Galaxy S25 Ultra 256GB','Galaxy S25+ 256GB','Galaxy S25 FE 256GB','Galaxy S24 256GB','Galaxy S25 128GB/256GB'])assert.equal(modelMatches(title,'Galaxy S25','256GB'),false,title);
 assert.equal(modelMatches('Sony PlayStation 5 Pro','PlayStation 5'),false);
 assert.ok(modelMatches('Sony PS5 Pro 2TB','PlayStation 5 Pro','2TB'));
 assert.equal(modelMatches('2x Sony DualSense','Sony DualSense'),false);
 assert.equal(modelMatches('ThinkPad T14 16GB 256GB SSD','ThinkPad T14','16GB 512GB'),false);
});
test('condition categories do not quietly collapse into a guessed percentage',()=>{
 assert.equal(conditionOf('neuwertig'), 'Wie neu');assert.equal(conditionOf('Sehr Gut'), 'Sehr gut');assert.equal(conditionOf('Defekt Displaybruch'),'Defekt');assert.equal(conditionOf('neu ungeöffnet'),'Neu');
});
test('classifieds parser ignores wanted ads, commercial PRO and old struck prices',()=>{
 const ad=(title,tail='')=>`<article data-href="/s-anzeige/test/123"><h3>${title}</h3><p>420 € VB</p><s>500 €</s>${tail}</article>`;
 assert.equal(parseClassifieds(ad('Galaxy S25 256GB'))[0].price,420);
 assert.equal(parseClassifieds(ad('Ankauf Galaxy S25 256GB')).length,0);
 assert.equal(parseClassifieds(ad('Galaxy S25 256GB','<span>PRO</span>')).length,0);
});
test('detail page verifies private seller, current price and full description',()=>{
 const html='<h1>Galaxy S25 256GB</h1><h2 id="viewad-price">420 € VB</h2><li>Zustand<span>Sehr Gut</span></li><p id="viewad-description-text">Mit Rechnung.</p><span>Privater Nutzer</span>';
 const r=readClassified(html,row(500,1));assert.equal(r.price,420);assert.equal(r.condition,'Sehr gut');assert.equal(r.verified,true);
 assert.equal(readClassified(html.replace('Privater Nutzer','Gewerblicher Nutzer'),row(500,1)),null);
});
test('reBuy cents and in-stock conditions are separate from hidden purchase prices',()=>{
 const docs=[{id:12,name:'Galaxy S25 256GB',category_sanitized_name:'handy',product_sanitized_name:'galaxy-s25',variants:[{label:'A2',price:51299,purchasePrice:34337,quantity:2},{label:'A3',price:45699,quantity:0}]}];
 const html='<script id="ry-inject" type="application/json">'+JSON.stringify({productListViewDto:{searchResponse:{products:{docs}}}})+'</script>';
 const rows=parseRebuy(html);assert.equal(rows.length,1);assert.equal(rows[0].price,512.99);assert.equal(rows[0].kind,'dealer-used');assert.equal(rows[0].condition,'Sehr gut');
});
test('idealo new and unspecified used ab-prices stay context only',()=>{
 const html='<h1 id="oopStage-title">Galaxy S25 256GB</h1><div id="oopStage-conditionButton-used"><strong>499,00 €</strong><div class="oopStage-conditionButton-arrow"></div><div id="oopStage-conditionButton-new"><strong>559,89 €</strong><div class="oopStage-conditionButton-arrow"></div>';
 const rows=parseIdealo(html,{url:'https://www.idealo.de/test'});assert.deepEqual(rows.map(r=>r.price),[499,559.89]);assert.equal(summarizePrices(rows,profile).estimate,null);
});
test('median and range use only verified condition/contents match and reject outliers',()=>{
 const rows=[row(400,1),row(450,2),row(500,3),row(99999,4),row(200,5,{condition:'Defekt'}),row(900,6,{kind:'new-reference'}),row(100,7,{verified:false})];
 const s=summarizePrices(rows,{...profile,contents:'OVP; Rechnung; Ladekabel'});assert.equal(s.estimate.value,450);assert.equal(s.estimate.low,400);assert.equal(s.estimate.high,500);assert.equal(s.used.length,3);
 assert.equal(summarizePrices(rows,{...profile,issues:'Displaybruch'}).estimate,null);
 assert.equal(summarizePrices(rows.slice(0,2),profile).estimate,null);
});
test('dealer fallback is labelled and never pooled with private asking prices',()=>{
 const rows=[row(100,1),...Array.from({length:3},(_,i)=>row(500+i*10,i+2,{kind:'dealer-used',source:'reBuy'}))];const s=summarizePrices(rows,profile);assert.equal(s.basis,'dealer-used');assert.equal(s.estimate.value,510);assert.equal(s.estimate.confidence,'gering');
});
test('explicit extras already in base bundle cannot be added twice',()=>{
 const rows=[1,2,3].map(i=>row(450,i,{description:'Mit Sony DualSense Controller'}));assert.equal(summarizePrices(rows,{...profile,accessories:[{name:'Sony DualSense',quantity:1}]}).estimate,null);
});
test('different storage configurations are never silently pooled',()=>{
 const rows=[row(400,1,{title:'Galaxy S25 128GB'}),row(450,2),row(550,3,{title:'Galaxy S25 512GB'})];assert.equal(summarizePrices(rows,{...profile,variant:''}).estimate,null);
});
test('failed providers and missing accessories never create invented set prices',async()=>{
 const result=await valueSet({...profile,accessories:[{name:'Sony DualSense',quantity:2}]},async()=>{throw Error('Quelle gesperrt');});assert.equal(result.estimate,null);assert.equal(result.accessories.length,1);assert.equal(result.base.sources.length,5);assert.ok(result.base.sources.filter(s=>s.status!=='browser').every(s=>s.status==='error'));
 await assert.rejects(valueSet({...profile,accessories:[{name:'x',quantity:100}]}),/Zubehör/);
});
test('complete set sums component quantities and observed ranges',async()=>{
 const fake=async url=>{const u=new URL(url);if(!u.hostname.includes('rebuy'))return {text:'',url};const name=u.searchParams.get('q').trim(),accessory=name==='Sony DualSense';const docs=[0,1,2].map(i=>({id:(accessory?200:100)+i,name:name+' color'+i,category_sanitized_name:'elektronik',product_sanitized_name:'device-'+i,variants:[{quantity:1,label:'A2',price:((accessory?40:300)+i*10)*100}]}));return {text:'<script id="ry-inject" type="application/json">'+JSON.stringify({productListViewDto:{searchResponse:{products:{docs}}}})+'</script>',url};};
 const result=await valueSet({name:'Test Device',condition:'Sehr gut',accessories:[{name:'Sony DualSense',quantity:2}]},fake);
 assert.equal(result.estimate.value,410);assert.equal(result.estimate.low,380);assert.equal(result.estimate.high,440);assert.equal(result.kind,'Händlerorientierung');
});

test('duplicates cannot turn one private offer into three observations',()=>{
 const one=row(400,1);const s=summarizePrices([one,{...one},{...one}],profile);assert.equal(s.estimate,null);assert.equal(s.evidence.length,1);
});
test('negated delivery items are excluded with an explanation',()=>{
 const rows=[1,2,3].map(i=>row(400,i,{description:'Ohne Rechnung, mit OVP und Kabel'}));const s=summarizePrices(rows,{...profile,contents:'Rechnung'});assert.equal(s.estimate,null);assert.ok(s.evidence.every(r=>r.exclusion==='Lieferumfang nicht bestätigt'));
});
test('dealer tier remains available when private candidates fail after outlier removal',()=>{
 const rows=[row(10,1),row(400,2),row(99999,3),...[1,2,3].map(i=>row(500+i*10,i+3,{kind:'dealer-used'}))];assert.equal(summarizePrices(rows,profile).basis,'dealer-used');
});
test('own reference prices are isolated and validated instead of mixed with dealer or private prices',async()=>{
 const comparisons=[1,2,3].map(i=>({title:'Galaxy S25 256GB',price:400+i*10,condition:'Sehr gut',description:'Mit Rechnung',url:'https://example.com/offer/'+i}));
 const answer=await valueSet({...profile,comparisons},async()=>{throw Error('403');});assert.equal(answer.estimate.value,420);assert.equal(answer.kind,'Eigene Vergleichsangebote');assert.equal(answer.base.basis,'user-reference');
 assert.equal(answer.base.estimate.confidence,'gering');assert.ok(answer.base.evidence.every(r=>r.source==='Eigener Vergleich'));
 await assert.rejects(()=>valueSet({...profile,comparisons:[{...comparisons[0],url:'https://127.0.0.1/'}]}),/Lokale/);
});
test('extras use their own condition and variant; main-device quantity affects the full set',async()=>{
 const fake=async url=>{const u=new URL(url);if(!u.hostname.includes('rebuy'))return {text:'',url};const query=u.searchParams.get('q').trim();const extra=query.startsWith('Sony');const docs=[1,2,3].map(i=>({id:(extra?200:100)+i,name:query,category_sanitized_name:'elektronik',product_sanitized_name:'device-'+i,variants:[{quantity:1,label:extra?'A3':'A2',price:(extra?50:300)*100}]}));return {text:'<script id="ry-inject">'+JSON.stringify({productListViewDto:{searchResponse:{products:{docs}}}})+'</script>',url};};
 const answer=await valueSet({name:'Test Device',quantity:2,condition:'Sehr gut',accessories:[{name:'Sony DualSense',quantity:2,variant:'V2',condition:'Gut'}]},fake);
 assert.equal(answer.estimate.value,700);assert.equal(answer.accessories[0].condition,'Gut');assert.equal(answer.accessories[0].variant,'V2');
 await assert.rejects(()=>valueSet({...profile,quantity:0}),/Anzahl/);
});

test('tracking parameters do not turn one listing into several offers',()=>{
 const rows=[row(400,1),row(400,1,{url:row(400,1).url+'?utm_source=browser'}),row(400,1,{url:row(400,1).url+'#details'})];const answer=summarizePrices(rows,profile);assert.equal(answer.estimate,null);assert.equal(answer.evidence.length,1);
});

test('explicit accessory unit values complete a set without claiming online verification',async()=>{
 const comparisons=[1,2,3].map(i=>({title:'Galaxy S25 256GB',price:400+i*10,condition:'Sehr gut',description:'',url:'https://example.com/'+i}));let calls=0;
 const answer=await valueSet({...profile,comparisons,accessories:[{name:'Sony DualSense',quantity:2,condition:'Gut',manualValue:50}]},async()=>{calls++;throw Error('403');});
 assert.equal(answer.estimate.value,520);assert.equal(answer.kind,'Online & eigene Stückwerte');assert.equal(answer.accessories[0].basis,'manual');assert.equal(calls,3);
 await assert.rejects(()=>valueSet({...profile,accessories:[{name:'Sony DualSense',quantity:2,manualValue:-1}]}),/Stückwert/);
});
