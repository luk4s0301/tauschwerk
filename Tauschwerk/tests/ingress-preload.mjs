// Only loaded by the isolated tests: simulates the Supervisor's reverse proxy.
import http from 'node:http';
const originalEmit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,...args){
  if(event==='request'){
    const req=args[0];
    if(req.url.startsWith('/api/hassio_ingress/test/')){
      req.url=req.url.slice('/api/hassio_ingress/test'.length);
      req.headers['x-ingress-path']='/api/hassio_ingress/test';
      Object.defineProperty(req.socket,'remoteAddress',{get:()=> '172.30.32.2',configurable:true});
    }
  }
  return originalEmit.call(this,event,...args);
};
const originalListen=http.Server.prototype.listen;
http.Server.prototype.listen=function(...args){
  if(args[0]===8099)args[0]=0;
  this.once('listening',()=>process.stdout.write('TEST-INGRESS '+this.address().port+'\n'));
  return originalListen.apply(this,args);
};
