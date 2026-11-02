// Offline local backup/restore. Stop the app for a consistent research + outreach snapshot.
import {readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const args=process.argv.slice(2),operation=args[0],get=key=>{const at=args.indexOf(key);return at<0?undefined:args[at+1];};
const hash=value=>createHash('sha256').update(value).digest('hex');
const dir=path.resolve(get('--dir')||process.env.CHANNELSCOUT_DATA_DIR||'.local');
const files=['workspace.json','outreach.json'];
function validate(name,raw){if(Buffer.byteLength(raw)>(name==='workspace.json'?12_000_000:5_000_000))throw new Error('Backup exceeds limits');const s=JSON.parse(raw);if(s.version!==1)throw new Error('Unsupported version');if(name==='workspace.json'){if(!Array.isArray(s.drafts)||!Array.isArray(s.publications)||!Array.isArray(s.audit)||!s.sourceChecks)throw new Error('Invalid research backup');}else if(!Array.isArray(s.leads)||!Array.isArray(s.mails)||!Array.isArray(s.strategies))throw new Error('Invalid outreach backup');return s;}
async function optional(file){try{return await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function snapshot(to){await mkdir(to,{recursive:true,mode:0o700});try{await access(path.join(to,'manifest.json'));throw new Error('Destination already contains a backup');}catch(e){if(e.code!=='ENOENT')throw e;}const manifest={format:'channelscout-local-backup-v1',at:new Date().toISOString(),files:{}};for(const name of files){const raw=await optional(path.join(dir,name));if(raw===null){manifest.files[name]=null;continue;}validate(name,raw);await writeFile(path.join(to,name),raw,{mode:0o600,flag:'wx'});manifest.files[name]=hash(raw);}await writeFile(path.join(to,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});return manifest;}
try{
 if(!args.includes('--server-stopped'))throw new Error('Stop the local server first and pass --server-stopped. No data changed.');
 if(operation==='backup'){const to=get('--to');if(!to)throw new Error('Required: --to directory');await snapshot(path.resolve(to));console.log('Local backup complete. Keep it private; JSON exports are not a full workspace backup.');}
 else if(operation==='restore'){
  if(!args.includes('--confirm'))throw new Error('Restore requires --confirm. No data changed.');const from=get('--from');if(!from)throw new Error('Required: --from directory');
  const base=path.resolve(from),manifest=JSON.parse(await readFile(path.join(base,'manifest.json'),'utf8'));
  if(manifest.format!=='channelscout-local-backup-v1'||!manifest.files)throw new Error('Invalid manifest');
  const contents={};for(const name of files){const expected=manifest.files[name];if(expected===null){if(await optional(path.join(dir,name))!==null)throw new Error('Backup lacks '+name+'; refusing to erase current records.');continue;}if(typeof expected!=='string')throw new Error('Missing manifest entry');const raw=await readFile(path.join(base,name),'utf8');if(hash(raw)!==expected)throw new Error('Backup hash mismatch');validate(name,raw);contents[name]=raw;}
  // Preserve the current workspace for reversal before replacing either file.
  const rollback=path.join(dir,'backups','before-restore-'+randomUUID());await snapshot(rollback);await mkdir(dir,{recursive:true});
  for(const [name,raw]of Object.entries(contents)){const temp=path.join(dir,`restore-${randomUUID()}.tmp`);await writeFile(temp,raw,{mode:0o600});await rename(temp,path.join(dir,name));}
  console.log('Restore complete. Prior records are in a private before-restore backup. Restart in Mock mode and verify both workspaces.');
 }else throw new Error('Usage: node scripts/outreach-backup.mjs backup --dir .local --to <private-directory> --server-stopped | restore --dir .local --from <backup> --server-stopped --confirm');
}catch{console.error('Backup/restore refused or failed. No credentials or record contents are printed. Verify arguments, manifest integrity, storage permissions and saved rollback backup before restarting.');process.exitCode=1;}
