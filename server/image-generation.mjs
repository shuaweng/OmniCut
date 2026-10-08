import {publicSettings} from './settings.mjs';
import {runninghubConfig,runninghubRequest,runninghubImageBody,runninghubTask,uploadRunninghub,downloadRunninghub} from './runninghub.mjs';
import {muskConfig,muskImageRequest,generateMuskImage,MUSK_SIZES} from './musk.mjs';
import {mediaFailure} from './media-errors.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {assetPath,importAsset} from './assets.mjs';
export const SEEDREAM_MODEL='doubao-seedream-5-0-flash-260915';
const API='https://ark.cn-beijing.volces.com/api/v3';
const clean=(e,key)=>String(e?.message||e||'生成失败').replaceAll(key||'\0','[已隐藏]').replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);
export class ImageGenerationService {
 constructor({service,getConfig,fetcher=fetch,pollMs=5000,autoPoll=true}){Object.assign(this,{service,getConfig,fetcher,pollMs,autoPoll});this.timers=new Map();this.dir=path.join(service.dataRoot,'image-generations');this.jobs=new Map();this.listeners=new Set();this.queue=Promise.resolve();this.work=new Map();this.closed=false;}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 public(j){const {hash,...value}=j;const failure=j.error?mediaFailure(j.errorCode,j.error):null;if(failure&&j.provider==='musk'&&j.status==='unknown'){failure.nextAction='请先在服务商用量记录中核对结果，再决定是否重新生成。';failure.retryable=false;}return {...value,...(failure?{failure}:{}),taskId:'image:'+j.id};}
 list(projectId){return [...this.jobs.values()].filter(j=>j.projectId===projectId).map(j=>this.public(j));}
 get(projectId,id){const j=this.jobs.get(id);if(!j||j.projectId!==projectId)throw Error('图片任务不存在');return j;}
 async persist(j){j.updated=new Date().toISOString();const dest=path.join(this.dir,j.id+'.json');await fs.writeFile(dest+'.tmp',JSON.stringify(j,null,2),{mode:0o600});await fs.rename(dest+'.tmp',dest);for(const fn of this.listeners){try{fn(this.public(j));}catch{}}}
 async init(){
  await fs.mkdir(this.dir,{recursive:true});
  for(const f of await fs.readdir(this.dir)){
   if(!/^[a-f0-9-]{36}\.json$/.test(f))continue;
   const j=JSON.parse(await fs.readFile(path.join(this.dir,f),'utf8'));this.jobs.set(j.id,j);
   if(['submitting','queued','running','recovering','downloading'].includes(j.status)){
    try{await this.cachedFile(j);await this.ingest(j);}
    catch{if(j.provider==='runninghub'&&j.remoteId)this.schedule(j.id);else{j.status='unknown';j.error='上次生成被中断，请核对结果后再决定是否重新生成';await this.persist(j);}}
   }
  }
 }
 async configuration(){const c=publicSettings(await this.getConfig());return {provider:c.imageProvider,model:c.imageProvider==='musk'?c.muskImageModel:c.imageProvider==='runninghub'?c.runninghubImageModel:c.seedreamModel,configured:c.imageProvider==='musk'?c.muskConfigured:c.imageProvider==='runninghub'?c.runninghubConfigured:c.seedanceConfigured,maxReferenceImages:c.imageProvider==='runninghub'?10:4,sizes:Object.keys(MUSK_SIZES),...(c.imageProvider==='musk'?{outputSizes:MUSK_SIZES,defaultQuality:'medium'}:{})};}
 create(projectId,input){const pending=this.queue.then(()=>this.start(projectId,input));this.queue=pending.catch(()=>{});return pending;}
 async start(projectId,input){
  if(this.closed)throw Error('图片服务已停止');
  if(!/^[a-f0-9-]{36}$/.test(input.requestId)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000)throw Error('图片生成参数无效');
  const env=await this.getConfig(),provider=input.provider||publicSettings(env).imageProvider;
  if(!['seedream','runninghub','musk'].includes(provider))throw Error('图像服务无效');
  const imageFiles=input.imageFiles||[],size=input.size||'1440x2560',maxImages=provider==='runninghub'?10:4;
  if(!Array.isArray(imageFiles)||imageFiles.length>maxImages||imageFiles.some(f=>typeof f!=='string')||new Set(imageFiles).size!==imageFiles.length)throw Error('最多使用 '+maxImages+' 张不同的参考图');
  if(!['1440x2560','2560x1440','2048x2048','2368x1776','1776x2368'].includes(size))throw Error('不支持的图片尺寸');
  const values={...(input.provider?{provider:input.provider}:{}),name:typeof input.name==='string'?input.name.trim().slice(0,60):'',quality:input.quality==='premium'?'premium':'configured',prompt:input.prompt.trim(),imageFiles,size},hash=crypto.createHash('sha256').update(JSON.stringify({projectId,...values})).digest('hex');
  const prior=this.jobs.get(input.requestId);if(prior){if(prior.projectId!==projectId||prior.hash!==hash)throw Error('任务 ID 已用于其他请求');return this.public(prior);}
  const p=await this.service.get(projectId);
  if(provider==='musk'){
   const config=muskConfig(env),files=[];
   for(const file of imageFiles){if(!p.assets.some(a=>a.filename===file&&a.kind==='image'))throw Error('参考图必须来自当前项目素材库');files.push(await assetPath(this.service.dir(projectId),file));}
   const request=await muskImageRequest(values,config,files);
   const job={id:input.requestId,projectId,hash,...values,provider,model:config.model,outputSize:request.size,generationQuality:request.quality,status:'running',created:new Date().toISOString()};this.jobs.set(job.id,job);await this.persist(job);
   this.track(job.id,()=>this.executeMusk(job,request,config));return this.public(job);
  }
  if(provider==='runninghub'){
   const config=runninghubConfig(env,'image');runninghubImageBody(values);
   for(const file of imageFiles)if(!p.assets.some(a=>a.filename===file&&a.kind==='image'))throw Error('参考图必须来自当前项目素材库');
   const job={id:input.requestId,projectId,hash,...values,provider,model:config.model,status:'submitting',created:new Date().toISOString()};this.jobs.set(job.id,job);await this.persist(job);
   this.track(job.id,()=>this.submitRunninghub(job,config));return this.public(job);
  }
  if(!env.ARK_API_KEY)throw Error('请先填写火山方舟 API Key');if((env.ARK_BASE_URL||API).replace(/\/$/,'')!==API)throw Error('图片生成仅支持火山方舟官方北京接口');
  const model=values.quality==='premium'?'doubao-seedream-5-0-pro-260628':env.SEEDREAM_MODEL||SEEDREAM_MODEL;if(!/^(doubao-seedream-[a-z0-9-]+-\d{6}|ep-[a-zA-Z0-9-]+)$/.test(model))throw Error('Seedream 模型 ID 无效');
  const images=[];for(const file of imageFiles){const a=p.assets.find(a=>a.filename===file&&a.kind==='image');if(!a)throw Error('参考图必须来自当前项目素材库');const bytes=await fs.readFile(await assetPath(this.service.dir(projectId),file));if(bytes.length>10e6)throw Error('参考图不能超过 10 MB');images.push('data:image/'+(({'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp','.gif':'gif','.avif':'avif'})[path.extname(file)]||'jpeg')+';base64,'+bytes.toString('base64'));}
  const job={id:input.requestId,projectId,hash,...values,model,status:'running',created:new Date().toISOString()};this.jobs.set(job.id,job);await this.persist(job);
  const payload={model,prompt:values.prompt,size,output_format:'jpeg',response_format:'b64_json',watermark:false,...(images.length?{image:images}: {})};
  const work=this.execute(job,payload,env.ARK_API_KEY).finally(()=>this.work.delete(job.id));this.work.set(job.id,work);return this.public(job);
 }
 async execute(job,payload,key){let received=false;
  try{const response=await this.fetcher(API+'/images/generations',{method:'POST',headers:{Authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(180000)});
   const data=await response.json();if(!response.ok){const error=Error(data.error?.message||'火山图片生成失败');error.definitive=response.status>=400&&response.status<500&&response.status!==408;error.code=data.error?.code;throw error;}
   received=true;const item=data.data?.[0];if(item?.error){const e=Error(item.error.message);e.definitive=true;throw e;}
   if(typeof item?.b64_json!=='string'||item.b64_json.length>16e6||!item.b64_json.length)throw Error('图片结果缺失或超过 12 MB');
   await fs.writeFile(path.join(this.dir,job.id+'.jpg'),Buffer.from(item.b64_json,'base64'),{mode:0o600});job.status='downloading';await this.persist(job);await this.ingest(job);
  }catch(e){job.status=e.definitive?'failed':received?'blocked':'unknown';job.error=clean(e,key);if(e.code)job.errorCode=String(e.code).slice(0,80);await this.persist(job);}
 }
 track(id,operation){if(this.work.has(id))return this.work.get(id);const task=operation().finally(()=>this.work.delete(id));this.work.set(id,task);return task;}
 async executeMusk(job,request,config){let received=false;
  try{
   const result=await generateMuskImage(request,config,this.fetcher);received=true;job.outputExtension=result.extension;
   const file=path.join(this.dir,job.id+result.extension);await fs.writeFile(file+'.tmp',result.bytes,{mode:0o600});await fs.rename(file+'.tmp',file);
   job.status='downloading';await this.persist(job);await this.ingest(job);
  }catch(e){job.status=e.definitive?'failed':received||e.received?'blocked':'unknown';job.error=clean(e,config.key);if(e.code)job.errorCode=String(e.code).slice(0,80);await this.persist(job);}
 }
 async submitRunninghub(job,config){
  let submitted=false;
  try{
   const urls=[];for(const file of job.imageFiles)urls.push(await uploadRunninghub(await assetPath(this.service.dir(job.projectId),file),config,this.fetcher));
   const {route,body}=runninghubImageBody(job,urls);submitted=true;
   const result=await runninghubRequest(config,route,body,this.fetcher);
   if(typeof result.taskId!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(result.taskId))throw Error('RunningHub 未返回有效任务 ID');
   job.remoteId=result.taskId;job.status='queued';await this.persist(job);this.schedule(job.id);
  }catch(e){job.status=job.remoteId?'paused':!submitted||e.definitive?'failed':'unknown';job.error=clean(e,config.key);if(e.providerCode)job.errorCode=e.providerCode;await this.persist(job);}
 }
 schedule(id,delay=this.pollMs){if(this.closed||!this.autoPoll)return;clearTimeout(this.timers.get(id));const timer=setTimeout(()=>{this.timers.delete(id);this.poll(id).catch(()=>{});},delay);timer.unref();this.timers.set(id,timer);}
 poll(id){return this.track(id,()=>this.advanceRunninghub(id));}
 async advanceRunninghub(id){
  const job=this.jobs.get(id);if(job?.provider!=='runninghub'||!job.remoteId||['succeeded','failed'].includes(job.status))return job&&this.public(job);
  let config;
  try{
   config=runninghubConfig(await this.getConfig(),'image');
   const result=runninghubTask(await runninghubRequest(config,'/openapi/v2/query',{taskId:job.remoteId},this.fetcher),'image');
   delete job.error;delete job.errorCode;if(result.usage)job.usage=result.usage;
   if(result.status==='succeeded'){
    job.status='downloading';await this.persist(job);if(!result.url)throw Error('RunningHub 未返回生成图片');
    await fs.writeFile(path.join(this.dir,job.id+'.jpg'),await downloadRunninghub(result.url,this.fetcher,12e6),{mode:0o600});await this.ingest(job);
   }else{job.status=result.status;if(result.status==='failed'){job.error=clean(result.error.message||'图片生成失败',config.key);job.errorCode=result.error.code;}}
   delete job.pollFailures;await this.persist(job);if(['running','queued'].includes(job.status))this.schedule(id);
  }catch(e){job.pollFailures=(job.pollFailures||0)+1;const recover=!e.definitive&&job.pollFailures<=4;job.status=recover?'recovering':'paused';job.error=clean(e,config?.key);if(e.providerCode)job.errorCode=e.providerCode;await this.persist(job);if(recover)this.schedule(id,[5000,15000,45000,120000][job.pollFailures-1]);}
  return this.public(job);
 }
 async cachedFile(job){for(const ext of ['.jpg','.png','.webp']){if(job.outputExtension&&ext!==job.outputExtension)continue;const file=path.join(this.dir,job.id+ext);try{await fs.access(file);return file;}catch{}}throw Error('图片结果尚未保存');}
 async ingest(job){const p=await this.service.get(job.projectId);let asset=p.assets.find(a=>a.provenance?.taskId==='image:'+job.id);
  if(!asset){const file=await this.cachedFile(job);asset=await importAsset(this.service.dir(job.projectId),await fs.readFile(file),(job.name||job.prompt.slice(0,24))+path.extname(file),{taskId:'image:'+job.id,provider:job.provider||'seedream',model:job.model,inputAssetIds:p.assets.filter(a=>job.imageFiles.includes(a.filename)).map(a=>a.id)});}
  job.assetFile=asset.filename;job.assetId=asset.id;job.status='succeeded';delete job.error;await this.persist(job);
 }
 async close(){this.closed=true;for(const timer of this.timers.values())clearTimeout(timer);await Promise.allSettled(this.work.values());}
}
