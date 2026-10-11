// Explicit real process check with fake config only (requires sandbox-exec).
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {Context} from '@deepseek-ai/cordis';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy';
import LocalSandbox from '@deepseek-ai/dsh-sandbox-local';
import {runRipgrep} from '@deepseek-ai/dsh-tool-fs-search';
import {protectedConfiguration,protectProjectProcess} from '../server/protected-configuration.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'omnicut-fake-search-')),workspace=path.join(root,'workspace'),fibers=[];
try{
 await mkdir(workspace);await writeFile(path.join(root,'.env'),'FAKE_API_KEY=fixture-only');await writeFile(path.join(workspace,'scene.txt'),'normal scene');
 const host=new Context();fibers.push(await host.plugin(SessionProjectionRegistry));fibers.push(await host.plugin(SandboxPolicy,{mode:'workspace-write',workspaceRoot:workspace,...await protectedConfiguration(root)}));fibers.push(await host.plugin(LocalSandbox));
 const context={get:name=>host.get(name),subprocess:{spawn:spec=>{
  let out='',err='';
  const done=new Promise(resolve=>execFile(spec.argv[0],spec.argv.slice(1),{cwd:spec.cwd,env:{PATH:process.env.PATH},signal:spec.signal},(error,stdout,stderr)=>{out=stdout;err=stderr;resolve({exitCode:error?typeof error.code==='number'?error.code:2:0,signal:null});}));
  return {done,collected:{stdout:{readFrom:()=>({text:out,lossy:false})},stderr:{readFrom:()=>({text:err,lossy:false})}}};
 }}};
 const execution={signal:new AbortController().signal};
 const normal=await runRipgrep(context,execution,'grep',['--json','-e','normal','--',path.join(workspace,'scene.txt')],100000,3000,64000);assert.match(normal.stdout,/normal scene/);
 await assert.rejects(runRipgrep(context,execution,'grep',['--json','--hidden','--no-ignore','-e','FAKE_API_KEY','--',path.join(root,'.env')],100000,3000,64000),error=>error.code==='SEARCH_FAILED'&&/not permitted|Permission denied/i.test(error.message));
 const fakeParent=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{env:{FRAME_FAKE_API_KEY:'fixture-only-env-secret'},stdio:'ignore'});
 try{
  await new Promise(resolve=>fakeParent.once('spawn',resolve));
  const execute=promisify(execFile),args=['eww','-p',String(fakeParent.pid)];
  assert.match((await execute('/bin/ps',args,{env:{PATH:process.env.PATH}})).stdout,/fixture-only-env-secret/);
  const launch=protectProjectProcess('/bin/ps',args,await protectedConfiguration(root));
  let output='';try{output=(await execute(launch.command,launch.args,{env:{PATH:process.env.PATH}})).stdout;}catch(error){output=String(error.stdout||'');}
  assert.ok(!output.includes('fixture-only-env-secret'));
 }finally{fakeParent.kill();await new Promise(resolve=>fakeParent.once('exit',resolve));}
 console.log('native grep source succeeds, fake config is denied, and parent-process fake credentials are inaccessible');
}finally{for(const fiber of fibers.reverse())await fiber.dispose();await rm(root,{recursive:true,force:true});}
