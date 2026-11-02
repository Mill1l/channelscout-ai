import {describe,it,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {companies,sources} from '../lib/data';
import {companySources} from '../lib/engine';
import {decodeHtmlEntities} from '../lib/research/html-entities';
import {cleanHtml,fetchPublic} from '../lib/research/fetch-public';
import {extract,mockExtract} from '../lib/research/providers';
import {parseClaims,validateCitations} from '../lib/research/validation';
import {createResearch,submitReview} from '../lib/research/service';
import {readState,catalogFromState} from '../lib/research/store';
import type {ResearchDocument,ReviewInput} from '../lib/research/types';
const doc=(text:string):ResearchDocument=>({id:'doc-0',url:'https://entity-fixture.cl/',title:'合成实体夹具',status:'ok',text,method:'manual',capturedAt:'2026-11-01T08:00:00Z'});
describe('F12 西语实体及证据一致性',()=>{
 it.each([['&aacute;&eacute;&iacute;&oacute;&uacute;&ntilde;&uuml;','áéíóúñü'],['&Aacute;&Eacute;&Iacute;&Oacute;&Uacute;&Ntilde;&Uuml;','ÁÉÍÓÚÑÜ'],['K&auml;rcher &amp; Compa&ntilde;&iacute;a','Kärcher & Compañía'],['&#243; &#xF1; &#XF1;','ó ñ ñ'],['&iquest;Atenci&oacute;n? &iexcl;S&iacute;!','¿Atención? ¡Sí!']])('解码 %s',(input,expected)=>expect(decodeHtmlEntities(input)).toBe(expected));
 it('解码只进行一次，不把原文中的字面编码再解释一层',()=>expect(decodeHtmlEntities('&amp;oacute;')).toBe('&oacute;'));
 it('未知命名实体不悄悄删除或伪造',()=>expect(decodeHtmlEntities('&notARealReference;')).toBe('&notARealReference;'));
 it.each(['&#0;','&#xD800;','&#1114112;'])('非法Unicode %s替换而不产生孤立代理',input=>expect(decodeHtmlEntities(input)).toBe('\uFFFD'));
 it('保留实际有效的HTML命名引用大小写',()=>expect(decodeHtmlEntities('&Aacute;&aacute;')).toBe('Áá'));
 it('编码联系方式在解码后移除',()=>expect(cleanHtml('Atenci&oacute;n: test&#64;example.com +56 9 1234 5678')).not.toMatch(/example.com|1234/));
 it('编码标签保留为文本，不重新解析执行',()=>expect(cleanHtml('<main>&lt;script&gt;texto&lt;/script&gt;</main>')).toBe('<script>texto</script>'));
 it('页面标题与正文解码一致，证据引用必须匹配真实显示内容',async()=>{const d=await fetchPublic('https://entity-fixture.cl/','doc-0',{resolve:vi.fn(async()=>[{address:'93.184.216.34',family:4}]) as never,request:async()=>({status:200,type:'text/html',body:'<title>K&auml;rcher &amp; Compa&ntilde;&iacute;a</title><main>Equipos de limpieza industrial. Servicio t&eacute;cnico y repuestos.</main>'})});expect(d.title).toBe('Kärcher & Compañía');expect(d.text).toContain('Servicio técnico');const claims=parseClaims(mockExtract([d]),[d]).claims;const f=claims.find(c=>c.key==='afterSales')!;expect(f.kind).toBe('fact');expect(validateCitations(f.evidence,[d])).toHaveLength(1);expect(validateCitations([{documentId:d.id,quote:'Servicio t&eacute;cnico y repuestos'}],[d])).toEqual([]);});
 it('手录企业名、标题、正文、审核保存及重载保持相同字符',async()=>{const dir=await mkdtemp(path.join(tmpdir(),'scout27-'));vi.stubEnv('CHANNELSCOUT_DATA_DIR',dir);vi.stubEnv('RESEARCH_PROVIDER','mock');try{const d=await createResearch({name:'Compa&ntilde;&iacute;a de Limpieza',website:'https://entity-fixture.cl/',sourceMode:'manual',manual:[{url:'https://entity-fixture.cl/',title:'Atenci&oacute;n t&eacute;cnica',text:'Equipos de limpieza industrial. Servicio t&eacute;cnico y repuestos.'}]});expect(d.name).toBe('Compañía de Limpieza');expect(d.documents[0].title).toBe('Atención técnica');const review:ReviewInput={revision:1,reviewer:'Phase2.7合成回归（模拟）',note:'只测字符和审核路径',confirmed:true,role:'potential',claims:Object.fromEntries(d.claims.map(c=>[c.id,{decision:c.kind==='unknown'?'reject':'accept',kind:c.kind,value:c.value,evidence:c.evidence,note:''}])),scores:{}};const p=await submitReview({draftId:d.id,review});const state=await readState();const c=catalogFromState(state).companies.find(c=>c.id===p.company.id)!;expect(c.name).toBe(d.name);expect(c.fields.afterSales.value).toContain('técnico');expect(p.sources[0].summary).toContain('técnico');expect(c.fields.afterSales.citations?.[0].quote).toContain('técnico');}finally{vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});}});
});
describe('DeepSeek准备：只使用替身验证成本门禁和结构',()=>{
 it('有假Key但默认Mock不请求',async()=>{const request=vi.fn();await extract([doc('Equipos de limpieza industrial.')],true,{env:{DEEPSEEK_API_KEY:'fake-key'},request});expect(request).not.toHaveBeenCalled();});
 it('服务端开关与Key都有但单次未授权仍不请求',async()=>{const request=vi.fn();await expect(extract([doc('Equipos de limpieza industrial.')],false,{env:{RESEARCH_PROVIDER:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'fake-key'},request})).rejects.toThrow('未授权');expect(request).not.toHaveBeenCalled();});
 it('替身有效usage保存输入输出tokens，不假装已计算金额',async()=>{const documents=[doc('Equipos de limpieza industrial.')];const request=vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(mockExtract(documents))}}],usage:{prompt_tokens:150,completion_tokens:80,prompt_cache_hit_tokens:50,prompt_cache_miss_tokens:100}})));const r=await extract(documents,true,{env:{RESEARCH_PROVIDER:'deepseek',ALLOW_PAID_AI:'true',DEEPSEEK_API_KEY:'fake-key'},request});expect('usage' in r?r.usage:null).toEqual({inputTokens:150,outputTokens:80});expect(request).toHaveBeenCalledTimes(1);expect(JSON.stringify(r)).not.toContain('fake-key');});
});

describe('新企业详情来源归属回归',()=>{
 function fresh(){const c=structuredClone(companies[0]);c.id='new-company';c.city.evidenceIds=[];for(const f of Object.values(c.fields))f.evidenceIds=[];for(const a of Object.values(c.assessments))a.evidenceIds=[];c.relationship.evidenceIds=[];return c;}
 it('无引用的新企业不能继承Proasin来源',()=>expect(companySources(fresh(),sources)).toEqual([]));
 it('保留历史企业显式来源包括失败记录',()=>expect(companySources(companies[0],sources).some(s=>s.id==='pro-brands')).toBe(true));
 it('新企业仅引用自己的关系来源时也能展示，不混入其他公司',()=>{const c=fresh(),s={...sources[0],id:'new-relation',url:'https://entity-fixture.cl/'};c.relationship.evidenceIds=[s.id];expect(companySources(c,[...sources,s]).map(x=>x.id)).toEqual([s.id]);});
});

it('保留HTML5别名和多码点实体支持，不回退旧版通用实体正确性',()=>{expect(decodeHtmlEntities('&AMP;&QUOT;&LT;&GT;')).toBe('&"<>');expect(decodeHtmlEntities('&NotEqualTilde;')).toBe('≂̸');});
