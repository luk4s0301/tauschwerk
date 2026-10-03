export function median(values) {
  const sorted = values.filter(n => Number.isFinite(n) && n > 0).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
}

export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? '').trim().replace(/[\s€]/g,'');
  if (!text) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(text)) text=text.replaceAll('.','');
  else if (text.includes(',') && text.includes('.')) return NaN;
  text=text.replace(',','.');
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
}

export function evaluateTrade(give, receive, cash = 0) {
  if (![give, receive, cash].every(Number.isFinite) || give < 0 || receive < 0) throw new Error('Ungültige Werte');
  const fairCash = receive - give;
  const difference = fairCash - cash;
  const tolerance = Math.max(20, Math.max(give, receive) * 0.05);
  return { give, receive, cash, fairCash, difference, tolerance,
    verdict: Math.abs(difference) <= tolerance ? 'balanced' : difference > 0 ? 'positive' : 'negative' };
}

export function mergeDeviceDraft(original,draft,current){
  if(!original)return structuredClone(draft);
  if(!current)throw new Error('Dieses Gerät wurde inzwischen entfernt. Bitte als neues Gerät anlegen.');
  const merged=structuredClone(current);
  for(const key of new Set([...Object.keys(original),...Object.keys(draft)])){
    const before=JSON.stringify(original[key]),after=JSON.stringify(draft[key]),latest=JSON.stringify(current[key]);
    if(after===before)continue;
    if(latest!==before&&latest!==after)throw new Error('Das gleiche Gerätefeld wurde auf einem anderen Gerät geändert ('+({name:'Name',notes:'Notizen',value:'Preis',specs:'Merkmale',offers:'Preisbeispiele'}[key]||key)+'). Bitte deine Eingabe sichern, den Editor schließen und den neuen Stand öffnen.');
    merged[key]=structuredClone(draft[key]);
  }
  return merged;
}
export function validateStore(store) {
  const fail = m => { throw new Error(m); };
  const str = (v, n = 300) => typeof v === 'string' && v.length <= n;
  const safeUrl = v => !v || (str(v, 2000) && /^https?:\/\//i.test(v));
  const imageUrl=v=>{try{const u=new URL(v);return str(v,2000)&&u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443');}catch{return false;}};
  if (!store || store.version !== 1 || !Array.isArray(store.devices) || store.devices.length > 10000 || !Array.isArray(store.trades) || store.trades.length > 5000) fail('Ungültiges Backup-Format (Version 1 erwartet).');
  const ids = new Set();
  for (const d of store.devices) {
    if (!d || !str(d.id, 100) || !d.id || ids.has(d.id) || !str(d.name) || !d.name.trim() || !str(d.brand) || !str(d.category, 80)) fail('Ungültiges Gerät oder doppelte Geräte-ID.');
    ids.add(d.id);
    if(d.image!==undefined&&d.image!==null){
      const i=d.image;
      if(!i||typeof i!=='object'||!str(i.data,700000)||!/^data:image\/(?:jpeg|png|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(i.data)||!imageUrl(i.url)||!imageUrl(i.source)||!str(i.alt)||!str(i.attribution??'',2000))fail('Ungültiges Produktbild.');
    }
    if (!Array.isArray(d.specs) || d.specs.length > 100 || d.specs.some(s => !s || !str(s.key, 100) || !str(s.value, 2000))) fail('Ungültige technische Daten.');
    if (!Array.isArray(d.offers) || d.offers.length > 100 || d.offers.some(o => !o || !Number.isFinite(o.price) || o.price <= 0 || o.price > 10000000 || !safeUrl(o.url) || !str(o.note ?? '', 2000) || !str(o.date ?? '', 50))) fail('Ungültige Vergleichspreise.');
    if (!safeUrl(d.source ?? '') || !str(d.notes ?? '', 10000) || !str(d.checked ?? '', 50) || (d.value !== null && (!Number.isFinite(d.value) || d.value < 0 || d.value > 10000000))) fail('Ungültige Gerätewerte oder Quellen.');
  }
  for (const t of store.trades) {
    if (!t || !str(t.id,100) || !str(t.giveName) || !str(t.receiveName) || !str(t.date,50) || !str(t.notes ?? '',10000) || !t.result || ![t.result.give,t.result.receive,t.result.cash].every(Number.isFinite)) fail('Ungültiger gespeicherter Tausch.');
    const r = evaluateTrade(t.result.give,t.result.receive,t.result.cash);
    if ([r.give,r.receive,Math.abs(r.cash)].some(n=>n>10000000)) fail('Tauschwert zu groß.');
    t.result = r;
  }
  if(store.savedComparisons!==undefined){
    if(!Array.isArray(store.savedComparisons)||store.savedComparisons.length>500)fail('Zu viele gemerkte Vergleiche.');
    const comparisonIds=new Set();
    for(const c of store.savedComparisons){
      if(!c||!str(c.id,100)||!c.id||comparisonIds.has(c.id)||!str(c.name,1200)||!str(c.date,50)||!Array.isArray(c.devices)||c.devices.length<1||c.devices.length>4)fail('Ungültiger gemerkter Vergleich.');
      comparisonIds.add(c.id);validateStore({version:1,devices:c.devices,trades:[]});
    }
  }
  return store;
}
