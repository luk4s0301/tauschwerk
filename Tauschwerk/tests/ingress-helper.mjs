import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root} from './helper.mjs';
export async function launchIngress(dir){
  const child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'tests','ingress-preload.mjs')).href,path.join(root,'server.mjs')],{cwd:root,env:{...process.env,TAUSCHWERK_HOME_ASSISTANT:'1',TAUSCHWERK_DATA:dir},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error='';child.stderr.on('data',b=>error+=b);
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error(error||'Ingress-Test Timeout'));},12000);child.stdout.on('data',b=>{const match=String(b).match(/TEST-INGRESS (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Ingress-Test exit '+code+': '+error));});});
  const origin='http://127.0.0.1:'+port;
  return {origin,base:origin+'/api/hassio_ingress/test',url:origin+'/api/hassio_ingress/test/',stop:()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();})};
}
