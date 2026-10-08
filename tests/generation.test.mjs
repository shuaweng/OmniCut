import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ProjectService,run } from '../server/project.mjs';
import { importAsset } from '../server/assets.mjs';
import { GenerationService,validateDownloadUrl } from '../server/generation.mjs';
import { canonicalSeedanceModel } from '../server/seedance-models.mjs';
const env={ARK_API_KEY:'private-test-only',SEEDANCE_MODEL:'Doubao-Seedance-2.0-mini'};
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
async function fixture(t,fetcher,real=false){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-seedance-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const service=new ProjectService(dir,real?undefined:async()=>{});const project=await service.create('隔离生成测试');const generation=new GenerationService({service,getConfig:async()=>env,fetcher,autoPoll:false});await generation.init();t.after(()=>generation.close());return {dir,service,project,generation};}
function input(p,overrides={}){return {requestId:crypto.randomUUID(),revision:p.revision,shotId:'shot-2',prompt:'商品镜头缓慢推进',duration:5,resolution:'480p',imageFile:null,audio:false,confirmed:true,...overrides};}

test('正式提交映射首帧与官方模型 ID，重复请求只提交一次',async t=>{
 let calls=0,sent;const {generation:g,project:p,service:s}=await fixture(t,async(url,opts)=>{calls++;assert.equal(url,'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks');assert.equal(opts.headers.Authorization,'Bearer '+env.ARK_API_KEY);sent=JSON.parse(opts.body);return json({id:'cgt-mock-1'});});
 const a=await importAsset(s.dir(p.id),await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url)),'商品图.png');
 const req=input(p,{imageFile:a.filename});const [first,second]=await Promise.all([g.create(p.id,req),g.create(p.id,req)]);
 assert.equal(calls,1);assert.equal(first.id,second.id);assert.equal(sent.model,'doubao-seedance-2-0-mini-260615');assert.equal(sent.ratio,'9:16');assert.equal(sent.duration,5);assert.equal(sent.generate_audio,false);
 assert.equal(sent.content[1].role,'first_frame');assert.match(sent.content[1].image_url.url,/^data:image\/png;base64,/);
 assert.doesNotMatch(JSON.stringify(g.list(p.id)),/private-test-only|base64/);
 const disk=await fs.readFile(path.join(g.dir,first.id+'.json'),'utf8');assert.doesNotMatch(disk,/private-test-only|base64/);
});

test('重启恢复远端任务、下载不附密钥、真实视频回填仅影响目标镜头并可撤销',async t=>{
 let posts=0,gets=0,downloadHeaders;let media;
 const fetcher=async(url,opts)=>{if(opts.method==='POST'){posts++;return json({id:'cgt-mock-2'});}if(url.includes('/contents/generations/tasks/')){gets++;return json({status:'succeeded',content:{video_url:'https://result.tos-cn-beijing.volces.com/video.mp4?signature=private-url'}});}downloadHeaders=opts.headers;return new Response(media);};
 const {generation:g,project:p,service:s,dir}=await fixture(t,fetcher,true);
 const file=path.join(dir,'result.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=180x320:r=30','-t','5','-c:v','libx264','-pix_fmt','yuv420p',file]);media=await fs.readFile(file);
 const job=await g.create(p.id,input(p));g.close();
 const resumed=new GenerationService({service:s,getConfig:async()=>env,fetcher,autoPoll:false});await resumed.init();t.after(()=>resumed.close());const done=await resumed.poll(job.id);
 assert.equal(done.status,'succeeded');assert.equal(posts,1);assert.equal(gets,1);assert.equal(downloadHeaders,undefined);assert.doesNotMatch(JSON.stringify(done),/private-url|video_url/);
 const before=await s.change(p.id,p.revision,{type:'text',id:'title',text:'生成期间的新标题'});
 const after=await resumed.apply(p.id,job.id,before.revision);assert.equal(after.shots[1].assetFile,done.assetFile);assert.equal(after.shots[1].duration,4);assert.deepEqual(after.shots[0],before.shots[0]);assert.deepEqual(after.shots[2],before.shots[2]);assert.deepEqual(after.texts,before.texts);
 await assert.rejects(resumed.apply(p.id,job.id,before.revision),/项目已更新/);
 const undone=await s.undo(p.id,after.revision);assert.deepEqual(undone.shots,before.shots);assert.equal(undone.assets.length,1);
});

test('提交超时不自动重试；再次请求相同 ID 仍不产生新任务',async t=>{
 let calls=0;const {generation:g,project:p}=await fixture(t,async()=>{calls++;throw Error('socket timeout');});const req=input(p);const job=await g.create(p.id,req);assert.equal(job.status,'unknown');await g.create(p.id,req);await g.poll(job.id);assert.equal(calls,1);
});

test('鉴权错误脱敏并保留错误码；拒绝不受信任的素材和规格',async t=>{
 let calls=0;const {generation:g,project:p}=await fixture(t,async()=>{calls++;return new Response(JSON.stringify({error:{code:'AuthenticationError',message:'invalid '+env.ARK_API_KEY}}),{status:401});});
 for(const override of [{confirmed:false},{duration:2},{imageFile:'../../.env'},{resolution:'8k'}])await assert.rejects(g.create(p.id,input(p,override)));
 assert.equal(calls,0);const job=await g.create(p.id,input(p));assert.equal(job.status,'failed');assert.equal(job.errorCode,'AuthenticationError');assert.doesNotMatch(job.error,/private-test-only/);
 for(const url of ['http://localhost/x','https://127.0.0.1/x','https://volces.com.attacker.invalid/x','https://a.volces.com:8443/x','https://user:pass@a.volces.com/x'])assert.throws(()=>validateDownloadUrl(url));
});

test('查询失败自动恢复，刷新同一任务而不重新生成',async t=>{
 let posts=0,queries=0;const {generation:g,project:p}=await fixture(t,async(url,opts)=>{if(opts.method==='POST'){posts++;return json({id:'cgt-mock-3'});}queries++;if(queries===1)throw Error('temporary timeout');return json({status:'running'});});
 const j=await g.create(p.id,input(p));assert.equal((await g.poll(j.id)).status,'recovering');assert.equal((await g.poll(j.id)).status,'running');assert.equal(posts,1);
});

test('展示模型名称可标准化，完整模型 ID 不被改写',()=>{assert.equal(canonicalSeedanceModel('Doubao-Seedance-2.0-mini'),'doubao-seedance-2-0-mini-260615');assert.equal(canonicalSeedanceModel('ep-user-endpoint'),'ep-user-endpoint');});

test('商品外观参考保持目标竖屏',async t=>{
 let sent;const {generation:g,project:p,service:s}=await fixture(t,async(url,opts)=>{sent=JSON.parse(opts.body);return json({id:'cgt-reference-test'});});
 const a=await importAsset(s.dir(p.id),await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url)),'参考.png');
 await g.create(p.id,input(p,{imageFile:a.filename,imageMode:'reference_image',audio:true}));
 assert.equal(sent.content[1].role,'reference_image');assert.equal(sent.ratio,'9:16');assert.equal(sent.generate_audio,true);
 await assert.rejects(g.create(p.id,input(p,{imageMode:'bad-mode'})),/参考模式/);
});

test('后台生成自动回填保留声音；重启不重复生成，用户改过镜头不覆盖',async t=>{
 let media,posts=0;const fetcher=async(url,opts)=>{if(opts.method==='POST'){posts++;return json({id:'cgt-auto-'+posts});}if(url.includes('/contents/generations/'))return json({status:'succeeded',content:{video_url:'https://result.tos-cn-beijing.volces.com/a.mp4'}});return new Response(media);};
 const {generation:g,project:p,service:s,dir}=await fixture(t,fetcher,true);
 const file=path.join(dir,'sound.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=180x320:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file]);media=await fs.readFile(file);
 let events=0;g.subscribe(()=>events++);const req=input(p,{autoApply:true,audio:true});const j=await g.create(p.id,req);await g.create(p.id,req);await g.poll(j.id);
 let current=await s.get(p.id);assert.equal(current.shots[1].sourceAudio,true);assert.equal(current.shots[1].duration,5);assert.equal(current.shots[1].assetFile,g.get(p.id,j.id).assetFile);assert.ok(g.get(p.id,j.id).appliedRevision);assert.ok(events>=3);assert.equal(posts,1);
 current=await s.change(p.id,current.revision,{type:'batch',changes:[{type:'shot',shotId:'shot-2',assetFile:current.shots[1].assetFile,trimStart:1,duration:3},{type:'overlays',visible:false}]});assert.equal(current.shots[1].sourceAudio,true);assert.equal(current.overlaysVisible,false);
 const before=current;await g.poll(j.id);assert.deepEqual((await s.get(p.id)).shots,before.shots);
 const j2=await g.create(p.id,input(current,{autoApply:true,audio:true,shotId:'shot-3'}));current=await s.change(p.id,current.revision,{type:'shot',shotId:'shot-3',duration:2});await g.poll(j2.id);assert.equal((await s.get(p.id)).shots[2].duration,2);assert.match(g.get(p.id,j2.id).applyError,/已被修改/);assert.equal((await s.get(p.id)).assets.length,2);
 g.close();const resumed=new GenerationService({service:s,getConfig:async()=>env,fetcher,autoPoll:false});await resumed.init();t.after(()=>resumed.close());assert.equal(posts,2);assert.equal((await s.get(p.id)).overlaysVisible,false);
});

test('新增镜头可生成，排序不改回填目标；删除目标不覆盖其他镜头且不重提付费任务',async t=>{
 let posts=0,media;const fetcher=async(url,opts)=>{if(opts.method==='POST'){posts++;return json({id:'cgt-order-'+posts});}if(url.includes('/contents/generations/'))return json({status:'succeeded',content:{video_url:'https://result.tos-cn-beijing.volces.com/m.mp4'}});return new Response(media);};
 const {generation:g,project:p,service:s,dir}=await fixture(t,fetcher,true);const file=path.join(dir,'order.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=180x320:r=30','-t','5','-c:v','libx264','-pix_fmt','yuv420p',file]);media=await fs.readFile(file);
 let q=await s.change(p.id,p.revision,{type:'timeline',action:'add',duration:2}),target=q.shots.at(-1).id;
 const j=await g.create(p.id,input(q,{shotId:target,autoApply:true}));q=await s.change(p.id,q.revision,{type:'timeline',action:'move',shotId:target,index:0});await g.poll(j.id);q=await s.get(p.id);assert.equal(q.shots[0].id,target);assert.equal(q.shots[0].assetFile,g.get(p.id,j.id).assetFile);assert.equal(q.shots[1].id,'shot-1');
 const j2=await g.create(p.id,input(q,{shotId:target,autoApply:true}));q=await s.change(p.id,q.revision,{type:'timeline',action:'delete',shotId:target});const unchanged=q.shots;await g.poll(j2.id);q=await s.get(p.id);assert.deepEqual(q.shots,unchanged);assert.match(g.get(p.id,j2.id).applyError,/已删除/);assert.equal(q.assets.length,2);
 await assert.rejects(g.create(p.id,input(q,{shotId:target})),/已不存在/);assert.equal(posts,2);
 await assert.rejects(g.apply(p.id,j2.id,q.revision),/已删除/);
 q=await g.apply(p.id,j2.id,q.revision,'shot-3');assert.equal(q.shots.at(-1).assetFile,g.get(p.id,j2.id).assetFile);
});

test('多段同时完成，版本竞争会重读目标并全部回填',async t=>{
 const {generation:g,project:p,service:s,dir}=await fixture(t,async()=>json({}));
 const file=path.join(dir,'concurrent.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=180x320:r=30','-t','5','-c:v','libx264','-pix_fmt','yuv420p',file]);const a=await importAsset(s.dir(p.id),await fs.readFile(file),'并发视频.mp4');
 const jobs=p.shots.slice(0,2).map(shot=>({id:crypto.randomUUID(),projectId:p.id,shotId:shot.id,baseShot:shot,autoApply:true,status:'succeeded',assetFile:a.filename,audio:false}));
 for(const j of jobs)g.jobs.set(j.id,j);
 const apply=g.apply.bind(g);let conflicts=0;g.apply=async(...args)=>{try{return await apply(...args);}catch(e){if(e.status===409)conflicts++;throw e;}};
 await Promise.all(jobs.map(j=>g.complete(j)));
 assert.ok(conflicts>=1);assert.ok(jobs.every(j=>j.appliedRevision&&!j.applyError));assert.ok((await s.get(p.id)).shots.slice(0,2).every(s=>s.assetFile===a.filename));
});

test('复刻重生成保留已剪短镜头的时长，不把后续镜头推后',async t=>{
 let media;const fetcher=async(url,opts)=>opts.method==='POST'?json({id:'cgt-preserve'}):url.includes('/contents/generations/')?json({status:'succeeded',content:{video_url:'https://result.tos-cn-beijing.volces.com/keep.mp4'}}):new Response(media);
 const {generation:g,project:p,service:s,dir}=await fixture(t,fetcher,true);
 const file=path.join(dir,'keep.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=180x320:r=30','-t','5','-c:v','libx264','-pix_fmt','yuv420p',file]);media=await fs.readFile(file);
 const edited=await s.change(p.id,p.revision,{type:'shot',shotId:'shot-2',duration:2});const j=await g.create(p.id,input(edited,{autoApply:true,preserveTiming:true}));await g.poll(j.id);const after=await s.get(p.id);assert.equal(after.shots[1].duration,2);assert.equal(after.duration,edited.duration);assert.ok(g.get(p.id,j.id).appliedRevision);
});


test('独立生成不要求旧模板镜头，4:3 和正式版 1080p 传入供应商',async t=>{
 let sent,calls=0;const {generation:g,project:p}=await fixture(t,async(url,opts)=>{calls++;sent=JSON.parse(opts.body);return json({id:'cgt-independent'});});
 const before=p.shots;
 const req=input(p,{shotId:undefined,autoApply:false,ratio:'4:3',name:'校园分享',resolution:'1080p'});
 await assert.rejects(g.create(p.id,req),/1080p/);assert.equal(calls,0);
 const job=await g.create(p.id,{...req,quality:'premium'});
 assert.equal(job.status,'queued');assert.equal(sent.model,'doubao-seedance-2-0-260128');assert.equal(sent.ratio,'4:3');assert.equal(sent.resolution,'1080p');assert.equal(job.name,'校园分享');assert.deepEqual(p.shots,before);
});

test('远端查询断网时自动恢复而非重新提交，并设有限重试',async t=>{
 let posts=0,gets=0;const {generation:g,project:p}=await fixture(t,async(url,opts)=>{if(opts.method==='POST'){posts++;return json({id:'cgt-recover'});}gets++;throw Error('fetch failed');});
 const job=await g.create(p.id,input(p,{shotId:undefined,revision:undefined,autoApply:false}));
 for(let i=1;i<=5;i++){const r=await g.poll(job.id);assert.equal(r.status,i<=4?'recovering':'paused');}
 assert.equal(posts,1);assert.equal(gets,5);
 g.fetcher=async()=>json({status:'running'});const resumed=await g.poll(job.id);assert.equal(resumed.status,'running');assert.equal(resumed.error,undefined);
});
