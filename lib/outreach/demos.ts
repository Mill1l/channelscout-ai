import {randomUUID} from 'node:crypto';
import {companies,sources} from '../data';
import {demoDocuments} from '../research/demos';
import {parseClaims} from '../research/validation';
import {mockExtract} from '../research/providers';
import {applyReview} from '../research/review';
import {mutateState,readState} from '../research/store';
import type {Draft,ReviewInput,ResearchDocument} from '../research/types';
import {salesDir} from './store';
import {salesAction} from './service';
// Replays short excerpts already obtained in Phase 1 / 2.7. No fresh fetch or live model.
export function demoPublication(id:'proasin'|'hoppe'|'dimacofi'){
 const previous=companies.find(c=>c.id===id)!;
 const documents:ResearchDocument[]=id==='dimacofi'?[{id:'doc-0',url:'https://www.dimacofi.cl/pudu-mt1/',title:'Dimacofi · Phase2.7实际读取短引文档案',status:'ok',method:'archive',capturedAt:'2026-11-01T08:00:00Z',text:'Conoce el robot autónomo PUDU MT1 Dimacofi es distribuidor oficial de Pudu Robotics en Chile'}]:demoDocuments(id);
 const parsed=parseClaims(mockExtract(documents),documents);
 const d:Draft={id:`phase3-demo-${id}`,revision:1,name:previous.name,website:previous.website,companyId:id,status:'pending',createdAt:new Date().toISOString(),mode:'mock',documents,...parsed,reviews:null};
 const r:ReviewInput={revision:1,confirmed:true,reviewer:'演示审核者（模拟，非实际尽调）',note:'基于历史官网短引文模拟逐项审核；非当前官网复核或真实客户联系。',role:id==='hoppe'?'competitor':id==='dimacofi'?'benchmark':'potential',claims:Object.fromEntries(d.claims.map(c=>[c.id,{decision:c.kind==='unknown'?'reject':'accept',kind:c.kind,value:c.value,evidence:c.evidence,note:''}])),scores:{}};
 if(id==='proasin'){
  const industry=d.claims.find(c=>c.key==='industries')!;r.claims[industry.id]={decision:'edit',kind:'fact',value:'HORECA（历史公开行业线索）',evidence:[{documentId:'doc-0',quote:documents[0].text!}],note:'模拟人工补正：HORECA短词不足最短引文长度，保留完整公开上下文；非实际客户名单。'};
  const ref=(key:string)=>d.claims.find(c=>c.key===key)!;
  r.scores={product:{value:3,rationale:'目录清扫/洗地设备；机器人交付仍未知（模拟评分）。',claimIds:[ref('products').id]},customers:{value:2,rationale:'HORECA是公开行业线索，不证明实际客户名单或可触达性（模拟评分）。',claimIds:[ref('industries').id]},technical:{value:2,rationale:'现场诊断维修和备件培训；机器人部署未核实（模拟评分）。',claimIds:[ref('afterSales').id]}};
 }
 const p=applyReview(d,r,previous,sources);d.status='approved';d.reviews=r;d.revision=2;d.publishedCompanyId=id;return {draft:d,publication:p};
}
export async function initializeDemos(){
 const dir=salesDir('demo');await mutateState(s=>{for(const id of ['proasin','hoppe','dimacofi'] as const){if(s.publications.some(p=>p.draftId===`phase3-demo-${id}`))continue;const {draft,publication}=demoPublication(id);s.drafts.push(draft);s.publications.push(publication);s.audit.push({at:new Date().toISOString(),action:'phase3_simulated_review',draftId:draft.id,reviewer:'演示审核者（模拟）'});}},dir);
 for(const id of ['proasin','hoppe','dimacofi']){const {readSales}=await import('./store');let s=await readSales(dir);if(!s.strategies.some(x=>x.companyId===id))await salesAction({scope:'demo',companyId:id,action:'strategy'});s=await readSales(dir);if(!s.leads.some(x=>x.companyId===id))await salesAction({scope:'demo',companyId:id,action:'addLead',actor:'演示销售（模拟）'});}
 for(const id of ['proasin','hoppe','dimacofi']){
  const {readSales}=await import('./store');let state=await readSales(dir);const strategy=state.strategies.filter(x=>x.companyId===id).at(-1)!;
  for(const language of ['en','es'] as const){if(!state.mails.some(m=>m.companyId===id&&m.language===language)){await salesAction({scope:'demo',companyId:id,action:'generateMail',strategyId:strategy.id,language,length:language==='es'?'detailed':'short'});state=await readSales(dir);}}
  const mail=state.mails.find(m=>m.companyId===id&&m.language==='en')!;
  if(!mail.review)await salesAction({scope:'demo',companyId:id,action:'approveMail',mailId:mail.id,revision:mail.revision,actor:'演示邮件审核者（模拟）',confirmed:true});
  let lead=(await readSales(dir)).leads.find(l=>l.companyId===id)!;
  if(lead.activities.length===1){const update=async(stage:string,summary:string,kind?:string)=>{await salesAction({scope:'demo',companyId:id,action:'updateLead',revision:lead.revision,stage,actor:'演示销售（模拟）',summary,priority:id==='proasin'?'high':'normal',task:id==='hoppe'?'模拟：核实Keenon合同品类、地域及排他限制':id==='dimacofi'?'模拟：向品牌方核对既有关系与服务边界':'模拟：核实HORECA场景与现场服务',nextDate:'2026-11-03',...(kind?{confirmed:true,contactDate:'2026-11-01',channel:'email',communicationKind:kind}:{})});lead=(await readSales(dir)).leads.find(l=>l.companyId===id)!;};
   if(id==='proasin'){await update('Qualified','【模拟】按有据三维人工评分确认初步访谈门槛，非实际合作资格认证');await update('Ready','【模拟】邮件草稿人工确认，尚未发送');await update('Contacted','【模拟】假设人工发出资格核实问题，系统未发送任何邮件','sent');await update('Replied','【模拟】假设收到要求说明服务范围的问题，不代表真实企业回复或合作意愿','reply');}
   else if(id==='hoppe')await update('OnHold','【模拟】保留限制调查邮件草稿，未联系；先核实竞品合同，不自动否决合作');
   else{await update('Contacted','【模拟】假设人工发送现有关系核实问题，非新经销商开发，系统未发送','sent');await update('Replied','【模拟】假设收到渠道维护问答，实际关系仍仅企业自述，未获品牌确认','reply');}
  }
 }
 return {initialized:true,simulated:true,researchVersions:(await readState(dir)).publications.length,marker:randomUUID()};
}
