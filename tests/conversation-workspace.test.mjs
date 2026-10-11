import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {conversationWorkspace,conversationCheckoutPath,withConversationWorkspace} from '../server/conversation-workspace.mjs';

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
 await fs.writeFile(path.join(builtin,'package.json'),JSON.stringify({name:'@fixture/motion',version:'1.0.0',hypit:{activation:'./index.js'},frame:{import:'@fixture/motion@1'}}));
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

test('旧对话即使传最新 revision 也不能删除另一对话新增文件，重启仍保留服务端基线',async t=>{
 const {data,service,engine,project,directory}=await fixture(t);
 const [a,b]=await Promise.all([scoped(first,()=>engine.checkout(project.id)),scoped(second,()=>engine.checkout(project.id))]);
 const draft=await read(path.join(directory(second),'main.svml'))+'\n<!-- 尚未提交的第二段草稿 -->';
 await fs.writeFile(path.join(directory(second),'main.svml'),draft);
 await fs.writeFile(path.join(directory(first),'new-scene.svml'),'<svml><!-- 第一段对话新增场景 --></svml>');
 const accepted=await scoped(first,()=>engine.applyWorkspace(project.id,a.revision));
 const restarted=new NativeEngine({service,root:engine.root,hypit:engine.hypit,run:async()=>({stdout:'{}'})});
 const record=JSON.parse(await read(conversationCheckoutPath(data,project.id,second)));
 assert.equal(record.revision,b.revision);
 assert.ok(!conversationCheckoutPath(data,project.id,second).startsWith(conversationWorkspace(data,project.id,second)));
 await assert.rejects(scoped(second,()=>restarted.applyWorkspace(project.id,accepted.revision)),error=>{
  assert.equal(error.status,409);assert.equal(error.code,'WORKSPACE_BASE_CONFLICT');
  assert.equal(error.baseRevision,b.revision);assert.equal(error.currentRevision,accepted.revision);
  assert.match(error.message,/草稿已保留.*比较最新工程.*合并/);return true;
 });
 assert.equal(await read(path.join(directory(second),'main.svml')),draft);
 assert.match(await read(path.join(service.dir(project.id),'new-scene.svml')),/新增场景/);
 assert.equal((await service.get(project.id)).revision,accepted.revision);
});

test('当前对话连续提交和干净文件的局部编辑会推进基线，不影响未提交的其他文件',async t=>{
 const {service,engine,project,directory}=await fixture(t);
 const initial=await scoped(first,()=>engine.checkout(project.id));
 await fs.appendFile(path.join(directory(first),'main.svml'),'\n<!-- 第一次提交 -->');
 const one=await scoped(first,()=>engine.applyWorkspace(project.id,initial.revision));
 await fs.writeFile(path.join(directory(first),'local.svml'),'<svml><!-- 本地待提交 --> </svml>');
 const two=await scoped(first,()=>engine.edit(project.id,one.revision,{'look.svs':'/* 服务端局部编辑 */'}));
 assert.equal((await scoped(first,()=>engine.checkoutRecord(project.id))).revision,two.revision);
 assert.match(await read(path.join(directory(first),'look.svs')),/局部编辑/);
 const three=await scoped(first,()=>engine.applyWorkspace(project.id,two.revision));
 assert.match(await read(path.join(service.dir(project.id),'local.svml')),/本地待提交/);
 assert.notEqual(three.revision,two.revision);
 const undone=await scoped(first,()=>engine.undo(project.id,three.revision));
 assert.equal((await scoped(first,()=>engine.checkoutRecord(project.id))).revision,undone.revision);
});

test('服务端修改与同对话草稿有重叠时不推进基线，保留本地草稿并阻止覆盖',async t=>{
 const {service,engine,project,directory}=await fixture(t);
 const initial=await scoped(first,()=>engine.checkout(project.id));
 const draft='/* 用户尚未保存的样式 */';await fs.writeFile(path.join(directory(first),'look.svs'),draft);
 const accepted=await scoped(first,()=>engine.edit(project.id,initial.revision,{'look.svs':'/* 已接受的新样式 */'}));
 assert.equal(await read(path.join(directory(first),'look.svs')),draft);
 assert.equal((await scoped(first,()=>engine.checkoutRecord(project.id))).revision,initial.revision);
 await assert.rejects(scoped(first,()=>engine.applyWorkspace(project.id,accepted.revision)),{code:'WORKSPACE_BASE_CONFLICT'});
 assert.match(await read(path.join(service.dir(project.id),'look.svs')),/已接受的新样式/);
});

test('同 revision 下的新辅助源码也不能被陈旧草稿删除，已同步辅助源码可正常提交',async t=>{
 const {service,engine,project,directory}=await fixture(t);
 const initial=await scoped(first,()=>engine.checkout(project.id));
 const filename='prepared/new.svml',text='<svml><!-- 新生成素材的编辑适配 --> </svml>';
 await fs.mkdir(path.join(service.dir(project.id),'prepared'),{recursive:true});
 await fs.writeFile(path.join(service.dir(project.id),filename),text);
 await assert.rejects(scoped(first,()=>engine.applyWorkspace(project.id,initial.revision)),error=>{
  assert.equal(error.code,'WORKSPACE_BASE_CONFLICT');assert.deepEqual(error.conflictingFiles,[filename]);return true;
 });
 assert.equal(await read(path.join(service.dir(project.id),filename)),text);
 await fs.mkdir(path.join(directory(first),'prepared'),{recursive:true});
 await fs.writeFile(path.join(directory(first),filename),text);
 const accepted=await scoped(first,()=>engine.applyWorkspace(project.id,initial.revision));
 assert.notEqual(accepted.revision,initial.revision);
 assert.equal(await read(path.join(service.dir(project.id),filename)),text);
});

test('未登记基线的既有工作区不自动认领当前 revision，也不清掉草稿',async t=>{
 const {engine,project,directory}=await fixture(t);
 const file=path.join(directory(first),'main.svml');await fs.mkdir(directory(first),{recursive:true});
 await fs.writeFile(file,'<svml><!-- 旧安装留下的草稿 --> </svml>');
 await assert.rejects(scoped(first,()=>engine.applyWorkspace(project.id,project.revision)),error=>{
  assert.equal(error.code,'WORKSPACE_BASE_UNAVAILABLE');assert.match(error.message,/草稿已保留/);return true;
 });
 assert.match(await read(file),/旧安装留下的草稿/);
});

test('checkout 与正在接受的修改串行，源码副本和登记基线来自同一版本',async t=>{
 const {service,engine,project,directory}=await fixture(t);
 let entered,release;
 const checking=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 engine.run=async()=>{entered();await gate;return {stdout:'{}'};};
 const original=await read(path.join(service.dir(project.id),'main.svml'));
 const editing=scoped(first,()=>engine.edit(project.id,project.revision,{'main.svml':original+'\n<!-- 锁内接受的新工程 -->'}));
 await checking;
 const checkingOut=scoped(second,()=>engine.checkout(project.id));
 release();
 const [accepted,checkedOut]=await Promise.all([editing,checkingOut]);
 assert.equal(checkedOut.revision,accepted.revision);
 assert.equal((await scoped(second,()=>engine.checkoutRecord(project.id))).revision,accepted.revision);
 assert.match(await read(path.join(directory(second),'main.svml')),/锁内接受的新工程/);
});
