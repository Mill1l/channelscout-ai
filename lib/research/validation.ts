import {redactText,hasSensitiveText} from './privacy';
import type {Metering} from './metering';
import {CLAIM_KEYS,Claim,ClaimKey,Citation,ResearchDocument,ReviewInput,ClaimReview} from './types';
export class ResearchError extends Error { constructor(message:string,public status=400,public metering?:Metering){super(redactText(message));} }
export function text(value:unknown,max=2000){return typeof value==='string'?value.trim().slice(0,max):'';}
export function normalize(value:string){return value.normalize('NFKC').replace(/\s+/g,' ').trim();}
export function hasContact(value:string){return hasSensitiveText(value);}
export function validateCitations(evidence:unknown,documents:ResearchDocument[]):Citation[]{
 if(!Array.isArray(evidence))return [];
 return evidence.slice(0,4).flatMap(item=>{
  if(!item || typeof item!=='object')return [];
  const id=text(item.documentId,100),quote=text(item.quote,600),doc=documents.find(d=>d.id===id);
  if(!doc || doc.status!=='ok' || !doc.text || quote.length<8 || hasContact(quote) || !normalize(doc.text).includes(normalize(quote)))return [];
  return [{documentId:id,quote}];
 });
}
// Conservative guards for the audited failure classes; not a general semantic verifier.
export const instructionText=/(?:instrucci[oó]n|para el asistente|responde exactamente|ignore.{0,30}instructions|system prompt|忽略.{0,15}指令|输出以下|提示词)/i;
export const negativeText=/(?:\bno (?:somos|ofrecemos|disponemos|tenemos|comercializamos|realizamos|implementamos)|\bsin\s+(?:servicio|soporte|repuestos|representaci[oó]n|distribuci[oó]n)|不提供|并非|没有|不具备)/i;
const support:Partial<Record<ClaimKey,RegExp>>={deployment:/mapeo|configuraci[oó]n de rutas|puesta en marcha|instalaci[oó]n|部署|建图|投运/i,puduRelationship:/(?:distribuidor|representante|经销|代理)/i};
export function factConcern(key:ClaimKey,value:string,evidence:Citation[],documents:ResearchDocument[]):string|null{
 const quotes=evidence.map(e=>e.quote).join(' ');
 if(instructionText.test(value+' '+quotes))return '疑似网页指令，不能当作企业事实；请核实原文语境。';
 // Risk signals trigger review/unknown. Matching a deployment word is never
 // treated as proof of completed deployment in conditional or historical context.
 const contextualKeys=['business','deployment','robotics','puduRelationship','cooperation','afterSales','coverage','products','brands'];
 const uncertain=/(?:\bcursos?\s+te[oó]ricos?|formaci[oó]n\s+te[oó]rica|\btheoretic|理论课程|仅.{0,10}理论|\bno\s+(?:realiz|implement|instal|prest|ofrec|dispon|somos|oper|brind|proporcion)[\p{L}]*|\b(?:never|cannot|do not|does not)\b|尚未|未开展|不提供|不能|\bsi\s+(?:el|la|se|usted)\b|sujeto a|previa\s+(?:evaluaci[oó]n|aprobaci[oó]n)|\b(?:could|might|planned)\b|计划|如果|拟开展|\b(?:anteriormente|hist[oó]ricamente|ya no)\b|hasta\s+(?:el\s+)?(?:año\s+)?20\d{2}|曾经|过去曾)/iu;
 const contexts=evidence.map(e=>{const d=documents.find(d=>d.id===e.documentId);const body=normalize(d?.text??''),quote=normalize(e.quote),at=body.indexOf(quote);if(at<0)return quote;const before=body.slice(0,at),start=Math.max(before.lastIndexOf('.'),before.lastIndexOf('。'))+1;const after=body.slice(at+quote.length),boundary=after.search(/[.。]/),end=boundary<0?body.length:at+quote.length+boundary;return body.slice(Math.max(start,at-160),Math.min(end,at+quote.length+160));}).join(' ');
 if(contextualKeys.includes(key)&&/(?:可能|似乎|推测|不确定|\b(?:perhaps|possibly|probably|seems|might|could|podría|posiblemente)\b|tal vez)/iu.test(value))return '候选表述包含不确定推断，不能标为已证实事实；请人工核实或保留未知。';
 if(contextualKeys.includes(key)&&uncertain.test(contexts))return '原文包含否定、条件、历史或理论培训语境；不能据关键词确认当前能力/合作关系，请人工核实或保留未知。';
 if(support[key]&&!support[key]!.test(quotes))return '原文仅支持相邻信息，不足以支持该项能力或关系；请补充原文证据。';
 if(key==='afterSales'){
  const matches=documents.flatMap(d=>d.status==='ok'&&d.text?d.text.split(/[.。\n]/).filter(s=>/servicio t[eé]cnico|repuestos|售后|维修/i.test(s)):[]);
  if(matches.some(s=>negativeText.test(s))&&matches.some(s=>!negativeText.test(s)))return '不同公开来源存在矛盾：售后服务表述正反不一，需人工核实。';
 }
 return null;
}
export function parseClaims(raw:unknown,documents:ResearchDocument[]):{claims:Claim[];warnings:string[]}{
 if(!raw || typeof raw!=='object' || !('claims' in raw) || !Array.isArray(raw.claims))throw new ResearchError('AI 返回结构错误：需要 claims 数组。',502);
 const rawClaims=raw.claims as unknown[];
 const warnings:string[]=[];
 if(documents.some(d=>d.status==='ok'&&d.text?.split(/[.。\n]/).some(line=>/PUDU/i.test(line)&&negativeText.test(line))))warnings.push('普渡关系存在否定或冲突线索；保留历史关系，必须人工核实，不能静默改为潜客。');
 const claims=CLAIM_KEYS.map((key,index):Claim=>{
  const entries=rawClaims.filter((x:unknown)=>x && typeof x==='object' && 'key' in x && x.key===key);
  const item=entries[0] as Record<string,unknown>|undefined;
  const value=text(item?.value,1800),kind=item?.kind,evidence=validateCitations(item?.evidence,documents);
  const base={id:`claim-${index}`,key,evidence:[]};
  if(entries.length>1){warnings.push(`${key} 重复字段已阻断`);return {...base,kind:'unknown',value:null,warning:'模型重复字段；需要重新研究或离线录入。'};}
  if(!value || kind==='unknown')return {...base,kind:'unknown',value:null};
  if(hasContact(value)){warnings.push(`${key} 包含联系方式已阻断`);return {...base,kind:'unknown',value:null,warning:'不采集联系人或联系方式。'};}
  if(['fit','questions','competition'].includes(key) && kind==='fact'){warnings.push(`${key} 不得标记为事实`);return {...base,kind:'unknown',value:null,warning:'适配、风险及建议必须标记为推断。'};}
  if(kind==='fact' && evidence.length){const concern=factConcern(key,value,evidence,documents);if(concern){warnings.push(`${key}: ${concern}`);return {...base,kind:'unknown',value:null,warning:concern};}return {...base,kind:'fact',value,evidence};}
  if(kind==='inference')return {...base,kind:'inference',value,evidence};
  warnings.push(`${key} 无有效原文引证或类型错误，降级为未知`);
  return {...base,kind:'unknown',value:null,warning:'事实候选无可匹配的原文证据，已阻断。'};
 });
 return {claims,warnings};
}
export function parseReview(raw:unknown):ReviewInput{
 if(!raw || typeof raw!=='object')throw new ResearchError('无效审核请求');
 const r=raw as Record<string,unknown>;
 if(r.confirmed!==true)throw new ResearchError('需要确认已核对事实、来源和评分依据。');
 if(!Number.isInteger(r.revision) || typeof r.reviewer!=='string' || !text(r.reviewer,100) || !text(r.note,2000))throw new ResearchError('请输入复核人、审核说明及版本。');
 if(!['potential','benchmark','competitor','unknown'].includes(String(r.role)))throw new ResearchError('研究分类无效');
 if(!r.claims || typeof r.claims!=='object' || Array.isArray(r.claims) || !r.scores || typeof r.scores!=='object' || Array.isArray(r.scores))throw new ResearchError('审核项目格式无效');
 const claims:Record<string,ClaimReview>={};
 for(const [id,item] of Object.entries(r.claims)){
  if(!item || typeof item!=='object')throw new ResearchError('审核项目无效');const x=item as Record<string,unknown>;
  if(!['accept','edit','reject'].includes(String(x.decision)) || !['fact','inference','unknown'].includes(String(x.kind)))throw new ResearchError('请逐项接受、修改或拒绝');
  if(typeof x.value==='string'&&hasSensitiveText(x.value))throw new ResearchError('审核内容包含联系方式或凭证，请移除敏感内容后再提交。');
  if(!Array.isArray(x.evidence) || x.evidence.length>4)throw new ResearchError('引用格式无效');
  claims[id]={decision:x.decision as ClaimReview['decision'],kind:x.kind as ClaimReview['kind'],value:x.value===null?null:text(x.value,1800),evidence:x.evidence as Citation[],note:text(redactText(typeof x.note==='string'?x.note:''),1000)};
 }
 return {confirmed:true,revision:r.revision as number,reviewer:text(redactText(typeof r.reviewer==='string'?r.reviewer:''),100),note:text(redactText(typeof r.note==='string'?r.note:'')),role:r.role as ReviewInput['role'],claims,scores:r.scores as ReviewInput['scores']};
}
export function claimKey(value:string):value is ClaimKey{return (CLAIM_KEYS as readonly string[]).includes(value);}
