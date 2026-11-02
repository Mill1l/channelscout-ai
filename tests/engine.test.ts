import { describe,it,expect } from 'vitest';
import { companies,sources } from '../lib/data';
import {DIMENSIONS,evaluate,usableEvidence,classify,relationshipLabel,selectCompanies,researchQueue,validateData} from '../lib/engine';
import type {Company,Source} from '../lib/types';
const clone=():Company=>structuredClone(companies[0]);
const setAll=(c:Company,value:number|null)=>{for(const d of DIMENSIONS)c.assessments[d.key]={value,evidenceIds:value===null?[]:['pro-home'],rationale:'可核对的测试依据',kind:'inference'};return c;};
describe('独立评分引擎',()=>{
 it('六维度权重和为 100',()=>expect(DIMENSIONS.reduce((s,d)=>s+d.weight,0)).toBe(100));
 it('完整满分',()=>{const e=evaluate(setAll(clone(),4),sources);expect(e.score).toBe(100);expect(e.coverage).toBe(100);expect(e.interval).toEqual([100,100]);});
 it('有证据的真实零分仍覆盖',()=>{const e=evaluate(setAll(clone(),0),sources);expect(e.score).toBe(0);expect(e.coverage).toBe(100);});
 it('全部未知不评分',()=>{const e=evaluate(setAll(clone(),null),sources);expect(e.score).toBeNull();expect(e.coverage).toBe(0);expect(e.interval).toEqual([0,100]);expect(e.missing).toHaveLength(6);});
 it('未知不成为零分，按已知权重归一',()=>{const c=setAll(clone(),null);c.assessments.product={value:3,evidenceIds:['pro-home'],rationale:'测试依据',kind:'inference'};const e=evaluate(c,sources);expect(e.score).toBe(75);expect(e.coverage).toBe(25);expect(e.interval).toEqual([18.8,93.8]);expect(c.assessments.customers.value).toBeNull();});
 it('权重计算及示例保留精度',()=>{const e=evaluate(companies[0],sources);expect(e.score).toBe(70.3);expect(e.coverage).toBe(80);expect(e.interval).toEqual([56.3,76.3]);});
 it.each([-1,5,2.5,NaN,Infinity])('非法分数 %s 不计入',value=>{const c=setAll(clone(),null);c.assessments.product={value,evidenceIds:['pro-home'],rationale:'测试',kind:'inference'};expect(evaluate(c,sources).score).toBeNull();});
 it('缺失评分对象安全降级',()=>{const c=clone();delete (c.assessments as Partial<Company['assessments']>).product;expect(evaluate(c,sources).dimensions[0].value).toBeNull();});
 it('评分资料完整度与证据覆盖率独立',()=>{const c=setAll(clone(),null);expect(evaluate(c,sources).completeness).toBeGreaterThan(0);expect(evaluate(c,sources).coverage).toBe(0);});
});
describe('证据处理',()=>{
 it('未知来源、空引用、失败、索引来源不可用',()=>{for(const ids of [[],['missing'],['pro-brands'],['acq-lavor'],['pro-home','missing']])expect(usableEvidence(ids,sources)).toBe(false);});
 it('已核对官网来源可用',()=>expect(usableEvidence(['pro-home'],sources)).toBe(true));
 it('无摘要 / 无日期 / 非 https 不可用',()=>{for(const patch of [{summary:''},{checkedAt:''},{url:'javascript:alert(1)'}])expect(usableEvidence(['pro-home'],sources.map(s=>s.id==='pro-home'?{...s,...patch}:s))).toBe(false);});
 it('评分有分数但无依据时转未知',()=>{const c=setAll(clone(),null);c.assessments.product={value:4,evidenceIds:[],rationale:'猜测',kind:'inference'};expect(evaluate(c,sources).score).toBeNull();expect(evaluate(c,sources).dimensions[0].invalidEvidence).toBe(true);});
 it('评分没有解释不进入计算',()=>{const c=setAll(clone(),null);c.assessments.product={value:4,evidenceIds:['pro-home'],rationale:' ',kind:'inference'};expect(evaluate(c,sources).score).toBeNull();});
 it('仅企业自述不得升级为厂家独立确认',()=>{const c=structuredClone(companies.find(c=>c.id==='dimacofi')!);c.relationship.status='brand_confirmed';c.relationship.brandConfirmed=true;expect(relationshipLabel(c,sources)).toContain('企业公开宣称');expect(validateData([c],sources).length).toBeGreaterThan(0);});
 it('厂家独立确认需要品牌来源',()=>{const c=clone();c.relationship={status:'brand_confirmed',brandConfirmed:true,evidenceIds:['brand-test'],claim:'测试授权'};const s:Source={...sources[0],id:'brand-test',publisher:'brand'};expect(relationshipLabel(c,[...sources,s])).toBe('品牌方独立确认');});
 it('无复核记录不得标注人工判断',()=>{const c=clone();c.fields.business.kind='human';expect(validateData([c],sources)).toContain('proasin: 未授权人工判断');});
 it('重复来源、企业以及不安全 URL 报错',()=>{expect(validateData([companies[0],companies[0]],[...sources,sources[0],{...sources[0],id:'bad',url:'http://bad'}]).length).toBeGreaterThanOrEqual(3);});
});
describe('分类与关系',()=>{
 it('两家企业公开宣称为现有标杆而非全新潜客',()=>{for(const id of ['dimacofi','vic-robotics']){const c=companies.find(c=>c.id===id)!;expect(classify(c,sources)).toBe('existing');expect(relationshipLabel(c,sources)).toContain('品牌方未独立确认');}});
 it('现有渠道优先于竞争渠道标签',()=>{const c=structuredClone(companies[4]);c.researchRole='competitor';expect(classify(c,sources)).toBe('existing');});
 it('Hoppe 为竞争研究对象但没有自动否决规则',()=>{const c=companies.find(c=>c.id==='hoppe')!;expect(classify(c,sources)).toBe('competitor');expect(evaluate(c,sources).score).toBeGreaterThan(0);expect(relationshipLabel(c,sources)).toBe('与普渡关系未知');});
 it('Sauber 的同类机器人冲突保留调查空间',()=>expect(classify(companies.find(c=>c.id==='sauber')!,sources)).toBe('potential'));
 it('无证据的潜在分组降级为关系未知企业',()=>{expect(classify(clone(),[])).toBe('unknown');});
 it('明确 unknown 研究角色可以独立筛选',()=>{const c=clone();c.researchRole='unknown';expect(selectCompanies([c],sources,{category:'unknown'})).toHaveLength(1);});
});
describe('排序、搜索与筛选',()=>{
 it('研究队列不混入标杆与竞争渠道',()=>{expect(researchQueue(companies,sources).map(c=>c.id)).toEqual(['general-trade','proasin','sauber','acquatecnia']);});
 it('归一高分不会自动占据证据支持分首位',()=>{const [a,b]=[setAll(clone(),3),setAll(clone(),null)];a.id='a';b.id='b';b.assessments.product={value:4,evidenceIds:['pro-home'],rationale:'测试',kind:'inference'};expect(selectCompanies([b,a],sources,{sort:'research'})[0].id).toBe('a');expect(selectCompanies([a,b],sources,{sort:'score'})[0].id).toBe('b');});
 it('全未知排在有分数之后',()=>{const a=clone(),b=setAll(clone(),null);b.id='unknown';expect(selectCompanies([b,a],sources,{sort:'score'})[1].id).toBe('unknown');});
 it('同分按覆盖率后名称排序',()=>{const a=clone(),b=clone();a.name='Zulu';b.name='Alpha';expect(selectCompanies([a,b],sources)[0].name).toBe('Alpha');});
 it('关键词不区分大小写且修剪空格',()=>expect(selectCompanies(companies,sources,{query:'  PROASIN  '}).map(c=>c.id)).toEqual(['proasin']));
 it('支持中文行业检索',()=>expect(selectCompanies(companies,sources,{query:'矿业'}).length).toBeGreaterThan(1));
 it('分类和覆盖率组合过滤',()=>expect(selectCompanies(companies,sources,{category:'potential',minCoverage:80}).map(c=>c.id)).toEqual(['general-trade','proasin']));
 it('无结果返回空数组',()=>expect(selectCompanies(companies,sources,{query:'不存在的企业'})).toEqual([]));
 it('排序不修改源数组',()=>{const before=companies.map(c=>c.id);selectCompanies(companies,sources,{sort:'name'});expect(companies.map(c=>c.id)).toEqual(before);});
});
describe('七家真实样本完整性',()=>{
 it('七家唯一企业，来源和字段校验通过',()=>{expect(companies).toHaveLength(7);expect(validateData(companies,sources)).toEqual([]);});
 it('未知合作适配性保持 null，无虚构采购意愿',()=>{for(const c of companies){expect(c.assessments.cooperation.value).toBeNull();expect(c.humanReview).toBeNull();expect(c.relationship.brandConfirmed).toBe(false);}});
 it('所有已知维度都有关联证据和解释',()=>{for(const c of companies)for(const d of evaluate(c,sources).dimensions)if(d.value!==null){expect(d.evidenceIds.length).toBeGreaterThan(0);expect(d.rationale.length).toBeGreaterThan(4);}});
 it('Acquatecnia 失败首页不被当作评分证据',()=>{const c=companies.find(c=>c.id==='acquatecnia')!;for(const d of evaluate(c,sources).dimensions.filter(d=>d.value!==null))expect(d.evidenceIds).not.toContain('acq-home');});
});
