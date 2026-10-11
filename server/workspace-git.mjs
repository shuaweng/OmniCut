import {promises as fs} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';

const run=promisify(execFile),pending=new Map();
const excludes=['/conversations/','/videos/','assets/','node_modules/','.hypit/','.skills/','hypit.runtime.json','*.tmp'];

// Only the Agent's disposable code copy gets Git metadata. Project revisions
// and undo remain owned by ProjectService; no files are staged or committed.
export async function ensureWorkspaceGit(directory,{root}){
 await fs.mkdir(directory,{recursive:true});
 const [canonical,canonicalRoot]=await Promise.all([fs.realpath(directory),fs.realpath(root)]);
 const relative=path.relative(path.resolve(root),path.resolve(directory));
 if(!relative||relative.startsWith('..')||canonical!==path.join(canonicalRoot,relative))throw Error('代码工作区不属于当前项目和视频');
 if(pending.has(canonical))return pending.get(canonical);
 const task=(async()=>{
  const metadata=path.join(canonical,'.git');
  try{await fs.lstat(metadata);return {root:canonical,created:false};}catch(error){if(error.code!=='ENOENT')throw error;}
  const stage=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-workspace-git-'));
  try{
   // Empty templates and scrubbed Git settings avoid inherited hooks, git-dir
   // overrides and writes to the enclosing application's repository.
   const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_'))),GIT_CONFIG_COUNT:'0',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:os.devNull,GIT_TERMINAL_PROMPT:'0'};
   await run('git',['init','--quiet','--initial-branch=workspace','--template=',stage],{env,timeout:10000,maxBuffer:100000});
   await fs.mkdir(path.join(stage,'.git/info'),{recursive:true});
   await fs.writeFile(path.join(stage,'.git/info/exclude'),excludes.join('\n')+'\n');
   // Preserve a repository another owner may have installed while Git ran.
   try{await fs.lstat(metadata);return {root:canonical,created:false};}catch(error){if(error.code!=='ENOENT')throw error;}
   await fs.rename(path.join(stage,'.git'),metadata);
   return {root:canonical,created:true};
  }finally{await fs.rm(stage,{recursive:true,force:true});}
 })();
 pending.set(canonical,task);
 try{return await task;}finally{pending.delete(canonical);}
}
