import {createHash,randomUUID} from 'node:crypto';
import {classify,evaluate,sourceHealth,usableEvidence,validDate} from '../engine';
import {qualification} from '../research/priority';
import {redactValue} from '../research/privacy';
import {ResearchError} from '../research/validation';
import {FIELD_LABELS,type Company,type Source} from '../types';
import type {Fact,Strategy,Purpose} from './types';
export function researchFingerprint(c:Company,sources:Source[]){const ids=new Set([c.city,...Object.values(c.fields),...Object.values(c.assessments)].flatMap(f=>f.evidenceIds).concat(c.relationship.evidenceIds));return createHash('sha256').update(JSON.stringify({company:c,sources:sources.filter(s=>ids.has(s.id)).map(s=>({...s,health:sourceHealth(s)})).sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');}
export function reviewedFacts(c:Company,sources:Source[]):Fact[]{
 const h=c.humanReview;if(!h||!h.reviewer.trim()||!h.note.trim()||!validDate(h.date)||h.date>new Date().toISOString().slice(0,10))return [];
 return Object.entries(c.fields).filter(([key,f])=>h.verifiedFields?.includes(key)&&f.kind==='fact'&&f.value&&usableEvidence(f.evidenceIds,sources)&&f.citations?.length&&f.citations.every(x=>f.evidenceIds.includes(x.sourceId)&&x.quote.trim().length>=8)).map(([key,f])=>({key,label:FIELD_LABELS[key as keyof typeof FIELD_LABELS],value:f.value!,citations:f.citations!.map(x=>{const s=sources.find(s=>s.id===x.sourceId)!;return {...x,url:s.url,retrieval:s.retrieval??'archive'};}),reviewer:h.reviewer,date:h.date}));
}
export function context(c:Company,sources:Source[]){const q=qualification(c,sources),e=evaluate(c,sources),facts=reviewedFacts(c,sources);const needed=[['business','products'],['customers','industries'],['afterSales','deployment']];const complete=needed.every(keys=>facts.some(f=>keys.includes(f.key)));const purpose:Purpose=q.stage==='benchmark'?'channel-maintenance':q.stage==='conflict'?'conflict-inquiry':'new-channel';const eligible=q.stage==='contact'&&complete;const canDraft=eligible||purpose!=='new-channel'&&facts.some(f=>['business','products','brands'].includes(f.key))&&!c.reviewWarnings?.length;return {fingerprint:researchFingerprint(c,sources),eligible,canDraft,purpose,qualification:q.label,category:classify(c,sources),score:e.score,coverage:e.coverage,completeness:e.completeness,facts,reason:q.stage==='contact'&&!complete?'评分门槛已满足，但邮件引用所需的业务、客户/行业或技术事实尚未逐项人工核验。':q.action};}
export function generateStrategy(c:Company,sources:Source[]):Strategy{
 const x=context(c,sources),products=x.facts.find(f=>f.key==='products')??x.facts.find(f=>f.key==='business'),customer=x.facts.find(f=>f.key==='customers'||f.key==='industries');
 const hook=products?`以已复核线索「${products.value.slice(0,160)}」为起点`:'先取得可追溯、逐项人工确认的业务与产品资料';
 const existing=x.category==='existing',conflict=x.category==='competitor'||qualification(c,sources).stage==='conflict';
 return redactValue({id:randomUUID(),companyId:c.id,createdAt:new Date().toISOString(),fingerprint:x.fingerprint,mode:'local-template',category:x.category,qualification:x.qualification,eligible:x.eligible,canDraft:x.canDraft,purpose:x.purpose,facts:x.facts,
 complementarity:`商业建议（待验证）：${hook}，调查是否存在商用地面清洁场景，再分别评估 CC1 Pro / MT1 的适用性；不承诺性能、收益、价格或代理权益。`,
 entry:existing?'渠道维护 / 标杆研究：向品牌方核实当前授权、区域与协同边界，讨论已有产品服务经验；不作为新经销商开发。':conflict?`${hook}，先核实竞品的品类、地域与排他条款；限制未清楚前不生成增量渠道邀约。`:`${hook}；${customer?`围绕「${customer.value.slice(0,120)}」询问现有清洁工作流程和产品品类缺口`:'补充B2B客户与服务行业证据'}。`,
 risks:[...(existing?['普渡关系为企业公开宣称时，不能写成品牌方独立授权。']:[]),...(conflict?['竞争品牌不等于不能合作；需核实排他、服务边界和兼营限制。']:[]),...c.risks.map(r=>`待核实风险（历史/人工推断）：${r}`),...(c.reviewWarnings??[]),...(!x.eligible?['当前不满足新渠道邮件资格；只做研究、维护或限制核查。']:[])],
 questions:[products?`「${products.value.slice(0,100)}」是否包含商用地面清洁设备销售与服务？`:'能否提供主营业务、产品目录及公开来源？',customer?`所述「${customer.value.slice(0,100)}」中哪些场景需要清扫或洗地？`:'主要B2B客户类型及服务行业是什么，有无可公开核对的资料？',existing?'当前普渡关系与区域权益能否由品牌方独立确认？':conflict?'现有品牌合同是否限制清洁机器人品类、区域或兼营？':'现有品牌合同和渠道政策是否允许补充清洁机器人？','现有技术团队能否承担建图、投运、培训及持续维修？配送范围不能替代现场服务范围。'],firstAction:x.reason});
}
export function requireCurrent(fingerprint:string,c:Company,sources:Source[]){if(fingerprint!==researchFingerprint(c,sources))throw new ResearchError('企业资料、关系或来源状态已变化；旧策略/邮件已过期，请重新生成并确认。',409);}
