import {classify,evaluate} from '../engine';
import type {Company,Source} from '../types';
export function qualification(c:Company,sources:Source[]){
 const category=classify(c,sources),e=evaluate(c,sources);
 if(category==='existing')return {stage:'benchmark',label:'渠道标杆 · 核实协同边界',action:'向品牌方独立核实历史渠道身份与区域权益；不作为全新潜客。'};
 if(category==='competitor')return {stage:'conflict',label:'冲突调查 · 需人工判断',action:'先核实既有品牌合同、品类与区域限制，再判断合作空间。'};
 if(category==='unknown')return {stage:'research',label:'先确认企业与关系',action:'补齐企业业务、关系与公开证据，再做渠道资格判断。'};
 if(/Keenon|Phantas|同类机器人|品牌线索/i.test(c.fields.competition.value??''))return {stage:'conflict',label:'人工评估冲突后再接触',action:'同类机器人业务可能存在冲突，先确认排他限制；不自动否决合作。'};
 if(!c.humanReview || e.limited)return {stage:'research',label:'优先补充研究',action:!c.humanReview?'先人工复核公开事实、评分依据与品牌冲突，再决定是否接触。':'评分证据覆盖率不足 60%；优先调查缺失项，不据高归一分直接接触。'};
 const reviewed=c.humanReview?.reviewedDimensions??[];
 const human=e.dimensions.filter(d=>d.kind==='human'&&d.value!==null&&reviewed.includes(d.key));
 const required=['product','customers','technical'];
 const humanCoverage=human.reduce((n,d)=>n+d.weight,0),humanScore=humanCoverage?human.reduce((n,d)=>n+d.value!/4*d.weight,0)/humanCoverage*100:null;
 if(c.reviewWarnings?.length||humanCoverage<60||required.some(k=>!human.some(d=>d.key===k&&d.value!>0))||humanScore===null||humanScore<50)return {stage:'research',label:'继续渠道资格调查',action:c.reviewWarnings?.length?'存在来源实体或关系冲突，先核实再判断接触。':'需人工有据复核产品、B2B客户与技术服务维度（各大于0），人工评分覆盖至少60%、人工已复核维度归一分至少50。接受未知或推断不代表能力已核实；机器人经验、合作条款等未知可留待访谈。'};
 return {stage:'contact',label:'可考虑人工初步接触',action:'按已复核的业务适配点开展人工资格访谈，询问服务范围、品牌政策与合作条件；尚不代表对方有合作意愿。'};
}
