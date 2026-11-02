import {redactValue} from './privacy';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {companies as seedCompanies,sources as seedSources} from '../data';
import type {LocalState} from './types';
import {ResearchError} from './validation';
export const emptyState=():LocalState=>({version:1,drafts:[],publications:[],sourceChecks:{},audit:[]});
export function dataDir(){return process.env.CHANNELSCOUT_DATA_DIR || path.join(process.cwd(),'.local');}
export async function readState(dir=dataDir()):Promise<LocalState>{
 try{const file=await readFile(path.join(dir,'workspace.json'),'utf8');if(file.length>12_000_000)throw new Error('Too large');const data=JSON.parse(file);if(data.version!==1 || !Array.isArray(data.drafts) || !Array.isArray(data.publications) || !Array.isArray(data.audit) || !data.sourceChecks)throw new Error('Invalid state');return redactValue(data);}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return emptyState();throw new ResearchError('本地研究状态读取失败，请保留文件并从备份恢复；没有覆盖损坏文件。',500);}
}
const locks=globalThis as typeof globalThis & {scoutWriteQueue?:Promise<unknown>};
export async function mutateState<T>(fn:(state:LocalState)=>T|Promise<T>,dir=dataDir()):Promise<T>{
 const previous=locks.scoutWriteQueue??Promise.resolve();
 const operation=previous.catch(()=>undefined).then(async()=>{const state=await readState(dir);const result=await fn(state);const rawSize=Buffer.byteLength(JSON.stringify(state),'utf8');if(rawSize>12_000_000)throw new ResearchError('本地工作区已达 12MB 容量上限，请先备份归档；未覆盖现有状态。',413);const serialized=JSON.stringify(redactValue(state),null,2);if(Buffer.byteLength(serialized,'utf8')>12_000_000)throw new ResearchError('本地工作区已达 12MB 容量上限，请先备份归档；未覆盖现有状态。',413);await mkdir(dir,{recursive:true});const temp=path.join(dir,`workspace-${randomUUID()}.tmp`);await writeFile(temp,serialized,{mode:0o600});await rename(temp,path.join(dir,'workspace.json'));return redactValue(result);});
 locks.scoutWriteQueue=operation;return operation;
}
export function catalogFromState(state:LocalState){
 const map=new Map(seedCompanies.map(c=>[c.id,structuredClone(c)]));const sourceMap=new Map(seedSources.map(s=>[s.id,structuredClone(s)]));
 for(const p of state.publications){map.set(p.company.id,p.company);for(const s of p.sources)sourceMap.set(s.id,s);}
 return {companies:[...map.values()],sources:[...sourceMap.values()].map(s=>({...s,lastAttempt:state.sourceChecks[s.id]??s.lastAttempt}))};
}
export async function getCatalog(){return catalogFromState(await readState());}
