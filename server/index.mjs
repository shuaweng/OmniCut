import {BeatGuidesService} from './beat-guides.mjs';
import {ProductionPreviewService} from './production-preview.mjs';
import {BeatAnalysisService} from './beat-analysis.mjs';
import {createRenderProgress} from './render-progress.mjs';
import {AssetLibrary} from './asset-library.mjs';
import {SkillLibrary} from './skill-library.mjs';
import {NativeRuntime} from './native-runtime.mjs';
import {NativeBuilds} from './native-builds.mjs';
import {timelineMutation} from './timeline-edit.mjs';
import {StudioManager} from './studio-manager.mjs';
import {StudioHost,sendStudioResource} from './studio-host.mjs';
import {buildStudioClient} from './studio-client.mjs';
import {TranscriptionService} from './transcription.mjs';
import {NativeEngine,sourceFiles} from './native-engine.mjs';
import {componentCatalog} from './visual-components.mjs';
import {AudioGenerationService} from './audio-generation.mjs';
import http from 'node:http';
import {serveMedia} from './media-response.mjs';
import {requestAccessError} from './request-access.mjs';
import {LocalAccess,localAccessCredentialPath} from './local-access.mjs';
import {latestEvents} from './latest-events.mjs';
import {proxyNative,proxyNativeUpgrade} from './native-proxy.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import {SettingsStore,publicSettings} from './settings.mjs';
import {importAsset,assetPath,registerExistingImage} from './assets.mjs';
import {ReferenceService} from './reference.mjs';
import {ImageGenerationService} from './image-generation.mjs';
import {TaskRegistry} from './task-registry.mjs';
import {GenerationService} from './generation.mjs';
import { ProjectService,root,hypit,run } from './project.mjs';
import {initializeProjectRuntimes,restoreExportJobs} from './startup-recovery.mjs';
import {ProjectShelf} from './project-shelf.mjs';
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const settingsStore=new SettingsStore(path.join(root,'.env'));await settingsStore.loadInto(process.env);
const port=Number(process.env.PORT||5180);
const localAccess=await new LocalAccess(localAccessCredentialPath(root),{port}).init();
const agentPort=Number(process.env.OMNICUT_AGENT_PORT||5182);
const service=new ProjectService();const engine=new NativeEngine({service,root,hypit,run});service.engine=engine;const library=new AssetLibrary({service});const skills=new SkillLibrary({service,root});const nativeRuntime=new NativeRuntime({root,getConfig:async()=>(await settingsStore.read()).env});engine.runtime=nativeRuntime;await service.recover();
const generations=new GenerationService({service,getConfig:async()=>(await settingsStore.read()).env});await generations.init();
const references=new ReferenceService({service,generations,getConfig:async()=>(await settingsStore.read()).env});await references.init();
const images=new ImageGenerationService({service,getConfig:async()=>(await settingsStore.read()).env});await images.init();
const transcriptions=new TranscriptionService({service,getConfig:async()=>(await settingsStore.read()).env});await transcriptions.init();
transcriptions.engine=engine;references.transcriptions=transcriptions;
const audio=new AudioGenerationService({service,getConfig:async()=>(await settingsStore.read()).env});await audio.init();
// Extend older local projects without changing their video sources or selected providers.
await initializeProjectRuntimes(service,path.join(root,'template/hypit.runtime.json'));
const studios=new StudioManager({service,hypit,root,prepare:id=>nativeRuntime.prepare(service.dir(id))});const jobs=new Map();
const serveStudioClient=await buildStudioClient(root);
const studioHost=new StudioHost({service,engine,studios,notify:id=>agentBridge?.notify(id)});
const exportRecoveryDiagnostics=await restoreExportJobs(path.join(root,'data/exports'),jobs,{stopRuntime:dir=>run(hypit,['runtime','down','--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--json'],{timeout:10000})});
await Promise.all([...jobs.values()].filter(job=>job.status==='done'&&!Number.isSafeInteger(job.fileSize)).map(async job=>{try{job.fileSize=(await fs.stat(path.join(root,'data/exports',job.id,'final.mp4'))).size;}catch{}}));
const getExports=(id,all=false)=>[...jobs.values()].filter(j=>j.projectId===id&&(all||(j.videoId||'v-default')===(service.currentVideoId(id)||'v-default'))).map(j=>({...j,download:j.status==='done'?'/api/jobs/'+j.id+'/download':undefined,poster:j.status==='done'?'/api/jobs/'+j.id+'/poster':undefined}));
const previews=new ProductionPreviewService({service,engine,studios,root,run,jobs});
const beats=new BeatAnalysisService({service,runner:run});await beats.init();
const beatGuides=await new BeatGuidesService({service,beats,snapshot:id=>studios.snapshot(id)}).init();previews.beatGuides=beatGuides;
const shelf=new ProjectShelf({dataRoot:service.dataRoot,exportsRoot:path.join(root,'data/exports'),jobs,run});
const exportPosters=new Map();
async function exportPoster(id){
 if(!exportPosters.has(id))exportPosters.set(id,(async()=>{
  const dir=path.join(root,'data/exports',id),file=path.join(dir,'poster.jpg');
  try{await fs.access(file);return file;}catch{}
  const temp=path.join(dir,'poster-'+crypto.randomUUID()+'.jpg');
  try{await run('ffmpeg',['-hide_banner','-loglevel','error','-ss','0.5','-i',path.join(dir,'final.mp4'),'-frames:v','1','-vf','scale=640:-2','-y',temp],{timeout:20000});await fs.rename(temp,file);return file;}
  finally{await fs.rm(temp,{force:true});}
 })().catch(e=>{exportPosters.delete(id);throw e;}));
 return exportPosters.get(id);
}
audio.subscribe(job=>{if(job.status==='succeeded'&&job.kind==='music'&&job.assetFile)void beats.analyze(job.projectId,{assetFile:job.assetFile,videoId:job.videoId}).catch(error=>console.error('配乐节拍分析:',error.message));});
beats.subscribe(result=>agentBridge?.notify(result.projectId));
const nativeBuilds=new NativeBuilds({service,engine,runtime:nativeRuntime});await nativeBuilds.init();
const tasks=new TaskRegistry().register('hypit',nativeBuilds).register('transcript',transcriptions).register('audio',audio).register('image',images).register('video',generations).register('reference',references).register('export',{list:getExports});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const snapshot=async id=>{const scene=await studios.snapshot(id);scene.beatGuides=await beatGuides.load(id,scene);return scene;};
async function studioMutation(id,input){return studioHost.mutate(id,input);}
async function adjustTiming(id,input){return studioMutation(id,timelineMutation(await snapshot(id),input));}
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
async function body(req,max=1e6){const parts=[];let size=0;for await(const p of req){size+=p.length;if(size>max)throw Object.assign(Error('上传文件过大'),{status:413});parts.push(p);}return Buffer.concat(parts);}
async function requestJson(req){return JSON.parse((await body(req)).toString()||'{}');}
async function exportVideo(id,expected,summary){return service.exclusive(id,async()=>{
 const p=await service.get(id);if(p.draft)throw Error('还没有可导出的画面');
 let compiled;
 if(p.native){compiled=await snapshot(id);p.duration=compiled.space.durationSec;p.output={width:compiled.space.canvasWidth,height:compiled.space.canvasHeight,fps:compiled.space.frameRate.numerator/compiled.space.frameRate.denominator};}
 references.assertExportReady(p);if(p.revision!==expected)throw Object.assign(Error('项目已更新，请重试'),{status:409});
 const job={id:crypto.randomUUID(),projectId:id,videoId:p.videoId||'v-default',name:p.name+'·成片',changeSummary:typeof summary==='string'&&summary.trim()?summary.trim().slice(0,60):p.history?.at(-1)?.label||'首次导出',revision:p.revision,duration:p.duration,output:p.output||{width:540,height:960},status:'running',phase:'准备本地渲染',created:new Date().toISOString()};
 jobs.set(job.id,job);const dir=path.join(root,'data','exports',job.id);
 await fs.cp(service.dir(id),dir,{recursive:true,filter:x=>!x.includes('/.hypit')&&!x.endsWith('/project.json')&&!x.endsWith('/pending.json')&&!path.relative(service.dir(id),x).split(path.sep).includes('productions')});
 if(p.native){await engine.copyMedia(service.dir(id),dir);await engine.linkLocalPackages(dir);}
 await nativeRuntime.prepare(dir);
 let saveQueue=Promise.resolve(),lastPublished=0;
 const persist=()=>{saveQueue=saveQueue.catch(()=>{}).then(()=>fs.writeFile(path.join(dir,'job.json'),JSON.stringify(job,null,2)));return saveQueue;};
 await persist();
 const progress=createRenderProgress({snapshot:compiled,duration:p.duration,...p.output,onUpdate:value=>{
  job.phase=value.phase;job.progress={framesCompleted:value.framesCompleted,framesTotal:value.framesTotal,elapsedMs:value.elapsedMs};job.updated=new Date().toISOString();
  if(value.failure)job.failure=value.failure;
  if(Date.now()-lastPublished>700){lastPublished=Date.now();void persist().catch(()=>{});tasks.notify(id);agentBridge?.notify(id);}
 }});
 (async()=>{try{
  tasks.notify(id);agentBridge?.notify(id);
  const {stdout}=await engine.run(hypit,['build',path.join(dir,p.native?.run||'render.svrun'),'--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--title','OmniCut '+p.name,'--follow','--json','--verbose'],{maxBuffer:6e6,onStderr:chunk=>progress.pushStderr(chunk),deadlineAt:progress.deadlineAt});
  const result=JSON.parse(stdout),buildId=result.build?.id||result.buildId||result.id;
  if(!buildId)throw Error('渲染返回缺少 Build ID');job.buildId=buildId;
  if(result.build?.outcome==='failed')throw Error(result.build.reason||'原生渲染失败');
  job.phase='保存成片';tasks.notify(id);agentBridge?.notify(id);
  await engine.run(hypit,['get',buildId,'--output',p.native?.target||'final.video','--to',path.join(dir,'final.mp4'),'--workspace',dir,'--json'],{timeout:30000,maxBuffer:2e6});
  job.fileSize=(await fs.stat(path.join(dir,'final.mp4'))).size;
  progress.finish(stdout);job.status='done';job.phase='导出完成';
 }catch(e){progress.finish('',e);job.status='failed';job.phase='导出失败';job.error=job.failure?.message||String(e.stderr||e.message).slice(-1200);}
 await persist().catch(error=>{job.status='failed';job.phase='导出失败';job.error=error.code==='ENOSPC'?'磁盘空间不足，请释放空间后重新导出':('保存导出状态失败：'+error.message);});
 tasks.notify(id);agentBridge?.notify(id);
 await run(hypit,['runtime','down','--workspace',dir,'--runtime',path.join(dir,'hypit.runtime.json'),'--json'],{timeout:10000}).then(()=>{job.runtimeStopped=true;return persist();}).catch(()=>{});
 })();return job;
});}
async function getExportStatus(projectId,jobId){
 if(!/^[a-f0-9-]{36}$/.test(jobId))throw Error('导出任务不存在');
 let job=jobs.get(jobId);
 if(!job)job=JSON.parse(await fs.readFile(path.join(root,'data/exports',jobId,'job.json'),'utf8'));
 if(job.projectId!==projectId)throw Error('导出任务不属于当前项目');
 for(let i=0;i<25&&job.status==='running';i++)await sleep(500);
 return {...job,download:job.status==='done'?'/api/jobs/'+job.id+'/download':undefined};
}
let agentBridge,configUpdating=false;
try{const {createAgentBridge}=await import('./agent.mjs');agentBridge=await createAgentBridge({service,exportVideo,getExportStatus,generations,getExports,references,images,audio,tasks,nativeWeb:true,nativePort:agentPort,engine,snapshot,studioMutation,adjustTiming,transcriptions,nativeRuntime,nativeBuilds,library,skills,previews,beats,beatGuides});}catch(e){console.error('Agent bridge:',e.message);}
async function createConversationJob(projectId,input,kind,create){
 const cid=input.conversationId||projectId;agentBridge?.state(projectId,cid);
 const result=await create();
 for(const job of result.jobs||[result])await agentBridge?.ownTask(projectId,cid,kind,job,{kind:'user'});
 return result;
}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost:'+port),target=u.pathname.match(/^\/(?:api|__studio)\/projects\/(p-[a-f0-9]{12})/),pathVideo=u.pathname.match(/\/videos\/(v-[a-f0-9]{12}|v-default)\//),videoId=pathVideo?.[1]||u.searchParams.get('videoId');if(target&&videoId){try{return await service.withVideoContext(target[1],videoId,()=>handleRequest(req,res));}catch(error){return json(res,error.status||400,{error:error.message});}}return handleRequest(req,res);});
async function handleRequest(req,res){try{
 const url=new URL(req.url,'http://localhost:'+port),p=url.pathname;
 const accessError=requestAccessError(req,p,port);if(accessError)return json(res,403,{error:accessError});
 if(p==='/api/local-access/pair'&&req.method==='POST'){
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'需要 JSON 请求'});
  let input;try{input=await requestJson(req);}catch{return json(res,401,{error:'本机连接尚未授权，请使用本机启动命令打开工作台',code:'LOCAL_ACCESS_REQUIRED'});}
  const cookie=localAccess.pair(req,input?.code);
  if(!cookie)return json(res,401,{error:'本机连接尚未授权，请使用本机启动命令打开工作台',code:'LOCAL_ACCESS_REQUIRED'});
  res.setHeader('set-cookie',cookie);return json(res,200,{authenticated:true});
 }
 if(localAccess.requiresAuthentication(p)&&!localAccess.isAuthenticated(req))return json(res,401,{error:'本机连接尚未授权，请使用本机启动命令打开工作台',code:'LOCAL_ACCESS_REQUIRED'});
 if(p==='/api/local-access/session'&&req.method==='GET')return json(res,200,{authenticated:true});
 // Never forward the workbench's owner credential into the Agent process.
 if(p.startsWith('/dsh/')){delete req.headers.authorization;return proxyNative(req,res,agentPort);}
 if(p==='/api/home-composer'&&req.method==='POST'){
  if(!agentBridge?.ready)throw Error('对话服务正在连接，请稍后重试');
  const sessionId=await agentBridge.ensureHome();
  const auth=await fetch(agentBridge.authURL,{redirect:'manual'});if(auth.status!==303)throw Error('输入框连接未完成');
  const cookies=auth.headers.getSetCookie().map(c=>c.replace(/Path=\//i,'Path=/dsh/'));if(cookies.length)res.setHeader('set-cookie',cookies);
  return json(res,200,{sessionId,url:'/dsh/?frame=1&home=1&session='+encodeURIComponent(sessionId)});
 }

 if(p.startsWith('/hypit-studio/')&&req.method==='GET')return serveStudioClient(p,res);
 if((p==='/api/settings'||p==='/api/reconnect')&&req.method==='POST'){
   if(configUpdating)return json(res,409,{error:'正在保存模型配置，请稍后重试'});
   if(p==='/api/settings'&&!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'需要 JSON 请求'});
   configUpdating=true;
   try{
     for(const item of await service.list())if((await agentBridge?.conversations(item.id))?.conversations.some(c=>c.status==='running'))throw Error('请等待正在运行的对话结束，或先停止对应对话');
     const agentSettings=['DEEPSEEK_API_KEY','DEEPSEEK_MODEL','DEEPSEEK_BASE_URL','CREATIVE_API_KEY','CREATIVE_MODEL','CREATIVE_BASE_URL','CREATIVE_PROTOCOL','CREATIVE_ENABLED','AGENT_PROVIDER','AGENT_KEY_SOURCE','AGENT_API_KEY','AGENT_MODEL','AGENT_BASE_URL','AGENT_CONTEXT_WINDOW','AGENT_MAX_TOKENS','AGENT_REASONING_EFFORT'];
     const before=agentSettings.map(key=>process.env[key]);
     if(p==='/api/settings'){let input;try{input=await requestJson(req);}catch{throw Error('模型配置格式无效');}await settingsStore.save(input);}
     await settingsStore.loadInto(process.env);
     const changed=before.some((value,index)=>value!==process.env[agentSettings[index]]);
     if(changed||p==='/api/reconnect'||!agentBridge?.ready){await agentBridge?.close();try{const {createAgentBridge}=await import('./agent.mjs');agentBridge=await createAgentBridge({service,exportVideo,getExportStatus,generations,getExports,references,images,audio,tasks,nativeWeb:true,nativePort:agentPort,engine,snapshot,studioMutation,adjustTiming,transcriptions,nativeRuntime,nativeBuilds,library,skills,previews,beats,beatGuides});}catch{agentBridge=undefined;}}
     return json(res,200,{...publicSettings(process.env),agentReady:Boolean(agentBridge?.ready),saved:true});
   }finally{configUpdating=false;}
 }
 if(p==='/api/hypit/import'&&req.method==='POST')return json(res,201,await engine.importProject(await requestJson(req)));
 if(p==='/api/hypit/catalog'&&req.method==='GET')return json(res,200,await engine.catalog());
 if(p==='/api/hypit/docs'&&req.method==='GET')return json(res,200,await engine.docs(url.searchParams.get('path')));
 if(p==='/api/components'&&req.method==='GET')return json(res,200,componentCatalog);
 if(p==='/api/motion-library'&&req.method==='GET'){const id=url.searchParams.get('projectId');if(id)await service.get(id);return json(res,200,await engine.motionLibrary.list(id||undefined));}
 const motionMatch=p.match(/^\/api\/motion-library\/([^/]+)(\/(?:preview|poster))?$/);
 if(motionMatch&&['GET','HEAD'].includes(req.method)){
  const id=decodeURIComponent(motionMatch[1]);
  if(motionMatch[2]){const poster=motionMatch[2]==='/poster';return serveMedia(req,res,await engine.motionLibrary[poster?'poster':'preview'](id),{'content-type':poster?'image/jpeg':'video/mp4','cache-control':'private, max-age=3600'});}
  return json(res,200,await engine.motionLibrary.get(id));
 }
 if(p==='/api/library'&&req.method==='GET')return json(res,200,await library.list(Object.fromEntries(url.searchParams)));
 if(p==='/api/library'&&req.method==='POST')return json(res,201,await library.import(await body(req,80e6),decodeURIComponent(req.headers['x-filename']||'素材')));
 if(p==='/api/skills'&&req.method==='GET'){const projectId=url.searchParams.get('projectId');if(projectId)await service.getVideo(projectId);return json(res,200,await skills.list({projectId,query:url.searchParams.get('query')||''}));}
 if(p==='/api/skills'&&req.method==='POST')return json(res,201,await skills.import(JSON.parse((await body(req,8e6)).toString())));
 const skillMatch=p.match(/^\/api\/skills\/(builtin-[a-z0-9-]+|catalog-[a-z0-9-]+|s-[a-f0-9]{20})$/);
 if(skillMatch){if(req.method==='GET')return json(res,200,await skills.get(skillMatch[1]));if(req.method==='DELETE')return json(res,200,await skills.remove(skillMatch[1]));}
 if(p==='/api/brands'&&req.method==='GET')return json(res,200,await library.listBrands());
 if(p==='/api/brands'&&req.method==='POST')return json(res,201,await library.createBrand(await requestJson(req)));
 const libraryMatch=p.match(/^\/api\/library\/([^/]+)(?:\/(media|preview|usage))?$/);
 if(libraryMatch){const [,id,action]=libraryMatch;
  if(['media','preview'].includes(action)&&['GET','HEAD'].includes(req.method)){const asset=await library.get(id),file=await library.file(id,{preview:action==='preview'});return serveMedia(req,res,file,{'content-type':({'.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4','.gif':'image/gif','.avif':'image/avif','.ogg':'audio/ogg','.flac':'audio/flac'})[path.extname(action==='preview'?file:asset.filename)]||'application/octet-stream'});}
  if(req.method==='GET')return json(res,200,action==='usage'?await library.usage(id):await library.get(id));
  if(req.method==='PATCH'){const input=await requestJson(req);return json(res,200,input.hidden!==undefined?await library.hide(id,input.hidden):await library.patch(id,input));}
  if(req.method==='DELETE')return json(res,200,await library.remove(id));
 }
 if(p==='/api/config'&&req.method==='GET')return json(res,200,{...publicSettings(process.env),agentReady:Boolean(agentBridge?.ready)});
 if(p==='/api/projects'&&req.method==='GET')return json(res,200,await shelf.decorate(await service.list(),{videoCount:async id=>(await fs.readdir(path.join(service.projectDir(id),'productions')).catch(()=>[])).filter(name=>/^v-[a-f0-9]{12}$/.test(name)).length+1}));
 const pinMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/pin$/);
 if(pinMatch&&req.method==='POST'){await service.get(pinMatch[1]);return json(res,200,{ids:await shelf.pin(pinMatch[1],(await requestJson(req)).pinned)});}
 if(p==='/api/projects'&&req.method==='POST'){const b=await requestJson(req);return json(res,201,await (b.template&&b.template!=='blank'?service.create(b.name,b.title,b.template):service.createBlank(b.name,b.brief)));}
 const conversationMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/conversations(?:\/((?:p|c)-[a-f0-9]{12}))?$/);
 if(conversationMatch){const [,id,cid]=conversationMatch;if(!agentBridge)throw Error('对话服务尚未连接');
  if(req.method==='GET'&&!cid)return json(res,200,await agentBridge.conversations(id));
  if(req.method==='POST'&&!cid)return json(res,201,await agentBridge.createConversation(id,await requestJson(req)));
  if(req.method==='PATCH'&&cid)return json(res,200,await agentBridge.patchConversation(id,cid,await requestJson(req)));
  return json(res,405,{error:'不支持的对话操作'});
 }
 const refMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/references(?:\/([a-f0-9-]{36})(?:\/(retry|plan|apply|generate|produce|scene-\d+\.jpg))?)?$/);
 if(refMatch){const [,projectId,id,action]=refMatch;await service.get(projectId);
  if(req.method==='GET'){
   if(action?.startsWith('scene-')){res.setHeader('content-type','image/jpeg');return res.end(await references.thumbnail(projectId,id,Number(action.match(/\d+/)[0])));}
   return json(res,200,id?references.public(references.get(projectId,id)):references.list(projectId));
  }
  if(req.method==='POST'){
   const b=await requestJson(req);
   if(!id)return json(res,202,await createConversationJob(projectId,b,'reference',()=>references.create(projectId,b)));
   if(action==='retry')return json(res,202,await references.retry(projectId,id));
   if(action==='plan')return json(res,200,await references.update(projectId,id,b));
   if(action==='apply')return json(res,200,await references.apply(projectId,id,b));
   if(action==='produce'){if(!agentBridge?.ready||!publicSettings(process.env).agentConfigured)throw Error('请先在模型设置中配置主力模型');if(['running','waiting'].includes(agentBridge.state(projectId,b.conversationId||projectId).status))throw Object.assign(Error('当前任务仍在进行，可在对话中调整要求'),{status:409});await agentBridge.ensure(projectId,b.conversationId||projectId);await references.apply(projectId,id,b);return json(res,202,await references.dispatch(projectId,id,b,text=>agentBridge.prompt(projectId,{text,conversationId:b.conversationId||projectId})));}
   if(action==='generate')return json(res,202,await createConversationJob(projectId,b,'video',()=>references.generate(projectId,id,b)));
  }
  return json(res,405,{error:'不支持的参考操作'});
 }
 const previewFile=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/previews\/(pv-[a-f0-9]{24})\/([^/]+)$/);
 if(previewFile&&['GET','HEAD'].includes(req.method)){const [,id,previewId,name]=previewFile;const file=await previews.file(id,previewId,decodeURIComponent(name),{videoId:url.searchParams.get('videoId')||undefined});return serveMedia(req,res,file.path,{'content-type':file.mediaType,'cache-control':'private, max-age=3600'});}
 if(p==='/api/audio/voices'&&req.method==='GET')return json(res,200,await audio.voices(url.searchParams.get('provider')||'elevenlabs'));
 const audioMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/audio(?:\/([a-f0-9-]{36}))?$/);
 if(audioMatch){const [,projectId,id]=audioMatch;await service.get(projectId);if(req.method==='GET')return json(res,200,id?audio.public(audio.get(projectId,id)):audio.list(projectId));if(req.method==='POST'&&!id){const b=await requestJson(req);return json(res,202,await createConversationJob(projectId,b,'audio',()=>audio.create(projectId,b)));}return json(res,405,{error:'不支持的声音操作'});}
 const imageMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/images(?:\/([a-f0-9-]{36})(?:\/(refresh))?)?$/);
 if(imageMatch){const [,projectId,id,action]=imageMatch;await service.get(projectId);if(req.method==='GET')return json(res,200,id?images.public(images.get(projectId,id)):images.list(projectId));if(req.method==='POST'&&id&&action==='refresh'){images.get(projectId,id);return json(res,200,await images.poll(id));}if(req.method==='POST'&&!id){const b=await requestJson(req);return json(res,202,await createConversationJob(projectId,b,'image',()=>images.create(projectId,b)));}return json(res,405,{error:'不支持的图片操作'});}
 const genMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/generations(?:\/([a-f0-9-]{36})(?:\/(apply|refresh))?)?$/);
 if(genMatch){const [,projectId,id,action]=genMatch;await service.get(projectId);
  if(req.method==='GET')return json(res,200,id?generations.public(generations.get(projectId,id)):generations.list(projectId));
  if(req.method==='POST'){
   if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'需要 JSON 请求'});
   if(!id){const b=await requestJson(req);return json(res,202,await createConversationJob(projectId,b,'video',()=>generations.create(projectId,b)));}
   generations.get(projectId,id);
   if(action==='apply'){const input=await requestJson(req);return json(res,200,await generations.apply(projectId,id,input.revision,input.shotId,true));}
   if(action==='refresh')return json(res,200,await generations.poll(id));
  }
  return json(res,405,{error:'不支持的任务操作'});
 }
 const assetMatch=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})\/assets\/([a-f0-9-]{36}(?:\.preview)?\.(?:png|jpg|jpeg|mp4|mov|webm|mp3|wav|m4a|webp|gif|avif|ogg|flac))$/);
 if(assetMatch&&['GET','HEAD'].includes(req.method)){
  const file=await assetPath(service.dir(assetMatch[1]),assetMatch[2]),stat=await fs.stat(file);
  const types={'.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.ogg':'audio/ogg','.flac':'audio/flac','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.m4a':'audio/mp4'};
  const headers={'content-type':types[path.extname(file)],'accept-ranges':'bytes','cache-control':'private, max-age=3600'};
  if(path.extname(file)==='.svg')headers['content-security-policy']="sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";
  return serveMedia(req,res,file,headers);
 }
 const match=p.match(/^\/api\/projects\/(p-[a-f0-9]{12})(?:\/([\w-]+))?$/);
 if(match){const [,id,action]=match;
   if(['production-preferences','turn-undo','native-session','selection'].includes(action)&&!agentBridge?.ready)throw Object.assign(Error('对话正在连接，请稍后重试'),{status:503});
   if(action==='skills'){if(req.method==='GET')return json(res,200,await skills.list({projectId:id}));if(req.method==='POST'){const input=await requestJson(req);const active=(await agentBridge?.conversations(id))?.conversations.some(c=>['running','waiting'].includes(c.status));const result=await skills.enable(id,input.skillId,input.enabled,{defer:!!active});await agentBridge?.refreshSkills?.(id);return json(res,200,result);}}
   if(action==='videos'){if(req.method==='GET')return json(res,200,await service.listVideos(id));if(req.method==='POST')return json(res,201,await service.createVariant(id,await requestJson(req)));}
   if(action==='library-use'&&req.method==='POST'){const input=await requestJson(req);return json(res,200,await library.attach(id,input.assetId));}
   if(action==='library-publish'&&req.method==='POST'){const input=await requestJson(req);return json(res,200,await library.publish(id,input.assetFile));}
   if(action==='brand'&&req.method==='POST'){const input=await requestJson(req);return json(res,200,await library.pinBrand(id,input.brandId,input.version));}
   if(action==='production-preferences'){if(req.method==='GET')return json(res,200,agentBridge.input(id,url.searchParams.get('conversationId')||id));if(req.method==='POST')return json(res,200,await agentBridge.configureInput(id,await requestJson(req)));}
   if(action==='turn-undo'&&req.method==='POST'){const input=await requestJson(req);return json(res,200,await agentBridge.undoTurn(id,input.changeSetId));}
   if(action==='review-export'&&req.method==='POST'){const input=await requestJson(req),job=jobs.get(input.exportId);if(!job||job.projectId!==id||(job.videoId||'v-default')!==service.currentVideoId(id)||job.status!=='done')throw Error('请选择当前视频已完成的成片');const asset=await importAsset(service.dir(id),await fs.readFile(path.join(root,'data/exports',job.id,'final.mp4')),job.name+'.mp4',{provider:'export',exportId:job.id});return json(res,202,await createConversationJob(id,input,'reference',()=>references.create(id,{requestId:crypto.randomUUID(),assetFile:asset.filename,brief:input.brief||'检查商品外观、字幕与旁白对齐、音乐节奏、画面穿帮和品牌结尾。',purpose:'quality'})));}
   if(action==='transcriptions'){if(req.method==='GET')return json(res,200,transcriptions.list(id));if(req.method==='POST'){const b=await requestJson(req);return json(res,202,await createConversationJob(id,b,'transcript',()=>transcriptions.create(id,b)));}}
   if(action==='native-builds'){if(req.method==='GET')return json(res,200,nativeBuilds.list(id));if(req.method==='POST'){const b=await requestJson(req);return json(res,202,await createConversationJob(id,b,'hypit',()=>nativeBuilds.create(id,b)));}}
   if(action==='preview-frames'&&req.method==='POST'){const input=await requestJson(req);const result=await previews.previewFrames(id,input);return json(res,200,JSON.parse(JSON.stringify(result,(key,value)=>key==='image'?undefined:value)));}
   if(action==='probe-export'&&req.method==='POST')return json(res,200,await previews.probeExport(id,await requestJson(req)));
   if(action==='beats'){if(req.method==='GET')return json(res,200,await beats.list(id));if(req.method==='POST')return json(res,200,await beats.analyze(id,await requestJson(req)));}
   if(action==='beat-guides'){if(req.method==='GET')return json(res,200,await beatGuides.load(id));if(req.method==='POST')return json(res,200,await beatGuides.bind(id,await requestJson(req)));}
   if(action==='motion-packages'&&req.method==='GET')return json(res,200,await engine.motionLibrary.projectPackages(id));
   if(action==='motion-save'&&req.method==='POST')return json(res,201,await engine.motionLibrary.save(id,await requestJson(req)));
   if(action==='native-runtime'&&req.method==='GET')return json(res,200,await nativeRuntime.status(service.dir(id)));
   if(req.method==='POST'&&action==='index-assets')return json(res,200,await engine.indexAssets(id));
   if(req.method==='GET'&&action==='source')return json(res,200,await engine.read(id,url.searchParams.get('file')));
   if(req.method==='POST'&&action==='source'){const b=await requestJson(req);return json(res,200,await engine.edit(id,b.revision,b.files,b.options));}
   if(req.method==='POST'&&action==='timeline-edit')return json(res,200,await adjustTiming(id,await requestJson(req)));
   if(req.method==='POST'&&action==='studio-mutation')return json(res,200,await studioMutation(id,await requestJson(req)));
   if(req.method==='POST'&&action==='fork'){const b=await requestJson(req);return json(res,201,await engine.fork(id,b.name));}
   if(req.method==='POST'&&action==='assets'){await service.get(id);const name=decodeURIComponent(req.headers['x-filename']||'');return json(res,201,await importAsset(service.dir(id),await body(req,80e6),name));}
   if(req.method==='GET'&&!action){const project=await service.get(id);project.history=project.history.map(h=>({...h,origin:agentBridge?.historyOrigin(id,h)}));return json(res,200,project);}
   if(req.method==='GET'&&action==='tasks')return json(res,200,tasks.list(id));
   if(req.method==='GET'&&action==='exports')return json(res,200,getExports(id).sort((a,b)=>b.created.localeCompare(a.created)));
   if(req.method==='GET'&&action==='snapshot'){const s=await snapshot(id);return json(res,200,s);}
   if(req.method==='POST'&&action==='rename')return json(res,200,await service.rename(id,await requestJson(req)));
   if(req.method==='POST'&&action==='change'){const b=await requestJson(req);return json(res,200,await service.change(id,b.revision,b.change));}
   if(req.method==='POST'&&action==='undo'){const b=await requestJson(req);return json(res,200,await service.undo(id,b.revision));}
   if(req.method==='POST'&&action==='image'){const data=await body(req,12e6);let ext;if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(data[0]===255&&data[1]===216&&data[2]===255)ext='jpg';else throw Error('请上传 PNG 或 JPEG 图片');const before=await service.get(id);if(before.revision!==req.headers['x-revision'])throw Object.assign(Error('项目已更新，请重试'),{status:409});const asset=await importAsset(service.dir(id),data,'商品图.'+ext,{provider:'import'});return json(res,200,await service.image(id,req.headers['x-revision'],asset.filename));}
   if(req.method==='GET'&&action==='image'){const raw=await service.raw(id),file=raw.source.match(/id="product-image" src="\.\/assets\/([a-f0-9-]+\.(?:png|jpg))"/)?.[1];if(!file){res.writeHead(404);return res.end();}res.setHeader('content-type',file.endsWith('png')?'image/png':'image/jpeg');return res.end(await fs.readFile(path.join(service.dir(id),'assets',file)));}
   if(req.method==='POST'&&action==='export'){const b=await requestJson(req);return json(res,202,await createConversationJob(id,b,'export',()=>exportVideo(id,b.revision,b.summary)));}
   if(req.method==='POST'&&action==='chat'){if(configUpdating)throw Object.assign(Error('模型配置正在更新'),{status:409});if(!publicSettings(process.env).agentConfigured)throw Object.assign(Error('请先在模型设置中配置主力模型'),{status:503});if(!agentBridge?.ready)throw Error(agentBridge?.error||'Agent 尚未启动');const b=await requestJson(req);return json(res,202,await agentBridge.prompt(id,b));}
   if(req.method==='GET'&&action==='events'){
    await service.get(id);
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive','x-accel-buffering':'no'});
    const {send,heartbeat:beat}=latestEvents(res);
    send(agentBridge?.state(id,url.searchParams.get('conversationId')||id)||{status:'idle',messages:[]});
    const unsubscribe=agentBridge?.subscribe(id,send,url.searchParams.get('conversationId')||id);
    res.write('retry: 15000\n\n');
    const heartbeat=setInterval(beat,5000);
    // Retire legacy clients' permanent streams too. EventSource reconnects;
    // no tab should hold a scarce browser HTTP/1 slot indefinitely.
    const lease=setTimeout(()=>res.end(),12000);
    res.on('close',()=>{clearInterval(heartbeat);clearTimeout(lease);unsubscribe?.();});return;
   }
   if(req.method==='POST'&&action==='selection'){await agentBridge.select(id,await requestJson(req));return json(res,200,{ok:true});}
   if(req.method==='POST'&&action==='native-session'){const b=await requestJson(req),conversationId=b.conversationId||id;await agentBridge.activateConversation(id,conversationId);await agentBridge.configureInput(id,{conversationId,videoId:service.currentVideoId(id)});const sessionId=await agentBridge.ensure(id,conversationId);const auth=await fetch(agentBridge.authURL,{redirect:'manual'});if(auth.status!==303)throw Error('原生会话认证未完成');const cookie=auth.headers.getSetCookie().map(c=>c.replace(/Path=\//i,'Path=/dsh/'));if(cookie.length)res.setHeader('set-cookie',cookie);return json(res,200,{sessionId,conversationId,url:'/dsh/?frame=1&project='+id+'&conversation='+conversationId+'&videoId='+encodeURIComponent(service.currentVideoId(id))+'&session='+encodeURIComponent(sessionId)});}
   if(req.method==='GET'&&action==='chat')return json(res,200,agentBridge?.state(id,url.searchParams.get('conversationId')||id)||{status:'idle',messages:[]});
   if(req.method==='GET'&&action==='progress'){
    // Native DSH already owns conversation history. The workbench only needs
    // media state and the current operation; don't resend megabytes per tick.
    const {messages=[],...progress}=agentBridge?.state(id,url.searchParams.get('conversationId')||id)||{status:'idle'};
    return json(res,200,{...progress,serviceInstance:agentBridge?.instanceId,messages:messages.filter(m=>m.role==='tool'&&m.status==='running').slice(-1)});
   }
   if(req.method==='POST'&&action==='stop'){const b=await requestJson(req);await agentBridge?.cancel(id,b.conversationId||id);return json(res,200,{ok:true});}
 }
 const sr=p.match(/^\/__studio\/projects\/(p-[a-f0-9]{12})\/(?:videos\/(v-[a-f0-9]{12}|v-default)\/)?(.+)$/);if(sr){const r=await studioHost.resource(sr[1],sr[3],url.search,{method:req.method,body:['POST','PUT'].includes(req.method)?await requestJson(req):undefined,revision:req.headers['x-frame-revision'],range:req.headers.range});if(sr[3]==='session'&&r.status===200){const scene=JSON.parse(r.body);scene.beatGuides=await beatGuides.load(sr[1],{...scene,revision:r.frameRevision});r.body=Buffer.from(JSON.stringify(scene));delete r.headers?.['content-length'];}return sendStudioResource(req,res,r);}
 const jm=p.match(/^\/api\/jobs\/([a-f0-9-]+)(?:\/(download|poster|cover))?$/);if(jm){let j=jobs.get(jm[1]);if(!j){try{j=JSON.parse(await fs.readFile(path.join(root,'data','exports',jm[1],'job.json'),'utf8'));if(j.status==='running'){j.status='interrupted';j.error='工作台已重启，请检查本地导出记录后重新导出。';}}catch{throw Error('任务不存在');}}if(j.status==='done'&&!Number.isSafeInteger(j.fileSize)){try{j.fileSize=(await fs.stat(path.join(root,'data','exports',j.id,'final.mp4'))).size;}catch{}}if(jm[2]==='cover'){if(j.status!=='done')throw Error('视频尚未导出');return serveMedia(req,res,await shelf.cover(j.id),{'content-type':'image/jpeg','cache-control':'private, max-age=86400'});}if(jm[2]==='poster'){if(j.status!=='done')throw Error('视频尚未导出');const poster=await exportPoster(j.id);return serveMedia(req,res,poster,{'content-type':'image/jpeg','cache-control':'private, max-age=3600'});}
 if(jm[2]){if(j.status!=='done')throw Error('视频尚未导出');const file=path.join(root,'data','exports',j.id,'final.mp4'),stat=await fs.stat(file);
 const headers={'content-type':'video/mp4','accept-ranges':'bytes','content-disposition':"inline; filename=\"frame-video.mp4\"; filename*=UTF-8''"+encodeURIComponent((j.name||'广告成片')+'.mp4')};
 return serveMedia(req,res,file,headers);}return json(res,200,j);}
 const assets={'/design-system.css':'design-system.css','/local-access.js':'local-access.js','/home-hub.css':'home-hub.css','/omnicut-mark.svg':'omnicut-mark.svg','/omnicut-icon.svg':'omnicut-icon.svg','/brand-icon-v3.png':'brand-icon-v3.png','/brand-icon-v2.png':'brand-icon-v2.png','/brand-icon.png':'brand-icon.png','/':'index.html','/app.js':'app.js','/conversation-tools.js':'conversation-tools.js','/library-view.js':'library-view.js','/library-view.css':'library-view.css','/skill-browser.js':'skill-browser.js','/skill-browser.css':'skill-browser.css','/editor-drafts.js':'editor-drafts.js','/export-monitor.js':'export-monitor.js','/conversations.js':'conversations.js','/conversations.css':'conversations.css','/home-composer.js':'home-composer.js','/select.css':'select.css','/production-state.js':'production-state.js','/request.js':'request.js','/panel-layout.js':'panel-layout.js','/media-preview.js':'media-preview.js','/media-preview.css':'media-preview.css','/model-settings.js':'model-settings.js','/model-settings.css':'model-settings.css','/motion-gallery.js':'motion-gallery.js','/motion-gallery.css':'motion-gallery.css','/motion-library.js':'motion-library.js','/motion-library.css':'motion-library.css','/audio-view.js':'audio-view.js','/native-view.js':'native-view.js','/studio-workbench.js':'studio-workbench.js','/components-view.js':'components-view.js','/chat-view.js':'chat-view.js','/reference-view.js':'reference-view.js','/style.css':'style.css'};if(assets[p]){res.setHeader('content-type',p.endsWith('.svg')?'image/svg+xml':p.endsWith('.png')?'image/png':p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html; charset=utf-8');return res.end(await fs.readFile(path.join(root,'src',assets[p])));}
 if(/^\/vendor-logos\/(?:claude-color|elevenlabs|minimax-color|volcengine-color|xiaomimimo)\.svg$/.test(p)){res.setHeader('content-type','image/svg+xml');res.setHeader('cache-control','public, max-age=86400');return res.end(await fs.readFile(path.join(root,'src',p)));}
 if(p==='/icons.js'){res.setHeader('content-type','text/javascript');return res.end(await fs.readFile(path.join(root,'node_modules/lucide/dist/umd/lucide.js')));}
 json(res,404,{error:'未找到页面'});
 }catch(e){if(res.headersSent){res.destroy();return;}json(res,e.status||400,{error:e.message,...(Array.isArray(e.candidates)?{candidates:e.candidates.filter(x=>typeof x==='string').slice(0,30)}:{}),...Object.fromEntries(['code','baseRevision','currentRevision','nextAction'].filter(key=>typeof e[key]==='string').map(key=>[key,e[key]]))});}}
server.on('upgrade',(req,socket,head)=>{const pathname=new URL(req.url,'http://localhost:'+port).pathname,error=requestAccessError(req,pathname,port);if(error||!localAccess.isAuthenticated(req)){socket.end('HTTP/1.1 '+(error?'403 Forbidden':'401 Unauthorized')+'\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');return;}delete req.headers.authorization;proxyNativeUpgrade(req,socket,head,agentPort,port);});
server.listen(port,'127.0.0.1',()=>console.log('OmniCut 工作台 http://localhost:'+port));
function shutdown(){tasks.close();beats.close().catch(()=>{});images.close().catch(()=>{});audio.closed=true;generations.close();studios.close();agentBridge?.close();server.close();setTimeout(()=>process.exit(),500).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
