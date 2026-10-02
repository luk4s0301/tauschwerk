// Shared source labels and domain classification; no credentials or network calls.
export const manufacturers = [
  {id:'apple',name:'Apple',domains:['apple.com'],models:'iphone|ipad|macbook|imac|airpods|apple watch'},
  {id:'samsung',name:'Samsung',domains:['samsung.com'],models:'galaxy'},
  {id:'lenovo',name:'Lenovo',domains:['lenovo.com','lenovo.com.cn'],models:'thinkpad|thinkbook|ideapad|yoga|legion'},
  {id:'dell',name:'Dell / Alienware',domains:['dell.com'],models:'alienware|xps|latitude|inspiron'},
  {id:'hp',name:'HP',domains:['hp.com'],models:'elitebook|probook|spectre|victus|omen'},
  {id:'asus',name:'ASUS',domains:['asus.com'],models:'zenbook|vivobook|rog|tuf'},
  {id:'acer',name:'Acer',domains:['acer.com'],models:'aspire|swift|predator'},
  {id:'msi',name:'MSI',domains:['msi.com'],models:'katana|stealth|raider'},
  {id:'microsoft',name:'Microsoft / Xbox',domains:['microsoft.com','xbox.com'],models:'surface|xbox'},
  {id:'framework',name:'Framework',domains:['frame.work']},
  {id:'razer',name:'Razer',domains:['razer.com']},
  {id:'gigabyte',name:'Gigabyte',domains:['gigabyte.com'],models:'aorus'},
  {id:'google',name:'Google',domains:['google.com'],models:'pixel'},
  {id:'sony',name:'Sony / PlayStation',domains:['sony.com','sony.de','playstation.com'],models:'playstation'},
  {id:'nintendo',name:'Nintendo',domains:['nintendo.com','nintendo.de']},
  {id:'valve',name:'Valve',domains:['steampowered.com','steamdeck.com'],models:'steam deck'},
  {id:'amd',name:'AMD',domains:['amd.com'],models:'ryzen|radeon'},
  {id:'intel',name:'Intel',domains:['intel.com','intel.de'],models:'core ultra'},
  {id:'nvidia',name:'NVIDIA',domains:['nvidia.com'],models:'geforce'},
  {id:'garmin',name:'Garmin',domains:['garmin.com']},
  {id:'xiaomi',name:'Xiaomi',domains:['mi.com','xiaomi.com'],models:'redmi|poco'},
  {id:'oneplus',name:'OnePlus',domains:['oneplus.com']},
  {id:'nothing',name:'Nothing',domains:['nothing.tech']},
  {id:'huawei',name:'Huawei',domains:['huawei.com'],models:'matebook'},
  {id:'honor',name:'Honor',domains:['honor.com']},
  {id:'fairphone',name:'Fairphone',domains:['fairphone.com']},
  {id:'corsair',name:'Corsair',domains:['corsair.com']},
  {id:'logitech',name:'Logitech',domains:['logitech.com']},
  {id:'bose',name:'Bose',domains:['bose.com','bose.de']},
  {id:'lg',name:'LG',domains:['lg.com']},
  {id:'philips',name:'Philips',domains:['philips.com','philips.de']},
  {id:'tcl',name:'TCL',domains:['tcl.com']},
  {id:'panasonic',name:'Panasonic',domains:['panasonic.com']},
  {id:'canon',name:'Canon',domains:['canon.com','canon.de']},
  {id:'nikon',name:'Nikon',domains:['nikon.com','nikon.de']},
  {id:'gopro',name:'GoPro',domains:['gopro.com']},
  {id:'dji',name:'DJI',domains:['dji.com']},
  {id:'polar',name:'Polar',domains:['polar.com']},
  {id:'suunto',name:'Suunto',domains:['suunto.com']},
  {id:'withings',name:'Withings',domains:['withings.com']},
  {id:'fitbit',name:'Fitbit',domains:['fitbit.com']},
  {id:'bosch',name:'Bosch',domains:['bosch-home.com','bosch.com']},
  {id:'dyson',name:'Dyson',domains:['dyson.com','dyson.de']},
  {id:'roborock',name:'Roborock',domains:['roborock.com']},
  {id:'seagate',name:'Seagate',domains:['seagate.com']},
  {id:'western-digital',name:'Western Digital',domains:['westerndigital.com','wd.com'],models:'western digital|wd black|wd blue'},
  {id:'crucial',name:'Crucial',domains:['crucial.com','crucial.de']},
  {id:'kingston',name:'Kingston',domains:['kingston.com']},
  {id:'asrock',name:'ASRock',domains:['asrock.com']}
];
export const deviceKinds=[['all','Automatisch / alle Geräte'],['phones','Handys & Tablets'],['laptops','Laptops & Computer'],['cpu','Prozessoren'],['gpu','Grafikkarten'],['consoles','Konsolen & Gaming'],['watches','Uhren & Wearables'],['tv','Fernseher & Monitore'],['audio','Audio & Kopfhörer'],['cameras','Kameras & Drohnen'],['peripherals','PC-Zubehör & Speicher'],['home','Haushalt & Smart Home'],['other','Andere Geräte']];
export const specialistSources=[
  {id:'nanoreview',name:'NanoReview',domains:['nanoreview.net'],kinds:['phones']},
  {id:'gsmarena',name:'GSMArena',domains:['gsmarena.com'],kinds:['phones','watches']},
  {id:'cpu-monkey',name:'CPU-Monkey',domains:['cpu-monkey.com'],kinds:['cpu']},
  {id:'gpu-monkey',name:'GPU-Monkey',domains:['gpu-monkey.com'],kinds:['gpu']},
  {id:'techpowerup',name:'TechPowerUp',domains:['techpowerup.com'],kinds:['gpu','cpu']},
  {id:'rtings',name:'RTINGS',domains:['rtings.com'],kinds:['tv','audio','cameras','peripherals','home','laptops']},
  {id:'laptopmedia',name:'LaptopMedia',domains:['laptopmedia.com'],kinds:['laptops']}
];
export const sourceOptions = [
  ['all','Alle passenden Quellen'],['manufacturer','Herstellerseiten'],['web','Websuche'],
  ...specialistSources.map(s=>[s.id,s.name]),['wikipedia','Wikipedia']
];
const databases=[...specialistSources.flatMap(s=>s.domains.map(d=>[d,s.name])),['notebookcheck.net','Notebookcheck'],['notebookcheck.com','Notebookcheck'],['devicespecifications.com','DeviceSpecifications']];
export function domainMatches(host,domain){return host===domain||host.endsWith('.'+domain);}
export function classifySource(input){
  let host;try{host=new URL(input).hostname.toLowerCase();}catch{return {kind:'website',name:'Webquelle',host:''};}
  const maker=manufacturers.find(m=>m.domains.some(d=>domainMatches(host,d)));
  if(maker)return {kind:'manufacturer',name:maker.name,manufacturer:maker.id,host};
  if(domainMatches(host,'wikipedia.org'))return {kind:'wikipedia',name:'Wikipedia',host};
  const database=databases.find(([domain])=>domainMatches(host,domain));
  return {kind:database?'database':'website',name:database?.[1] || host.replace(/^www\./,''),host};
}
export function detectManufacturer(query){
  const text=String(query).toLowerCase();
  return manufacturers.find(m=>new RegExp('\\b(?:'+m.id+'|'+(m.models || m.id)+')\\b','i').test(text));
}
export function detectDeviceKind(query){
  const t=String(query).toLowerCase();
  if(/watch|fenix|fēnix|forerunner|venu|vivoactive|suunto|fitbit|vantage|smartwatch/.test(t))return 'watches';
  if(/iphone|galaxy (?:s|a|z)|pixel|redmi|poco|oneplus|smartphone|ipad|tablet|nothing phone|fairphone/.test(t))return 'phones';
  if(/playstation|\bps[345]\b|xbox|nintendo|steam deck|rog ally|legion go/.test(t))return 'consoles';
  if(/laptop|notebook|macbook|thinkpad|zenbook|vivobook|yoga|ideapad|xps|latitude|inspiron|elitebook|probook|surface|framework|imac|mac mini/.test(t))return 'laptops';
  if(/geforce|radeon|\brtx\b|\bgtx\b|grafikkarte|\bgpu\b/.test(t))return 'gpu';
  if(/ryzen|core (?:i[3579]|ultra)|xeon|threadripper|prozessor|\bcpu\b/.test(t))return 'cpu';
  if(/airpods|kopfhörer|headphone|earbud|soundbar|lautsprecher|wh-\d|wf-\d/.test(t))return 'audio';
  if(/fernseher|monitor|television|\btv\b|oled|odyssey|ultragear/.test(t))return 'tv';
  if(/kamera|camera|canon|nikon|gopro|lumix|\bdji\b|drohne/.test(t))return 'cameras';
  if(/ssd|hdd|keyboard|tastatur|maus|mouse|router|mainboard|motherboard|kingston|crucial|seagate/.test(t))return 'peripherals';
  if(/dyson|roborock|staubsauger|vacuum|waschmaschine|kaffeemaschine|smart home/.test(t))return 'home';
  return 'other';
}
