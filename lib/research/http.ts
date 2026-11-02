import {redactValue} from './privacy';
import {ResearchError} from './validation';
export async function requestJson(request:Request):Promise<Record<string,unknown>>{
 const url=new URL(request.url),origin=request.headers.get('origin');
 let canonical:URL;try{canonical=new URL(`${url.protocol}//${request.headers.get('host')??url.host}`);}catch{throw new ResearchError('请求 Host 无效。',403);}
 if(!['127.0.0.1','localhost','[::1]'].includes(canonical.hostname) || canonical.username!=='' || canonical.password!=='' || origin!==canonical.origin || request.headers.get('sec-fetch-site')==='cross-site')throw new ResearchError('仅允许本机同源操作。',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ResearchError('需要 JSON 请求',415);
 const reader=request.body?.getReader();if(!reader)throw new ResearchError('缺少请求内容');let bytes=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>200000){await reader.cancel();throw new ResearchError('请求超过 200KB 限制。',413);}chunks.push(value);}}finally{reader.releaseLock();}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ResearchError('请求不是有效 JSON。');}
 if(!data || typeof data!=='object' || Array.isArray(data))throw new ResearchError('请求格式无效');return data as Record<string,unknown>;
}
export function failure(error:unknown){return Response.json(redactValue({error:error instanceof ResearchError?error.message:'处理失败；没有发布任何变更。请重试或检查本地日志。'}),{status:error instanceof ResearchError?error.status:500});}
const limits=globalThis as typeof globalThis & {scoutLimits?:Map<string,{start:number;count:number}>};
export function throttle(key:string,limit=12,windowMs=3600000){
 const map=limits.scoutLimits??=new Map(),now=Date.now(),entry=map.get(key);
 if(!entry || now-entry.start>windowMs){map.set(key,{start:now,count:1});return;}
 if(entry.count>=limit)throw new ResearchError('已达本机本时段调用上限，请稍后再试。',429);entry.count++;
}
