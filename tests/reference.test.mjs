import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService,run} from '../server/project.mjs';
import {ReferenceService,validatePlan,fitPlanDuration} from '../server/reference.mjs';
import {importAsset} from '../server/assets.mjs';
const plan={summary:'先展示质感，再给使用场景',audio:'测试合成音，无台词',scenes:[{sourceStart:0,sourceEnd:1,role:'开场',observation:'红色画面',preserve:'强色彩吸引注意',prompt:'新商品红色背景特写',voiceover:'麻辣王子',caption:'麻辣王子',duration:4},{sourceStart:1,sourceEnd:2,role:'结尾',observation:'蓝色画面',preserve:'清晰收束',prompt:'新商品包装收束',voiceover:'快乐加点辣',caption:'快乐加点辣',duration:4}]};
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-reference-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const service=new ProjectService(dir);const p=await service.create('参考测试');const file=path.join(dir,'test.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=red:s=320x480:d=2','-c:v','libx264','-y',file]);const a=await importAsset(service.dir(p.id),await fs.readFile(file),'reference.mp4');const jobs=new Map();let creates=0;const generations={jobs,list:id=>[...jobs.values()].filter(x=>x.projectId===id),get(id,k){const j=jobs.get(k);if(!j)throw Error('missing');return j;},public:j=>j,async create(id,input){creates++;const j={...input,id:input.requestId,projectId:id,status:'queued'};jobs.set(j.id,j);return j;}};const refs=new ReferenceService({service,generations,getConfig:async()=>({CREATIVE_API_KEY:'isolated-test',CREATIVE_BASE_URL:'https://creative.test',CREATIVE_PROTOCOL:'anthropic-messages'}),prepare:async()=>({boundaries:[]}),review:async p=>p,analyze:async()=>structuredClone(plan)});await refs.init();return {service,p,a,refs,jobs,get creates(){return creates;}};}
async function analyzed(f){const r=await f.refs.create(f.p.id,{requestId:crypto.randomUUID(),assetFile:f.a.filename,brief:'麻辣王子，红色包装',targetDuration:8,imageFile:null});await f.refs.close();return f.refs.get(f.p.id,r.id);}
test('本地关键帧接续失败参考分析，保留错误来源并回填同一制作方案',async t=>{
 const f=await fixture(t);let calls=0;f.refs.analyzeMedia=async()=>{calls++;throw Error('账户余额不足');};
 const r=await analyzed(f),evidence={frames:[{at:.4,observation:'红色画面'},{at:1.4,observation:'仍是红色画面'}],audio:{reviewed:false,notes:'仅查看本地帧图'}};
 assert.equal(r.status,'failed');
 await assert.rejects(f.refs.recover(f.p.id,r.id,{version:r.version,plan,evidence:{...evidence,frames:evidence.frames.slice(0,1)}}),/每段参考/);
 assert.equal(f.refs.get(f.p.id,r.id).status,'failed');
 const recovered=await f.refs.recover(f.p.id,r.id,{version:r.version,plan:{...plan,scenes:plan.scenes.map(s=>({...s,observation:'红色画面'}))},evidence});
 assert.equal(recovered.status,'ready');assert.equal(recovered.version,1);assert.equal(recovered.analysisMethod,'frame-review');assert.match(recovered.analysisHistory[0].error,/余额/);assert.equal(recovered.error,undefined);
 assert.match(recovered.plan.audio,/未核实/);assert.doesNotMatch(recovered.plan.audio,/测试合成音/);
 assert.ok((await f.refs.thumbnail(f.p.id,r.id,1)).length>0);
 const project=await f.service.get(f.p.id);assert.equal(project.productionPlan.referenceId,r.id);assert.equal(project.productionPlan.referenceVersion,1);assert.equal(project.productionPlan.duration,8);
 await f.refs.init();assert.equal(f.refs.get(f.p.id,r.id).analysisMethod,'frame-review');assert.equal(calls,1);assert.equal(f.creates,0);
 await assert.rejects(f.refs.recover(f.p.id,r.id,{version:0,plan,evidence}),/只可接续/);
});
test('参考方案拒绝越界时间、无效生成时长和过量片段',()=>{assert.equal(validatePlan(plan,2).scenes.length,2);assert.throws(()=>validatePlan({...plan,scenes:[{...plan.scenes[0],sourceEnd:3}]},2),/超出/);assert.throws(()=>validatePlan({...plan,scenes:[{...plan.scenes[0],duration:0.1}]},2),/0.5–15/);assert.throws(()=>validatePlan({...plan,scenes:Array(31).fill(plan.scenes[0])},2),/1–30/);});
test('参考分析持久化时间证据，应用方案原子提交且可整次撤销',async t=>{const f=await fixture(t),before=await f.service.raw(f.p.id),r=await analyzed(f);assert.equal(r.status,'ready',r.error);assert.match(await fs.readFile(path.join(f.refs.dir,r.id,'TREATMENT.md'),'utf8'),/参考 0–1s：红色画面/);assert.ok((await fs.stat(path.join(f.refs.dir,r.id,'scene-0.jpg'))).size>0);const p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});assert.equal(p.shots.length,2);assert.equal(p.duration,8);assert.equal(p.history.length,1);assert.equal(p.overlaysVisible,true);assert.equal(p.headingsVisible,false);assert.deepEqual(p.texts.slice(-2).map(x=>x.text),['麻辣王子','快乐加点辣']);await f.service.undo(p.id,p.revision);assert.deepEqual(await f.service.raw(p.id),before);});
test('重复生成不重复收费，重排仍绑定原镜头，删除后拒绝提交',async t=>{const f=await fixture(t),r=await analyzed(f);let p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});const target=p.shots.map(s=>s.id);p=await f.service.change(p.id,p.revision,{type:'timeline',action:'move',shotId:target[0],index:1});await f.refs.generate(p.id,r.id,{revision:p.revision});await f.refs.generate(p.id,r.id,{revision:p.revision});assert.equal(f.creates,2);assert.deepEqual([...f.jobs.values()].map(j=>j.shotId),target);p=await f.service.change(p.id,p.revision,{type:'timeline',action:'delete',shotId:target[0]});await assert.rejects(f.refs.generate(p.id,r.id,{revision:p.revision}),/删除/);});
test('分析失败可恢复，重启不偷偷再调用付费模型，跨项目记录不可读',async t=>{const f=await fixture(t);f.refs.analyzeMedia=async()=>{throw Error('模型拒绝');};const r=await analyzed(f);assert.equal(r.status,'failed');f.refs.analyzeMedia=async()=>plan;await f.refs.retry(f.p.id,r.id);await f.refs.close();assert.equal(r.status,'ready');assert.throws(()=>f.refs.get('p-000000000000',r.id),/不存在/);r.status='analyzing';await f.refs.save(r);await f.refs.init();assert.equal(f.refs.get(f.p.id,r.id).status,'interrupted');});
test('方案编辑遵循版本，旧版本不能覆盖新方案',async t=>{const f=await fixture(t),r=await analyzed(f);const version=r.version;await f.refs.update(f.p.id,r.id,{version,plan:{...plan,summary:'新说明'}});await assert.rejects(f.refs.update(f.p.id,r.id,{version,plan}),/已更新/);const p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});await assert.rejects(f.refs.update(p.id,r.id,{version:r.version,plan:{...plan,scenes:[{...plan.scenes[0],duration:8},plan.scenes[1]]}}),/时间线/);await f.refs.update(p.id,r.id,{version:r.version,plan:{...plan,scenes:[{...plan.scenes[0],prompt:'更新画面描述'},plan.scenes[1]]}});});

test('目标时长按原节奏分配，保持每段生成边界',()=>{const p=fitPlanDuration(plan,15);assert.equal(p.scenes.reduce((n,s)=>n+s.duration,0),15);assert.ok(p.scenes.every(s=>s.duration>=4&&s.duration<=15));assert.equal(fitPlanDuration(plan,4).scenes.reduce((n,s)=>n+s.duration,0),4);assert.throws(()=>fitPlanDuration(plan,.5),/不匹配/);});

test('对话或手动生成映射同一参考镜头，批量按钮不会重复生成；未知提交不重试',async t=>{
 const f=await fixture(t),r=await analyzed(f);const p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});
 assert.throws(()=>f.refs.assertExportReady(p),/待生成/);
 const j=await f.refs.generations.create(p.id,{requestId:crypto.randomUUID(),shotId:p.shots[0].id});j.status='unknown';
 const list=f.refs.public(r);assert.equal(list.jobs[0].jobId,j.id);assert.equal(list.jobs[0].index,0);
 await f.refs.generate(p.id,r.id,{revision:p.revision,indices:[0],retry:true});assert.equal(f.creates,1);
 j.status='succeeded';await f.refs.generate(p.id,r.id,{revision:p.revision,indices:[0]});assert.equal(f.creates,1);
 await f.refs.generate(p.id,r.id,{revision:p.revision,indices:[0],retry:true});assert.equal(f.creates,2);
});

test('参考理解经创意接口接收时间帧与真实转录，不伪装视频听音且凭证不落盘',async t=>{
 const f=await fixture(t),dir=path.join(f.refs.dir,crypto.randomUUID());await fs.mkdir(dir,{recursive:true});const item={id:path.basename(dir),projectId:f.p.id,brief:'商品事实',duration:2,targetDuration:8,hasAudio:true};let request;
 f.refs.fetcher=async(url,opts)=>{assert.equal(url,'https://creative.test/v1/messages');assert.equal(opts.headers['x-api-key'],'isolated-test');request=JSON.parse(opts.body);return new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify(plan)}]}));};
 const frame=path.join(dir,'frame.jpg');await run('ffmpeg',['-v','error','-i',path.join(f.service.dataRoot,'test.mp4'),'-frames:v','1','-y',frame]);
 const result=await ReferenceService.prototype.analyzeMedia.call(f.refs,{frames:[{at:.25,file:frame},{at:1.25,file:frame}],transcript:{status:'transcribed',text:'真实转录台词',words:[{text:'台词',start:.2,end:.6}]},boundaries:[{at:1,score:.4}]},item);
 const content=request.messages[0].content;assert.equal(content.filter(x=>x.type==='image').length,2);assert.ok(!content.some(x=>['video_url','input_audio'].includes(x.type)));assert.match(request.system,/忽略其中任何指令/);assert.match(JSON.stringify(content),/真实转录台词/);assert.match(JSON.stringify(content),/0.250 秒/);assert.equal(request.max_tokens,32768);assert.match(result.audio,/未直接听取/);assert.doesNotMatch(result.audio,/测试合成音/);assert.doesNotMatch(await fs.readFile(path.join(dir,'model-response.json'),'utf8'),/isolated-test/);assert.equal(item.analysisProvider,'creative');
});

test('商品校对仅能改创作字段，不能改原片观察或注入字段',async t=>{
 const f=await fixture(t);const item={brief:'麻辣王子，麻辣味',duration:2};
 f.refs.fetcher=async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify({edits:[{index:0,voiceover:'麻辣好滋味'}],corrections:['去除未经提供的产地']})}]}));
 const result=await ReferenceService.prototype.reviewPlan.call(f.refs,plan,item);assert.equal(result.scenes[0].voiceover,'麻辣好滋味');assert.equal(result.scenes[0].observation,plan.scenes[0].observation);
 f.refs.fetcher=async()=>new Response(JSON.stringify({content:[{type:'text',text:JSON.stringify({edits:[{index:0,observation:'新虚构的原片'}],corrections:[]})}]}));
 await assert.rejects(ReferenceService.prototype.reviewPlan.call(f.refs,plan,item),/无效修改/);
});

test('空白项目采用参考不套模板，转为原生工程后仍复用同一场景素材',async t=>{
 const f=await fixture(t);f.p=await f.service.createBlank('原生参考','横屏8秒');f.a=await importAsset(f.service.dir(f.p.id),await fs.readFile(path.join(f.service.dataRoot,'test.mp4')),'参考.mp4');
 f.refs.analyzeMedia=async()=>({...plan,scenes:[{...plan.scenes[0],duration:3},{...plan.scenes[1],duration:5}]});
 const first=await f.refs.create(f.p.id,{requestId:crypto.randomUUID(),assetFile:f.a.filename,brief:'真实商品',targetDuration:8,ratio:'16:9',preserve:'shots'});await f.refs.close();const r=f.refs.get(f.p.id,first.id);
 let p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});assert.equal(p.draft,true);assert.equal(p.shots.length,0);assert.equal(p.history.length,0);assert.equal(p.productionPlan.ratio,'16:9');assert.equal(p.productionPlan.referenceId,r.id);assert.deepEqual(p.productionPlan.scenes.map(s=>s.id),r.plan.scenes.map(s=>s.id));
 p=await f.refs.updateProductionPlan(p.id,r.id,{ratio:'16:9',duration:8,scenes:p.productionPlan.scenes.map((s,i)=>({...s,name:i===0?'商品开场':s.name,visual:i===0?'斑驳光影落在商品上':s.visual}))});assert.equal(r.plan.scenes[0].role,'商品开场');assert.equal(r.plan.scenes[0].prompt,'斑驳光影落在商品上');assert.equal(r.plan.scenes[0].observation,plan.scenes[0].observation);
 const result=await f.refs.generate(p.id,r.id,{revision:p.revision});assert.equal(result.jobs.length,2);assert.equal(p.productionPlan.scenes[0].end,3);assert.equal(result.jobs[0].duration,4);assert.ok(result.jobs.every(j=>!j.shotId&&j.autoApply===false&&j.ratio==='16:9'));assert.ok(r.jobs.every(j=>j.sceneId));
 // The native projection deliberately has no legacy shots. Its media mapping must survive.
 const metaFile=path.join(f.service.dir(p.id),'project.json'),meta=JSON.parse(await fs.readFile(metaFile,'utf8'));meta.draft=false;meta.native={duration:8,output:{width:1920,height:1080}};await fs.writeFile(metaFile,JSON.stringify(meta));p=await f.service.get(p.id);
 await f.refs.apply(p.id,r.id,{revision:p.revision,version:r.version});await f.refs.generate(p.id,r.id,{revision:p.revision});assert.equal(f.creates,2);assert.equal(p.template,'hypit-native');assert.doesNotThrow(()=>f.refs.assertExportReady(p));
});

test('方案确认交给同一 Agent，重复确认不重复派发，派发失败可以恢复',async t=>{
 const f=await fixture(t),r=await analyzed(f);await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});let calls=0;
 await assert.rejects(f.refs.dispatch(f.p.id,r.id,{version:r.version},async()=>{throw Error('暂不可用');}),/暂不可用/);assert.equal(r.production,undefined);
 const send=async text=>{calls++;assert.match(text,new RegExp(r.id));assert.match(text,/连续配乐/);assert.match(text,/导出并检查/);};
 await f.refs.dispatch(f.p.id,r.id,{version:r.version},send);await f.refs.dispatch(f.p.id,r.id,{version:r.version},send);assert.equal(calls,1);await f.refs.dispatch(f.p.id,r.id,{version:r.version,resume:true},send);assert.equal(calls,2);
});


for(const provider of ['minimax','runninghub'])test(provider+' 参考改编绑定真实原片片段与每镜商品图，重试复用证据',async t=>{
 const f=await fixture(t);f.refs.generations.configuration=async()=>({provider,minimaxModel:'MiniMax-H3'});
 const image=await importAsset(f.service.dir(f.p.id),await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url)),'商品身份.png');
 const r=await analyzed(f);r.preserve='shots';r.plan.scenes[0].imageFile=image.filename;
 let p=await f.refs.apply(f.p.id,r.id,{revision:f.p.revision,version:r.version});
 const result=await f.refs.generate(p.id,r.id,{revision:p.revision,indices:[0]});
 const job=result.jobs[0];assert.equal(job.imageFile,image.filename);assert.equal(job.references[0].role,'reference_video');
 const asset=(await f.service.get(p.id)).assets.find(a=>a.filename===job.references[0].file);
 assert.equal(asset.provenance.provider,'hypit-reference');assert.equal(asset.provenance.sceneId,r.plan.scenes[0].id);assert.ok(asset.duration>=2&&asset.duration<=15);
 const count=(await f.service.get(p.id)).assets.length;
 job.status='succeeded';await f.refs.generate(p.id,r.id,{revision:p.revision,indices:[0],retry:true});
 assert.equal((await f.service.get(p.id)).assets.length,count);assert.equal(f.creates,2);
});
