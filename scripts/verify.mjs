import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const checks=[['test','node_modules/vitest/vitest.mjs',['run']],['lint','node_modules/eslint/bin/eslint.js',['.','--max-warnings','0']],['typecheck','node_modules/typescript/bin/tsc',['--noEmit']],['build','node_modules/next/dist/bin/next',['build','--webpack']]];
const report={checkedAt:new Date().toISOString(),node:process.version,platform:`${process.platform}/${process.arch}`,checks:[]};
mkdirSync(new URL('../docs/phase-2/validation/',import.meta.url),{recursive:true});
for(const [name,cli,args] of checks){const started=Date.now();const r=spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8',timeout:300000,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1',FORCE_COLOR:'0',NO_COLOR:'1'}});const text=(r.stdout??'')+(r.stderr??'')+(r.error?`\n${r.error.message}`:'');writeFileSync(new URL(`../docs/phase-2/validation/${name}.log`,import.meta.url),text);report.checks.push({name,command:`node ${cli} ${args.join(' ')}`,exitCode:r.status,signal:r.signal,durationMs:Date.now()-started,passed:r.status===0});console.log(`${name}: ${r.status===0?'PASS':'FAIL'} (${r.status??r.signal})`);if(r.status!==0)console.log(text);}
writeFileSync(new URL('../docs/phase-2/validation/results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(report.checks.some(c=>!c.passed))process.exitCode=1;
