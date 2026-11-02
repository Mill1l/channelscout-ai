import {randomUUID} from 'node:crypto';
import {readState,catalogFromState} from '../research/store';
import {ResearchError} from '../research/validation';
import {redactText,redactValue} from '../research/privacy';
import {validDate} from '../engine';
import {context,generateStrategy,requireCurrent} from './strategy';
import {generateMail} from './mail';
import {mailWarnings} from './safety';
import {salesDir,readSales,mutateSales} from './store';
import {STAGES,type Scope,type SalesView,type Lead,type Stage,type Activity} from './types';
export function parseScope(value:unknown):Scope{if(value===undefined||value===null||value==='main')return 'main';if(value==='demo')return 'demo';throw new ResearchError('无效工作区。');}
function str(value:unknown,max:number,required=true){if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new ResearchError('请输入有效文本，且不要超过字段长度限制。');return redactText(value.trim());}
function date(value:unknown,future=true){if(value===null||value==='')return null;if(typeof value!=='string'||!validDate(value)||!future&&value>new Date().toISOString().slice(0,10))throw new ResearchError('日期无效；联系日期不能在未来。');return value;}
export async function salesView(scope:Scope='main'):Promise<SalesView>{const dir=salesDir(scope),research=await readState(dir),catalog=catalogFromState(research),state=await readSales(dir);return redactValue({scope,...catalog,state,contexts:Object.fromEntries(catalog.companies.map(c=>[c.id,context(c,catalog.sources)]))});}
export async function salesAction(input:Record<string,unknown>){const scope=parseScope(input.scope),dir=salesDir(scope);
 return mutateSales(async state=>{const catalog=catalogFromState(await readState(dir)),company=catalog.companies.find(c=>c.id===input.companyId);if(!company)throw new ResearchError('企业不存在，请先研究并审核。',404);const x=context(company,catalog.sources),now=new Date().toISOString();
 if(input.action==='strategy'){const strategy=generateStrategy(company,catalog.sources);state.strategies.push(strategy);return strategy;}
 if(input.action==='generateMail'){
  const strategy=state.strategies.find(s=>s.id===input.strategyId&&s.companyId===company.id);if(!strategy)throw new ResearchError('请先生成当前企业策略。',404);requireCurrent(strategy.fingerprint,company,catalog.sources);if(!x.canDraft)throw new ResearchError(x.reason,422);
  if(!['en','es'].includes(String(input.language))||!['short','detailed'].includes(String(input.length)))throw new ResearchError('请选择英文/西语及简洁/详细版。');
  const mail=generateMail(strategy,company.name,input.language as 'en'|'es',input.length as 'short'|'detailed');state.mails.push(mail);return mail;
 }
 if(input.action==='saveMail'||input.action==='approveMail'){
  const m=state.mails.find(m=>m.id===input.mailId&&m.companyId===company.id);if(!m)throw new ResearchError('草稿不存在。',404);if(input.revision!==m.revision)throw new ResearchError('草稿版本已变化，请刷新。',409);requireCurrent(m.fingerprint,company,catalog.sources);
  if(input.action==='saveMail'){m.subject=str(input.subject,240);m.body=str(input.body,12000);m.edited=m.subject!==m.originalSubject||m.body!==m.originalBody;m.review=null;}
  else{if(input.confirmed!==true)throw new ResearchError('需要人工明确确认邮件事实、身份及所有商业措辞。');if(!x.canDraft)throw new ResearchError(x.reason,422);const warnings=mailWarnings(m.subject,m.body);if(warnings.length)throw new ResearchError('邮件存在待解决风险：'+warnings.join('；'),422);m.review={actor:str(input.actor,100),at:now};}
  m.updatedAt=now;m.revision++;return m;
 }
 if(input.action==='addLead'){
  if(state.leads.some(l=>l.companyId===company.id))throw new ResearchError('企业已在看板中。',409);
  const actor=str(input.actor,100),lead:Lead={id:randomUUID(),companyId:company.id,revision:1,stage:'Researching',basisFingerprint:null,priority:'normal',nextDate:null,task:'核对研究、来源与渠道关系',simulated:scope==='demo',activities:[{id:randomUUID(),at:now,actor,type:'added',from:null,to:'Researching',summary:scope==='demo'?'模拟加入开发看板；非真实商业活动':'人工加入研究看板；未联系',communication:null,nextDate:null,task:'核对研究、来源与渠道关系',simulated:scope==='demo'}]};state.leads.push(lead);return lead;
 }
 if(input.action==='updateLead'){
  const l=state.leads.find(l=>l.companyId===company.id);if(!l)throw new ResearchError('请先添加到看板。',404);if(input.revision!==l.revision)throw new ResearchError('看板版本已更新，请刷新后重试。',409);
  if(typeof input.stage!=='string'||!Object.hasOwn(STAGES,input.stage)||!['high','normal','low'].includes(String(input.priority)))throw new ResearchError('无效阶段或优先级。');
  const stage=input.stage as Stage;if((stage==='Qualified'&&!x.eligible||stage==='Ready'&&!x.canDraft))throw new ResearchError('当前资格不足：'+x.reason,422);
  if(stage==='Ready'&&!state.mails.some(m=>m.companyId===company.id&&m.fingerprint===x.fingerprint&&m.review&&!mailWarnings(m.subject,m.body).length))throw new ResearchError('需要当前资料版本下人工确认的邮件；生成不等于审核或发送。',422);
  const actor=str(input.actor,100),summary=str(input.summary,2000),task=str(input.task,1000,false),nextDate=date(input.nextDate);
  let communication:Activity['communication']=null;
  if(['Contacted','Replied','Opportunity'].includes(stage)&&(stage!==l.stage||input.confirmed===true||!!input.contactDate)){
   if(input.confirmed!==true)throw new ResearchError('必须人工明确确认联系/回复/商机记录；生成邮件不代表已发送。');
   const d=date(input.contactDate,false);if(!d||!['email','phone','meeting','other'].includes(String(input.channel))||!['sent','reply','meeting'].includes(String(input.communicationKind)))throw new ResearchError('请填写实际联系日期、渠道和沟通类型。');
   if(stage==='Replied'&&input.communicationKind!=='reply')throw new ResearchError('已回复需要人工录入回复沟通摘要。');
   if(stage==='Opportunity'&&input.communicationKind==='sent')throw new ResearchError('商机评估需要回复或会谈依据，不能由分数或发信推定。');
   if(summary.length<8)throw new ResearchError('请提供具体沟通摘要，至少8字符。');
   communication={date:d,channel:input.channel as NonNullable<Activity['communication']>['channel'],kind:input.communicationKind as NonNullable<Activity['communication']>['kind'],confirmed:true};
  }
  l.activities.push({id:randomUUID(),at:now,actor,type:'updated',from:l.stage,to:stage,summary,communication,nextDate,task,simulated:scope==='demo'});Object.assign(l,{stage,basisFingerprint:['Qualified','Ready'].includes(stage)?x.fingerprint:l.basisFingerprint,priority:input.priority,nextDate,task,revision:l.revision+1});return l;
 }
 throw new ResearchError('未知操作。');
 },dir);
}
export function csvCell(value:unknown){let s=value===null||value===undefined?'':String(value);if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function salesCsv(view:SalesView){const rows=[['企业','官网','模拟活动','当前阶段','优先级','下次跟进','下一步任务','活动日期','活动原阶段','活动新阶段','操作人','沟通日期','渠道','沟通类型','摘要','当前接触资格']];for(const l of view.state.leads){const c=view.companies.find(c=>c.id===l.companyId);for(const a of l.activities)rows.push([c?.name??l.companyId,c?.website??'',String(l.simulated),l.stage,l.priority,l.nextDate??'',l.task,a.at,a.from??'',a.to,a.actor,a.communication?.date??'',a.communication?.channel??'',a.communication?.kind??'',a.summary,view.contexts[l.companyId]?.qualification??'未知']);}return '\uFEFF'+rows.map(r=>r.map(v=>csvCell(redactText(v))).join(',')).join('\r\n');}
