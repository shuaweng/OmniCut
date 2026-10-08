import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {conversationWorkspace,withConversationWorkspace} from '../server/conversation-workspace.mjs';

const first='c-111111111111',second='c-222222222222';
const scoped=(id,fn)=>withConversationWorkspace(id,fn);
const read=file=>fs.readFile(file,'utf8');

async function fixture(t){
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'frame-conversation-workspace-'));
 t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const root=path.join(data,'app'),calls=[];
 await fs.mkdir(path.join(root,'fonts'),{recursive:true});
 await fs.writeFile(path.join(root,'fonts','FrameSans-Regular.otf'),'local font fixture');
 const builtin=path.join(root,'components','brand-reveal');
 await fs.mkdir(builtin,{recursive:true});
 await fs.writeFile(path.join(builtin,'package.json'),JSON.stringify({name:'@fixture/motion',version:'1.0.0',hypit:{activation:'./index.js'}}));
 await fs.writeFile(path.join(builtin,'README.md'),'Local workspace isolation fixture.');
 await fs.writeFile(path.join(builtin,'index.js'),'export const fixture=true;');
 const service=new ProjectService(data,async()=>{});
 const engine=new NativeEngine({service,root,hypit:'local-hypit-fixture',run:async(command,args,options)=>{calls.push({command,args,options});return {stdout:'{}'};}});
 service.engine=engine;
 const project=await service.createBlank('独立对话工作区验证');
 const directory=cid=>path.join(conversationWorkspace(data,project.id,cid),'hypit');
 return {data,service,engine,project,directory,calls};
}

test('同项目不同对话使用独立 checkout，旧 revision 不覆盖已接受工程',async t=>{
 const {data,service,engine,project,directory}=await fixture(t);
 assert.equal(conversationWorkspace(data,project.id,project.id),path.join(data,'workspaces',project.id));
 assert.equal(conversationWorkspace(data,project.id),path.join(data,'workspaces',project.id));
 await engine.checkout(project.id);
 const [a,b]=await Promise.all([scoped(first,()=>engine.checkout(project.id)),scoped(second,()=>engine.checkout(project.id))]);
 assert.equal(a.revision,b.revision);
 assert.notEqual(directory(first),directory(second));
 const original=await read(path.join(service.dir(project.id),'main.svml'));
 await fs.writeFile(path.join(directory(first),'main.svml'),original+'\n<!-- 第一段对话 -->');
 await fs.writeFile(path.join(directory(first),'look.svs'),'/* 第一段对话样式 */');
 await fs.writeFile(path.join(directory(second),'main.svml'),original+'\n<!-- 第二段对话草稿 -->');
 const accepted=await scoped(first,()=>engine.applyWorkspace(project.id,a.revision));
 assert.notEqual(accepted.revision,a.revision);
 assert.match(await read(path.join(service.dir(project.id),'main.svml')),/第一段对话/);
 assert.match(await read(path.join(directory(second),'main.svml')),/第二段对话草稿/);
 assert.equal(await read(path.join(directory(second),'look.svs')),'','未改动文件也不能被其他对话偷偷推进');
 assert.equal(await read(path.join(directory(project.id),'look.svs')),'','默认会话保持自己的 checkout');
 await assert.rejects(scoped(second,()=>engine.applyWorkspace(project.id,b.revision)),/项目已更新/);
 assert.equal((await service.get(project.id)).revision,accepted.revision);
 assert.match(await read(path.join(service.dir(project.id),'main.svml')),/第一段对话/);
 assert.match(await read(path.join(directory(second),'main.svml')),/第二段对话草稿/);
});

test('异步命令、素材同步与动效安装保持当前对话 scope',async t=>{
 const {service,engine,project,directory,calls}=await fixture(t);
 await Promise.all([scoped(first,()=>engine.checkout(project.id)),scoped(second,()=>engine.checkout(project.id))]);
 const assetId='11111111-1111-4111-8111-111111111111',filename=assetId+'.png';
 await fs.writeFile(path.join(service.dir(project.id),'assets',filename),'asset copy fixture');
 await fs.writeFile(path.join(service.dir(project.id),'assets',assetId+'.asset.json'),JSON.stringify({id:assetId,filename,name:'复制验证',kind:'image',width:1,height:1,created:'2026-01-01T00:00:00.000Z'}));
 const [synced]=await Promise.all([
  scoped(first,async()=>{await Promise.resolve();return engine.syncAssets(project.id,[filename]);}),
  scoped(second,async()=>{await Promise.resolve();return engine.command(project.id,['check','render.svrun']);}),
 ]);
 assert.equal(synced.assets.length,1);
 assert.equal(await read(path.join(directory(first),'assets',filename)),'asset copy fixture');
 await assert.rejects(fs.access(path.join(directory(second),'assets',filename)),{code:'ENOENT'});
 assert.equal(calls.at(-1).options.cwd,directory(second));
 assert.equal(calls.at(-1).args[calls.at(-1).args.indexOf('--workspace')+1],directory(second));
 const installed=await scoped(first,()=>engine.motionLibrary.use(project.id,'fixture--motion@1.0.0'));
 const installedPath=installed.directory.replace(/^hypit\//,'');
 assert.match(await read(path.join(directory(first),installedPath,'index.js')),/fixture=true/);
 await assert.rejects(fs.access(path.join(directory(second),installedPath)),{code:'ENOENT'});
 assert.equal(JSON.parse(await read(path.join(directory(second),'package.json'))).dependencies,undefined);
});
