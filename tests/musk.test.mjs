import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
import {SettingsStore} from '../server/settings.mjs';
import {generateMuskImage,validateMuskDownload} from '../server/musk.mjs';
const image=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));
const env={MUSK_API_KEY:'isolated-musk-key',IMAGE_PROVIDER:'musk',VIDEO_PROVIDER:'runninghub'};
async function fixture(t,fetcher){const root=await fs.mkdtemp(path.join(os.tmpdir(),'frame-musk-test-'));const service=new ProjectService(root,async()=>{}),project=await service.createBlank('图像接入验证','产品广告');const images=new ImageGenerationService({service,getConfig:async()=>env,fetcher});await images.init();t.after(async()=>{await images.close();await fs.rm(root,{recursive:true,force:true});});return {root,service,project,images};}
test('Musk 默认文生图、参考图编辑、共享素材与重启恢复沿用同一任务链路',async t=>{
 const calls=[];const {root,service,project:p,images}=await fixture(t,async(url,o)=>{calls.push({url,...o});return Response.json({data:[{b64_json:image.toString('base64')}]});});
 const store=new SettingsStore(path.join(root,'.env'));await store.save({muskApiKey:env.MUSK_API_KEY,imageProvider:'musk',videoProvider:'runninghub'});const config=await store.loadInto({});assert.equal(config.muskConfigured,true);assert.equal(config.videoProvider,'runninghub');assert.doesNotMatch(JSON.stringify(config),/isolated-musk-key/);
 const tasks=new TaskRegistry().register('image',images);t.after(()=>tasks.close());
 const input={requestId:crypto.randomUUID(),name:'汽水主视觉',prompt:'竖屏汽水商业摄影',size:'1440x2560'};
 await images.create(p.id,input);await Promise.all(images.work.values());const done=tasks.get(p.id,'image:'+input.requestId);assert.equal(done.status,'succeeded');const a=(await service.get(p.id)).assets[0];assert.equal(a.name,'汽水主视觉.png');assert.equal(a.provenance.provider,'musk');assert.equal(JSON.parse(calls[0].body).size,'1152x2048');assert.equal(JSON.parse(calls[0].body).quality,'medium');
 const edit={requestId:crypto.randomUUID(),name:'汽水横版',prompt:'保留商品外观，将背景改成海边蓝色',imageFiles:[a.filename],size:'2368x1776',quality:'premium'};
 await images.create(p.id,edit);await Promise.all(images.work.values());assert.ok(calls[1].url.endsWith('/images/edits'));assert.ok(calls[1].body instanceof FormData);assert.equal(calls[1].headers['content-type'],undefined);assert.equal(calls[1].body.get('quality'),'high');assert.equal(calls[1].body.get('size'),'1536x1152');assert.deepEqual(Buffer.from(await calls[1].body.get('image').arrayBuffer()),image);
 const assets=(await service.get(p.id)).assets;assert.equal(assets.length,2);assert.deepEqual(assets.find(asset=>asset.provenance.taskId==='image:'+edit.requestId).provenance.inputAssetIds,[a.id]);assert.deepEqual(await fs.readFile(path.join(service.dir(p.id),'assets',a.filename)),image);
 const job=images.get(p.id,edit.requestId);job.status='downloading';await images.persist(job);const resumed=new ImageGenerationService({service,getConfig:async()=>({...env,IMAGE_PROVIDER:'runninghub'}),fetcher:()=>assert.fail('重启不应再次收费生成')});await resumed.init();await resumed.close();assert.equal((await service.get(p.id)).assets.length,2);assert.equal(resumed.get(p.id,job.id).status,'succeeded');
 await assert.rejects(images.create(p.id,{...edit,requestId:crypto.randomUUID(),imageFiles:['../../.env']}),/当前项目/);
});
test('Musk 分组权限错误可读、未知超时不重发，临时 URL 下载不携带密钥',async t=>{
 const {images,project:p}=await fixture(t,async()=>Response.json({error:{message:'Image generation is not enabled for this group',code:'403'}},{status:403}));const input={requestId:crypto.randomUUID(),prompt:'商业广告图片'};await images.create(p.id,input);await Promise.all(images.work.values());const failed=images.list(p.id)[0];assert.equal(failed.status,'failed');assert.equal(failed.failure.message,'当前密钥分组未开通图片生成');
 let calls=0;images.fetcher=async()=>{calls++;throw Error('timeout isolated-musk-key');};const retry={...input,requestId:crypto.randomUUID()};await images.create(p.id,retry);await Promise.all(images.work.values());await images.create(p.id,retry);assert.equal(calls,1);const unknown=images.list(p.id).find(j=>j.id===retry.requestId);assert.equal(unknown.failure.retryable,false);assert.doesNotMatch(JSON.stringify(unknown),/isolated-musk-key/);
 const result=await generateMuskImage({route:'/images/generations',headers:{},body:'{}'},{key:env.MUSK_API_KEY},async(url,o)=>{if(url.endsWith('/generations'))return Response.json({data:[{url:'https://api.muskapi.cc/generated/test.png'}]});assert.equal(o.headers?.Authorization,undefined);return new Response(image);});assert.deepEqual(result.bytes,image);assert.equal(result.extension,'.png');assert.throws(()=>validateMuskDownload('https://localhost/image.png'),/服务域名/);
});
