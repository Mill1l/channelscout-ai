import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {dataDir} from '../research/store';
import {redactValue} from '../research/privacy';
import {ResearchError} from '../research/validation';
import {STAGES,type Scope,type SalesState} from './types';
export const salesDir=(scope:Scope)=>scope==='demo'?path.join(dataDir(),'phase3-demo'):dataDir();
export const emptySales=():SalesState=>({version:1,strategies:[],mails:[],leads:[]});
export function assertSales(value:unknown):asserts value is SalesState{
 if(!value||typeof value!=='object')throw new Error('Invalid state');const s=value as SalesState;
 if(s.version!==1||!Array.isArray(s.strategies)||!Array.isArray(s.mails)||!Array.isArray(s.leads))throw new Error('Invalid arrays');
 if(s.strategies.length>1000||s.mails.length>1000||s.leads.length>500)throw new Error('Capacity');
 const ids=new Set<string>();for(const row of [...s.strategies,...s.mails,...s.leads]){if(!row||typeof row.id!=='string'||ids.has(row.id)||typeof row.companyId!=='string')throw new Error('Invalid IDs');ids.add(row.id);}
 for(const m of s.mails)if(!Number.isInteger(m.revision)||m.revision<1||typeof m.subject!=='string'||typeof m.body!=='string'||typeof m.fingerprint!=='string'||!['en','es'].includes(m.language)||!['short','detailed'].includes(m.length))throw new Error('Invalid mail');
 for(const x of s.strategies)if(typeof x.fingerprint!=='string'||!Array.isArray(x.facts)||!Array.isArray(x.questions)||typeof x.eligible!=='boolean')throw new Error('Invalid strategy');
 const leads=new Set<string>();for(const l of s.leads){if(!l||!Object.hasOwn(STAGES,l.stage)||!Number.isInteger(l.revision)||!Array.isArray(l.activities)||l.activities.length>2000||!['high','normal','low'].includes(l.priority)||typeof l.simulated!=='boolean'||leads.has(l.companyId))throw new Error('Invalid lead');leads.add(l.companyId);for(const a of l.activities)if(!a||typeof a.actor!=='string'||!Object.hasOwn(STAGES,a.to)||typeof a.simulated!=='boolean'||typeof a.summary!=='string')throw new Error('Invalid activity');}
}
export async function readSales(dir:string):Promise<SalesState>{try{const raw=await readFile(path.join(dir,'outreach.json'),'utf8');if(Buffer.byteLength(raw)>5_000_000)throw new Error('Too large');const value=JSON.parse(raw);assertSales(value);return redactValue(value);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return emptySales();throw new ResearchError('本地开发看板读取失败；请保留原文件并从备份恢复，未覆盖损坏数据。',500);}}
// Same queue as research mutations: re-check the latest catalog inside a sales write.
const locks=globalThis as typeof globalThis & {scoutWriteQueue?:Promise<unknown>};
export async function mutateSales<T>(fn:(s:SalesState)=>T|Promise<T>,dir:string):Promise<T>{const op=(locks.scoutWriteQueue??Promise.resolve()).catch(()=>undefined).then(async()=>{const s=await readSales(dir),result=await fn(s);assertSales(s);const raw=JSON.stringify(s);if(Buffer.byteLength(raw)>5_000_000)throw new ResearchError('跟进记录达到5MB限制，请先备份归档。',413);const clean=JSON.stringify(redactValue(s),null,2);if(Buffer.byteLength(clean)>5_000_000)throw new ResearchError('跟进记录达到5MB限制，未覆盖旧文件。',413);await mkdir(dir,{recursive:true});const temp=path.join(dir,`outreach-${randomUUID()}.tmp`);await writeFile(temp,clean,{mode:0o600});await rename(temp,path.join(dir,'outreach.json'));return redactValue(result);});locks.scoutWriteQueue=op;return op;}
