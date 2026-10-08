import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService,run} from '../server/project.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {GenerationService} from '../server/generation.mjs';
import {SettingsStore} from '../server/settings.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
import {runninghubVideoBody,runninghubImageBody,validateRunninghubDownload,uploadRunninghub,runninghubConfig} from '../server/runninghub.mjs';
const env={RUNNINGHUB_API_KEY:'isolated-rh-secret',VIDEO_PROVIDER:'runninghub',IMAGE_PROVIDER:'runninghub'};
const base='https://www.runninghub.cn',cdn='https://rh-images-1252422369.cos.ap-beijing.myqcloud.com/';
const image=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-rh-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const service=new ProjectService(dir,async()=>{}),project=await service.createBlank('接口隔离验证','商品广告');return {dir,service,project};}
test('RunningHub 图像重启续查、任务通知、共享素材到 Enhanced 图生视频使用同一链路',async t=>{
 const {dir,service,project:p}=await fixture(t),calls=[];let imageQueries=0;
 const file=path.join(dir,'generated.mp4');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:s=320x480:d=4','-f','lavfi','-i','sine=frequency=440:duration=4','-c:v','libx264','-c:a','aac','-y',file]);const video=await fs.readFile(file);
 const fetcher=async(url,o={})=>{
  calls.push({url,body:o.body instanceof FormData?'file':o.body?JSON.parse(o.body):null});
  if(url.startsWith(base)){assert.equal(o.headers.Authorization,'Bearer '+env.RUNNINGHUB_API_KEY);}
  else assert.equal(o.headers?.Authorization,undefined);
  if(url.endsWith('/text-to-image'))return Response.json({taskId:'rh-image-1',status:'QUEUED'});
  if(url.endsWith('/upload/binary')){assert.ok(o.body.get('file').size);return Response.json({code:0,data:{download_url:cdn+'reference.png',fileName:'input/reference.png'}});}
  if(url.endsWith('/i2va'))return Response.json({taskId:'rh-video-1',status:'RUNNING'});
  if(url.endsWith('/query')){const id=JSON.parse(o.body).taskId;if(id==='rh-image-1'&&!imageQueries++)return Response.json({taskId:id,status:'RUNNING'});return Response.json({taskId:id,status:'SUCCESS',results:[{url:cdn+(id==='rh-image-1'?'result.jpg':'result.mp4'),outputType:id==='rh-image-1'?'jpg':'mp4'}]});}
  if(url.endsWith('.jpg'))return new Response(image);
  if(url.endsWith('.mp4'))return new Response(video);
  assert.fail('unexpected '+url);
 };
 const images=new ImageGenerationService({service,getConfig:async()=>env,fetcher,autoPoll:false});await images.init();t.after(()=>images.close());
 const req={requestId:crypto.randomUUID(),name:'商品主视觉',prompt:'生成具有柔和光线的商品主视觉',size:'2368x1776'};
 const [a,b]=await Promise.all([images.create(p.id,req),images.create(p.id,req)]);await Promise.all(images.work.values());assert.equal(a.id,b.id);assert.equal(calls.filter(x=>x.url.endsWith('/text-to-image')).length,1);assert.equal(images.get(p.id,a.id).remoteId,'rh-image-1');
 const payload=calls[0].body;assert.equal(payload.width,2368);assert.equal(payload.height,1776);assert.equal(payload.resolution,undefined);
 await images.close();
 const resumed=new ImageGenerationService({service,getConfig:async()=>({...env,IMAGE_PROVIDER:'seedream'}),fetcher,autoPoll:false});await resumed.init();t.after(()=>resumed.close());const tasks=new TaskRegistry().register('image',resumed);t.after(()=>tasks.close());let notices=0;tasks.subscribe(()=>notices++);
 await resumed.poll(a.id);assert.equal(tasks.get(p.id,a.taskId).status,'running');await resumed.poll(a.id);assert.equal(tasks.get(p.id,a.taskId).status,'succeeded');assert.ok(notices>0);
 const asset=(await service.get(p.id)).assets[0];assert.equal(asset.provenance.provider,'runninghub');assert.equal(asset.name,'商品主视觉.jpg');
 const videos=new GenerationService({service,getConfig:async()=>env,fetcher,autoPoll:false});await videos.init();t.after(()=>videos.close());
 const input={requestId:crypto.randomUUID(),autoApply:false,prompt:'商品在柔和光线中缓慢转动',duration:4,ratio:'3:4',audio:true,imageFile:asset.filename,imageMode:'first_frame',confirmed:true};
 const job=await videos.create(p.id,input);assert.equal(job.remoteId,'rh-video-1');const wire=calls.find(x=>x.url.endsWith('/i2va')).body;assert.equal(wire.firstFrameUrl,cdn+'reference.png');assert.equal(wire.resolution,'768p');assert.equal(wire.aspectRatio,'3:4');assert.equal(wire.audioMode,'native');assert.equal(Object.keys(wire).some(k=>k.includes('##')),false);
 await videos.close();const restored=new GenerationService({service,getConfig:async()=>({...env,VIDEO_PROVIDER:'seedance'}),fetcher,autoPoll:false});await restored.init();t.after(()=>restored.close());const done=await restored.poll(job.id);assert.equal(done.status,'succeeded',done.error);assert.equal(done.hasAudio,true);assert.equal(done.provider,'runninghub');assert.equal((await service.get(p.id)).assets.length,2);
 assert.doesNotMatch(await fs.readFile(path.join(videos.dir,job.id+'.json'),'utf8'),/isolated-rh-secret|base64|download_url/);
});
test('Enhanced 首尾帧、多参考和锁定音轨按官方别名映射，不偷换模型或画幅',()=>{
 const values={prompt:'产品广告',duration:5,ratio:'4:3',resolution:'1080p'},ref=(role,type,url)=>({role,type:type+'_url',[type+'_url']:{url}});
 const multi=runninghubVideoBody({...values,audioMode:'lock_source'},[ref('reference_image','image',cdn+'product.jpg'),ref('reference_video','video',cdn+'ref.mp4'),ref('reference_audio','audio',cdn+'voice.wav'),ref('driving_audio','audio',cdn+'drive.wav')]);assert.ok(multi.route.endsWith('/ref2va'));assert.equal(multi.body.refImage1,cdn+'product.jpg');assert.equal(multi.body.refVideo1,cdn+'ref.mp4');assert.equal(multi.body.driveAudio,cdn+'drive.wav');assert.equal(multi.body.audioMode,'lock_source');
 assert.ok(runninghubVideoBody(values,[]).route.endsWith('/t2va'));assert.ok(runninghubVideoBody(values,[ref('last_frame','image',cdn+'last.jpg')]).route.endsWith('/i2va'));
 assert.throws(()=>runninghubVideoBody({...values,resolution:'2K'},[]),/480p/);assert.throws(()=>runninghubVideoBody({...values,ratio:'adaptive'},[]),/画面比例/);assert.throws(()=>runninghubVideoBody({...values,audioMode:'lock_source'},[]),/驱动音频/);
 assert.throws(()=>validateRunninghubDownload('https://localhost/secret'),/域名/);assert.throws(()=>validateRunninghubDownload('https://rh-images-999999.cos.ap-beijing.myqcloud.com/x'),/域名/);
 const edit=runninghubImageBody({prompt:'商品改为白色背景',size:'1776x2368'},[cdn+'product.jpg']);assert.ok(edit.route.endsWith('/image-to-image'));assert.equal(edit.body.imageUrls.length,1);assert.equal(edit.body.resolution,undefined);
});
test('RunningHub 提交超时不重发，返回明确失败可解释，设置不泄露密钥',async t=>{
 const {dir,service,project:p}=await fixture(t),store=new SettingsStore(path.join(dir,'.env'));await store.save({runninghubApiKey:env.RUNNINGHUB_API_KEY,videoProvider:'runninghub',imageProvider:'runninghub'});const visible=await store.loadInto({});assert.equal(visible.runninghubConfigured,true);assert.equal(visible.imageProvider,'runninghub');assert.doesNotMatch(JSON.stringify(visible),/isolated-rh-secret/);
 let calls=0;const images=new ImageGenerationService({service,getConfig:async()=>env,autoPoll:false,fetcher:async()=>{calls++;throw Error('timeout isolated-rh-secret');}});await images.init();t.after(()=>images.close());const input={requestId:crypto.randomUUID(),prompt:'产品在柔和光线中展示'};await images.create(p.id,input);await Promise.all(images.work.values());assert.equal(images.get(p.id,input.requestId).status,'unknown');await images.create(p.id,input);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(images.list(p.id)),/isolated-rh-secret/);
 images.fetcher=async()=>Response.json({errorCode:'301',errorMessage:'PARAMS_INVALID'});const failed={...input,requestId:crypto.randomUUID()};await images.create(p.id,failed);await Promise.all(images.work.values());assert.equal(images.get(p.id,failed.requestId).status,'failed');
});

test('有效共享 Key 遭独立上传服务拒绝时，以官方 Base64 直传参考，不换服务也不改原图',async t=>{
 const {dir}=await fixture(t),file=path.join(dir,'product.png');await fs.writeFile(file,image);
 const result=await uploadRunninghub(file,runninghubConfig(env),async()=>Response.json({code:1,message:'API Key不存在'}));assert.ok(result.startsWith('data:image/png;base64,'));assert.deepEqual(Buffer.from(result.split(',')[1],'base64'),image);assert.deepEqual(await fs.readFile(file),image);
});
