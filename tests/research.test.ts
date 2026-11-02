import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {companies,sources} from '../lib/data';
import {evaluate,classify} from '../lib/engine';
import {demoDocuments,DEMOS} from '../lib/research/demos';
import {parseClaims,parseReview,validateCitations} from '../lib/research/validation';
import {extract,mockExtract} from '../lib/research/providers';
import {applyReview} from '../lib/research/review';
import {emptyState,readState,mutateState,catalogFromState} from '../lib/research/store';
import {requestJson} from '../lib/research/http';
import type {Draft,ReviewInput,ResearchDocument} from '../lib/research/types';
const docs=()=>demoDocuments('proasin');
const makeDraft=(demo:keyof typeof DEMOS='proasin'):Draft=>{const documents=demoDocuments(demo);return {id:'test-draft',revision:1,name:DEMOS[demo].name,website:DEMOS[demo].website,companyId:DEMOS[demo].companyId,createdAt:'2026-11-01T08:00:00Z',status:'pending',mode:'mock',documents,...parseClaims(mockExtract(documents),documents),reviews:null};};
function review(d:Draft):ReviewInput{return {confirmed:true,revision:d.revision,reviewer:'验收测试（模拟）',note:'模拟审核，非真实商业尽调',role:d.companyId==='hoppe'?'competitor':'potential',claims:Object.fromEntries(d.claims.map(c=>[c.id,{decision:c.kind==='unknown'?'reject':'accept',kind:c.kind,value:c.value,evidence:c.evidence,note:''}])),scores:{}};}
describe('AI 研究事实及证据校验',()=>{
 it('正常企业提取保留原文引用',()=>{const d=makeDraft();const f=d.claims.find(c=>c.key==='business')!;expect(f.kind).toBe('fact');expect(f.evidence[0].quote).toContain('industrial');expect(validateCitations(f.evidence,d.documents)).toHaveLength(1);});
 it('资料不完整保持未知/null',()=>{const d=makeDraft('acquatecnia');expect(d.claims.find(c=>c.key==='customers')?.value).toBeNull();expect(d.claims.find(c=>c.key==='deployment')?.kind).toBe('unknown');});
 it('不存在的引证不能变事实',()=>{const r=parseClaims({claims:[{key:'business',kind:'fact',value:'虚构',evidence:[{documentId:'missing',quote:'虚构证据片段不存在'}]}]},docs());expect(r.claims[0].value).toBeNull();expect(r.warnings.length).toBeGreaterThan(0);});
 it('正文中不存在的片段不能变事实',()=>{const r=parseClaims({claims:[{key:'business',kind:'fact',value:'500 employees',evidence:[{documentId:'doc-0',quote:'我们有五百名员工和全国网络'}]}]},docs());expect(r.claims[0].kind).toBe('unknown');});
 it('失败网页不产生可引证事实',()=>expect(validateCitations([{documentId:'doc-0',quote:'Equipos de aseo industrial'}],[{...docs()[0],status:'failed',text:null}])).toEqual([]));
 it('重复字段阻断，不任意取第一项',()=>{const x={key:'business',kind:'fact',value:'A',evidence:[{documentId:'doc-0',quote:'Equipos de aseo industrial'}]};expect(parseClaims({claims:[x,x]},docs()).claims[0].value).toBeNull();});
 it('不能把适配建议当作事实',()=>expect(parseClaims({claims:[{key:'fit',kind:'fact',value:'必然合作',evidence:[{documentId:'doc-0',quote:'Equipos de aseo industrial'}]}]},docs()).claims.find(c=>c.key==='fit')?.value).toBeNull());
 it('AI 推断无引证也可保留但不能作为事实',()=>{const r=parseClaims({claims:[{key:'fit',kind:'inference',value:'建议调查产品适配',evidence:[]}]},docs());expect(r.claims.find(c=>c.key==='fit')?.kind).toBe('inference');});
 it('不保存模型输出中的联系方式',()=>expect(parseClaims({claims:[{key:'customers',kind:'inference',value:'contact private@example.com'}]},docs()).claims.find(c=>c.key==='customers')?.value).toBeNull());
 it('模型非法根结构报错，不伪造成功',()=>expect(()=>parseClaims({facts:[]},docs())).toThrow('结构错误'));
});
describe('DeepSeek 成本开关与错误处理（全部注入假网络，不执行付费调用）',()=>{
 it('默认 Mock 不调用网络',async()=>{const request=vi.fn();const r=await extract(docs(),false,{env:{},request});expect(r.mode).toBe('mock');expect(request).not.toHaveBeenCalled();});
 it.each([{RESEARCH_PROVIDER:'deepseek'},{RESEARCH_PROVIDER:'deepseek',ALLOW_PAID_AI:'true'},{RESEARCH_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test'}])('缺少服务端开关或 Key 时禁止付费',async env=>{const request=vi.fn();await expect(extract(docs(),true,{env,request})).rejects.toThrow('未授权');expect(request).not.toHaveBeenCalled();});
 it('未提供单次确认时不付费',async()=>{const request=vi.fn();await expect(extract(docs(),false,{env:{RESEARCH_PROVIDER:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'test'},request})).rejects.toThrow('未授权');expect(request).not.toHaveBeenCalled();});
 const env={RESEARCH_PROVIDER:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'fake-test-key'};
 it('授权适配器使用固定服务端地址、JSON、token 上限与有效证据校验',async()=>{const request=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockExtract(docs()))}}],usage:{prompt_tokens:200,completion_tokens:100}})));const r=await extract(docs(),true,{env,request});expect(r.mode).toBe('deepseek');expect('usage' in r?r.usage.inputTokens:null).toBe(200);const [url,init]=request.mock.calls[0] as unknown as [string,RequestInit];expect(url).toBe('https://api.deepseek.com/chat/completions');expect(JSON.parse(String(init.body)).max_tokens).toBe(2200);expect(JSON.parse(String(init.body)).stream).toBe(false);});
 it.each(['','not json','{}'])('空白或无效响应不发布（%s）',async content=>{const request=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]})));await expect(extract(docs(),true,{env,request})).rejects.toThrow('无效研究结构');expect(request).toHaveBeenCalledTimes(1);});
 it('截断响应拒绝且无自动重试',async()=>{const request=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})));await expect(extract(docs(),true,{env,request})).rejects.toThrow('截断');expect(request).toHaveBeenCalledTimes(1);});
 it('429 不重试、不泄露 Key 或原始错误正文',async()=>{const request=vi.fn(async()=>new Response('fake-test-key',{status:429}));await expect(extract(docs(),true,{env,request})).rejects.toThrow('HTTP 429');expect(request).toHaveBeenCalledTimes(1);});
 it('网络异常被明确报告',async()=>{const request=vi.fn(async()=>{throw new Error('secret backend error');});await expect(extract(docs(),true,{env,request})).rejects.toThrow('网络请求失败');});
 it('没有可用正文时不调用模型',async()=>{const request=vi.fn();await expect(extract([],true,{env,request})).rejects.toThrow('没有可用');expect(request).not.toHaveBeenCalled();});
});
describe('人工确认与评分联动',()=>{
 it('研究草稿不改变 Phase 1 企业数据库',()=>{const original=JSON.stringify(companies);makeDraft();expect(JSON.stringify(companies)).toBe(original);});
 it('审核后创建独立版本并保存事实原文、来源和审核人',()=>{const d=makeDraft(),r=review(d);const pub=applyReview(d,r,companies[0],sources);expect(pub.company.humanReview?.reviewer).toContain('模拟');expect(pub.company.fields.business.citations?.[0].quote).toContain('industrial');expect(pub.sources[0].retrieval).toBe('archive');expect(pub.company).not.toBe(companies[0]);});
 it('修改事实会失效相关旧评分，未知不是零',()=>{const d=makeDraft(),r=review(d);const pub=applyReview(d,r,companies[0],sources);expect(pub.company.assessments.product.value).toBeNull();expect(pub.changes.find(c=>c.dimension==='产品业务匹配')?.reason).toContain('失效');});
 it('人工有依据地重新评分并解释变化',()=>{const d=makeDraft(),r=review(d),product=d.claims.find(c=>c.key==='products')!;r.scores.product={value:3,rationale:'人工核对公开地面清洁设备目录，仍需调查机器人部署',claimIds:[product.id]};const p=applyReview(d,r,companies[0],sources);expect(p.company.assessments.product.value).toBe(3);expect(evaluate(p.company,[...sources,...p.sources]).dimensions[0].kind).toBe('human');expect(p.changes[0].reason).toContain('人工核对');});
 it('错误提取可拒绝，保留原库正确值',()=>{const d=makeDraft(),r=review(d),claim=d.claims.find(c=>c.key==='business')!;r.claims[claim.id].decision='reject';const pub=applyReview(d,r,companies[0],sources);expect(pub.company.fields.business.value).toBe(companies[0].fields.business.value);});
 it('人工修改事实须有匹配引文及修改原因',()=>{const d=makeDraft(),r=review(d),c=d.claims[0];r.claims[c.id]={decision:'edit',kind:'fact',value:'工业清洁设备业务',evidence:c.evidence,note:'修正翻译'};expect(applyReview(d,r,companies[0],sources).company.fields.business.value).toBe('工业清洁设备业务');r.claims[c.id].evidence=[{documentId:'doc-0',quote:'虚构的来源内容不存在'}];expect(()=>applyReview(d,r,companies[0],sources)).toThrow('原文');});
 it('不能用 accept 偷改模型内容',()=>{const d=makeDraft(),r=review(d);r.claims[d.claims[0].id].value='偷偷修改';expect(()=>applyReview(d,r,companies[0],sources)).toThrow('使用“修改”');});
 it('未审完不能发布',()=>{const d=makeDraft(),r=review(d);delete r.claims[d.claims[0].id];expect(()=>applyReview(d,r,companies[0],sources)).toThrow('所有候选');});
 it('空复核人、空说明或未确认不能通过请求校验',()=>{const d=makeDraft(),r=review(d);expect(()=>parseReview({...r,reviewer:''})).toThrow();expect(()=>parseReview({...r,note:''})).toThrow();expect(()=>parseReview({...r,confirmed:false})).toThrow('需要确认');});
 it('来源支持不等于模型建议，AI 推断不能用于资格赋分',()=>{const d=makeDraft(),r=review(d);const f=d.claims.find(c=>c.key==='fit')!;r.scores.product={value:4,rationale:'错用适配建议',claimIds:[f.id]};expect(()=>applyReview(d,r,companies[0],sources)).toThrow('不能引用 AI');});
 it('旧草稿版本或重复审核返回冲突',()=>{const d=makeDraft(),r=review(d);expect(()=>applyReview(d,{...r,revision:0},companies[0],sources)).toThrow('版本');d.status='approved';expect(()=>applyReview(d,r,companies[0],sources)).toThrow('已完成');});
 it('Hoppe 保留竞争冲突，不自动拒绝合作',()=>{const d=makeDraft('hoppe'),r=review(d);const p=applyReview(d,r,companies[6],sources);expect(classify(p.company,[...sources,...p.sources])).toBe('competitor');expect(p.company.risks.join('')).toContain('不自动否决');});
 it('既有渠道保护，不能被审核分类降为潜客',()=>{const d=makeDraft(),r=review(d);const p=applyReview({...d,companyId:'dimacofi'},r,companies[4],sources);expect(p.company.researchRole).toBe('benchmark');expect(classify(p.company,[...sources,...p.sources])).toBe('existing');});
 it('标杆分类不能凭空创造品牌关系',()=>{const d=makeDraft(),r=review(d);r.role='benchmark';expect(()=>applyReview(d,r,null,sources)).toThrow('不能凭研究分类');});
 it('未知字段显式编辑为 null 清空，接受未知则不清空旧库',()=>{const d=makeDraft(),r=review(d),c=d.claims.find(c=>c.key==='city')!;r.claims[c.id]={decision:'accept',kind:'unknown',value:null,evidence:[],note:''};expect(applyReview(d,r,companies[0],sources).company.city.value).toBe(companies[0].city.value);r.claims[c.id]={...r.claims[c.id],decision:'edit',note:'旧城市尚未核实，撤回'};expect(applyReview(d,r,companies[0],sources).company.city.value).toBeNull();});
 it('新企业未提供资料不填充国家、城市或规模',()=>{const d=makeDraft(),r=review(d);const p=applyReview(d,r,null,sources);expect(p.company.country).toBeNull();expect(p.company.city.value).toBeNull();expect(p.company.assessments.cooperation.value).toBeNull();});
});
describe('本地持久化、版本合并与损坏保护',()=>{
 it('无状态时返回空草稿，不修改种子',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'scout-'));try{expect((await readState(dir)).drafts).toEqual([]);expect(catalogFromState(emptyState()).companies).toHaveLength(7);}finally{await rm(dir,{recursive:true,force:true});}});
 it('并发写入串行提交，重读仍保留全部操作',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'scout-'));try{await Promise.all([1,2,3].map(n=>mutateState(s=>{s.audit.push({at:'2026-11-01T08:00:00Z',action:`test-${n}`});},dir)));expect((await readState(dir)).audit).toHaveLength(3);expect(JSON.parse(await readFile(path.join(dir,'workspace.json'),'utf8')).version).toBe(1);}finally{await rm(dir,{recursive:true,force:true});}});
 it('损坏文件报错且不覆盖',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'scout-'));try{await writeFile(path.join(dir,'workspace.json'),'corrupt');await expect(mutateState(s=>s.audit.push({at:'x',action:'x'}),dir)).rejects.toThrow('没有覆盖');expect(await readFile(path.join(dir,'workspace.json'),'utf8')).toBe('corrupt');}finally{await rm(dir,{recursive:true,force:true});}});
 it('发布版本出现在合并目录，种子仍未修改',()=>{const d=makeDraft(),s=emptyState(),p=applyReview(d,review(d),companies[0],sources);s.publications.push(p);const c=catalogFromState(s);expect(c.companies).toHaveLength(7);expect(c.companies[0].humanReview).not.toBeNull();expect(companies[0].humanReview).toBeNull();});
});
describe('本机 API 请求边界',()=>{
 it('跨站请求禁止修改',async()=>{const r=new Request('http://127.0.0.1:3100/api/research',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:'{}'});await expect(requestJson(r)).rejects.toThrow('同源');});
 it('没有 origin 的脚本请求也被拒绝',async()=>await expect(requestJson(new Request('http://127.0.0.1:3100/api/research',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}))).rejects.toThrow('同源'));
 it('有效同源 JSON 可读取',async()=>{const r=new Request('http://127.0.0.1:3100/api/research',{method:'POST',headers:{origin:'http://127.0.0.1:3100','content-type':'application/json'},body:'{"name":"test"}'});expect((await requestJson(r)).name).toBe('test');});
 it('超大请求被拒绝',async()=>{const r=new Request('http://127.0.0.1:3100/api/research',{method:'POST',headers:{origin:'http://127.0.0.1:3100','content-type':'application/json'},body:JSON.stringify({text:'x'.repeat(210000)})});await expect(requestJson(r)).rejects.toThrow('200KB');});
});
// Type-level fixture deliberately includes a failed document: never treated as successfully fetched.
const failed:ResearchDocument={id:'failed',url:'https://proasin.cl/',title:'failed',status:'failed',text:null,capturedAt:'2026-11-01T08:00:00Z',method:'live',error:'不可访问'};
it('官网全部不可访问时 Mock 也不虚构内容',async()=>{const r=await extract([failed],false,{env:{}});expect(r.claims.every(c=>c.value===null)).toBe(true);});
it('Next 适配器规范化 URL 为 localhost 时，仍按经过校验的本机 Host 匹配 Origin',async()=>{
 const request=new Request('http://localhost:3100/api/research',{method:'POST',headers:{host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100','content-type':'application/json'},body:'{}'});
 expect(await requestJson(request)).toEqual({});
});
it('状态超出容量时不覆盖上一次有效文件',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'scout-capacity-'));try{
  await mutateState(s=>{s.audit.push({at:'2026-11-01T08:00:00Z',action:'保留有效记录'});},dir);
  await expect(mutateState(s=>{s.audit.push({at:'2026-11-01T08:00:00Z',action:'x'.repeat(12000001)});},dir)).rejects.toThrow('未覆盖');
  expect((await readState(dir)).audit).toHaveLength(1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
