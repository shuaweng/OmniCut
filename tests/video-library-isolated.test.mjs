import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService,root,hypit} from '../server/project.mjs';
import {NativeEngine,sourceFiles} from '../server/native-engine.mjs';
import {AssetLibrary} from '../server/asset-library.mjs';
import {conversationWorkspace,conversationCheckoutPath,withConversationWorkspace} from '../server/conversation-workspace.mjs';
import {assetPath,updateAssetMetadata,importAsset} from '../server/assets.mjs';

async function fixture(t,validator=async()=>{}){const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-video-library-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));return {data,service:new ProjectService(data,validator)};}
async function fakeImport(directory,bytes,name,provenance){const id=crypto.randomUUID(),filename=id+path.extname(name),asset={id,filename,name,kind:'image',duration:null,width:1,height:1,hasAudio:false,created:new Date().toISOString(),provenance};await fs.mkdir(path.join(directory,'assets'),{recursive:true});await fs.writeFile(path.join(directory,'assets',filename),bytes);return asset;}

test('同调用链的嵌套视频锁可重入，外部写入仍按序等待',{timeout:2000},async t=>{
 const {service}=await fixture(t),p=await service.createBlank('锁验证'),order=[];let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);t.after(()=>release?.());
 const first=service.exclusive(p.id,async()=>{order.push('first');await service.exclusive(p.id,async()=>{order.push('nested');entered();await gate;});order.push('released');});await ready;
 const second=service.exclusive(p.id,()=>order.push('second')),third=service.exclusive(p.id,()=>order.push('third'));await Promise.resolve();assert.deepEqual(order,['first','nested']);release();await Promise.all([first,second,third]);assert.deepEqual(order,['first','nested','released','second','third']);
});

test('旧项目无需迁移，变体同属项目，源码/锁/历史按视频隔离',async t=>{
 let entered,release;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);t.after(()=>release?.());
 const {service}=await fixture(t,async directory=>{if((await fs.readFile(path.join(directory,'main.svml'),'utf8')).includes('默认视频慢修改')){entered();await gate;}});
 const project=await service.create('活动'),variant=await service.createVariant(project.id,{name:'Hook B',difference:'更换开场'});
 assert.equal(project.videoId,'v-default');assert.equal(variant.projectId,project.id);assert.equal(variant.id,project.id);assert.equal(variant.parentId,'v-default');assert.equal((await service.listVideos(project.id)).length,2);
 assert.equal(Object.keys(await sourceFiles(service.projectDir(project.id))).some(name=>name.startsWith(variant.productionPath)),false);
 const a=service.change(project.id,project.revision,{type:'text',id:'title',text:'默认视频慢修改'});await ready;
 const b=await service.withVideoContext(project.id,variant.videoId,()=>service.change(project.id,variant.revision,{type:'text',id:'title',text:'变体完成'}));
 assert.equal(b.history.length,1);assert.equal((await service.get(project.id)).history.length,0);release();await a;
 assert.equal((await service.getVideo(project.id,variant.videoId)).texts.find(x=>x.id==='title').text,'变体完成');
 assert.equal((await service.get(project.id)).texts.find(x=>x.id==='title').text,'默认视频慢修改');
 const other=await service.createBlank('另一项目');await assert.rejects(service.getVideo(other.id,variant.videoId),error=>error.status===404);
 await fs.mkdir(path.join(service.projectDir(other.id),'productions'),{recursive:true});await fs.symlink(path.join(service.projectDir(project.id),variant.productionPath),path.join(service.projectDir(other.id),variant.productionPath));let enteredWrongProject=false;await assert.rejects(service.withVideoContext(other.id,variant.videoId,()=>{enteredWrongProject=true;}),error=>error.status===404);assert.equal(enteredWrongProject,false);
});

test('对话的各视频工作区/服务端基线独立，不能用新revision掩盖旧草稿',async t=>{
 const {data,service}=await fixture(t),engine=new NativeEngine({service,root,hypit,run:async()=>({stdout:'{}'})});engine.run=async()=>({stdout:'{}'});service.engine=engine;
 const project=await service.createBlank('活动'),variant=await engine.fork(project.id,'B'),conversationId='c-123456789abc';
 await withConversationWorkspace(conversationId,async()=>{
  const original=await engine.checkout(project.id),defaultBase=conversationWorkspace(data,project.id),defaultRecord=conversationCheckoutPath(data,project.id);
  await service.withVideoContext(project.id,variant.videoId,async()=>{const checkout=await engine.checkout(project.id);assert.notEqual(conversationWorkspace(data,project.id),defaultBase);assert.notEqual(conversationCheckoutPath(data,project.id),defaultRecord);await fs.appendFile(path.join(conversationWorkspace(data,project.id),'hypit/main.svml'),'\n<!-- B 修改 -->');const saved=await engine.applyWorkspace(project.id,checkout.revision);assert.equal(saved.videoId,variant.videoId);});
  assert.equal((await service.get(project.id)).revision,original.revision);
  await fs.appendFile(path.join(defaultBase,'hypit/main.svml'),'\n<!-- A 草稿 -->');
  // A different conversation changes A after the original checkout.
  const changed=await withConversationWorkspace('c-abcdef123456',()=>engine.edit(project.id,original.revision,{'main.svml':'<?svml using="@hypit/markup@1"?><svml></svml>\n<!-- 最新 A -->'}));
  await assert.rejects(engine.applyWorkspace(project.id,changed.revision),error=>error.code==='WORKSPACE_BASE_CONFLICT');
  assert.match(await fs.readFile(path.join(defaultBase,'hypit/main.svml'),'utf8'),/A 草稿/);
 });
});

test('全局库跨项目/变体共用字节；当前引用、旧历史和品牌版本阻止删除',async t=>{
 const {data,service}=await fixture(t),library=new AssetLibrary({service,importer:fakeImport});
 const asset=await library.import(Buffer.from('fake immutable pixels'),'商品.png'),same=await library.import(Buffer.from('fake immutable pixels'),'另一名称.png');
 assert.equal((await fs.readdir(path.join(data,'library/blobs'))).length,1);assert.notEqual(asset.id,same.id);
 const a=await service.createBlank('A'),b=await service.createBlank('B');await library.attach(a.id,asset.id);await library.attach(b.id,asset.id);
 const variant=await service.createVariant(a.id,{name:'A 的变体'});
 const [globalFile,aFile,bFile,vFile]=await Promise.all([library.file(asset.id),assetPath(service.projectDir(a.id),asset.filename),assetPath(service.projectDir(b.id),asset.filename),service.withVideoContext(a.id,variant.videoId,()=>assetPath(service.dir(a.id),asset.filename))]);
 const stats=await Promise.all([globalFile,aFile,bFile,path.join(service.projectDir(a.id),variant.productionPath,'assets',asset.filename)].map(file=>fs.stat(file)));assert.equal(new Set(stats.map(s=>s.ino)).size,1);assert.equal(vFile,aFile);
 await service.withVideoContext(a.id,variant.videoId,()=>updateAssetMetadata(service.dir(a.id),{assetFile:asset.filename,name:'变体商品',status:'selected'}));assert.equal((await service.getVideo(a.id,variant.videoId)).assets.find(x=>x.id===asset.id).name,'变体商品');assert.equal((await service.get(a.id)).assets.find(x=>x.id===asset.id).name,'商品.png');
 await assert.rejects(library.remove(asset.id),error=>error.status===409&&error.usage.projectIds.length===2);
 const metaFile=path.join(service.projectDir(a.id),'project.json'),meta=JSON.parse(await fs.readFile(metaFile,'utf8'));meta.history.push({source:'<asset:Image src="./assets/'+asset.filename+'"/>',style:''});await fs.writeFile(metaFile,JSON.stringify(meta));
 await assert.rejects(library.detach(a.id,asset.id),error=>error.status===409&&error.references.some(x=>x.endsWith('project.json')));
 const brand=await library.createBrand({name:'品牌',assetIds:[asset.id],colors:{primary:'#123456'}});await library.pinBrand(b.id,brand.id,1);await library.versionBrand(brand.id,{assetIds:[same.id],colors:{primary:'#654321'}});
 assert.equal((await service.get(b.id)).brand.version,1);assert.equal((await library.resolveBrand(brand.id,1)).colors.primary,'#123456');assert.equal((await library.resolveBrand(brand.id)).version,2);
 await library.hide(asset.id);assert.equal((await library.list()).some(x=>x.id===asset.id),false);assert.equal((await service.get(a.id)).assets.some(x=>x.libraryId===asset.id),true);
 await assert.rejects(library.attach(a.id,asset.id),error=>error.status===409);
});

test('现有项目上传入口使用真实本地图片探测，自动登记同一全局Blob且可从变体使用',async t=>{
 const {data,service}=await fixture(t),a=await service.createBlank('A'),b=await service.createBlank('B'),bytes=await fs.readFile(path.join(root,'sample-assets/sage-tumbler.png'));
 const one=await importAsset(service.dir(a.id),bytes,'商品.png',{provider:'import'}),two=await importAsset(service.dir(b.id),bytes,'商品.png',{provider:'import'});
 assert.equal(one.blobHash,two.blobHash);assert.equal((await fs.readdir(path.join(data,'library/blobs'))).length,1);
 const variant=await service.createVariant(a.id,{name:'A 的变体'}),library=new AssetLibrary({service});await library.publish(a.id,one.filename);
 const attached=await service.withVideoContext(a.id,variant.videoId,()=>library.attach(a.id,one.id));assert.equal(attached.videoId,variant.videoId);assert.equal(attached.libraryId,one.id);
 const global=await fs.stat(await library.file(one.id)),local=await fs.stat(path.join(service.projectDir(a.id),variant.productionPath,'assets',one.filename));assert.equal(global.ino,local.ino);
});
