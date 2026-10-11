import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {Context} from '@deepseek-ai/cordis';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy';
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox';
import {protectedConfiguration} from '../server/protected-configuration.mjs';

test('model filesystem preserves normal project reads and rejects private config, aliases and atomic temporary files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'omnicut-fake-config-')),workspace=path.join(root,'workspace');
 const fibers=[];
 try{
  await mkdir(workspace);await writeFile(path.join(root,'.env'),'FAKE_API_KEY=fixture-only');
  await writeFile(path.join(workspace,'scene.txt'),'normal project source');
  await symlink(path.join(root,'.env'),path.join(workspace,'alias'));
  const ctx=new Context();
  fibers.push(await ctx.plugin(SessionProjectionRegistry));
  fibers.push(await ctx.plugin(SandboxPolicy,{mode:'workspace-write',workspaceRoot:workspace,...await protectedConfiguration(root)}));
  fibers.push(await ctx.plugin(SandboxedFileSystem,{cwd:workspace}));
  assert.equal(await ctx.fs.readText(await ctx.fs.resolve('scene.txt')),'normal project source');
  await ctx.fs.writeText(await ctx.fs.resolve('new-scene.txt'),'editable');
  for(const filename of [path.join(root,'.env'),path.join(workspace,'alias'),path.join(root,'.settings-fixture.tmp')]){
   if(filename.endsWith('.tmp'))await writeFile(filename,'FAKE_API_KEY=fixture-only');
   await assert.rejects(ctx.fs.resolve(filename),{code:'FS_PROTECTED_CONFIG'});
   const raw={displayPath:filename,targetKey:filename};
   for(const read of [()=>ctx.fs.readText(raw),()=>ctx.fs.streamText(raw),()=>ctx.fs.readBytes(raw,undefined,1024),()=>ctx.fs.readByteRange(raw,{offset:0,length:16})])await assert.rejects(read(),{code:'FS_PROTECTED_CONFIG'});
  }
  assert.deepEqual((await ctx.fs.listDir(await ctx.fs.resolve(workspace))).map(e=>e.name).sort(),['new-scene.txt','scene.txt']);
  assert.throws(()=>ctx.sandboxPolicy.resolve({mode:'danger-full-access'}),/private configuration protection/);
 }finally{
  for(const fiber of fibers.reverse())await fiber.dispose();
  await rm(root,{recursive:true,force:true});
 }
});
