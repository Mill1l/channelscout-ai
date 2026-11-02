import {describe,it,expect,vi,afterEach} from 'vitest';
import {companies,sources} from '../lib/data';
import {sourceHealth,evaluate,classify,usableEvidence,validateData} from '../lib/engine';
import {qualification} from '../lib/research/priority';
afterEach(()=>vi.useRealTimers());
describe('Phase 1 复核回归',()=>{
 it.each(['2026-02-30','2026-99-01','not-a-date'])('阻断非法日期 %s',checkedAt=>expect(sourceHealth({...sources[0],checkedAt})).toBe('invalid'));
 it('阻断未来日期',()=>expect(sourceHealth({...sources[0],checkedAt:'2099-01-01'},new Date('2026-11-01'))).toBe('invalid'));
 it('来源超过 90 天不参与当前评分',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2027-03-01'));expect(usableEvidence(['pro-home'],sources)).toBe(false);expect(evaluate(companies[0],sources).score).toBeNull();});
 it('失效证据不把现有渠道重新变成全新潜客',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2027-03-01'));expect(classify(companies[4],sources)).toBe('existing');expect(qualification(companies[4],sources).stage).toBe('benchmark');});
 it('复检读取失败的来源被排除',()=>{const ss=sources.map(s=>({...s,lastAttempt:{at:'2026-11-01T08:00:00Z',status:'failed' as const,error:'404'}}));expect(evaluate(companies[0],ss).score).toBeNull();});
 it('AI 推断字段不计入事实资料完整度',()=>{const c=structuredClone(companies[2]);expect(evaluate(c,sources).completeness).toBe(90);c.fields.customers.kind='inference';expect(evaluate(c,sources).completeness).toBe(80);});
 it('人工评分必须有有效复核人、日期与说明',()=>{const c=structuredClone(companies[0]);c.assessments.product.kind='human';c.humanReview={reviewer:'',date:'2026-11-01',note:''};expect(evaluate(c,sources).dimensions[0].value).toBeNull();expect(validateData([c],sources).length).toBeGreaterThan(0);});
 it('资料不足的高归一分仍只建议补充研究',()=>{const c=structuredClone(companies[3]);c.humanReview={reviewer:'测试',date:'2026-11-01',note:'测试'};expect(evaluate(c,sources).limited).toBe(true);expect(qualification(c,sources).stage).toBe('research');});
 it('未人工复核的样本不直接建议接触',()=>expect(qualification(companies[2],sources).stage).toBe('research'));
});
