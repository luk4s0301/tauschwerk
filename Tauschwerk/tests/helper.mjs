import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function launch(dataDir) {
  fs.mkdirSync(dataDir,{recursive:true});
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...process.env,TAUSCHWERK_DATA:dataDir,TAUSCHWERK_NO_IDLE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error='';child.stderr.on('data',b=>error+=b);
  const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(new Error('Server-Start Timeout: '+error));},12000);child.stdout.once('data',b=>{clearTimeout(timeout);resolve(String(b).trim());});child.once('exit',code=>{clearTimeout(timeout);reject(new Error('Server exit '+code+': '+error));});});
  const base=new URL(url).origin;
  const response=await fetch(url,{redirect:'manual'});const cookie=response.headers.get('set-cookie').split(';')[0];
  return {child,url,base,cookie,async stop(){if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}};
}
