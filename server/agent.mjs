import {ConversationStore} from './conversations.mjs';
import {conversationWorkspace,withConversationWorkspace} from './conversation-workspace.mjs';
import {productionLimits} from './production-limits.mjs';
import {claimNativeInput,claimNativeWakeup,trackNativeTurnStatus} from './native-turn.mjs';
import {nativeSelectionContext,agentStudioSnapshot} from './studio-selection.mjs';
import {componentCatalog} from './visual-components.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { root } from './project.mjs';
import {importAsset,updateAssetMetadata} from './assets.mjs';
import {reduceChatEvent,interruptMessages} from './chat-events.mjs';
export async function createAgentBridge({service,exportVideo,getExportStatus,generations,getExports,references,images,audio,tasks,nativeWeb=false,nativePort=5182,engine,snapshot,studioMutation,adjustTiming,transcriptions,nativeRuntime,nativeBuilds}){
 const pendingSessions=new Map();
 const store=await new ConversationStore(service.dataRoot).init(),states=store.states;
 const timers=new Map(),prompting=new Set();let saving=store.queue;
 const persist=id=>{saving=store.persist(id);return saving;};
 const update=id=>store.get(id);
 const state=(projectId,conversationId)=>{
  const s=conversationId?store.ensure(projectId,conversationId):update(projectId),id=s.id,pid=s.projectId;
  const own=(kind,items)=>store.jobs(pid,id,kind,items||[]);
  return {...s,conversationId:id,projectExports:getExports?.(pid)||[],projectReferences:(references?.list(pid)||[]).map(({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration})=>({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration})),projectTasks:(tasks?.list(pid)||[]).map(j=>({...j,conversationId:store.owner(pid,j.kind,j.id.split(':').slice(1).join(':'))||pid})),generations:own('video',generations?.list(pid)),images:own('image',images?.list(pid)),audio:own('audio',audio?.list(pid)),tasks:(tasks?.list(pid)||[]).map(j=>({...j,conversationId:store.owner(pid,j.kind,j.id?.split(':').slice(1).join(':'))||pid})).filter(j=>j.conversationId===id),exports:own('export',getExports?.(pid)),references:own('reference',references?.list(pid)).map(({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,conversationId})=>({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,conversationId}))};
 };
 const listeners=new Map();let closed;
 const publish=id=>{for(const fn of listeners.get(id)||[])fn(state(id));};
 const publishProject=pid=>{for(const id of store.projectIds(pid))publish(id);};
 const resumeProject=pid=>{for(const id of store.projectIds(pid))resume(id).catch(e=>console.error('接续任务失败:',e.message));};
 const unsubscribeGenerations=generations?.subscribe(job=>{if(job.appliedRevision)for(const id of store.projectIds(job.projectId))update(id).projectRevision=job.appliedRevision;publishProject(job.projectId);});
 const unsubscribeReferences=references?.subscribe(item=>publishProject(item.projectId));
 const context=(p,active=update(p.id))=>({draft:!!p.draft,brief:p.brief||'',productionPlan:p.productionPlan||null,native:p.native||null,hypitTools:!!engine,id:p.id,name:p.name,template:p.template,limits:p.limits,productionLimits:productionLimits(p.productionPlan),capabilities:[...p.capabilities,...(images?['generate_image']:[]),...(audio?['generate_audio']:[]),...(tasks?['get_tasks','await_tasks']:[]),...(generations?['generate_video']:[]),...(p.template==='product'&&generations?['apply_generated_video']:[]),...(references?['analyze_video']:[]),...(references?['analyze_reference','recover_reference_plan','edit_reference_plan','apply_reference_plan','generate_reference_video']:[])],references:references?.list(p.id).filter(r=>r.purpose!=='quality').sort((a,b)=>(b.id===p.productionPlan?.referenceId?1:0)-(a.id===p.productionPlan?.referenceId?1:0)).slice(0,3)||[],texts:p.texts,y:p.y,size:p.size,headingsVisible:p.headingsVisible,overlaysVisible:p.overlaysVisible,revision:p.revision,shots:p.shots,duration:p.duration,music:p.music,components:p.components||[],componentCatalog:p.template==='product'?componentCatalog:[],audioTracks:p.audioTracks||[],audioGenerations:audio?.list(p.id)||[],assets:p.assets,generations:generations?.list(p.id)||[],tasks:tasks?.list(p.id)||[],imageGenerations:images?.list(p.id)||[],selection:active.selection||null,conversation:{id:active.id,title:active.title,sharedProject:true},conversations:[...states.values()].filter(s=>s.projectId===p.id).map(s=>({id:s.id,title:s.title,archived:!!s.archived,status:s.status})),output:p.draft?null:p.output||{width:540,height:960,fps:30}});
 const bridge={instanceId:crypto.randomUUID(),ready:false,error:null,state,
  notify:id=>{publishProject(id);resumeProject(id);},
  subscribe(projectId,fn,conversationId=projectId){const id=store.ensure(projectId,conversationId).id;if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(fn);return()=>listeners.get(id)?.delete(fn);},
  async ownTask(projectId,id,kind,job){store.ensure(projectId,id);store.own(id,kind,job);await store.queue;publishProject(projectId);},
  async conversations(id){await service.get(id);return store.list(id);},
  async createConversation(id,input){await service.get(id);return store.create(id,input);},
  async patchConversation(id,cid,input){await service.get(id);return store.patch(id,cid,input);},
  async activateConversation(id,cid){await service.get(id);return store.activate(id,cid);}
 };

 // Media completion settles native DSH jobs immediately, even while the agent
 // is reading that job. DSH alone schedules the continuation; legacy mode waits for idle.
 const resuming=new Set();
 async function resume(id){
  if(closed||!bridge.ready||resuming.has(id))return;
  const s=update(id),projectId=s.projectId,waiting=s.awaiting;if(!waiting||(!nativeWeb&&s.status==='running')||s.stopping||waiting.turnId!==s.turnId)return;
  resuming.add(id);
  try{
   const results=tasks.results(projectId,waiting.taskIds);if(results.some(r=>r.status==='running')){if(s.status!=='running')s.status='waiting';publish(id);persist(id);return;}
   if(nativeWeb){
    if(!s.waitRegistered){await bridge.ensure(projectId,id);setImmediate(()=>resume(id).catch(()=>{}));return;}
    if(s.awaiting!==waiting||s.stopping||waiting.turnId!==s.turnId)return;
    s.awaiting=null;s.waitRegistered=false;s.resuming=waiting.id;persist(id);await saving;
    child.send({type:'tasks-settled',projectId,conversationId:id,waitId:waiting.id,result:{userRequest:s.userRequest,instruction:waiting.instruction,results}});return;
   }
   if((s.continuations||0)>=4){s.awaiting=null;s.status='idle';s.messages.push({role:'error',text:'本次自动接续已达上限，已完成的结果保留。'});publish(id);persist(id);return;}
   s.continuations=(s.continuations||0)+1;s.awaiting=null;s.resuming=waiting.id;s.segmentId=waiting.id;s.segmentStarted=Date.now();s.status='running';persist(id);await saving;
   const p=await service.get(projectId);
   if(closed||s.stopping||s.turnId!==waiting.turnId){delete s.resuming;s.status='idle';persist(id);return;}
   child.send({type:'prompt',requestId:waiting.id,projectId,conversationId:id,sessionId:s.sessionId,prompt:JSON.stringify({userRequest:s.userRequest,taskContinuation:{instruction:waiting.instruction,results},project:context(p,s)})});
   armTimeout(id);publish(id);
  }catch(e){s.status='idle';s.awaiting=null;delete s.resuming;s.messages.push({role:'error',text:'自动接续失败：'+e.message});persist(id);publish(id);}
  finally{resuming.delete(id);}
 }
 const unsubscribeTasks=tasks?.subscribe(id=>{publishProject(id);resumeProject(id);});
 const unsubscribeImages=tasks?undefined:images?.subscribe(j=>publishProject(j.projectId));
 function armTimeout(id){if(nativeWeb)return;clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>{bridge.cancel(update(id).projectId,id);update(id).messages.push({role:'error',text:'模型响应中断，已完成的结果保留。'});publish(id);persist(id);},180000));}
 const child=spawn(process.execPath,[path.join(root,'node_modules/@deepseek-ai/dsh/lib/bin.js'),'--profile',nativeWeb?'frame-native':'frame'],{cwd:path.join(root,'harness'),stdio:['ignore','pipe','pipe','ipc'],env:{...Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),NODE_USE_ENV_PROXY:'1',FRAME_MCP_CONFIG:process.env.FRAME_MCP_CONFIG||path.join(root,'harness/mcp.config.json'),FRAME_NATIVE_DSH:nativeWeb?'1':'0',FRAME_DSH_PORT:String(nativePort),FRAME_CODE_ROOT:path.join(service.dataRoot,'workspaces'),FRAME_SKILLS_DIR:path.join(root,'harness/skills'),FRAME_HYPIT_SKILLS_DIR:path.resolve(root,'../hypit/skills'),FRAME_DSH_STORAGE:path.join(service.dataRoot,'dsh-storage'),DSH_TELEMETRY_DISABLED:'1',DSH_PRODUCT_ANALYTICS_DISABLED:'1',PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,DSH_HOME:path.join(root,'harness'),DSH_TELEMETRY:'0',FRAME_PLUGIN_PATH:path.join(root,'harness/plugin.mjs'),FRAME_SESSION_DIR:path.join(service.dataRoot,'sessions'),...Object.fromEntries(['CREATIVE_API_KEY','CREATIVE_MODEL','CREATIVE_BASE_URL','CREATIVE_PROTOCOL','CREATIVE_ENABLED'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]])),DEEPSEEK_API_KEY:process.env.DEEPSEEK_API_KEY||'',DEEPSEEK_BASE_URL:process.env.DEEPSEEK_BASE_URL||'https://api.deepseek.com',DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'}});
 let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',x=>{logs=(logs+x).slice(-5000);});
 child.on('error',e=>{bridge.error=e.message;bridge.ready=false;});child.on('exit',code=>{bridge.ready=false;bridge.error='对话服务已退出 ('+code+') '+logs.slice(-1000);for(const [id,s] of states)if(s.status==='running'){s.status='idle';interruptMessages(s);clearTimeout(timers.get(id));s.messages.push({role:'error',text:'对话服务已停止，请重启工作台。'});publish(id);persist(id);}});
 child.on('message',m=>withConversationWorkspace(m.conversationId||m.projectId,async()=>{
  const cid=m.projectId?store.ensure(m.projectId,m.conversationId||m.projectId).id:undefined;
  // Native DSH already streams its chat over its own connection. Forwarding
  // each token as another full Frame history duplicates traffic and can fill
  // the HTTP write queue during long conversations.
  if(nativeWeb&&m.type==='stream')return;
  if(m.type==='ready'){bridge.authURL=m.authURL;bridge.ready=true;bridge.error=null;for(const id of states.keys())resume(id).catch(()=>{});}
  if(m.type==='accepted'){const s=states.get(cid);if(s?.resuming===m.requestId){delete s.resuming;persist(cid);}}
  if(m.type==='native-inspection'){pendingSessions.get(m.requestId)?.resolve(m.result);pendingSessions.delete(m.requestId);}
  if(m.type==='home-session'){pendingSessions.get(m.requestId)?.resolve(m.sessionId);pendingSessions.delete(m.requestId);return;}
 if(m.type==='session'){update(cid).sessionId=m.sessionId;persist(cid);pendingSessions.get(m.requestId)?.resolve(m.sessionId);pendingSessions.delete(m.requestId);}
 if(m.type==='native-input'){const s=update(cid),text=claimNativeInput(s,m.text,m);store.nameFromMessage(cid,text);s.segmentId=crypto.randomUUID();s.segmentStarted=Date.now();s.status='running';armTimeout(cid);}
 if(m.type==='wait-delivered'){const s=update(cid);if(s.resuming===m.waitId){delete s.resuming;persist(cid);}}
 if(m.type==='native-wakeup'){const s=update(cid);claimNativeWakeup(s,m);s.segmentId=crypto.randomUUID();s.segmentStarted=Date.now();s.stopping=false;s.status='running';armTimeout(cid);}
 if(m.type==='wait-registered'){const s=update(cid);if(s.awaiting?.id===m.waitId){s.waitRegistered=true;s.awaiting.ownerSessionId=m.ownerSessionId;persist(cid);}resume(cid).catch(()=>{});}
 if(m.type==='wait-cancelled'&&!closed){const s=update(cid);if(s.awaiting?.id===m.waitId){s.awaiting=null;s.waitRegistered=false;persist(cid);}}
  if(m.type==='tool'){try{if(update(cid).stopping)throw Error('用户已停止任务');const active=update(cid);active.toolCalls=(active.toolCalls||0)+1;if(active.toolCalls>productionLimits((await service.get(m.projectId)).productionPlan).operations)throw Error('本次任务已达到操作上限');const p=await service.get(m.projectId);let value;if(m.operation==='conversation-history'){const other=store.ensure(m.projectId,m.args.conversationId);value={id:other.id,title:other.title,messages:other.messages.filter(x=>['user','assistant'].includes(x.role)).slice(-Math.min(10,Math.max(1,Number(m.args.limit)||6))).map(x=>({role:x.role,text:x.text?.slice(0,2000)}))};}
  else if(m.operation==='context'){
   if(p.native&&!p.draft&&active.selection?.nativeSelection){const scene=await snapshot(p.id);active.selection={...active.selection,...nativeSelectionContext(scene,active.selection.nativeSelection,active.selection.playhead)};}
   value={...context(p,active),editing:p.native||p.draft?{engine:'hypit',skill:'hypit',sourceOfTruth:'SVML/SVS/SVRun',inspect:'inspect_hypit_scene',mutate:'edit_hypit_scene',timing:'adjust_hypit_timing',author:'checkout_hypit_project → commit_hypit_project'}:null,audioConfiguration:await audio?.configuration(),transcriptionConfiguration:await transcriptions?.configuration(),imageConfiguration:await images?.configuration?.(),videoConfiguration:await generations?.configuration()};
  }
 else if(m.operation==='transcribe'){const s=update(cid);s.transcriptRequests??={};const k=s.turnId+':'+m.args.operationId;s.transcriptRequests[k]??=crypto.randomUUID();persist(cid);await saving;value=await transcriptions.create(m.projectId,{requestId:s.transcriptRequests[k],assetFile:m.args.assetFile,languageCode:m.args.languageCode});}
 else if(m.operation==='hypit-command')value=await engine.command(m.projectId,JSON.parse(m.args.args));
 else if(m.operation==='hypit-import')value=await engine.importProject(m.args);
 else if(m.operation==='hypit-speech')value=await engine.speechEvidence(m.projectId,m.args.assetFile);
 else if(m.operation==='hypit-catalog')value=await engine.catalog();
 else if(m.operation==='motion-list')value=await engine.motionLibrary.list();
 else if(m.operation==='motion-use')value=await engine.motionLibrary.use(m.projectId,m.args.componentId);
 else if(m.operation==='motion-save')value=await engine.motionLibrary.save(m.projectId,m.args);
 else if(m.operation==='hypit-docs')value=await engine.docs(m.args.path);
 else if(m.operation==='hypit-read')value=await engine.read(m.projectId,m.args.path);
 else if(m.operation==='hypit-edit')value=await engine.edit(m.projectId,m.args.revision,JSON.parse(m.args.files),m.args.options?JSON.parse(m.args.options):{});
 else if(m.operation==='hypit-checkout')value=await engine.checkout(m.projectId);
 else if(m.operation==='hypit-sync')value=await engine.syncAssets(m.projectId,m.args.assetFiles);
 else if(m.operation==='hypit-compose')value=await engine.compose(m.projectId,m.args.revision,JSON.parse(m.args.composition));
 else if(m.operation==='hypit-commit')value=await engine.applyWorkspace(m.projectId,m.args.revision,m.args.options?JSON.parse(m.args.options):{});
 else if(m.operation==='hypit-inspect'){const s=agentStudioSnapshot(await snapshot(m.projectId));value={revision:s.revision,space:s.space,tracks:s.tracks,semantic:s.semantic,script:s.script};}
 else if(m.operation==='hypit-build')value=await nativeBuilds.create(m.projectId,{...m.args,conversationId:cid,outputs:JSON.parse(m.args.outputs)});
 else if(m.operation==='hypit-runtime')value=await nativeRuntime.status(service.dir(m.projectId));
 else if(m.operation==='hypit-index-assets')value=await engine.indexAssets(m.projectId);
 else if(m.operation==='hypit-timing')value=await adjustTiming(m.projectId,{...m.args,semantic:m.args.semantic?JSON.parse(m.args.semantic):undefined});
 else if(m.operation==='hypit-mutation')value=await studioMutation(m.projectId,JSON.parse(m.args.mutation));
 else if(m.operation==='hypit-fork')value=await engine.fork(m.projectId,m.args.name);
 else if(m.operation==='stage-asset'){
  const asset=p.assets.find(a=>a.filename===m.args.assetFile);if(!asset)throw Error('素材不属于当前项目');
  const base=await fs.realpath(conversationWorkspace(service.dataRoot,m.projectId,cid));await fs.mkdir(path.join(base,'input'),{recursive:true});
  const input=await fs.realpath(path.join(base,'input'));if(!input.startsWith(base+path.sep))throw Error('素材目录不在当前代码工作区');
  const file=path.join('input',crypto.randomUUID()+'-'+asset.filename);await fs.writeFile(path.join(base,file),await fs.readFile(path.join(service.dir(m.projectId),'assets',asset.filename)),{flag:'wx'});value={file,kind:asset.kind,name:asset.name};
 }
 else if(m.operation==='stage-export'){
  const job=await getExportStatus(m.projectId,m.args.jobId);if(job.status!=='done')throw Error('成片尚未完成');
  const base=await fs.realpath(conversationWorkspace(service.dataRoot,m.projectId,cid));await fs.mkdir(path.join(base,'input'),{recursive:true});
  const input=await fs.realpath(path.join(base,'input'));if(!input.startsWith(base+path.sep))throw Error('素材目录不在当前代码工作区');
  const file=path.join('input','成片-'+job.id+'.mp4'),destination=path.join(base,file);
  try{await fs.writeFile(destination,await fs.readFile(path.join(service.dataRoot,'exports',job.id,'final.mp4')),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const real=await fs.realpath(destination);if(!real.startsWith(input+path.sep))throw Error('成片文件不在输入目录');}
  value={file,duration:job.duration,output:job.output};
 }
 else if(m.operation==='publish-workspace'){
  const base=await fs.realpath(conversationWorkspace(service.dataRoot,m.projectId,cid));
  if(typeof m.args.file!=='string'||path.isAbsolute(m.args.file))throw Error('使用代码工作区内的相对路径');
  const file=await fs.realpath(path.resolve(base,m.args.file));if(!file.startsWith(base+path.sep))throw Error('文件不在当前代码工作区');
  const stat=await fs.stat(file);if(!stat.isFile()||stat.size>80e6)throw Error('产物需为不超过 80 MB 的媒体文件');
  const bytes=await fs.readFile(file),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  value=p.assets.find(a=>a.provenance?.provider==='code'&&a.provenance?.sha256===sha256)||await importAsset(service.dir(m.projectId),bytes,m.args.name?String(m.args.name).replace(/\.[a-z0-9]+$/i,'')+path.extname(file):path.basename(file),{provider:'code',workspaceFile:m.args.file,sha256});publishProject(m.projectId);
 }
 else if(m.operation==='resume-video'){const job=generations.get(m.projectId,m.args.jobId);if(!job.remoteId)throw Error('没有可恢复查询的远端任务，不能重复生成');job.pollFailures=0;value=await generations.poll(job.id);}
 else if(m.operation==='tasks')value=tasks.list(m.projectId);
 else if(m.operation==='await-tasks'){
  tasks.results(m.projectId,m.args.taskIds);if(typeof m.args.instruction!=='string'||!m.args.instruction.trim()||m.args.instruction.length>2000)throw Error('请说明任务完成后的下一步');
  const s=update(cid),prior=s.awaiting?.turnId===s.turnId?s.awaiting:null;if(prior?.ownerSessionId&&m.ownerSessionId&&prior.ownerSessionId!==m.ownerSessionId)throw Error('此对话已有另一代理等待媒体任务，请在它完成后继续，已提交素材不会丢失');s.awaiting={ownerSessionId:m.ownerSessionId||prior?.ownerSessionId,id:prior?.id||crypto.randomUUID(),turnId:s.turnId,taskIds:[...new Set([...(prior?.taskIds||[]),...m.args.taskIds])],instruction:m.args.instruction,nextStep:String(m.args.nextStep||'').slice(0,60)};persist(cid);await saving;value={waiting:true,taskIds:s.awaiting.taskIds,waitId:s.awaiting.id};
 }
 else if(m.operation==='audio-voices')value=await audio.voices(m.args.provider);
 else if(m.operation==='production-plan'){const input={...m.args,scenes:JSON.parse(m.args.scenes)},referenceId=m.args.referenceId||p.productionPlan?.referenceId;value=referenceId?await references.updateProductionPlan(m.projectId,referenceId,input):await service.plan(m.projectId,input);}
 else if(m.operation==='asset-metadata'){value=await updateAssetMetadata(service.dir(m.projectId),m.args);publishProject(m.projectId);}
 else if(m.operation==='rename')value=await service.rename(m.projectId,{name:m.args.name,expectedName:p.name});
 else if(m.operation==='generate-audio'){
  if(!audio)throw Error('声音生成不可用');const s=update(cid);s.audioRequests??={};
  if(typeof m.args.operationId!=='string'||!m.args.operationId.trim()||m.args.operationId.length>100)throw Error('声音操作 ID 无效');
  const key=s.turnId+':'+m.args.operationId;
  if(!s.audioRequests[key]){s.audioRequests[key]=crypto.randomUUID();persist(cid);await saving;}
  value=await audio.create(m.projectId,{...m.args,requestId:s.audioRequests[key]});
 }
 else if(m.operation==='resume-image'){const job=images.get(m.projectId,m.args.jobId);if(!job.remoteId)throw Error('图片任务没有远端 ID，请先核对服务商记录');value=await images.poll(job.id);}
 else if(m.operation==='generate-image'){
  if(!images)throw Error('图片生成不可用');const s=update(cid);s.imageRequests??={};const key=s.turnId+':'+m.args.operationId;
  if(!s.imageRequests[key]){s.imageRequests[key]=crypto.randomUUID();persist(cid);await saving;}
  const ratio=p.output?.width/p.output?.height;const size=Math.abs(ratio-4/3)<.01?'2368x1776':Math.abs(ratio-3/4)<.01?'1776x2368':Math.abs(ratio-16/9)<.01?'2560x1440':Math.abs(ratio-1)<.01?'2048x2048':'1440x2560';value=await images.create(m.projectId,{size,...m.args,requestId:s.imageRequests[key]});
 }
 else if(m.operation==='change'){const {revision,clearAsset,...change}=m.args;if(clearAsset)change.assetFile=null;value=await service.change(m.projectId,revision,change);}
 else if(m.operation==='timeline'){const {revision,...args}=m.args;value=await service.change(m.projectId,revision,{type:'timeline',...args});}
 else if(m.operation==='batch')value=await service.change(m.projectId,m.args.revision,{type:'batch',changes:JSON.parse(m.args.changes)});
 else if(m.operation==='generate'){
  if(!generations||!['product','hypit-native','draft'].includes(p.template))throw Error('当前项目不支持视频生成');
  const s=update(cid);s.generationRequests??={};
  const key=s.turnId+':'+m.args.operationId;
  if(!s.generationRequests[key]){s.generationRequests[key]=crypto.randomUUID();persist(cid);await saving;}
  const ratio=['9:16','16:9','1:1','4:3','3:4','21:9'].find(r=>{const [w,h]=r.split(':').map(Number);return Math.abs(w/h-p.output?.width/p.output?.height)<.01;})||'9:16';value=await generations.create(m.projectId,{ratio,...m.args,...(typeof m.args.references==='string'?{references:JSON.parse(m.args.references)}:{}),requestId:s.generationRequests[key],imageFile:m.args.imageFile||null,imageMode:m.args.imageMode||'reference_image',resolution:m.args.resolution,audio:m.args.audio!==false,autoApply:p.native||p.draft?false:m.args.autoApply!==false,confirmed:true});
 }
 else if(m.operation==='reference-analyze'){
  const s=update(cid);s.referenceRequests??={};const k=s.turnId+':'+m.args.operationId;s.referenceRequests[k]??=crypto.randomUUID();persist(cid);await saving;
  value=await references.create(m.projectId,{...m.args,requestId:s.referenceRequests[k]});
 }
 else if(m.operation==='reference-status')value=references.list(m.projectId);
 else if(m.operation==='reference-recover')value=await references.recover(m.projectId,m.args.referenceId,{version:m.args.version,plan:JSON.parse(m.args.plan),evidence:JSON.parse(m.args.evidence)});
 else if(m.operation==='reference-edit')value=await references.update(m.projectId,m.args.referenceId,{version:m.args.version,plan:JSON.parse(m.args.plan),ratio:m.args.ratio});
 else if(m.operation==='reference-apply')value=await references.apply(m.projectId,m.args.referenceId,m.args);
 else if(m.operation==='reference-generate')value=await references.generate(m.projectId,m.args.referenceId,{...m.args,...(m.args.indices?{indices:JSON.parse(m.args.indices)}:{})});
 else if(m.operation==='generation-status')value=generations?.list(m.projectId)||[];
 else if(m.operation==='apply-generation')value=await generations.apply(m.projectId,m.args.jobId,m.args.revision,m.args.shotId,true);
 else if(m.operation==='batch-text'){const edits=JSON.parse(m.args.edits);if(!Array.isArray(edits))throw Error('edits 需要是数组');value=await service.change(m.projectId,m.args.revision,{type:'batch',changes:edits.map(e=>({type:'text',id:e.id,text:e.text}))});}
 else if(m.operation==='chat-timing')value=await service.change(m.projectId,m.args.revision,{type:'chat-timing',duration:m.args.duration,arrivals:JSON.parse(m.args.arrivals)});
 else if(m.operation==='undo')value=await service.undo(m.projectId,m.args.revision);
 else if(m.operation==='validate'){if(p.native){await engine.run(engine.hypit,['check',path.join(service.dir(m.projectId),p.native.run),'--workspace',service.dir(m.projectId),'--json'],{timeout:45000});}else await service.validate(service.dir(m.projectId));value={valid:true,revision:p.revision,duration:p.duration,texts:p.texts};}
 else if(m.operation==='export'){if(!exportVideo)throw Error('导出服务不可用');value=await exportVideo(m.projectId,m.args.revision,m.args.summary);}
 else if(m.operation==='export-status'){if(!getExportStatus)throw Error('导出服务不可用');value=await getExportStatus(m.projectId,m.args.jobId);}
 else throw Error('未授权工具');
 const jobKind={'generate':'video','generate-image':'image','generate-audio':'audio','reference-analyze':'reference','transcribe':'transcript','export':'export','hypit-build':'hypit'}[m.operation];if(jobKind)store.own(cid,jobKind,value);if(m.operation==='reference-generate')for(const job of value.jobs||[])store.own(cid,'video',job);
 if(['production-plan','asset-metadata','hypit-edit','hypit-commit','hypit-compose','hypit-mutation','hypit-timing','rename','reference-apply','change','timeline','batch','apply-generation','batch-text','chat-timing','undo'].includes(m.operation)){for(const id of store.projectIds(m.projectId))update(id).projectRevision=value.revision||value.project?.revision;}
 if(['production-plan','rename','asset-metadata'].includes(m.operation)){for(const id of store.projectIds(m.projectId))update(id).metadataUpdated=Date.now();}
 child.send({type:'tool-result',id:m.id,value});}catch(e){child.send({type:'tool-result',id:m.id,error:e.message});}}
  if(m.type==='status'){const s=update(cid);if(nativeWeb)trackNativeTurnStatus(s,m.status);if(nativeWeb&&m.status==='running'&&s.status!=='running'){s.segmentStarted=Date.now();s.lastProgress=Date.now();s.stopping=false;armTimeout(cid);}s.status=m.status;if(m.status==='idle'){if(s.awaiting&&!s.stopping)s.status='waiting';setImmediate(()=>resume(cid).catch(()=>{}));interruptMessages(s);clearTimeout(timers.get(cid));const latestUser=s.messages.findLastIndex(x=>x.role==='user');if(!s.stopping&&!s.awaiting&&!s.messages.slice(latestUser+1).some(x=>x.role==='assistant'&&x.turnToken===(s.segmentId||s.turnId)&&x.text?.trim()||x.role==='error'))s.messages.push({role:'error',text:'模型本轮未返回可见答复，已经完成的操作保留，可继续当前任务。'});s.stopping=false;}}
  if(m.type==='error'){pendingSessions.get(m.requestId)?.reject(Error(m.error));pendingSessions.delete(m.requestId);if(!m.projectId)return;const s=update(cid);s.status='idle';clearTimeout(timers.get(cid));interruptMessages(s);s.messages.push({role:'error',text:m.error});}
  if(m.type==='event'||m.type==='stream'){const s=update(cid);reduceChatEvent(s,m);if(!nativeWeb&&s.status==='running'&&Date.now()-(s.lastProgress||0)>10000){s.lastProgress=Date.now();if(Date.now()-(s.segmentStarted||Date.now())>900000)bridge.cancel(m.projectId,cid);else armTimeout(cid);}}
 if(m.projectId&&states.has(cid)){publishProject(m.projectId);if(m.type!=='stream')persist(cid);}

 }).catch(e=>{console.error('对话事件处理失败:',e.message);if(m.type==='tool')child.send({type:'tool-result',id:m.id,error:e.message});}));
 bridge.inspectNative=async(projectId,compact=false,conversationId=projectId)=>{const s=store.ensure(projectId,conversationId),requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('原生诊断超时'));},20000);pendingSessions.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.send({type:'inspect-native',projectId,conversationId:s.id,sessionId:s.sessionId,requestId,compact});});};
 bridge.ensureHome=async()=>{const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('输入框连接超时'));},25000);pendingSessions.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});child.send({type:'ensure-home',requestId});});};
 bridge.ensure=async(projectId,conversationId=projectId)=>{await service.get(projectId);const s=store.ensure(projectId,conversationId);if(s.archived)throw Error('请先恢复这段对话');const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('原生会话初始化超时'));},25000);pendingSessions.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.send({type:'ensure',requestId,projectId,conversationId:s.id,sessionId:s.sessionId,waiting:s.awaiting});});};
 bridge.select=async(id,{selectedId,selectedAsset,mode,nativeSelection,playhead,conversationId=id})=>{
  const p=await service.get(id),state=store.ensure(id,conversationId);
  if(p.native&&!p.draft){
   const selection=nativeSelection||(selectedId?{kind:'clip',clipId:selectedId}:state.selection?.nativeSelection||{kind:'none'});
   state.selection={...nativeSelectionContext(await snapshot(id),selection,playhead??state.selection?.playhead),assetFile:p.assets.some(a=>a.filename===selectedAsset)?selectedAsset:null};
  }else state.selection={selectedId:p.texts.some(t=>t.id===selectedId)?selectedId:null,shotId:p.shots?.find(s=>s.captionId===selectedId)?.id||null,assetFile:p.assets.some(a=>a.filename===selectedAsset)?selectedAsset:null};
  state.selection.mode=mode==='guided'||mode==='guide'?'guided':'free';
 };
 bridge.prompt=async(projectId,{text,selectedId,selectedAsset,mode,conversationId=projectId})=>{
  if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('请输入 1–4000 字的指令');
  const s=store.ensure(projectId,conversationId),id=s.id;if(s.archived)throw Error('请先恢复这段对话');if(prompting.has(id)||['running','waiting'].includes(s.status))throw Error('当前对话仍在进行，请在对话中调整要求');
  prompting.add(id);try{
  const currentProject=await service.get(projectId);await bridge.ensure(projectId,id);await bridge.select(projectId,{selectedId,selectedAsset,mode,conversationId:id});
  delete s.outcome;s.status='running';s.turnId=crypto.randomUUID();s.segmentId=s.turnId;s.stopping=false;s.awaiting=null;s.resuming=null;s.continuations=0;s.toolCalls=0;s.segmentStarted=Date.now();s.turnStarted=Date.now();s.userRequest=text;if(nativeWeb)s.pendingNativeText=text;s.messages.push({role:'user',text});store.nameFromMessage(id,text);
  child.send({type:'prompt',requestId:crypto.randomUUID(),projectId,conversationId:id,sessionId:s.sessionId,prompt:nativeWeb?text:JSON.stringify({userRequest:text,selectedId,selectedAsset:currentProject.assets.find(a=>a.filename===selectedAsset)||null,mode,project:context(currentProject,s)})});publish(id);persist(id);armTimeout(id);return s;
  }finally{prompting.delete(id);}
 };
 bridge.cancel=async(projectId,conversationId=projectId)=>{const s=store.ensure(projectId,conversationId),id=s.id;s.outcome='stopped';s.stopping=true;s.awaiting=null;s.resuming=null;if(s.status==='waiting')s.status='idle';clearTimeout(timers.get(id));child.send({type:'cancel',projectId,conversationId:id});s.messages.push({role:'tool',text:'已请求停止；已完成的修改可撤销。'});publish(id);persist(id);};
 bridge.close=()=>closed||(closed=(async()=>{unsubscribeGenerations?.();unsubscribeReferences?.();unsubscribeTasks?.();unsubscribeImages?.();for(const timer of timers.values())clearTimeout(timer);if(child.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;}await store.queue;})());
 await new Promise(r=>{const timer=setTimeout(r,12000);const listener=m=>{if(m.type==='ready'){clearTimeout(timer);child.off('message',listener);r();}};child.on('message',listener);child.once('exit',()=>{clearTimeout(timer);r();});});
 if(!bridge.ready&&!bridge.error)bridge.error='对话服务尚未启动完成：'+logs.slice(-1000);
 return bridge;
}
