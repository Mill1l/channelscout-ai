import {redactText,redactValue} from './privacy';
import {decodeHtmlEntities} from './html-entities';
import {randomUUID,createHash} from 'node:crypto';
import {DEMOS,demoDocuments} from './demos';
import {fetchPublic,publicUrl,cleanHtml} from './fetch-public';
import {extract,providerConfig} from './providers';
import {mutateState,readState,catalogFromState} from './store';
import {applyReview} from './review';
import {Draft,ResearchDocument} from './types';
import {parseClaims,parseReview,ResearchError,text} from './validation';
import {throttle} from './http';
export async function createResearch(input:Record<string,unknown>){
 throttle('research');
 const state=await readState();if(state.drafts.length>=100)throw new ResearchError('本地已达 100 份草稿上限，请备份状态并另建研究工作区。',409);
 const sourceMode=input.sourceMode;let name=text(redactText(decodeHtmlEntities(typeof input.name==='string'?input.name:'')),120),website=text(input.website,2000),companyId=text(input.companyId,100)||null;
 let documents:ResearchDocument[]=[];
 if(sourceMode==='demo'){
  if(typeof input.demo!=='string' || !Object.hasOwn(DEMOS,input.demo))throw new ResearchError('未知演示案例');
  const key=input.demo as keyof typeof DEMOS,demo=DEMOS[key];name=demo.name;website=demo.website;companyId=demo.companyId;documents=demoDocuments(key);
 }else{
  if(!name || !website)throw new ResearchError('请输入企业名称和官网。');website=publicUrl(website).href;
  if(sourceMode==='live'){
   const links=Array.isArray(input.urls)?input.urls.map(u=>text(u,2000)).filter(Boolean).map(u=>publicUrl(u).href):[];
   const urls=[...new Set([website,...links])];if(urls.length>3)throw new ResearchError('每次最多读取 3 个用户提供的公开链接，不自动跟随站内链接。');
   documents=await Promise.all(urls.map((url,i)=>fetchPublic(url,`doc-${i}`)));
  }else if(sourceMode==='manual'){
   if(!Array.isArray(input.manual) || !input.manual.length || input.manual.length>3)throw new ResearchError('离线模式需要 1–3 份公开资料正文。');
   documents=input.manual.map((item,i)=>{if(!item||typeof item!=='object')throw new ResearchError('离线资料格式无效');const url=publicUrl(text(item.url,2000)).href;const body=cleanHtml(text(redactText(typeof item.text==='string'?item.text:''),20000));if(body.length<20)throw new ResearchError('离线正文至少 20 字符；没有信息请保留未知。');return {id:`doc-${i}`,url,title:text(redactText(decodeHtmlEntities(typeof item.title==='string'?item.title:'')),120)||'人工提供的公开资料',status:'ok',text:body,capturedAt:new Date().toISOString(),method:'manual',hash:createHash('sha256').update(body).digest('hex')};});
  }else throw new ResearchError('请选择实时公开网页、离线正文或档案演示。');
 }
 const duplicates:string[]=[];
 documents=documents.filter((d,i,all)=>{const repeated=all.slice(0,i).some(x=>x.status==='ok'&&d.status==='ok'&&(x.url===d.url||x.hash&&x.hash===d.hash));if(repeated&&all.slice(0,i).some(x=>x.url===d.url&&x.text===d.text))return false;if(repeated)duplicates.push('重复来源或相同正文：不代表独立证据，矛盾内容仍保留待核实。');return true;});
 const catalog=catalogFromState(state);
 if(companyId && !catalog.companies.some(c=>c.id===companyId))throw new ResearchError('关联企业不存在。');
 // Same official host maps to an existing record: known partners cannot be recreated as new leads.
 const selected=catalog.companies.find(c=>c.id===companyId);
 if(selected && new URL(selected.website).hostname.replace(/^www\./,'')!==new URL(website).hostname.replace(/^www\./,''))throw new ResearchError('官网与关联企业不匹配。');
 const matched=catalog.companies.find(c=>new URL(c.website).hostname.replace(/^www\./,'')===new URL(website).hostname.replace(/^www\./,''));
 if(matched){if(companyId && companyId!==matched.id)throw new ResearchError('官网与所选企业不匹配。');companyId=matched.id;name=matched.name;}
 const draft:Draft={id:randomUUID(),revision:1,name,website,companyId,createdAt:new Date().toISOString(),mode:input.extract===false?'manual':sourceMode==='demo'?'mock':providerConfig().provider,status:'pending',basePublication:state.publications.filter(p=>p.company.id===companyId).at(-1)?.draftId??null,documents,claims:[],warnings:[],reviews:null};
 if(documents.some(d=>d.status==='ok')){
  try{
   if(input.extract===false){draft.claims=parseClaims({claims:[]},documents).claims;draft.mode='manual';}
   else{
    if(sourceMode!=='demo' && providerConfig().provider==='deepseek')throttle('paid',3,86400000);
    const result=await extract(documents,input.confirmPaid===true,{env:sourceMode==='demo'?{RESEARCH_PROVIDER:'mock'}:process.env});Object.assign(draft,{claims:result.claims,warnings:result.warnings,mode:result.mode,...('usage' in result?{usage:result.usage}:{}),...('metering' in result?{metering:result.metering}:{})});
   }
  }catch(error){draft.error=error instanceof ResearchError?error.message:'研究提取失败，保留输入供人工处理。';if(error instanceof ResearchError&&error.metering){draft.metering=error.metering;draft.usage=error.metering.usage;}draft.claims=parseClaims({claims:[]},documents).claims;}
 }else{draft.error='全部网页读取失败，未调用模型；没有生成企业事实。';draft.claims=parseClaims({claims:[]},documents).claims;}
 draft.warnings.push(...duplicates,...documents.flatMap(d=>d.diagnostics?.warnings??[]));
 if(documents.some(d=>d.method==='archive'))draft.warnings.push('这是 Phase 1 官网短引文档案演示，不是本次实时抓取；Mock 不证明模型准确率。');
 if(documents.some(d=>d.method==='manual'))draft.warnings.push('正文由人工提供；来源归属和事实语义仍需人工核对，未实时抓取。');
 return mutateState(s=>{if(s.drafts.length>=100)throw new ResearchError('草稿数量已达上限。',409);s.drafts.push(draft);s.audit.push({at:new Date().toISOString(),action:'research_created',draftId:draft.id,...(draft.metering?{attemptId:draft.metering.attemptId}:{})});return draft;});
}
export async function submitReview(input:Record<string,unknown>){
 const id=text(input.draftId,100),review=parseReview(input.review);
 return mutateState(state=>{
  const draft=state.drafts.find(d=>d.id===id);if(!draft)throw new ResearchError('草稿不存在。',404);
  const catalog=catalogFromState(state),previous=catalog.companies.find(c=>c.id===draft.companyId)??null;
  const latest=state.publications.filter(p=>p.company.id===draft.companyId).at(-1)?.draftId??null;
  if(latest!==(draft.basePublication??null))throw new ResearchError('企业已有更新版本，请基于最新资料重新研究，避免覆盖他人的审核。',409);
  if(!draft.companyId && catalog.companies.some(c=>new URL(c.website).hostname.replace(/^www\./,'')===new URL(draft.website).hostname.replace(/^www\./,'')))throw new ResearchError('该官网已有企业档案，请关联已有企业后新建研究。',409);
  const publication=redactValue(applyReview(draft,review,previous,catalog.sources));
  draft.status='approved';draft.revision++;draft.reviews=redactValue(review);draft.publishedCompanyId=publication.company.id;
  state.publications.push(publication);state.audit.push({at:new Date().toISOString(),action:'review_approved',draftId:id,reviewer:review.reviewer});return publication;
 });
}
export async function rejectDraft(input:Record<string,unknown>){
 input=redactValue(input);
 return mutateState(state=>{const d=state.drafts.find(d=>d.id===text(input.draftId,100));if(!d)throw new ResearchError('草稿不存在。',404);if(d.status!=='pending'||d.revision!==input.revision)throw new ResearchError('版本已变化，请刷新。',409);if(!text(input.reviewer,100)||!text(input.note))throw new ResearchError('拒绝需要复核人与原因。');d.status='rejected';d.revision++;state.audit.push({at:new Date().toISOString(),action:`review_rejected: ${text(input.note,500)}`,draftId:d.id,reviewer:text(input.reviewer,100)});return d;});
}
