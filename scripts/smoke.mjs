import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const companies=JSON.parse(await readFile(new URL('../data/companies.json',import.meta.url),'utf8'));
const origin=process.env.SCOUT_ORIGIN??'http://127.0.0.1:3100';
const paths=['/','/research','/companies','/sources','/methodology','/priorities',...companies.map(c=>`/companies/${c.id}`)];
for(const path of paths){const res=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(10000)});assert.equal(res.status,200,path);const html=await res.text();assert.match(html,/<h1[ >]/,`${path} 有主标题`);assert.match(html,/ChannelScout/);console.log(`PASS 200 ${path}`);}
const missing=await fetch(new URL('/companies/not-a-company',origin),{signal:AbortSignal.timeout(10000)});assert.equal(missing.status,404);console.log('PASS 404 /companies/not-a-company');
console.log(`HTTP smoke: ${paths.length+1} checks passed`);
