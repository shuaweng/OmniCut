import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {ProjectService,root} from '../server/project.mjs';
import {GenerationService} from '../server/generation.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {AudioGenerationService} from '../server/audio-generation.mjs';
import {TranscriptionService} from '../server/transcription.mjs';
import {ReferenceService} from '../server/reference.mjs';
import {NativeBuilds} from '../server/native-builds.mjs';
import {initializeProjectRuntimes,restoreExportJobs} from '../server/startup-recovery.mjs';
import {readStoredRecord,CorruptRecordError} from '../server/record-recovery.mjs';

async function fixture(t){
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-startup-recovery-'));
 t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const service=new ProjectService(data,async()=>{}),project=await service.createBlank('可继续制作的正常项目');
 return {data,service,project};
}
const task=(project,id,status)=>({id,projectId:project.id,status,name:'隔离恢复任务',created:'2026-10-09T00:00:00.000Z'});
async function record(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value));}

test('坏 project/pending/runtime 不阻塞其他项目，保留原文件并提供损坏列表条目',async t=>{
 const {service,project}=await fixture(t);
 const badMeta=await service.createBlank('坏元数据'),badPending=await service.createBlank('坏恢复记录'),badRuntime=await service.createBlank('坏运行配置');
 const bad='{"fake_private_value":"synthetic-private",';
 const files=[path.join(service.dir(badMeta.id),'project.json'),path.join(service.dir(badPending.id),'pending.json'),path.join(service.dir(badRuntime.id),'hypit.runtime.json')];
 for(const file of files)await fs.writeFile(file,bad);
 const healthyDir=service.dir(project.id),meta=JSON.parse(await fs.readFile(path.join(healthyDir,'project.json'),'utf8'));
 const original=await service.raw(project.id),next={source:original.source+'\n<!-- 已完成的隔离恢复 -->',style:original.style};
 meta.version++;await record(path.join(healthyDir,'pending.json'),{old:original,next,meta});
 await service.recover();await initializeProjectRuntimes(service,path.join(root,'template/hypit.runtime.json'));
 const listed=await service.list();assert.equal(listed.length,4);
 assert.equal(listed.find(p=>p.id===project.id).corrupt,undefined);
 assert.match((await service.raw(project.id)).source,/已完成的隔离恢复/);
 for(const p of [badMeta,badPending,badRuntime]){
  const row=listed.find(x=>x.id===p.id);assert.equal(row.corrupt,true);assert.match(row.name,/资料损坏/);assert.match(row.recoveryError,/原文件已保留/);
  assert.ok(Array.isArray(row.assets)&&Array.isArray(row.shots));await assert.rejects(service.get(p.id),CorruptRecordError);
 }
 for(const file of files){assert.equal(await fs.readFile(file,'utf8'),bad);const diagnostic=await fs.readFile(file+'.recovery.json','utf8');assert.doesNotMatch(diagnostic,/synthetic-private|fake_private_value/);assert.match(diagnostic,/损坏/);}
 await assert.rejects(service.get('p-ffffffffffff'),{status:404});
});

test('合法 JSON 但无效结构也隔离，不把 null history 洗成正常项目',async t=>{
 const {service,project}=await fixture(t),file=path.join(service.dir(project.id),'project.json');
 const meta=JSON.parse(await fs.readFile(file,'utf8'));meta.history=[null];const original=JSON.stringify(meta);await fs.writeFile(file,original);
 const [listed]=await service.list();assert.equal(listed.corrupt,true);assert.equal(await fs.readFile(file,'utf8'),original);
});

test('各媒体 init 隔离坏记录并保留既有 unknown/interrupted 恢复语义，不发请求',async t=>{
 const {service,project}=await fixture(t);let networkCalls=0;
 const options={service,getConfig:async()=>({}),fetcher:async()=>{networkCalls++;throw Error('不允许调用模型');},autoPoll:false};
 const services=[new GenerationService(options),new ImageGenerationService(options),new AudioGenerationService(options),new TranscriptionService(options)];
 const states=['submitting','submitting','running','queued'],expected=['unknown','unknown','unknown','interrupted'];
 for(let i=0;i<services.length;i++){
  const media=services[i],goodId=crypto.randomUUID(),badId=crypto.randomUUID(),badFile=path.join(media.dir,badId+'.json'),bad='{"fake_private_value":"synthetic-task-private",';
  await record(path.join(media.dir,goodId+'.json'),{...task(project,goodId,states[i]),provider:'fixture',extension:'mp3'});await record(badFile,bad);
  await media.init();assert.equal(media.list(project.id).length,1);assert.equal(media.list(project.id)[0].status,expected[i]);assert.equal(media.recoveryDiagnostics.length,1);
  assert.equal(await fs.readFile(badFile,'utf8'),bad);assert.doesNotMatch(await fs.readFile(badFile+'.recovery.json','utf8'),/synthetic-task-private|fake_private_value/);
  await media.close?.();
 }
 assert.equal(networkCalls,0);
});

test('参考、工程和导出恢复跳过单条坏记录，正常运行中记录仍按原语义中断',async t=>{
 const {data,service,project}=await fixture(t);
 const refs=new ReferenceService({service,getConfig:async()=>({})}),native=new NativeBuilds({service,engine:{}}),jobs=new Map();
 const base=[refs.dir,native.base,path.join(data,'exports')],filenames=['reference.json','job.json','job.json'];
 const goods=[],bads=[];
 for(let i=0;i<base.length;i++){
  const good=crypto.randomUUID(),bad=crypto.randomUUID(),badFile=path.join(base[i],bad,filenames[i]);goods.push(good);bads.push(badFile);
  await record(path.join(base[i],good,filenames[i]),{...task(project,good,i?'running':'analyzing'),ratio:'9:16',plan:{scenes:[]}});await record(badFile,'{');
 }
 await refs.init();await native.init();const diagnostics=await restoreExportJobs(base[2],jobs);
 assert.equal(refs.items.get(goods[0]).status,'interrupted');assert.equal(native.jobs.get(goods[1]).status,'interrupted');assert.equal(jobs.get(goods[2]).status,'interrupted');
 assert.equal(refs.recoveryDiagnostics.length,1);assert.equal(native.recoveryDiagnostics.length,1);assert.equal(diagnostics.length,1);
 for(const file of bads){assert.equal(await fs.readFile(file,'utf8'),'{');await fs.access(file+'.recovery.json');}
});

test('真实存储错误不当成坏数据跳过，诊断写入 ENOSPC 也会向上抛出',async t=>{
 const {data}=await fixture(t),file=path.join(data,'read-denied.json'),bad=path.join(data,'broken.json');
 await record(file,{valid:true});await record(bad,'{');
 const originalRead=fs.readFile,originalWrite=fs.writeFile;
 t.after(()=>{fs.readFile=originalRead;fs.writeFile=originalWrite;});
 fs.readFile=async(filename,...args)=>{if(filename===file)throw Object.assign(Error('隔离 EACCES 注入'),{code:'EACCES'});return originalRead(filename,...args);};
 await assert.rejects(readStoredRecord(file),{code:'EACCES'});await assert.rejects(fs.access(file+'.recovery.json'),{code:'ENOENT'});
 fs.writeFile=async(filename,...args)=>{if(String(filename).startsWith(bad+'.recovery.json.'))throw Object.assign(Error('隔离 ENOSPC 注入'),{code:'ENOSPC'});return originalWrite(filename,...args);};
 await assert.rejects(readStoredRecord(bad),{code:'ENOSPC'});assert.equal(await fs.readFile(bad,'utf8'),'{');
});

test('声音缓存的权限错误不被改写为 unknown 后继续启动',async t=>{
 const {service,project}=await fixture(t),audio=new AudioGenerationService({service,getConfig:async()=>({})}),id=crypto.randomUUID();
 const file=path.join(audio.dir,id+'.json'),cache=path.join(audio.dir,id+'.mp3'),value={...task(project,id,'running'),extension:'mp3'};await record(file,value);
 const originalAccess=fs.access;t.after(()=>{fs.access=originalAccess;});
 fs.access=async(filename,...args)=>{if(filename===cache)throw Object.assign(Error('隔离 EPERM 注入'),{code:'EPERM'});return originalAccess(filename,...args);};
 await assert.rejects(audio.init(),{code:'EPERM'});assert.equal(JSON.parse(await fs.readFile(file,'utf8')).status,'running');
});

test('已结束导出遗留的运行时只在启动时停止一次',async t=>{
 const {data,project}=await fixture(t),exports=path.join(data,'exports'),ids=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
 await record(path.join(exports,ids[0],'job.json'),task(project,ids[0],'running'));
 await record(path.join(exports,ids[1],'job.json'),task(project,ids[1],'done'));
 await record(path.join(exports,ids[2],'job.json'),{...task(project,ids[2],'done'),runtimeStopped:true});
 const stopped=[];let settle;const finished=new Promise(resolve=>settle=resolve);
 const stopRuntime=async dir=>{stopped.push(path.basename(dir));if(stopped.length===2)setTimeout(settle,50);};
 await restoreExportJobs(exports,new Map(),{stopRuntime});await finished;
 assert.deepEqual(stopped.sort(),[ids[0],ids[1]].sort(),'中断和已完成的导出都补停一次，已标记的跳过');
 for(const id of ids)assert.equal(JSON.parse(await fs.readFile(path.join(exports,id,'job.json'),'utf8')).runtimeStopped,true);
 stopped.length=0;await restoreExportJobs(exports,new Map(),{stopRuntime});await new Promise(resolve=>setTimeout(resolve,50));
 assert.deepEqual(stopped,[],'再次启动不重复停止');
});
