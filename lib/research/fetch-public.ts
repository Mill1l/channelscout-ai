import https from 'node:https';
import {redactText,hasSensitiveText} from './privacy';
import {decodeHtmlEntities} from './html-entities';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import type {ResearchDocument} from './types';
import {ResearchError} from './validation';
export function publicAddress(ip:string){
 if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);}
 if(isIP(ip)===6){const s=ip.toLowerCase();return /^[23][0-9a-f]{3}:/.test(s)&&!s.startsWith('2001:db8:')&&!(s.startsWith('2001:')&&(parseInt(s.split(':')[1]||'0',16)<0x200))&&!s.startsWith('2002:')&&!s.startsWith('3fff:');}
 return false;
}
export function publicUrl(input:string){
 if(hasSensitiveText(input))throw new ResearchError('链接包含敏感内容，未访问；请改用无凭证公开链接。');
 let url:URL;try{url=new URL(input);}catch{throw new ResearchError('请输入有效 HTTPS 公开网页 URL。');}
 url.hostname=url.hostname.replace(/\.$/,'');
 if(url.protocol!=='https:' || (url.port && url.port!=='443') || url.username || url.password || isIP(url.hostname.replace(/^\[|\]$/g,'')) || !url.hostname.includes('.') || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(url.hostname))throw new ResearchError('只允许正常域名的 HTTPS 公开页面，禁止内网、IP 地址、凭证和自定义端口。');
 if([...url.searchParams.keys()].some(k=>/token|secret|password|api.?key|auth|session/i.test(k)))throw new ResearchError('链接疑似包含凭证或会话参数，请改用公开页面。');
 url.hash='';return url;
}
export function extractPublicText(html:string){
 const lower=html.toLowerCase(),pieces:string[]=[];let offset=0,removedBlocks=0;
 // A semantic header can contain the entire company introduction (Nilfisk).
 // Keep it. Navigation/footer are removed only when they contain no business material.
 const nonContent=new Set(['script','style','noscript','form']);
 while(offset<html.length){
  const start=html.indexOf('<',offset);if(start<0){pieces.push(html.slice(offset));break;}
  pieces.push(html.slice(offset,start),' ');
  if(html.startsWith('<!--',start)){const end=html.indexOf('-->',start+4);offset=end<0?html.length:end+3;continue;}
  const end=html.indexOf('>',start+1);if(end<0)break;
  const tag=lower.slice(start+1,Math.min(end,start+4096)).match(/^\s*(\/?)\s*([a-z][a-z0-9]*)/);
  if(tag&&!tag[1]){
   const name=tag[2],close=lower.indexOf('</'+name,end+1),closeEnd=close<0?-1:html.indexOf('>',close);
   const candidate=close<0?'':html.slice(end+1,close);
   const business=/limpieza|servicio|repuestos|robot|tratamiento|purific|membrana|agua|equipment|清洁|技术|售后/i.test(decodeHtmlEntities(candidate));
   if(nonContent.has(name)||(['nav','footer'].includes(name)&&!business)){
    removedBlocks++;offset=closeEnd<0?html.length:closeEnd+1;continue;
   }
  }
  offset=end+1;
 }
 const decoded=decodeHtmlEntities(pieces.join('')),safe=redactText(decoded);
 const readable=safe.replace(/\s+/g,' ').trim();
 const warnings:string[]=[];
 if(safe!==decoded)warnings.push('正文中的联系方式或凭证已脱敏；这不代表企业能力缺失，原文仍需人工核对。');
 if(readable.length>18000)warnings.push('正文超过18000字符，已截断；未出现的信息仍是未知，不代表没有能力。');
 if(readable.length<300||readable.length/Math.max(html.length,1)<0.01)warnings.push('可读正文偏少或过滤比例较高，可能不完整；请核对原网页或人工提供正文。');
 return {text:readable.slice(0,18000),diagnostics:{rawCharacters:html.length,readableCharacters:readable.length,retainedCharacters:Math.min(18000,readable.length),removedBlocks,truncated:readable.length>18000,warnings}};
}
export function cleanHtml(html:string){return extractPublicText(html).text;}
export type PublicTransport=(url:URL,address:{address:string;family:number},signal:AbortSignal)=>Promise<{status:number;type:string;location?:string;body:string}>;
export const transport:PublicTransport=(url,address,signal)=>new Promise((resolve,reject)=>{
 const options:https.RequestOptions & {autoSelectFamily:boolean}={method:'GET',signal,family:address.family,autoSelectFamily:false,headers:{'User-Agent':'ChannelScout-Learning/0.2 (+public research; no crawling)','Accept':'text/html,text/plain','Accept-Encoding':'identity'},lookup:(_hostname,_opts,cb)=>cb(null,address.address,address.family)};
 const req=https.request(url,options,res=>{
  const status=res.statusCode??0,type=String(res.headers['content-type']??'');
  if([301,302,303,307,308].includes(status)){res.resume();resolve({status,type,location:res.headers.location,body:''});return;}
  if(status!==200 || !/^(text\/html|text\/plain)(;|$)/i.test(type)){res.resume();reject(new ResearchError(`公开页面返回 HTTP ${status}，或不是 HTML / 纯文本。`,422));return;}
  let bytes=0;const chunks:Buffer[]=[];
  res.on('data',chunk=>{bytes+=chunk.length;if(bytes>600_000){req.destroy(new ResearchError('页面超过 600KB 限制。',422));return;}chunks.push(Buffer.from(chunk));});
  res.on('end',()=>resolve({status,type,body:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
 });req.on('error',reject);req.end();
});
export async function fetchPublic(input:string,id:string,dependencies:{resolve?:typeof lookup;request?:PublicTransport}={}):Promise<ResearchDocument>{
 const capturedAt=new Date().toISOString(),base={id,url:redactText(input),title:redactText(input),capturedAt,method:'live' as const};
 try{
  let url=publicUrl(input);const original=url.hostname;
  const signal=AbortSignal.timeout(10000);
  for(let redirects=0;redirects<=2;redirects++){
   const addresses=await Promise.race([(dependencies.resolve??lookup)(url.hostname,{all:true,verbatim:true}),new Promise<never>((_,reject)=>{signal.addEventListener('abort',()=>reject(new ResearchError('网页读取超时',422)),{once:true});})]);
   if(signal.aborted)throw new ResearchError('网页读取超时',422);
   if(!addresses.length || addresses.some(a=>!publicAddress(a.address)))throw new ResearchError('域名解析含非公开地址，已阻断。',422);
   const result=await (dependencies.request??transport)(url,addresses[0],signal);
   if(result.location){const next=publicUrl(new URL(result.location,url).href);if(next.hostname.replace(/^www\./,'')!==original.replace(/^www\./,''))throw new ResearchError('跨域重定向已阻断，请直接提供目标公开链接。',422);url=next;continue;}
   if(result.status!==200)throw new ResearchError(`网页读取失败 HTTP ${result.status}`,422);
   const cleaned=extractPublicText(result.body),body=cleaned.text;if(body.length<20)throw new ResearchError('页面没有足够可读正文（可能需要 JavaScript / 权限）。',422);
   if(/captcha|access denied|verify you are human|checking your browser/i.test(body))throw new ResearchError('页面存在访问验证，未绕过。',422);
   return {...base,url:url.href,title:cleanHtml(result.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]??url.hostname).slice(0,120),status:'ok',text:body,diagnostics:cleaned.diagnostics,hash:createHash('sha256').update(body).digest('hex')};
  }
  throw new ResearchError('重定向次数超过限制。',422);
 }catch(error){const code=(error as NodeJS.ErrnoException)?.code;const detail=typeof code==='string'&&/^[A-Z_0-9]{2,60}$/.test(code)?`（${code}）`:'（网络、证书、DNS 或超时）';return {...base,status:'failed',text:null,error:redactText(error instanceof ResearchError?error.message:`网页读取失败${detail}；未生成抓取内容。`)};}
}
