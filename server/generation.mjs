import {runninghubConfig,runninghubRequest,runninghubVideoBody,runninghubTask,uploadRunninghub,downloadRunninghub,RUNNINGHUB_VIDEO_RESOLUTIONS} from './runninghub.mjs';
import {minimaxConfig,minimaxVideoBody,minimaxResult,validateMinimaxDownload} from './minimax.mjs';
import {publicSettings} from './settings.mjs';
import {mediaFailure} from './media-errors.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateSeedanceModel } from './seedance-models.mjs';
import {validShotId} from './storyboard.mjs';
import { assetPath,importAsset } from './assets.mjs';
const API='https://ark.cn-beijing.volces.com/api/v3';
const ACTIVE=new Set(['submitting','queued','running','downloading','recovering']);
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
function safeError(error,key){let text=String(error?.message||error||'生成失败');if(key)text=text.replaceAll(key,'[已隐藏]');return text.replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);}
export function validateGeneration(input){
 if(!input||typeof input!=='object'||!validId(input.requestId)||!(validShotId(input.shotId)||!input.shotId&&input.autoApply===false))throw Error('生成参数无效');
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>2000)throw Error('请填写 1–2000 字的镜头描述');
 if(!Number.isInteger(input.duration)||input.duration<4||input.duration>15)throw Error('生成时长需为 4–15 秒');
 if(input.provider&&!['seedance','minimax','runninghub'].includes(input.provider))throw Error('视频服务无效');
 if(input.resolution!==undefined&&!['480p','720p','768p','1080p','480P','768P','2K'].includes(input.resolution)||typeof input.audio!=='boolean')throw Error('生成规格无效');
 if(input.imageFile!==null&&typeof input.imageFile!=='string')throw Error('首帧图片无效');
 if(input.imageMode!==undefined&&!['first_frame','reference_image'].includes(input.imageMode))throw Error('图片参考模式无效');
 if(input.confirmed!==true)throw Error('请点击生成视频确认提交');
 if(input.references!==undefined&&(!Array.isArray(input.references)||input.references.length>12||input.references.some(r=>!r||!['reference_image','first_frame','last_frame','reference_video','reference_audio'].includes(r.role)||typeof(r.file||r.url)!=='string')))throw Error('参考素材参数无效');
 if(input.audioMode!==undefined&&!['native','reference_only','lock_source','remix_source'].includes(input.audioMode))throw Error('视频声音模式无效');
 if(input.drivingAudioFile!==undefined&&typeof input.drivingAudioFile!=='string')throw Error('驱动音频无效');
 return {...(input.audioMode?{audioMode:input.audioMode}:{}),...(input.drivingAudioFile?{drivingAudioFile:input.drivingAudioFile}:{}),provider:input.provider,name:typeof input.name==='string'?input.name.trim().slice(0,60):'',quality:input.quality==='premium'?'premium':'configured',references:input.references||[],ratio:input.ratio||'9:16',shotId:input.shotId,prompt:input.prompt.trim(),duration:input.duration,resolution:input.resolution,audio:input.audio,imageFile:input.imageFile,...(input.imageMode?{imageMode:input.imageMode}:{})};
}
export function validateDownloadUrl(raw){
 const url=new URL(raw);
 const hosts=['volces.com','volccdn.com','byteimg.com','ibyteimg.com','bytecdn.cn','bytedance.net','doubao.com'];
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!hosts.some(h=>url.hostname.endsWith('.'+h)))throw Error('生成视频的下载地址不在火山服务域名内');
 return url.href;
}
async function download(url,fetcher,provider){
 if(provider==='runninghub')return downloadRunninghub(url,fetcher);
 const response=await fetcher(provider==='minimax'?validateMinimaxDownload(url):validateDownloadUrl(url),{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('视频下载失败，可重试获取');
 if(Number(response.headers.get('content-length'))>80e6)throw Error('生成视频超过 80 MB');
 const parts=[];let size=0;
 for await(const part of response.body){size+=part.length;if(size>80e6)throw Error('生成视频超过 80 MB');parts.push(part);}
 return Buffer.concat(parts);
}
export class GenerationService {
 constructor({service,getConfig,fetcher=fetch,pollMs=5000,autoPoll=true}){this.service=service;this.getConfig=getConfig;this.fetcher=fetcher;this.pollMs=pollMs;this.autoPoll=autoPoll;this.listeners=new Set();this.jobs=new Map();this.timers=new Map();this.locks=new Map();this.submitQueue=Promise.resolve();this.closed=false;this.dir=path.join(service.dataRoot,'generations');}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 async init(){await fs.mkdir(this.dir,{recursive:true});for(const file of await fs.readdir(this.dir)){if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;const job=JSON.parse(await fs.readFile(path.join(this.dir,file),'utf8'));this.jobs.set(job.id,job);if(job.status==='submitting'&&!job.remoteId){job.status='unknown';job.error='提交结果未知，请先在对应服务商控制台核对任务，避免重复扣费';await this.persist(job);}else if(ACTIVE.has(job.status)||job.status==='recovering')this.schedule(job.id);else if(job.status==='succeeded'&&job.autoApply&&!job.appliedRevision&&!job.applyError)await this.complete(job);}}
 async persist(job){job.updated=new Date().toISOString();const dest=path.join(this.dir,job.id+'.json'),temp=dest+'.tmp';await fs.writeFile(temp,JSON.stringify(job,null,2),{mode:0o600});await fs.rename(temp,dest);for(const fn of this.listeners){try{fn(this.public(job));}catch{}}}
 public(job){const {requestHash,baseUrl,...value}=job;return {...value,...(job.error?{failure:mediaFailure(job.errorCode,job.error)}:{}),taskId:'video:'+job.id};}
 list(projectId){return [...this.jobs.values()].filter(j=>j.projectId===projectId).sort((a,b)=>b.created.localeCompare(a.created)).map(j=>this.public(j));}
 get(projectId,id){const job=this.jobs.get(id);if(!job||job.projectId!==projectId)throw Object.assign(Error('生成任务不存在'),{status:404});return job;}
 async multiReference(project,references,config){const content=[];let images=0,videos=0,audios=0,audioDuration=0,videoDuration=0;for(const ref of references){const type=ref.role==='reference_video'?'video':ref.role==='reference_audio'?'audio':'image';if(type==='image')images++;else if(type==='audio')audios++;else videos++;let url=ref.url;if(url){const u=new URL(url);if(!/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)&&(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||/^\d+\./.test(u.hostname)))throw Error('参考地址需为有效的 HTTPS 公网素材地址');}else{const a=project.assets.find(a=>a.filename===ref.file&&a.kind===type);if(!a)throw Error('参考素材不存在或类型不匹配');if(type==='image'){url=await this.reference(project,{imageFile:ref.file});}else if(type==='audio'){audioDuration+=a.duration;if(!/\.(wav|mp3)$/.test(a.filename)||a.duration<2||a.duration>15)throw Error('参考音频需为 2–15 秒 WAV/MP3');const bytes=await fs.readFile(await assetPath(this.service.dir(project.id),a.filename));if(bytes.length>15e6)throw Error('参考音频超过 15 MB');url='data:audio/'+path.extname(a.filename).slice(1)+';base64,'+bytes.toString('base64');}else{videoDuration+=a.duration;if(config.provider==='minimax'){if(a.duration<2||a.duration>15||videoDuration>15)throw Error('参考视频总长需为 2–15 秒');const bytes=await fs.readFile(await assetPath(this.service.dir(project.id),a.filename));if(bytes.length>35e6)throw Error('本地参考视频超过 35 MB，请先裁剪');url='data:video/'+(path.extname(a.filename)==='.mov'?'quicktime':'mp4')+';base64,'+bytes.toString('base64');}else{const job=this.jobs.get(a.provenance?.taskId?.replace('video:',''));if(job?.provider==='minimax')throw Error('Seedance 参考该视频需要可访问的公网素材 URL；也可用 MiniMax 直接参考本地视频');if(!job?.remoteId)throw Error('本地参考视频需要火山素材 ID 或公网 URL；已由 Seedance 生成的素材可直接复用');const result=await this.request('/contents/generations/tasks/'+job.remoteId,config);url=result.content?.video_url;if(!url)throw Error('生成视频参考地址已失效');}}}if(images>9||videos>3||audios>3||audioDuration>15||videoDuration>15)throw Error('参考素材超出 Seedance 2.0 限制');content.push({type:type+'_url',[type+'_url']:{url},role:ref.role});}return content;}
 async runninghubReferences(project,values,config){
  const refs=[...(values.imageFile?[{file:values.imageFile,role:values.imageMode||'first_frame'}]:[]),...values.references,...(values.drivingAudioFile?[{file:values.drivingAudioFile,role:'driving_audio'}]:[])];
  const content=refs.map(ref=>{const type=ref.role==='reference_video'?'video':['reference_audio','driving_audio'].includes(ref.role)?'audio':'image';return {type:type+'_url',[type+'_url']:{url:ref.url||ref.file},role:ref.role};});
  runninghubVideoBody(values,content);
  const uploaded=new Map();
  for(let i=0;i<refs.length;i++){
   const ref=refs[i],type=content[i].type.replace('_url','');let url=ref.url;
   if(url){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||u.hostname.includes(':')||/^\d+\./.test(u.hostname))throw Error('参考地址需为 HTTPS 公网素材地址');}
   else{
    let file;
    if(ref.file==='__product__'&&type==='image'){const {source}=await this.service.raw(project.id),filename=source.match(/id="product-image" src="\.\/assets\/([a-f0-9-]+\.(?:png|jpg))"/)?.[1];if(!filename)throw Error('商品图不存在');file=path.join(this.service.dir(project.id),'assets',filename);}
    else{const a=project.assets.find(a=>a.filename===ref.file&&a.kind===type);if(!a)throw Error('参考素材不存在或类型不匹配');if(type!=='image'&&(!a.duration||a.duration>15))throw Error('参考视频或音频请先裁剪至 15 秒以内');file=await assetPath(this.service.dir(project.id),ref.file);}
    if(!uploaded.has(file))uploaded.set(file,await uploadRunninghub(file,config,this.fetcher));url=uploaded.get(file);
   }
   content[i][type+'_url'].url=url;
  }
  return content;
 }
 async configuration(){const c=publicSettings(await this.getConfig());return {provider:c.videoProvider,seedanceConfigured:c.seedanceConfigured,seedanceModel:c.seedanceModel,minimaxConfigured:c.minimaxConfigured,minimaxModel:c.minimaxVideoModel,runninghubConfigured:c.runninghubConfigured,runninghubModel:c.runninghubVideoModel,providers:{runninghub:{resolutions:RUNNINGHUB_VIDEO_RESOLUTIONS,nativeAudio:true,localReferences:true,maxImages:9,maxVideos:3,maxAudio:3,duration:{min:4,max:15},audioModes:['native','reference_only','lock_source','remix_source'],priceSource:'https://www.runninghub.cn/call-api/search-api/standard-model'},seedance:{resolutions:['480p','720p','1080p']},minimax:{resolutions:c.minimaxVideoModel==='MiniMax-H3-Max'?['480P','768P']:['768P','2K'],nativeAudio:true,outputPriceCnyPerSecond:c.minimaxVideoModel==='MiniMax-H3-Max'?{'480P':.33,'768P':.50}:{'768P':.50,'2K':.80},priceChecked:'2026-10-07',priceSource:'https://platform.minimax.cn/docs/guides/pricing-paygo'}}};}
 async config(provider){const env=await this.getConfig();provider??=publicSettings(env).videoProvider;if(provider==='runninghub')return runninghubConfig(env);if(provider==='minimax')return minimaxConfig(env);if(!env.ARK_API_KEY)throw Error('请先填写火山方舟 API Key');if((env.ARK_BASE_URL||API).replace(/\/$/,'')!==API)throw Error('当前生成入口仅支持火山方舟官方北京接口');return {provider:'seedance',key:env.ARK_API_KEY,model:validateSeedanceModel(env.SEEDANCE_MODEL||''),baseUrl:API};}
 async request(route,config,body){
  if(config.provider==='runninghub')return runninghubRequest(config,route,body,this.fetcher);
  const response=await this.fetcher(config.baseUrl+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.key,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(45000)});
  let data;try{data=await response.json();}catch{throw Error('视频服务返回了无法解析的结果');}
  if(!response.ok){const error=Error(safeError(data.error?.message||`视频服务请求失败（${response.status}）`,config.key));error.providerCode=String(data.error?.code||response.status).slice(0,100);error.definitive=response.status>=400&&response.status<500&&response.status!==408;throw error;}
  return config.provider==='minimax'?minimaxResult(data):data;
 }
 async reference(project,input){
  if(!input.imageFile)return null;
  let file,width,height;
  if(input.imageFile==='__product__'){
   const {source}=await this.service.raw(project.id);const filename=source.match(/id="product-image" src="\.\/assets\/([a-f0-9-]+\.(?:png|jpg))"/)?.[1];if(!filename)throw Error('商品图不存在');
   file=path.join(this.service.dir(project.id),'assets',filename);const extent=source.match(/id="product-extent" width="(\d+)" height="(\d+)"/);width=Number(extent?.[1]);height=Number(extent?.[2]);
  }else{const asset=project.assets.find(a=>a.filename===input.imageFile&&a.kind==='image');if(!asset)throw Error('请选择项目中的图片作为首帧');file=await assetPath(this.service.dir(project.id),input.imageFile);width=asset.width;height=asset.height;}
  if(!width||!height||Math.min(width,height)<300||Math.max(width,height)>6000||width/height<.4||width/height>2.5)throw Error('首帧需为 300–6000 像素，宽高比 0.4–2.5');
  const bytes=await fs.readFile(file);if(bytes.length>12e6)throw Error('首帧图片不能超过 12 MB');
  return `data:image/${({'.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp','.gif':'gif','.avif':'avif'})[path.extname(file)]||'jpeg'};base64,${bytes.toString('base64')}`;
 }
 create(projectId,input){const task=this.submitQueue.then(()=>this.start(projectId,input));this.submitQueue=task.catch(()=>{});return task;}
 async start(projectId,input){
  const values={...validateGeneration(input),autoApply:input.autoApply===true,preserveTiming:input.preserveTiming===true},hash=crypto.createHash('sha256').update(JSON.stringify({projectId,...values})).digest('hex');
  const prior=this.jobs.get(input.requestId);if(prior){if(prior.projectId!==projectId||prior.requestHash!==hash)throw Error('请求已存在，请刷新后重试');return this.public(prior);}
  const p=await this.service.get(projectId);if((input.revision!==undefined&&p.revision!==input.revision)||input.revision===undefined&&(values.autoApply||values.shotId))throw Object.assign(Error('项目已更新，请重新打开生成面板'),{status:409});
  if((values.autoApply||values.shotId)&&(p.template!=='product'||!p.shots.some(s=>s.id===values.shotId)))throw Error('生成目标镜头已不存在');
  if(values.autoApply&&[...this.jobs.values()].some(j=>j.projectId===projectId&&values.shotId&&j.shotId===values.shotId&&ACTIVE.has(j.status)))throw Error('这个镜头已有生成任务');
  const config=await this.config(values.provider);values.provider=config.provider;values.resolution??=config.provider==='minimax'?'768P':config.provider==='runninghub'?(values.quality==='premium'?'1080p':'768p'):'720p';if(values.quality==='premium'&&config.provider!=='runninghub'){if(config.provider==='minimax')throw Error('MiniMax 请直接选择清晰度；精细生成仅用于 Seedance');config.model='doubao-seedance-2-0-260128';}if(config.provider==='seedance'&&!['480p','720p','1080p'].includes(values.resolution))throw Error('Seedance 清晰度请选择 480p、720p 或 1080p');
  if(config.provider==='seedance'&&values.resolution==='1080p'&&/mini|fast/.test(config.model))throw Error('1080p 需要 Seedance 2.0 正式版；请选择精细生成或改为 720p');
  if(config.provider!=='runninghub'&&(values.audioMode||values.drivingAudioFile))throw Error('驱动音频模式请使用 RunningHub');
  const reference=config.provider==='runninghub'?null:await this.reference(p,values);
  const content=[{type:'text',text:values.prompt}];if(reference)content.push({type:'image_url',image_url:{url:reference},role:values.imageMode||'first_frame'});
  content.push(...(config.provider==='runninghub'?await this.runninghubReferences(p,values,config):await this.multiReference(p,values.references,config)));const first=content.some(c=>c.role==='first_frame'),last=content.some(c=>c.role==='last_frame');if(config.provider==='seedance'&&last&&!first)throw Error('尾帧必须与首帧一起使用');if(config.provider!=='runninghub'&&(first||last)&&content.some(c=>c.role?.startsWith('reference_')))throw Error('首尾帧不能与全模态参考混用');if(!['9:16','16:9','1:1','4:3','3:4','21:9','adaptive'].includes(values.ratio))throw Error('画幅无效');
  if(config.provider==='minimax'){if((first||last)&&values.ratio!=='adaptive'){const file=values.imageFile||(values.references||[]).find(r=>['first_frame','last_frame'].includes(r.role))?.file;const a=p.assets.find(a=>a.filename===file);const [w,h]=values.ratio.split(':').map(Number);if(a?.width&&Math.abs(a.width/a.height-w/h)>.02)throw Error('H3 首帧生视频跟随图片画幅；请改用商品外观参考，或使用相同比例的首帧');}minimaxVideoBody(values,config.model,content);if(Buffer.byteLength(JSON.stringify(content))>63e6)throw Error('参考素材总大小超过 MiniMax 请求限制，请先裁剪');}
  const job={id:input.requestId,projectId,requestHash:hash,...values,shotNumber:p.shots.findIndex(s=>s.id===values.shotId)+1,baseShot:p.shots.find(s=>s.id===values.shotId),model:config.model,baseUrl:config.baseUrl,status:'submitting',created:new Date().toISOString()};
  await this.persist(job);this.jobs.set(job.id,job);
  try{
   const rh=config.provider==='runninghub'?runninghubVideoBody(values,content):null;
   const result=await this.request(rh?rh.route:config.provider==='minimax'?'/v2/video_generation':'/contents/generations/tasks',config,rh?rh.body:config.provider==='minimax'?minimaxVideoBody(values,config.model,content):{model:config.model,content,duration:values.duration,resolution:values.resolution,ratio:values.ratio,generate_audio:values.audio,watermark:false});
   const remoteId=config.provider==='runninghub'?result.taskId:config.provider==='minimax'?result.task_id:result.id;if(typeof remoteId!=='string'||!/[a-zA-Z0-9]/.test(remoteId)||!/^[a-zA-Z0-9_-]{1,160}$/.test(remoteId))throw Error('视频服务未返回有效任务 ID');
   job.remoteId=remoteId;job.status='queued';await this.persist(job);this.schedule(job.id);
  }catch(error){job.status=job.remoteId?'paused':error.definitive?'failed':'unknown';job.error=safeError(error,config.key);if(error.providerCode)job.errorCode=error.providerCode;await this.persist(job);}
  return this.public(job);
 }
 schedule(id,delay=this.pollMs){if(this.closed||!this.autoPoll)return;clearTimeout(this.timers.get(id));const timer=setTimeout(()=>{this.timers.delete(id);this.poll(id).catch(()=>{});},delay);timer.unref();this.timers.set(id,timer);}
 poll(id){if(this.locks.has(id))return this.locks.get(id);const task=this.advance(id).finally(()=>this.locks.delete(id));this.locks.set(id,task);return task;}
 async advance(id){
  const job=this.jobs.get(id);if(!job?.remoteId||['succeeded','failed','cancelled','expired'].includes(job.status))return job&&this.public(job);
  let config;
  try{
   config=await this.config(job.provider||'seedance');if(job.baseUrl&&job.baseUrl!==config.baseUrl){if(config.provider!=='minimax'||!['https://api.minimax.cn','https://api.minimax.io'].includes(job.baseUrl))throw Error('任务服务地址与配置不一致');config.baseUrl=job.baseUrl;}const response=await this.request(config.provider==='runninghub'?'/openapi/v2/query':(config.provider==='minimax'?'/v2/query/video_generation/':'/contents/generations/tasks/')+job.remoteId,config,config.provider==='runninghub'?{taskId:job.remoteId}:undefined);const result=config.provider==='runninghub'?runninghubTask(response,'video'):config.provider==='minimax'?response.task:response;if(!result)throw Error('视频服务未返回任务状态');
   delete job.error;delete job.errorCode;if(result.usage)job.usage=result.usage;
   if(result.status==='succeeded'){
    job.status='downloading';await this.persist(job);
    const videoUrl=config.provider==='minimax'?result.content?.url:result.content?.video_url;if(!videoUrl)throw Error('生成成功但服务未返回视频地址');
    const bytes=await download(videoUrl,this.fetcher,config.provider);
    const asset=await importAsset(this.service.dir(job.projectId),bytes,`${job.name||job.prompt.slice(0,24)||'生成视频'}.mp4`,{taskId:'video:'+job.id,provider:job.provider||'seedance',model:job.model,inputAssetFiles:[...new Set([job.imageFile,job.drivingAudioFile,...(job.references||[]).map(r=>r.file)].filter(Boolean))]});
    job.assetFile=asset.filename;job.status='succeeded';job.actualDuration=asset.duration;job.assetId=asset.id;job.hasAudio=asset.hasAudio;job.actualWidth=asset.width;job.actualHeight=asset.height;
   }else if(['failed','cancelled','expired'].includes(result.status)){job.status=result.status;job.error=safeError(result.error?.message||'视频任务未完成',config.key);job.errorCode=String(result.error?.code||result.status).slice(0,100);}
   else if(['queued','running'].includes(result.status))job.status=result.status;
   else throw Error('视频服务返回未知任务状态');
   delete job.pollFailures;await this.persist(job);if(job.status==='succeeded')await this.complete(job);if(ACTIVE.has(job.status))this.schedule(id);
  }catch(error){job.pollFailures=(job.pollFailures||0)+1;const recover=!error.definitive&&job.pollFailures<=4;job.status=recover?'recovering':'paused';job.error=safeError(error,config?.key);if(error.providerCode)job.errorCode=error.providerCode;await this.persist(job);if(recover)this.schedule(id,[5000,15000,45000,120000][job.pollFailures-1]);}
  return this.public(job);
 }
 async complete(job){
  if(!job.autoApply||job.appliedRevision||job.applyError)return;
  // Concurrent clips may finish together. Retry only revision conflicts, always recheck the target.
  for(let attempt=0;attempt<4;attempt++){
   try{
    const p=await this.service.get(job.projectId),shot=p.shots.find(s=>s.id===job.shotId);
    const signature=s=>JSON.stringify(s&&{assetFile:s.assetFile,duration:s.duration,trimStart:s.trimStart,sourceAudio:s.sourceAudio,fit:s.fit});
    if(!shot)job.applyError='目标镜头已删除，生成视频已存入素材';
    else if(shot.assetFile===job.assetFile)job.appliedRevision=p.revision;
    else if(signature(shot)!==signature(job.baseShot))job.applyError='镜头已被修改，生成视频已存入素材，可手动替换';
    else {const result=await this.apply(job.projectId,job.id,p.revision,undefined,!job.preserveTiming);job.appliedRevision=result.revision;}
    break;
   }catch(e){if(e.status===409&&attempt<3)continue;job.applyError=safeError(e);break;}
  }
  await this.persist(job);
 }
 async apply(projectId,id,revision,shotId,fitDuration=false){
  const job=this.get(projectId,id);if(job.status!=='succeeded'||!job.assetFile)throw Error('视频尚未生成完成');
  const target=shotId||job.shotId;if(!validShotId(target))throw Error('未知镜头');
  const p=await this.service.get(projectId);if(p.revision!==revision)throw Object.assign(Error('项目已更新，请刷新后再替换'),{status:409});
  if(!p.shots.some(s=>s.id===target))throw Error('目标镜头已删除，请选择其他镜头');
  if(p.shots.find(s=>s.id===target)?.assetFile===job.assetFile)return p;
  const asset=p.assets.find(a=>a.filename===job.assetFile);if(!asset)throw Error('生成素材已丢失');
  return this.service.change(projectId,revision,{type:'shot',shotId:target,assetFile:job.assetFile,...(fitDuration?{duration:Math.min(15,Math.floor((asset.videoDuration||asset.duration)*10)/10)}:{}),trimStart:0,sourceAudio:Boolean(job.audio&&asset.hasAudio)});
 }
 close(){this.closed=true;for(const timer of this.timers.values())clearTimeout(timer);}
}
