import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {FileSystemSkillProvider} from '@deepseek-ai/dsh-skill-filesystem';

test('explicit workspace skill roots follow the session cwd and keep user roots disabled',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-workspace-skills-'));
 const controller=new AbortController(),ctx={get:()=>undefined,logger:{warn(){}}};
 const control={invalidate(){},signal:controller.signal};
 const a=path.join(dir,'conversation-a'),b=path.join(dir,'conversation-b');
 for(const location of [path.join(a,'.skills/local-method'),path.join(dir,'user/skills/global-method'),b])await fs.mkdir(location,{recursive:true});
 await fs.writeFile(path.join(a,'.skills/local-method/SKILL.md'),'---\nname: local-method\ndescription: Scoped creative instructions\n---\nBODY_LOADED_ONLY_ON_DEMAND\n');
 await fs.writeFile(path.join(dir,'user/skills/global-method/SKILL.md'),'---\nname: global-method\ndescription: Must not appear\n---\nGLOBAL_BODY\n');
 const provider=new FileSystemSkillProvider(ctx,control,{includeDefaultRoots:false,workspaceSkillDirs:['.skills'],dshHome:path.join(dir,'user'),watch:false});
 t.after(async()=>{controller.abort();await provider.dispose();await fs.rm(dir,{recursive:true,force:true});});
 const catalog=await provider.list({cwd:a});assert.equal(catalog.length,1);assert.equal(catalog[0].name,'local-method');assert.doesNotMatch(JSON.stringify(catalog),/BODY_LOADED_ONLY_ON_DEMAND/);
 assert.deepEqual(await provider.list({cwd:b}),[]);assert.deepEqual(await provider.list({}),[]);
 const loaded=await provider.get(catalog[0],{cwd:a});assert.match(loaded.content,/BODY_LOADED_ONLY_ON_DEMAND/);
 for(const invalid of ['../outside','/absolute'])assert.throws(()=>new FileSystemSkillProvider(ctx,control,{workspaceSkillDirs:[invalid],watch:false}),/within the session cwd/);
});
