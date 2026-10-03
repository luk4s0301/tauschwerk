import {extractImageCandidates} from './online-parser.mjs';
import {fetchPublicImage,validateRemoteURL} from './remote.mjs';

export async function loadProductImage(html,source,device,provider='website',fetchImage=fetchPublicImage) {
  const candidates=extractImageCandidates(html,source,{name:device.name,provider});
  for(const candidate of candidates.slice(0,3)){
    try{
      validateRemoteURL(candidate.url);
      const response=await fetchImage(candidate.url);
      return {data:`data:${response.contentType};base64,${response.bytes.toString('base64')}`,url:response.url,source,alt:device.name,attribution:'Produktbild: '+new URL(source).hostname};
    }catch{}
  }
  return null;
}
