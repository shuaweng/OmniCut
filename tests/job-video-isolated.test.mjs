import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {importAsset} from '../server/assets.mjs';
import {withJobVideo,captureJobVideo} from '../server/job-video.mjs';
import {GenerationService} from '../server/generation.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {AudioGenerationService} from '../server/audio-generation.mjs';
import {TranscriptionService} from '../server/transcription.mjs';
import {NativeBuilds} from '../server/native-builds.mjs';
import {ReferenceService} from '../server/reference.mjs';

const png=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));
const env={ARK_API_KEY:'synthetic-only',SEEDANCE_MODEL:'doubao-seedance-2-0-mini-260615',ELEVENLABS_API_KEY:'synthetic-only'};
const json=value=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const forbidden=async()=>{throw Error('隔离测试禁止真实请求');};
const base=(p,videoId,more={})=>({id:crypto.randomUUID(),projectId:p.id,videoId,status:'succeeded',created:'2026-10-09T00:00:00Z',...more});
async function fixture(t){
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-job-video-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const service=new ProjectService(data,async()=>{}),p=await service.create('隔离多视频任务');
 const a=await service.createVariant(p.id,{name:'视频 A'}),b=await service.createVariant(p.id,{name:'视频 B'});
 return {data,service,p,a,b};
}
async function stored(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(value));}
const videoInput=p=>({requestId:crypto.randomUUID(),revision:p.revision,shotId:'shot-2',prompt:'隔离镜头',duration:5,resolution:'480p',audio:false,imageFile:null,autoApply:true,confirmed:true});

test('未知任务不执行回调，旧任务固定默认视频，显式视频目标须属于当前项目',async t=>{
 const {service,p,a}=await fixture(t);let called=false;
 assert.equal(await withJobVideo(service,undefined,()=>{called=true;}),undefined);assert.equal(called,false);
 await service.withVideoContext(p.id,a.videoId,async()=>{
  assert.equal(await withJobVideo(service,{projectId:p.id},()=>service.currentVideoId(p.id)),'v-default');
  assert.equal(captureJobVideo(service,p.id).videoId,a.videoId);
 });
 await assert.rejects(withJobVideo(service,{projectId:p.id,videoId:'v-missing'},()=>{}),/目标无效/);
 await assert.rejects(withJobVideo(service,{projectId:p.id,videoId:'v-ffffffffffff'},()=>{}));
 const g=new GenerationService({service,getConfig:async()=>env,fetcher:forbidden,autoPoll:false});await g.init();
 const images=new ImageGenerationService({service,getConfig:async()=>env,fetcher:forbidden,autoPoll:false});await images.init();
 assert.equal(await g.poll('unknown'),undefined);assert.equal(await images.poll('unknown'),undefined);g.close();await images.close();
});

test('排队创建保留调用时视频，同镜头并发按视频隔离，requestId 不能转移到其他视频',async t=>{
 const {service,p,a,b}=await fixture(t);const seen=[];
 const g=new GenerationService({service,getConfig:async()=>env,autoPoll:false,fetcher:async()=>{seen.push(service.currentVideoId(p.id));return json({id:'remote-'+seen.length});}});await g.init();t.after(()=>g.close());
 let release;g.submitQueue=new Promise(resolve=>{release=resolve;});const req=videoInput(a);let queued;
 await service.withVideoContext(p.id,a.videoId,()=>{queued=g.create(p.id,req);});
 const second=g.create(p.id,{...videoInput(b),videoId:b.videoId});release();const [ja,jb]=await Promise.all([queued,second]);
 assert.deepEqual(seen,[a.videoId,b.videoId]);assert.equal(ja.videoId,a.videoId);assert.equal(jb.videoId,b.videoId);
 await assert.rejects(g.create(p.id,{...req,videoId:b.videoId}),/请求已存在/);assert.equal(seen.length,2);
 assert.equal(JSON.parse(await fs.readFile(path.join(g.dir,ja.id+'.json'))).videoId,a.videoId);
 g.fetcher=async()=>{assert.equal(service.currentVideoId(p.id),b.videoId);return json({status:'running'});};assert.equal((await g.poll(jb.id)).status,'running');
});

test('成功任务在启动恢复时只回填原视频，默认视频和其他变体保留原镜头',async t=>{
 const {service,p,a,b}=await fixture(t);const asset=await importAsset(service.dir(p.id),png,'恢复素材.png');
 const g=new GenerationService({service,getConfig:async()=>env,fetcher:forbidden,autoPoll:false});
 const job=base(p,a.videoId,{shotId:'shot-2',baseShot:a.shots[1],autoApply:true,assetFile:asset.filename,audio:false,preserveTiming:true});
 await stored(path.join(g.dir,job.id+'.json'),job);await g.init();t.after(()=>g.close());
 const after=await service.getVideo(p.id,a.videoId);assert.equal(after.shots[1].assetFile,asset.filename);assert.ok(g.jobs.get(job.id).appliedRevision);
 assert.deepEqual((await service.get(p.id)).shots,p.shots);assert.deepEqual((await service.getVideo(p.id,b.videoId)).shots,b.shots);
 await g.apply(p.id,job.id,after.revision);assert.equal(service.currentVideoId(p.id),'v-default');
});

test('图片后台完成和缓存恢复、声音缓存恢复都读取任务视频，不依赖当前选择',async t=>{
 const {service,p,a,b}=await fixture(t),reads=[],get=service.get.bind(service);service.get=async id=>{reads.push(service.currentVideoId(id));return get(id);};
 const images=new ImageGenerationService({service,getConfig:async()=>env,fetcher:async()=>json({data:[{b64_json:png.toString('base64')}]}),autoPoll:false});await images.init();
 const req={requestId:crypto.randomUUID(),videoId:a.videoId,prompt:'隔离图片',size:'1440x2560'};const image=await images.create(p.id,req);await Promise.all(images.work.values());
 assert.equal(images.get(p.id,image.id).status,'succeeded');assert.ok(reads.length>=2&&reads.every(v=>v===a.videoId));
 await assert.rejects(images.create(p.id,{...req,videoId:b.videoId}),/任务 ID/);await images.close();
 const cached=base(p,b.videoId,{status:'downloading',prompt:'缓存图片',imageFiles:[]});await stored(path.join(images.dir,cached.id+'.json'),cached);await fs.writeFile(path.join(images.dir,cached.id+'.jpg'),png);
 reads.length=0;const resumed=new ImageGenerationService({service,getConfig:async()=>env,fetcher:forbidden,autoPoll:false});await resumed.init();await resumed.close();assert.deepEqual(reads,[b.videoId]);
 const audio=new AudioGenerationService({service,getConfig:async()=>env,fetcher:forbidden}),sound=base(p,b.videoId,{status:'saving',extension:'mp3'});await stored(path.join(audio.dir,sound.id+'.json'),sound);await fs.writeFile(path.join(audio.dir,sound.id+'.mp3'),'inert fixture');
 const scopes=[];audio.ingestInVideo=async job=>{scopes.push(service.currentVideoId(p.id));job.status='succeeded';await audio.persist(job);};await audio.init();assert.deepEqual(scopes,[b.videoId]);await audio.close();
});

test('声音和字幕创建持久化视频目标；重用请求 ID 不允许换目标',async t=>{
 const {service,p,a,b}=await fixture(t),audio=new AudioGenerationService({service,getConfig:async()=>env,fetcher:forbidden});await audio.init();
 const observed=[];audio.execute=async()=>{observed.push(service.currentVideoId(p.id));};const req={requestId:crypto.randomUUID(),kind:'speech',text:'隔离旁白',videoId:a.videoId};await audio.create(p.id,req);await Promise.all(audio.work.values());
 await assert.rejects(audio.create(p.id,{...req,videoId:b.videoId}),/任务 ID/);assert.deepEqual(observed,[a.videoId]);await audio.close();
 const transcripts=new TranscriptionService({service,getConfig:async()=>({HYPIT_WHISPERX:'enabled'}),engine:{runtime:{}}});await transcripts.init();
 const get=service.get.bind(service),fake={filename:crypto.randomUUID()+'.wav',kind:'audio',duration:2,name:'假语音'};service.get=async id=>({...await get(id),assets:[fake]});
 transcripts.executeLocal=async job=>{observed.push(service.currentVideoId(p.id));job.status='succeeded';await transcripts.save(job);};const tr={requestId:crypto.randomUUID(),assetFile:fake.filename,videoId:b.videoId};const j=await transcripts.create(p.id,tr);await Promise.all(transcripts.work.values());
 assert.equal(j.videoId,b.videoId);assert.equal(JSON.parse(await fs.readFile(path.join(transcripts.dir,j.id+'.json'))).videoId,b.videoId);await assert.rejects(transcripts.create(p.id,{...tr,videoId:a.videoId}),/任务 ID/);assert.equal(observed.at(-1),b.videoId);await transcripts.close();
});

test('原生构建同 operationId 在不同视频分别执行，快照和结果使用固定视频',async t=>{
 const {service,p,a,b}=await fixture(t);for(const v of [a,b])await fs.writeFile(path.join(await service.withVideoContext(p.id,v.videoId,()=>service.dir(p.id)),'fixture.svrun'),'fixture');
 const snapshots=[],execution=[],work=[];const engine={async writeFiles(){},async copyMedia(from){snapshots.push(from);},async linkLocalPackages(){}};
 const builds=new NativeBuilds({service,engine,runtime:{async prepare(){}}});await builds.init();builds.executeInVideo=async job=>{execution.push(service.currentVideoId(p.id));job.status='succeeded';await builds.save(job);};
 const execute=builds.execute.bind(builds);builds.execute=(...args)=>{const task=execute(...args);work.push(task);return task;};
 const input={operationId:'same-operation',revision:a.revision,run:'fixture.svrun',outputs:[{name:'test',file:'test.txt'}]};const x=await builds.create(p.id,{...input,videoId:a.videoId}),y=await builds.create(p.id,{...input,videoId:b.videoId});await Promise.all(work);
 assert.notEqual(x.id,y.id);assert.deepEqual(execution,[a.videoId,b.videoId]);assert.ok(snapshots[0].endsWith(a.videoId)&&snapshots[1].endsWith(b.videoId));assert.equal((await builds.create(p.id,{...input,videoId:a.videoId})).id,x.id);
 assert.equal(JSON.parse(await fs.readFile(path.join(builds.base,y.id,'job.json'))).videoId,b.videoId);
});

const plan={summary:'真实观察',audio:'未核实音轨',scenes:[{id:'ref-scene-test',sourceStart:0,sourceEnd:1,role:'开场',observation:'看到画面',preserve:'构图',prompt:'新商品',duration:5,caption:''}]};
test('参考后续应用与方案更新固定原视频，同镜头 ID 不关联其他视频任务或阻塞其导出',async t=>{
 const {service,p,a,b}=await fixture(t),jobs=new Map();const generations={jobs,list:id=>[...jobs.values()].filter(j=>j.projectId===id)};
 const refs=new ReferenceService({service,generations,getConfig:async()=>({})});await refs.init();
 const item=base(p,a.videoId,{status:'ready',brief:'测试商品事实',duration:2,targetDuration:5,ratio:'9:16',version:1,plan:structuredClone(plan),jobs:[]});refs.items.set(item.id,item);await refs.save(item);
 const project=await refs.apply(p.id,item.id,{revision:a.revision,version:1});assert.equal(project.videoId,a.videoId);assert.deepEqual((await service.get(p.id)).shots,p.shots);
 const shotId=item.applied.shotIds[0],other=base(p,b.videoId,{shotId,status:'queued'}),own=base(p,a.videoId,{shotId,status:'unknown'});jobs.set(other.id,other);jobs.set(own.id,own);
 assert.deepEqual(refs.linkedJobs(item).map(j=>j.jobId),[own.id]);assert.doesNotThrow(()=>refs.assertExportReady({...b,shots:[{id:shotId,assetFile:item.applied.placeholder}]}));
 assert.throws(()=>refs.assertExportReady(project),/待生成/);
 item.applied.mode='composition';jobs.clear();await refs.update(p.id,item.id,{version:1,plan:{...plan,summary:'更新方案'}});assert.equal((await service.getVideo(p.id,a.videoId)).productionPlan.referenceId,item.id);assert.equal((await service.get(p.id)).productionPlan,undefined);
});

test('参考恢复画幅从记录的视频读取，坏 videoId 隔离，旧记录仍属于默认视频',async t=>{
 const {service,p,a}=await fixture(t);await service.withVideoContext(p.id,a.videoId,()=>service.plan(p.id,{ratio:'16:9',duration:5,scenes:[{id:'scene-fixture',name:'场景',start:0,end:5,visual:'画面'}]}));
 const refs=new ReferenceService({service,getConfig:async()=>({})}),item=base(p,a.videoId,{status:'analyzing'}),bad=base(p,'other-project-video',{status:'ready'}),legacy=base(p,undefined,{ratio:'9:16'});
 for(const x of [item,bad,legacy])await stored(path.join(refs.dir,x.id,'reference.json'),x);const reads=[],get=service.get.bind(service);service.get=async id=>{reads.push(service.currentVideoId(id));return get(id);};
 await refs.init();assert.deepEqual(reads,[a.videoId]);assert.equal(refs.items.get(item.id).status,'interrupted');assert.equal(refs.recoveryDiagnostics.length,1);assert.equal(refs.public(refs.items.get(legacy.id)).videoId,'v-default');
});

test('参考创建捕获排队目标，两个视频可同时分析，相同 requestId 不复用其他视频结果',async t=>{
 const {service,p,a,b}=await fixture(t),get=service.get.bind(service),asset={filename:crypto.randomUUID()+'.mp4',name:'假视频',kind:'video',duration:2,width:320,height:480};
 service.get=async id=>({...await get(id),assets:[asset]});const refs=new ReferenceService({service,getConfig:async()=>({CREATIVE_API_KEY:'synthetic-only',CREATIVE_BASE_URL:'https://creative.invalid'})});await refs.init();
 const launched=[];refs.launch=()=>launched.push(service.currentVideoId(p.id));let release;refs.queue=new Promise(resolve=>{release=resolve;});let queued;
 const input={requestId:crypto.randomUUID(),assetFile:asset.filename,brief:'商品事实',targetDuration:5};await service.withVideoContext(p.id,a.videoId,()=>{queued=refs.create(p.id,input);});
 const second=refs.create(p.id,{...input,requestId:crypto.randomUUID(),videoId:b.videoId});release();const [x,y]=await Promise.all([queued,second]);assert.deepEqual(launched,[a.videoId,b.videoId]);assert.equal(x.videoId,a.videoId);assert.equal(y.videoId,b.videoId);
 await assert.rejects(refs.create(p.id,{...input,videoId:b.videoId}),/其他参考/);
});

test('Gemini 请求或视频准备失败时诚实降级；无关键帧服务配置时保留失败',async t=>{
 const {service,p,a,data}=await fixture(t),asset=await importAsset(service.dir(p.id),png,'参考占位.png'),cfg={VIDEO_UNDERSTANDING_PROVIDER:'gemini',GEMINI_API_KEY:'synthetic-only',CREATIVE_API_KEY:'synthetic-only',CREATIVE_BASE_URL:'https://creative.invalid',CREATIVE_PROTOCOL:'anthropic-messages'};
 const requests=[],refs=new ReferenceService({service,getConfig:async()=>cfg,fetcher:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return url.includes('generateContent')?new Response('{}',{status:503}):json({content:[{type:'text',text:JSON.stringify(plan)}]});}});await refs.init();
 const item=base(p,a.videoId,{assetFile:asset.filename,brief:'商品事实',duration:2,targetDuration:5,ratio:'9:16',preserve:'structure',hasAudio:true}),frames={frames:[{at:.5,file:path.join(data,'frame.jpg')}],boundaries:[],transcript:{status:'unavailable',limitation:'未听原始音轨'}};await fs.writeFile(frames.frames[0].file,png);await refs.save(item);
 refs.prepareFrameMedia=async()=>frames;
 const result=await withJobVideo(service,item,()=>refs.analyzeMedia({video:{mimeType:'video/mp4',data:'inert',bytes:5},transcript:{status:'direct-audio'}},item));
 assert.equal(item.analysisMethod,'frames-transcript');assert.match(item.analysisFallback,/不可用/);assert.match(result.uncertainties,/抽帧画面和旁白文字/);assert.equal(result.audio,'未听原始音轨');assert.ok(requests[1].body.messages[0].content.every(x=>x.type!=='video_url'));assert.match(requests[1].body.system,/没有原生视频或原始音频/);
 const prepared=await withJobVideo(service,item,()=>refs.prepareMedia(path.join(data,'missing-video.mp4'),path.join(refs.dir,item.id),item));assert.equal(prepared,frames);assert.ok(item.analysisFallback);
 refs.getConfig=async()=>({VIDEO_UNDERSTANDING_PROVIDER:'gemini',GEMINI_API_KEY:'synthetic-only'});await assert.rejects(refs.prepareMedia(path.join(data,'missing-video.mp4'),path.join(refs.dir,item.id),item));
 item.purpose='quality';refs.prepareMedia=async()=>({boundaries:[]});refs.analyzeMedia=async()=>({summary:'成功重新检查',issues:[]});await refs.process(item);assert.equal(item.status,'ready');assert.equal(item.analysisFallback,undefined);
});
