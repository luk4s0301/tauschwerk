import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateStore } from './core.mjs';
import { searchOnline, retrieveOnline, findDeviceImage } from './online.mjs';
import { isIngressRequest, ingressBase } from './server-policy.mjs';
import {valueSet} from './market-value.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const shared = process.env.TAUSCHWERK_HOME_ASSISTANT === '1';
const dataDir = path.resolve(process.env.TAUSCHWERK_DATA || path.join(root,'data'));
fs.mkdirSync(dataDir,{recursive:true});
const dataFile = path.join(dataDir,'tauschwerk.json');
const sessionFile = path.join(dataDir,'session.json');
const token = crypto.randomBytes(24).toString('hex');
let lastSeen = Date.now();
let store;
let revision;
try {
  store = validateStore(JSON.parse(fs.readFileSync(dataFile,'utf8')));
} catch(error) {
  if (fs.existsSync(dataFile)) { console.error('Daten konnten nicht gelesen werden. Datei bleibt erhalten: '+error.message); process.exit(1); }
  store = shared&&fs.existsSync(path.join(root,'initial-store.json')) ? JSON.parse(fs.readFileSync(path.join(root,'initial-store.json'),'utf8')) : {version:1,devices:JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8')),trades:[]};
  if(shared)delete store.ui;
  validateStore(store);
}
function persist(next) {
  validateStore(next);
  const tmp = dataFile+'.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next,null,2),'utf8');
  if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile,dataFile+'.bak');
  fs.renameSync(tmp,dataFile);
  store = next;
  revision='"'+crypto.createHash('sha256').update(JSON.stringify(store)).digest('hex')+'"';
}
if (!fs.existsSync(dataFile)) persist(store);
revision='"'+crypto.createHash('sha256').update(JSON.stringify(store)).digest('hex')+'"';
const cacheFile=path.join(dataDir,'online-cache.json');
let onlineCache=[];
if(shared)try{onlineCache=JSON.parse(fs.readFileSync(cacheFile,'utf8'));if(!Array.isArray(onlineCache))onlineCache=[];onlineCache=onlineCache.filter(e=>e && Number.isFinite(e.time) && Date.now()-e.time<86400000 && e.device).slice(-100);}catch{}
const publicFiles = new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']],
  ['/icons.js',['icons.js','text/javascript; charset=utf-8']],
  ['/core.mjs',['../core.mjs','text/javascript; charset=utf-8']],
  ['/online-sources.mjs',['../online-sources.mjs','text/javascript; charset=utf-8']],
  ['/favicon.svg',['favicon.svg','image/svg+xml']]
]);
const server = http.createServer(async (req,res) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  if(shared ? !isIngressRequest(req) : (req.headers.host !== `127.0.0.1:${server.address().port}` || (req.headers.origin && req.headers.origin !== origin))) { res.writeHead(403); return res.end('Zugriff nicht erlaubt.'); }
  const url = new URL(req.url, origin);
  const authenticated = shared || (req.headers.cookie || '').split(';').some(c=>c.trim()===`tw_session=${token}`);
  const send = (code,payload,headers={}) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(payload));};
  if (url.pathname === '/health' && (shared || url.searchParams.get('token') === token)) return send(200,{ok:true,version:'1.6.0'});
  if (!shared && url.pathname === '/' && url.searchParams.get('token') === token) {
    res.writeHead(302,{'Set-Cookie':`tw_session=${token}; HttpOnly; SameSite=Strict; Path=/`,'Location':'/','Cache-Control':'no-store'});return res.end();
  }
  if (!authenticated) return send(401,{error:'Bitte Tauschwerk.exe starten.'});
  lastSeen = Date.now();
  if (url.pathname === '/api/meta' && req.method === 'GET') return send(200,{shared,version:'1.6.0'});
  if (url.pathname === '/api/store' && req.method === 'GET') {const data=structuredClone(store);if(shared)delete data.ui;return send(200,data,{ETag:revision});}
  if (url.pathname === '/api/ping' && req.method === 'POST') return send(200,{ok:true});
  if(url.pathname==='/api/online/valuation'&&req.method==='POST'){
    if((shared?req.headers['x-tauschwerk-mode']:store.ui?.mode)!=='online')return send(409,{error:'Schalte zuerst auf den Online-Modus um.'});
    if(req.headers['content-type']?.split(';')[0]!=='application/json')return send(415,{error:'JSON erwartet.'});
    let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return send(413,{error:'Gerätebeschreibung ist zu lang.'});}const input=JSON.parse(body);return send(200,await valueSet(input));}catch(error){return send(400,{error:error.message});}
  }
  if (url.pathname.startsWith('/api/online/') && req.method === 'GET') {
    if ((shared ? req.headers['x-tauschwerk-mode'] : store.ui?.mode) !== 'online') return send(409,{error:'Schalte zuerst auf den Online-Modus um.'});
    try {
      if (url.pathname === '/api/online/search') return send(200,await searchOnline(url.searchParams.get('q'),url.searchParams.get('language') || 'all',{source:url.searchParams.get('source') || 'all',manufacturer:url.searchParams.get('manufacturer') || 'all',kind:url.searchParams.get('kind') || 'all'}));
      if (url.pathname === '/api/online/device') {
        const source=url.searchParams.get('url');
        const cached=shared&&onlineCache.find(e=>e.url===source&&Date.now()-e.time<86400000);
        if(cached?.imageVersion===2)return send(200,{device:cached.device,warnings:['Aus dem gemeinsamen Zwischenspeicher (maximal 24 Stunden).'],cached:true});
        const result=await retrieveOnline(source);
        if(shared){onlineCache=onlineCache.filter(e=>e.url!==source&&Date.now()-e.time<86400000);onlineCache.push({url:source,time:Date.now(),device:result.device,imageVersion:2});onlineCache=onlineCache.slice(-100);try{fs.writeFileSync(cacheFile+'.tmp',JSON.stringify(onlineCache));fs.renameSync(cacheFile+'.tmp',cacheFile);}catch{result.warnings=[...(result.warnings||[]),'Zwischenspeicher konnte nicht gespeichert werden.'];}}
        return send(200,result);
      }
      if(url.pathname==='/api/online/image')return send(200,await findDeviceImage(url.searchParams.get('name'),url.searchParams.get('source')||''));
      return send(404,{error:'Online-Funktion nicht gefunden.'});
    } catch(error) {return send(502,{error:error.message});}
  }
  if (url.pathname === '/api/store' && req.method === 'PUT') {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return send(415,{error:'JSON erwartet.'});
    try {
      let body = '';
      for await (const chunk of req) {body += chunk; if (Buffer.byteLength(body)>12*1024*1024) {send(413,{error:'Datei ist zu groß (max. 12 MB).'});return;}}
      if(shared&&!req.headers['if-match'])return send(428,{error:'Datenstand fehlt. Bitte die App neu laden.'});
      if(req.headers['if-match']&&req.headers['if-match']!==revision)return send(409,{error:'Die Daten wurden auf einem anderen Gerät geändert. Dein Eintrag wurde nicht überschrieben. Bitte lade den aktuellen Stand und speichere erneut.'});
      const next=JSON.parse(body);if(shared)delete next.ui;
      persist(next); return send(200,{ok:true},{ETag:revision});
    } catch(error) {return send(400,{error:error.message});}
  }
  if (req.method === 'GET' && publicFiles.has(url.pathname)) {
    const [name,mime] = publicFiles.get(url.pathname);
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors "+(shared?"'self'":"'none'")});
    let content=fs.readFileSync(path.join(root,'public',name));
    if(shared&&url.pathname==='/'){const base=ingressBase(req.headers['x-ingress-path']);if(!base)return res.end('Home-Assistant-Ingress-Pfad fehlt.');content=content.toString().replace('<head>','<head>\n  <base href="'+base+'">');}
    return res.end(content);
  }
  send(404,{error:'Nicht gefunden.'});
});
server.listen(shared?8099:0,shared?'0.0.0.0':'127.0.0.1',()=> {
  const port = server.address().port;
  if(!shared)fs.writeFileSync(sessionFile,JSON.stringify({pid:process.pid,port,token}));
  console.log(shared?'Tauschwerk bereit für Home Assistant Ingress auf Port 8099':`http://127.0.0.1:${port}/?token=${token}`);
});
const idle = setInterval(()=> {if (!shared && !process.env.TAUSCHWERK_NO_IDLE && Date.now()-lastSeen>120000) server.close(()=>process.exit(0));},15000);
idle.unref();
process.on('exit',()=> {try {const s=JSON.parse(fs.readFileSync(sessionFile,'utf8')); if(s.pid===process.pid) fs.unlinkSync(sessionFile);}catch{}});
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
