export function isIngressRequest(req) {
  const ip=req.socket.remoteAddress?.replace(/^::ffff:/,'');
  return ip==='172.30.32.2';
}
export function ingressBase(value) {
  if(typeof value!=='string' || !/^\/api\/hassio_ingress\/[A-Za-z0-9_-]+\/?$/.test(value))return null;
  return value.replace(/\/$/,'')+'/';
}
