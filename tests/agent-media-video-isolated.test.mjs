import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService} from '../server/project.mjs';
import {GenerationService} from '../server/generation.mjs';
import {OperationStore,productionIdentity,mediaOperationIdentity} from '../server/operation-store.mjs';
import {mediaOperationInput,prepareAgentMedia} from '../server/agent-media.mjs';
import {conversationWorkspace} from '../server/conversation-workspace.mjs';
import {assetPath} from '../server/assets.mjs';

test('Agent identities backfill each video; waiting results prepare their actual video without default workspace writes',async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-agent-media-target-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const service=new ProjectService(data,async()=>{}),p=await service.create('假服务隔离验证'),a=await service.createVariant(p.id,{name:'A'}),b=await service.createVariant(p.id,{name:'B'});
 const assetId=crypto.randomUUID(),filename=assetId+'.png',asset={id:assetId,filename,kind:'image',name:'假素材',width:540,height:960,created:'2026-10-09T00:00:00Z'};
 // Inert bytes and metadata: no probing, rendering, network or media provider participates.
 await fs.writeFile(path.join(service.projectDir(p.id),'assets',filename),'INERT_FIXTURE_BYTES');await fs.writeFile(path.join(service.projectDir(p.id),'assets',assetId+'.asset.json'),JSON.stringify(asset));
 const operations=await new OperationStore(data).init(),generation=new GenerationService({service,getConfig:async()=>({}),autoPoll:false,fetcher:async()=>assert.fail('禁止真实请求')});await generation.init();t.after(()=>generation.close());
 const submissions=[],refs=new Map();
 async function submitVideo(target){return service.withVideoContext(p.id,target,async()=>{
  const project=await service.get(p.id),input=mediaOperationInput(project,'generate',{autoApply:true,shotId:'shot-2',prompt:'相同镜头',assetFile:filename});
  return operations.runMedia({projectId:p.id,productionId:productionIdentity(project),operation:'generate',operationId:'G1',input},async id=>{
   submissions.push(input.videoId);const job={id,projectId:p.id,videoId:input.videoId,created:'2026-10-09T00:00:00Z',status:'succeeded',autoApply:true,preserveTiming:true,shotId:'shot-2',baseShot:project.shots[1],assetFile:filename};
   generation.jobs.set(id,job);await generation.persist(job);await generation.complete(job);return generation.public(job);
  },id=>generation.jobs.get(id));
 });}
 const one=await submitVideo(a.videoId),two=await submitVideo(b.videoId);assert.notEqual(one.id,two.id);assert.equal((await submitVideo(a.videoId)).id,one.id);assert.deepEqual(submissions,[a.videoId,b.videoId]);
 for(const target of [a.videoId,b.videoId])assert.equal((await service.getVideo(p.id,target)).shots[1].assetFile,filename);assert.deepEqual((await service.get(p.id)).shots,p.shots);
 for(const project of [a,b]){
  const input=mediaOperationInput(project,'reference-analyze',{videoId:'v-default',assetFile:filename,brief:'相同参考要求'});
  const item=await operations.runMedia({projectId:p.id,productionId:'media-evidence-'+p.id,operation:'reference-analyze',operationId:'R1',input},async id=>{const result={id,videoId:input.videoId};refs.set(id,result);return result;},id=>refs.get(id));assert.equal(item.videoId,project.videoId);
 }
 assert.equal(refs.size,2);
 for(const operation of ['generate','reference-analyze']){
  const legacyInput={...(operation==='generate'?{autoApply:true}:{}),prompt:'旧默认任务'},scope={projectId:p.id,productionId:productionIdentity(p),operation,operationId:'LEGACY'};
  const current=mediaOperationInput(p,operation,{...legacyInput,videoId:'v-default'});assert.equal(current.videoId,undefined);assert.equal(mediaOperationIdentity({...scope,input:current}).key,mediaOperationIdentity({...scope,input:legacyInput}).key);
 }
 for(const operation of ['generate-image','generate-audio']){
  const scope=project=>({projectId:p.id,productionId:productionIdentity(project),operation,operationId:'SHARED',input:mediaOperationInput(project,operation,{videoId:project.videoId,prompt:'共享素材'})});
  assert.equal(mediaOperationIdentity(scope(a)).key,mediaOperationIdentity(scope(b)).key);
 }
 const cid='c-aaaaaaaaaaaa',prepared=[],engine={async readyAssets(id,files){
  const videoId=service.currentVideoId(id),workspace=conversationWorkspace(data,id),directory=path.join(workspace,'hypit');prepared.push({videoId,workspace});await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'prepared-sentinel'),files.join('\n'));
  assert.equal(await fs.readFile(await assetPath(service.dir(id),filename),'utf8'),'INERT_FIXTURE_BYTES');
  return {directory,assets:files.map(assetFile=>({assetFile,editing:{document:'prepared/'+assetFile+'.svml'}}))};
 }};
 await service.withVideoContext(p.id,b.videoId,async()=>{
  const results=await prepareAgentMedia({service,engine},p.id,[{kind:'video',videoId:b.videoId,result:{assetFile:filename}},{kind:'image',videoId:a.videoId,result:{assetFile:filename}}],cid,{respectJobVideo:true});
  assert.deepEqual(prepared.map(row=>row.videoId),[b.videoId,a.videoId]);assert.ok(prepared.every(row=>row.workspace.includes('/conversations/'+cid+'/videos/')));
  assert.deepEqual(results.map(item=>item.result.editing.videoId),[b.videoId,a.videoId]);assert.equal(results[0].result.editing.workspaceDirectory,conversationWorkspace(data,p.id,cid));
  // A reused raw image is immediately prepared for the caller's B workspace.
  const [shared]=await prepareAgentMedia({service,engine},p.id,[{videoId:a.videoId,assetFile:filename}],cid);assert.equal(shared.editing.videoId,b.videoId);
  const [invalid]=await prepareAgentMedia({service,engine},p.id,[{videoId:'v-ffffffffffff',assetFile:filename}],cid,{respectJobVideo:true});assert.match(invalid.editingWarning,/不属于当前项目/);assert.equal(prepared.length,3);assert.equal(service.currentVideoId(p.id),b.videoId);
 });
 assert.equal(service.currentVideoId(p.id),'v-default');await assert.rejects(fs.access(path.join(conversationWorkspace(data,p.id,cid),'hypit','prepared-sentinel')),{code:'ENOENT'});
});
