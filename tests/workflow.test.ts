import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createResearch,submitReview,rejectDraft} from '../lib/research/service';
import {readState,catalogFromState} from '../lib/research/store';
import type {Draft,ReviewInput} from '../lib/research/types';
async function isolated(fn:()=>Promise<void>){const dir=await mkdtemp(path.join(tmpdir(),'scout-flow-'));vi.stubEnv('CHANNELSCOUT_DATA_DIR',dir);vi.stubEnv('RESEARCH_PROVIDER','mock');vi.stubEnv('ALLOW_PAID_AI','false');try{await fn();}finally{vi.unstubAllEnvs();await rm(dir,{recursive:true,force:true});}}
afterEach(()=>vi.unstubAllEnvs());
function review(d:Draft):ReviewInput{return {confirmed:true,revision:d.revision,reviewer:'测试（模拟）',note:'隔离测试',role:'potential',claims:Object.fromEntries(d.claims.map(c=>[c.id,{decision:c.kind==='unknown'?'reject':'accept',kind:c.kind,value:c.value,evidence:c.evidence,note:''}])),scores:{}};}
describe('研究服务的事务和企业去重',()=>{
 it('并行草稿不能覆盖较新的企业审核版本',()=>isolated(async()=>{const a=await createResearch({sourceMode:'demo',demo:'acquatecnia'}),b=await createResearch({sourceMode:'demo',demo:'acquatecnia'});await submitReview({draftId:a.id,review:review(a)});await expect(submitReview({draftId:b.id,review:review(b)})).rejects.toThrow('已有更新版本');expect((await readState()).publications).toHaveLength(1);}));
 it('已有渠道官网自动关联，不能另建未经开发的新潜客',()=>isolated(async()=>{const d=await createResearch({sourceMode:'manual',name:'VIC candidate',website:'https://www.vicrobotics.com./about',manual:[{url:'https://www.vicrobotics.com/about',text:'Somos distribuidores oficiales de PUDU Robotics.'}]});expect(d.companyId).toBe('vic-robotics');const p=await submitReview({draftId:d.id,review:review(d)});expect(p.company.researchRole).toBe('benchmark');expect(catalogFromState(await readState()).companies).toHaveLength(7);}));
 it('离线资料保留独立来源链接，人工模式全部未知直到编辑',()=>isolated(async()=>{const d=await createResearch({sourceMode:'manual',name:'Proasin',website:'https://proasin.cl/',extract:false,manual:[{url:'https://proasin.cl/servicio-tecnico/',text:'Servicio en terreno para diagnósticos y reparaciones.'}]});expect(d.documents[0].url).toBe('https://proasin.cl/servicio-tecnico/');expect(d.documents[0].method).toBe('manual');expect(d.claims.every(c=>c.value===null)).toBe(true);}));
 it('拒绝草稿不发布版本，并保存原因与审核人',()=>isolated(async()=>{const d=await createResearch({sourceMode:'demo',demo:'hoppe'});await rejectDraft({draftId:d.id,revision:1,reviewer:'测试（模拟）',note:'证据不足'});const s=await readState();expect(s.publications).toHaveLength(0);expect(s.drafts[0].status).toBe('rejected');expect(s.audit.at(-1)?.action).toContain('证据不足');expect(s.audit.at(-1)?.reviewer).toContain('模拟');}));
 it('官网与关联企业不符不创建草稿',()=>isolated(async()=>{await expect(createResearch({sourceMode:'manual',name:'Proasin',companyId:'proasin',website:'https://sauber.cl/',manual:[{url:'https://sauber.cl/',text:'Industrial cleaning equipment and support.'}]})).rejects.toThrow('不匹配');expect((await readState()).drafts).toHaveLength(0);}));
});
