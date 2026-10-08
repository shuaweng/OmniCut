import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {importAsset,registerExistingImage} from '../server/assets.mjs';
import {ImageGenerationService,SEEDREAM_MODEL} from '../server/image-generation.mjs';
import {GenerationService} from '../server/generation.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
const bytes=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));
const env={ARK_API_KEY:'test-private',SEEDANCE_MODEL:'doubao-seedance-2-0-mini-260615'};
const response=()=>new Response(JSON.stringify({data:[{b64_json:bytes.toString('base64')}]}));
async function setup(t,fetcher){const root=await fs.mkdtemp(path.join(os.tmpdir(),'frame-image-test-'));const service=new ProjectService(root,async()=>{}),project=await service.create('隔离图片测试'),images=new ImageGenerationService({service,getConfig:async()=>env,fetcher});await images.init();t.after(async()=>{await images.close();await fs.rm(root,{recursive:true,force:true});});return {root,service,project,images};}
const input=()=>({requestId:crypto.randomUUID(),prompt:'生成竖屏商品画面',size:'1440x2560'});
test('图片生成只提交一次、进入共享素材库，并可继续剪辑及作为 Seedance 参考',async t=>{
 let calls=0,wire;const {service:s,project:p,images,root}=await setup(t,async(url,o)=>{calls++;wire=JSON.parse(o.body);assert.equal(url,'https://ark.cn-beijing.volces.com/api/v3/images/generations');return response();});const req=input();const [a,b]=await Promise.all([images.create(p.id,req),images.create(p.id,req)]);await Promise.all(images.work.values());const done=images.get(p.id,a.id);assert.equal(a.id,b.id);assert.equal(calls,1);assert.equal(wire.model,SEEDREAM_MODEL);assert.equal(wire.response_format,'b64_json');assert.equal(done.status,'succeeded');
 const fresh=await s.get(p.id),asset=fresh.assets[0];assert.equal(asset.provenance.taskId,a.taskId);assert.equal(fresh.revision,p.revision);const edited=await s.change(p.id,p.revision,{type:'shot',shotId:'shot-2',assetFile:asset.filename});assert.equal(edited.shots[1].assetFile,asset.filename);assert.deepEqual(edited.shots[0],p.shots[0]);
 const videos=new GenerationService({service:s,getConfig:async()=>env,autoPoll:false,fetcher:async(url,o)=>{assert.ok(JSON.parse(o.body).content[1].image_url.url.startsWith('data:image/'));return new Response(JSON.stringify({id:'cgt-image-chain'}));}});await videos.init();t.after(()=>videos.close());await videos.create(p.id,{requestId:crypto.randomUUID(),revision:edited.revision,shotId:'shot-2',prompt:'镜头推进',duration:4,resolution:'480p',audio:false,imageFile:asset.filename,imageMode:'reference_image',confirmed:true});
 assert.doesNotMatch(await fs.readFile(path.join(root,'image-generations',a.id+'.json'),'utf8'),/test-private|base64/);
});
test('图片编辑引用原素材且不覆盖原图；非法跨项目文件不会发送',async t=>{
 let sent;const {service:s,project:p,images}=await setup(t,async(u,o)=>{sent=JSON.parse(o.body);return response();});const a=await importAsset(s.dir(p.id),bytes,'原图.png');await assert.rejects(images.create(p.id,{...input(),imageFiles:['../../.env']}),/当前项目/);assert.equal(sent,undefined);
 await images.create(p.id,{...input(),imageFiles:[a.filename]});await Promise.all(images.work.values());assert.equal(sent.image.length,1);assert.equal((await s.get(p.id)).assets.length,2);assert.deepEqual(await fs.readFile(path.join(s.dir(p.id),'assets',a.filename)),bytes);
});
test('超时与重启不重提交收费请求，明确鉴权失败脱敏',async t=>{
 let calls=0;const {images,service,project,root}=await setup(t,async()=>{calls++;throw Error('timeout test-private');});const req=input();await images.create(project.id,req);await Promise.all(images.work.values());assert.equal(images.get(project.id,req.requestId).status,'unknown');await images.create(project.id,req);assert.equal(calls,1);const restored=new ImageGenerationService({service,getConfig:async()=>env,fetcher:async()=>{throw Error('禁止重提');}});await restored.init();assert.equal(restored.list(project.id)[0].status,'unknown');assert.doesNotMatch(JSON.stringify(restored.list(project.id)),/test-private/);await restored.close();
 images.fetcher=async()=>new Response(JSON.stringify({error:{code:'AuthenticationError',message:'invalid test-private'}}),{status:401});const r=input();await images.create(project.id,r);await Promise.all(images.work.values());assert.equal(images.get(project.id,r.requestId).status,'failed');assert.doesNotMatch(await fs.readFile(path.join(root,'image-generations',r.requestId+'.json'),'utf8'),/test-private/);
});
test('重启恢复已落盘图片，只入库一次',async t=>{
 const {images,service,project}=await setup(t,response);const req=input();await images.create(project.id,req);await Promise.all(images.work.values());const job=images.get(project.id,req.requestId);job.status='downloading';delete job.assetFile;await images.persist(job);
 const resumed=new ImageGenerationService({service,getConfig:async()=>env,fetcher:()=>{throw Error('不能调用');}});await resumed.init();assert.equal(resumed.get(project.id,job.id).status,'succeeded');assert.equal((await service.get(project.id)).assets.length,1);await resumed.close();
});
test('统一任务等待视频回填完成，阻塞不被当作成功，禁止跨项目依赖',()=>{
 const records=[{id:'a',projectId:'p1',status:'succeeded',autoApply:true,assetFile:'a.mp4'},{id:'b',projectId:'p1',status:'unknown'}];const tasks=new TaskRegistry().register('video',{list:id=>records.filter(r=>r.projectId===id)});assert.equal(tasks.get('p1','video:a').status,'running');records[0].appliedRevision='v2';assert.equal(tasks.get('p1','video:a').status,'succeeded');assert.equal(tasks.get('p1','video:b').status,'blocked');assert.throws(()=>tasks.results('p2',['video:a']),/不属于/);
});

test('旧首页商品图原地加入共享素材库，文件名、作品版本和像素不变',async t=>{
 const {service,project,images}=await setup(t,response),file=crypto.randomUUID()+'.png';await fs.writeFile(path.join(service.dir(project.id),'assets',file),bytes);const p=await service.image(project.id,project.revision,file),raw=await service.raw(project.id);assert.equal(p.assets.length,0);
 const a=await registerExistingImage(service.dir(project.id),file);await registerExistingImage(service.dir(project.id),file);const fresh=await service.get(project.id);assert.equal(fresh.revision,p.revision);assert.deepEqual(await service.raw(project.id),raw);assert.equal(fresh.assets.length,1);assert.equal(a.filename,file);assert.deepEqual(await fs.readFile(path.join(service.dir(project.id),'assets',file)),bytes);
 await images.create(project.id,{...input(),imageFiles:[file]});await Promise.all(images.work.values());assert.equal(images.list(project.id)[0].status,'succeeded');
});


test('4:3 图片与 Pro 选项实际传入供应商，结果保留场景名称',async t=>{
 let sent;const {images,service,project}=await setup(t,async(u,o)=>{sent=JSON.parse(o.body);return response();});
 const job=await images.create(project.id,{...input(),size:'2368x1776',quality:'premium',name:'家庭聚会'});await Promise.all(images.work.values());
 assert.equal(sent.size,'2368x1776');assert.equal(sent.model,'doubao-seedream-5-0-pro-260628');assert.equal(images.get(project.id,job.id).status,'succeeded');assert.equal((await service.get(project.id)).assets[0].name,'家庭聚会.jpg');
});
