import {redactText,redactValue} from './privacy';
import {randomUUID} from 'node:crypto';
import {DIMENSIONS,evaluate,validDate,validateData} from '../engine';
import {Company,Source,FIELD_LABELS,Dimension} from '../types';
import {Claim,ClaimReview,Draft,Publication,ReviewInput} from './types';
import {hasContact,ResearchError,validateCitations,factConcern,negativeText} from './validation';
export const DEPENDENCIES:Record<Dimension,string[]>={product:['business','products'],customers:['customers','industries'],technical:['deployment','afterSales'],coverage:['coverage'],robotics:['robotics','products','deployment'],cooperation:['cooperation']};
export function applyReview(draft:Draft,input:ReviewInput,previous:Company|null,sources:Source[]):Publication{
 if(input.confirmed!==true)throw new ResearchError('需要确认已核对事实、来源和评分依据。');
 if(draft.status!=='pending')throw new ResearchError('此草稿已完成审核，请新建研究版本。',409);
 if(input.revision!==draft.revision)throw new ResearchError('版本已更新，请刷新后重新审核。',409);
 if(!input.reviewer.trim() || !input.note.trim())throw new ResearchError('复核人与说明必填。');
 const accepted:{claim:Claim;review:ClaimReview}[]=[];
 for(const claim of draft.claims){
  const r=input.claims[claim.id];if(!r)throw new ResearchError('所有候选项目均需明确接受、修改或拒绝。');
  if(r.decision==='reject')continue;
  if(r.decision==='accept' && (r.kind!==claim.kind || r.value!==claim.value || JSON.stringify(r.evidence)!==JSON.stringify(claim.evidence)))throw new ResearchError('接受操作不能偷偷修改结果，请使用“修改”。');
  if(r.decision==='edit' && !r.note.trim())throw new ResearchError('修改项目需要说明原因。');
  if(hasContact(r.value??''))throw new ResearchError('请勿保存联系人、电话或邮箱。');
  if(r.kind==='unknown' && r.value!==null)throw new ResearchError('未知值必须为 null。');
  if(r.kind!=='unknown' && !r.value?.trim())throw new ResearchError('非未知项目不能是空值。');
  const evidence=validateCitations(r.evidence,draft.documents);
  if(r.kind==='fact' && (!evidence.length || evidence.length!==r.evidence.length))throw new ResearchError('关键事实必须引用输入正文中真实存在的原文证据片段。');
  if(r.kind==='fact'){const concern=factConcern(claim.key,r.value!,evidence,draft.documents);if(concern)throw new ResearchError(concern);}
  if(['fit','questions','competition'].includes(claim.key) && r.kind==='fact')throw new ResearchError('适配、风险及建议须标为推断；不能直接作为企业事实。');
  accepted.push({claim,review:{...r,evidence}});
 }
 if(!accepted.length)throw new ResearchError('没有接受的研究内容；可使用“拒绝整份草稿”。');
 input={...input,reviewer:redactText(input.reviewer),note:redactText(input.note),scores:Object.fromEntries(Object.entries(input.scores).map(([key,score])=>[key,score?{...score,rationale:redactText(score.rationale)}:score]))};
 const day=new Date().toISOString().slice(0,10);
 const c:Company=previous?structuredClone(previous):{id:`company-${randomUUID()}`,name:draft.name,initials:draft.name.replace(/[^a-zA-Z]/g,'').slice(0,2).toUpperCase()||'CS',country:null,city:{value:null,evidenceIds:[],kind:'fact'},website:draft.website,summary:'已审核研究版本；仅反映公开证据。',fields:(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).reduce((out,k)=>{out[k]={value:null,evidenceIds:[],kind:'fact'};return out;},{} as Company['fields']),relationship:{status:'unknown',evidenceIds:[],claim:null,brandConfirmed:false},researchRole:'unknown',assessments:DIMENSIONS.reduce((out,d)=>{out[d.key]={value:null,evidenceIds:[],rationale:'信息未知；尚无人工确认的评分依据。',kind:'inference'};return out;},{} as Company['assessments']),risks:[],nextSteps:[],checkedAt:day,confidence:'公开资料候选经用户复核；未做独立商业尽调',humanReview:null};
 const newlyVerified=new Set(accepted.filter(a=>a.review.kind==='fact').map(a=>a.claim.key as string));
 c.reviewWarnings=[...new Set([...(previous?.reviewWarnings??[]).filter(w=>!newlyVerified.has(w.split(':')[0])),...(draft.warnings??[]).filter(w=>/矛盾|冲突|指令|实体|否定|条件|理论|不确定|不足以支持/.test(w))])];
 if(previous?.researchRole==='benchmark' || previous?.relationship.status!=='unknown' && previous!==null)c.researchRole='benchmark';else c.researchRole=input.role;
 const docSources:Source[]=draft.documents.filter(d=>d.status==='ok' && d.text).map(d=>({id:`research-${draft.id}-${d.id}`,url:d.url,title:d.title,summary:d.text!.slice(0,1200),status:'reviewed',checkedAt:d.capturedAt.slice(0,10),publisher:'company',retrieval:d.method,note:`用户 ${input.reviewer} 于 ${day} 审核。${d.method==='live'?'服务器读取公开正文':d.method==='manual'?'人工提供正文；未实时抓取':'历史短引文演示；未实时抓取'}。不代表品牌独立确认。`}));
 const citations=(r:ClaimReview)=>r.evidence.map(e=>({sourceId:`research-${draft.id}-${e.documentId}`,quote:e.quote}));
 const ids=(r:ClaimReview)=>[...new Set(r.evidence.map(e=>`research-${draft.id}-${e.documentId}`))];
 const changed=new Set<string>();
 // A URL mismatch is a warning, not a claim that third-party evidence is invalid.
 const official=new URL(previous?.website??draft.website).hostname.replace(/^www\./,'');
 const mismatched=accepted.filter(a=>a.review.kind==='fact').some(a=>a.review.evidence.some(e=>{const d=draft.documents.find(d=>d.id===e.documentId)!;return new URL(d.url).hostname.replace(/^www\./,'')!==official;}));
 if(mismatched){const warning='企业实体/来源域名不匹配：请核对是否引用了另一企业资料；当前版本需进一步研究。';c.reviewWarnings.push(warning);if(!draft.warnings.includes(warning))draft.warnings.push(warning);}

 for(const {claim,review:r} of accepted){
  if(['robotics','cooperation'].includes(claim.key) && (r.kind==='fact'||r.decision==='edit'&&r.kind==='unknown'))changed.add(claim.key);
  if(claim.key in FIELD_LABELS || claim.key==='city'){
   if(r.kind==='unknown' && r.decision!=='edit')continue;
   if(r.kind==='inference' && claim.key!=='competition')continue;
   const target=claim.key==='city'?c.city:c.fields[claim.key as keyof typeof FIELD_LABELS];
   if(target.value!==r.value)changed.add(claim.key);
   else if(r.kind==='fact'){
    // Same fact: refresh its linked evidence without inventing a capability change.
    const priorIds=target.evidenceIds;
    for(const dimension of DIMENSIONS){const a=c.assessments[dimension.key];
     if(DEPENDENCIES[dimension.key].includes(claim.key)&&a.evidenceIds.length&&a.evidenceIds.every(id=>priorIds.includes(id))){a.evidenceIds=ids(r);a.citations=citations(r);}
    }
   }
   Object.assign(target,{value:r.value,evidenceIds:r.kind==='unknown'?[]:ids(r),kind:r.kind==='unknown'?'fact':r.kind,citations:r.kind==='unknown'?[]:citations(r)});
  }
 }
 const rel=accepted.find(a=>a.claim.key==='puduRelationship');
 if(rel?.review.kind==='fact'){
  if(negativeText.test(rel.review.value!))throw new ResearchError('新普渡关系与历史/关系宣称存在冲突，请核对双方证据；未覆盖原关系。',409);
  if(c.relationship.status==='unknown')c.relationship={status:'public_claim',evidenceIds:ids(rel.review),claim:rel.review.value,brandConfirmed:false};
  // A company assertion never overwrites independent brand confirmation.
  c.researchRole='benchmark';
 }
 if(previous?.relationship.status!=='unknown'&&previous){
  if(rel?.review.decision==='edit'&&rel.review.kind==='unknown')throw new ResearchError('不能静默撤回历史普渡关系；存在冲突，请先核实关系证据并保留历史版本。',409);
  if(input.role!=='benchmark')c.reviewWarnings.push('所选分类与历史普渡关系冲突；保留现有渠道标杆，需人工核实历史权益。');
 }
 if(c.researchRole==='benchmark'&&c.relationship.status==='unknown')throw new ResearchError('标杆分类需要已接受的普渡关系公开宣称证据；不能凭研究分类创造经销关系。');
 if(c.researchRole==='competitor' && !c.fields.competition.evidenceIds.length)throw new ResearchError('竞争渠道分类需要接受冲突推断及其可追溯依据。');
 for(const d of DIMENSIONS){if(DEPENDENCIES[d.key].some(k=>changed.has(k))){c.assessments[d.key]={value:null,evidenceIds:[],rationale:'相关资料已修改，原评分已失效；等待人工按新证据重新评估。',kind:'inference'};}}
 for(const [key,raw] of Object.entries(input.scores)){
  const dim=DIMENSIONS.find(d=>d.key===key);if(!dim || !raw || typeof raw!=='object')throw new ResearchError('评分维度无效。');
  if(raw.value===null){c.assessments[dim.key]={value:null,evidenceIds:[],rationale:typeof raw.rationale==='string'&&raw.rationale.trim()?raw.rationale.trim():'人工保留未知，不能解释为能力缺失。',kind:'human'};continue;}
  if(!Number.isInteger(raw.value) || raw.value<0 || raw.value>4 || typeof raw.rationale!=='string' || !raw.rationale.trim() || raw.rationale.length>2000 || !Array.isArray(raw.claimIds) || !raw.claimIds.length)throw new ResearchError('已知评分需 0–4 整数、解释及已接受的事实依据。');
  const refs=raw.claimIds.map(id=>accepted.find(a=>a.claim.id===id && a.review.kind==='fact'));
  if(refs.some(a=>!a) || !refs.some(a=>DEPENDENCIES[dim.key].includes(a!.claim.key)))throw new ResearchError('评分只能引用已接受、与该维度相关的事实，不能引用 AI 适配建议。');
  if(dim.key==='technical'&&raw.value===4){
   const quoted=refs.flatMap(a=>a!.review.evidence.map(e=>e.quote)).join(' ');
   if(!/robot|机器人/i.test(quoted)||!refs.some(a=>a!.claim.key==='deployment')||!/mapeo|configuraci[oó]n de rutas|puesta en marcha|部署|建图|投运/i.test(quoted)||!/mantenimiento|soporte|repuestos|servicio t[eé]cnico|维护|维修|售后/i.test(quoted))throw new ResearchError('技术4分需要机器人建图/部署/投运和持续维护支持的原文，备件事实不足以达到最高档。');
  }
  c.assessments[dim.key]={value:raw.value,evidenceIds:[...new Set(refs.flatMap(a=>ids(a!.review)))],rationale:raw.rationale.trim(),kind:'human',citations:refs.flatMap(a=>citations(a!.review))};
 }
 const prior=c.humanReview;
 const invalidated=DIMENSIONS.filter(d=>DEPENDENCIES[d.key].some(k=>changed.has(k))).map(d=>d.key);
 c.humanReview={reviewer:input.reviewer,date:day,note:input.note,
  verifiedFields:[...new Set([...(prior?.verifiedFields??[]).filter(k=>!changed.has(k)),...accepted.filter(a=>a.review.kind==='fact').map(a=>a.claim.key)])],
  unknownFields:accepted.filter(a=>a.review.kind==='unknown').map(a=>a.claim.key),
  inferenceFields:accepted.filter(a=>a.review.kind==='inference').map(a=>a.claim.key),
  reviewedDimensions:[...new Set([...(prior?.reviewedDimensions??[]).filter(k=>!invalidated.includes(k)),...Object.keys(input.scores).filter(k=>input.scores[k as Dimension]?.value!==null) as Dimension[]])]
 };c.checkedAt=day;
 const risks=accepted.filter(a=>a.claim.key==='competition' && a.review.value).map(a=>a.review.value!);
 const steps=accepted.filter(a=>['questions','fit'].includes(a.claim.key) && a.review.value).map(a=>a.review.value!);
 if(accepted.some(a=>a.claim.key==='competition'&&(a.review.kind!=='unknown'||a.review.decision==='edit')))c.risks=risks;
 if(accepted.some(a=>['questions','fit'].includes(a.claim.key)&&(a.review.kind!=='unknown'||a.review.decision==='edit')))c.nextSteps=steps;
 const combined=[...sources,...docSources];const errors=validateData([c],combined);if(errors.length)throw new ResearchError('审核数据校验失败：'+errors.join('; '));
 if(docSources.some(s=>!validDate(s.checkedAt)))throw new ResearchError('来源核验日期无效。');
 const before=previous?evaluate(previous,sources):null,after=evaluate(c,combined);
 return redactValue({draftId:draft.id,company:c,sources:docSources,publishedAt:new Date().toISOString(),before:previous,changes:DIMENSIONS.map(d=>({dimension:d.label,before:before?.dimensions.find(x=>x.key===d.key)?.value??null,after:after.dimensions.find(x=>x.key===d.key)?.value??null,reason:c.assessments[d.key].rationale}))});
}
