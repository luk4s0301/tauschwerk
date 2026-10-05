import {isExcludedSource,classifySource} from './online-sources.mjs';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import zlib from 'node:zlib';
const agent='Swivo/2.2 (local device comparison; user initiated requests)';
export function isPublicAddress(address) {
  const type=net.isIP(address);
  if(type===4){const [a,b,c]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&c===0)||(b===0&&c===2)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));}
  if(type===6)return /^[23][\da-f]{3}:/i.test(address)&&!/^2001:(?:0*:|db8:|0?1[0-9a-f]:)/i.test(address)&&!address.includes('.');
  return false;
}
export function validateRemoteURL(input) {
  let url;try{url=new URL(input);}catch{throw new Error('Bitte einen vollständigen https://-Link eingeben.');}
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Nur öffentliche HTTPS-Seiten ohne Zugangsdaten werden unterstützt.');
  if(isExcludedSource(url.href))throw new Error('Diese Quelle ist ausgeschlossen. Nutze eine Herstellerseite, Geizhals oder eine Fachquelle.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  if((net.isIP(host)&&!isPublicAddress(host))||(!net.isIP(host)&&(!host.includes('.')||/\.(?:local|localhost|internal|home|test|invalid)$/i.test(host))))throw new Error('Lokale und interne Adressen sind keine Online-Quellen.');
  url.hash='';return url;
}
export const fetchPublicText=(input,redirects=0)=>requestPublic(input,redirects,false);
export const fetchPublicImage=(input,redirects=0)=>requestPublic(input,redirects,true);
export function imageMime(bytes) {
  if(bytes.length<12)return null;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12)))return 'image/avif';
  return null;
}
async function requestPublic(input,redirects,asImage) {
  const url=validateRemoteURL(input);
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=await dns.lookup(host,{all:true});
  if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new Error('Die Quelle verweist auf eine interne oder gesperrte Adresse.');
  const pinned=addresses.find(a=>a.family===4)||addresses[0];
  return new Promise((resolve,reject)=>{
    let settled=false;const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(deadline);error?reject(error):resolve(value);};
    const request=https.request(url,{method:'GET',agent:false,headers:{'User-Agent':agent,'Accept':asImage?'image/avif,image/webp,image/png,image/jpeg':'text/html,application/json;q=0.9','Accept-Encoding':'gzip, deflate, br'},lookup:(_hostname,options,callback)=>callback(null,options?.all?[pinned]:pinned.address,pinned.family)},response=>{
      const code=response.statusCode;
      if([301,302,303,307,308].includes(code)){
        response.resume();if(redirects>=4)return done(new Error('Zu viele Weiterleitungen. Verwende den direkten Datenblatt-Link.'));
        if(!response.headers.location)return done(new Error('Ungültige Weiterleitung.'));
        let next;try{next=new URL(response.headers.location,url).href;}catch{return done(new Error('Ungültige Weiterleitung.'));}
        requestPublic(next,redirects+1,asImage).then(v=>done(null,v),e=>done(e));return;
      }
      if(code!==200){response.resume();return done(new Error(code===429?'Die Quelle begrenzt gerade Anfragen. Bitte später erneut versuchen.':code===403?'Diese Webseite erlaubt keinen automatischen Abruf. Versuche eine andere Quelle.':`Die Quelle antwortet mit HTTP ${code}.`));}
      const contentType=response.headers['content-type'] || '';
      if(asImage?!/^image\/(?:jpeg|png|webp|avif)(?:;|$)/i.test(contentType):!/text\/|json|xml/.test(contentType)){response.resume();return done(new Error(asImage?'Die Quelle liefert kein unterstütztes Produktbild.':'Der Link liefert kein HTML-Datenblatt. PDF- und Binärdateien werden nicht unterstützt.'));}
      let stream=response;
      const encoding=response.headers['content-encoding'];
      if(encoding==='gzip')stream=response.pipe(zlib.createGunzip());else if(encoding==='br')stream=response.pipe(zlib.createBrotliDecompress());else if(encoding==='deflate')stream=response.pipe(zlib.createInflate());
      const chunks=[];let size=0;
      // Large manufacturer pages include extensive embedded product data. Apply
      // this allowance to the final validated domain, including after redirects.
      const textLimitMB=classifySource(url.href).kind==='manufacturer'?24:6;
      const limit=asImage?2*1024*1024:textLimitMB*1024*1024;
      stream.on('data',chunk=>{size+=chunk.length;if(size>limit){stream.destroy();request.destroy();done(new Error(asImage?'Das Produktbild ist zu groß (maximal 2 MB).':`Das Datenblatt ist zu groß (maximal ${textLimitMB} MB).`));}else chunks.push(chunk);});
      stream.on('error',error=>done(error));response.on('error',error=>done(error));
      stream.on('end',()=>{const bytes=Buffer.concat(chunks);if(asImage){const mime=imageMime(bytes);if(!mime||mime!==contentType.split(';')[0].toLowerCase())return done(new Error('Ungültige Bilddatei.'));return done(null,{bytes,url:url.href,contentType:mime});}done(null,{text:bytes.toString('utf8'),url:url.href,contentType});});
    });
    const deadline=setTimeout(()=>{request.destroy();done(new Error('Die Quelle antwortet nicht rechtzeitig. Bitte erneut versuchen.'));},18000);
    request.on('error',error=>done(new Error('Online-Abruf fehlgeschlagen: '+(error.code || error.message))));request.end();
  });
}
