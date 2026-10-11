import {validateProductionPreferences,validateReferences,productionPreferencesFromUserText,enforceProductionPreferences,mergeProductionPreferences} from './conversation-input.mjs';
import {mediaOperationInput,prepareAgentMedia} from './agent-media.mjs';
import {effectiveMediaCapabilities,effectiveMediaConfiguration} from './production-capabilities.mjs';
import {TurnChanges} from './turn-changes.mjs';
import {agentRuntimeEnvironment} from './agent-model.mjs';
import {sourceFiles} from './native-engine.mjs';
import {prepareNativeMediaReplacement} from './native-media-replacement.mjs';
import {ConversationStore} from './conversations.mjs';
import {conversationWorkspace,withConversationWorkspace} from './conversation-workspace.mjs';
import {ensureWorkspaceGit} from './workspace-git.mjs';
import {productionLimits} from './production-limits.mjs';
import {claimNativeInput,claimNativeWakeup,trackNativeTurnStatus} from './native-turn.mjs';
import {nativeSelectionContext,compactAgentScene} from './studio-selection.mjs';
import {componentCatalog} from './visual-components.mjs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { root } from './project.mjs';
import {importAsset,updateAssetMetadata} from './assets.mjs';
import {reduceChatEvent,interruptMessages} from './chat-events.mjs';
import {OperationStore,productionIdentity,unknownOperation} from './operation-store.mjs';
import {protectedConfiguration,protectedConfigurationEnvironment} from './protected-configuration.mjs';
const previewMetadata=value=>JSON.parse(JSON.stringify(value,(key,item)=>key==='image'?undefined:item));
const mergeTaskReferences=(existing=[],incoming=[])=>[...new Map([...existing,...incoming].map(ref=>[JSON.stringify([ref.videoId,ref.id]),ref])).values()];
export async function createAgentBridge({service,exportVideo,getExportStatus,generations,getExports,references,images,audio,tasks,nativeWeb=false,nativePort=5182,harnessHome=path.join(root,'harness'),engine,snapshot,studioMutation,adjustTiming,transcriptions,nativeRuntime,nativeBuilds,library,skills,previews,beats,beatGuides}){
 const pendingSessions=new Map(),nativePreparations=new Map(),ensuredSessions=new Set();
 const store=await new ConversationStore(service.dataRoot).init(),states=store.states;
 const operations=await new OperationStore(service.dataRoot).init();
 const changes=await new TurnChanges(service).init();
 const timers=new Map(),prompting=new Set();let saving=store.queue;
 const persist=id=>{saving=store.persist(id);return saving;};
 const update=id=>store.get(id);
 async function codeWorkspace(projectId,conversationId){
  const directory=conversationWorkspace(service.dataRoot,projectId,conversationId),root=path.join(service.dataRoot,'workspaces');
  await fs.mkdir(directory,{recursive:true});
  const [canonical,canonicalRoot]=await Promise.all([fs.realpath(directory),fs.realpath(root)]);
  if(canonical!==path.join(canonicalRoot,path.relative(root,directory)))throw Error('代码工作区不属于当前项目和视频');
  await ensureWorkspaceGit(canonical,{root});
  return canonical;
 }
 const state=(projectId,conversationId)=>{
  const s=conversationId?store.ensure(projectId,conversationId):update(projectId),id=s.id,pid=s.projectId;
  const videoId=service.currentVideoId?.(pid)||s.videoId||'v-default';
  const own=(kind,items)=>store.jobs(pid,id,kind,items||[]);
  return {...s,videoId,conversationId:id,beatAnalyses:beats?.listSync(pid)||[],beatBindings:beatGuides?.listSync(pid)||[],visualPreviews:(s.visualPreviews||[]).filter(item=>item.videoId===videoId),changeSet:changes.latest(id,s.turnId),projectExports:getExports?.(pid,true)||[],projectReferences:(references?.list(pid)||[]).map(({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,analysis,analysisMethod,analysisFallback,analysisModel,exportId,error,phase,videoId})=>({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,analysis,analysisMethod,analysisFallback,analysisModel,exportId,error,phase,videoId})),projectTasks:(tasks?.list(pid)||[]).map(j=>({...j,conversationId:store.owner(pid,j.kind,j.id.split(':').slice(1).join(':'))||pid})),generations:own('video',generations?.list(pid)),images:own('image',images?.list(pid)),audio:own('audio',audio?.list(pid)),tasks:(tasks?.list(pid)||[]).map(j=>({...j,conversationId:store.owner(pid,j.kind,j.id?.split(':').slice(1).join(':'))||pid})).filter(j=>j.conversationId===id),exports:own('export',getExports?.(pid)),references:own('reference',references?.list(pid).filter(r=>(r.videoId||'v-default')===videoId)).map(({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,analysis,analysisMethod,analysisFallback,analysisModel,exportId,error,phase,videoId,conversationId})=>({id,status,version,assetName,assetFile,created,purpose,production,applied,ratio,targetDuration,analysis,analysisMethod,analysisFallback,analysisModel,exportId,error,phase,videoId,conversationId}))};
 };
 const listeners=new Map();let closed;
 const publish=id=>{for(const fn of listeners.get(id)||[])fn();};
 const publishProject=pid=>{for(const id of store.projectIds(pid))publish(id);};
 const resumeProject=pid=>{for(const id of store.projectIds(pid))resume(id).catch(e=>console.error('接续任务失败:',e.message));};
 const readyMedia=(projectId,items,conversationId,options)=>prepareAgentMedia({service,engine},projectId,items,conversationId,options);
 const unsubscribeGenerations=generations?.subscribe(job=>{if(job.appliedRevision)for(const id of store.projectIds(job.projectId))update(id).projectRevision=job.appliedRevision;publishProject(job.projectId);});
 const unsubscribeReferences=references?.subscribe(item=>publishProject(item.projectId));
 async function mediaOperation(p,operation,args,adapter,input,configuration,rpcId){
  input=mediaOperationInput(p,operation,input);
  if(configuration?.provider)input={...input,provider:input.provider||configuration.provider};
  if(operation==='generate-image')input={imageFiles:[],quality:'configured',...input};
  if(operation==='generate')input={references:[],quality:'configured',...input};
  if(operation==='generate-audio')input={text:'',prompt:'',referenceFile:'',duration:null,speed:1,...input,languageCode:input.languageCode||(/[\u3400-\u9fff]/.test(input.text||'')?'zh':null),...(configuration?.voiceId?{voiceId:input.voiceId||configuration.voiceId}:{})};
  const productionId=args.productionId===undefined&&['transcribe','reference-analyze'].includes(operation)?'media-evidence-'+p.id:productionIdentity(p,args.productionId);
  return operations.runMedia({projectId:p.id,productionId,operation,operationId:args.operationId,operationVersion:args.operationVersion,attemptId:args.attemptId,input,configuration,rpcId},
   requestId=>adapter.create(p.id,{...input,requestId}),
   requestId=>adapter.list?.(p.id).find(job=>job.id===requestId));
 }
 async function generationConfiguration(operation,args,adapter){
  const config=await adapter.configuration?.()||{};if(args.model)config.model=args.model;
  if(operation==='generate-audio'){
   const provider=args.provider||(args.kind==='voice-change'?'elevenlabs':['voice-design','voice-clone'].includes(args.kind)?'mimo':args.kind==='speech'?config.speechProvider:args.kind==='music'?config.musicProvider:'elevenlabs');
   const model=args.kind==='voice-change'?'eleven_multilingual_sts_v2':args.model|| (provider==='minimax'?args.kind==='music'?config.minimaxMusicModel:config.minimaxSpeechModel:provider==='elevenlabs'?args.kind==='speech'?config.elevenlabsSpeechModel:args.kind==='music'?'music_v2_5':'eleven_text_to_sound_v2':args.kind);
   return {provider,model,...(['speech','voice-design','voice-clone','voice-change'].includes(args.kind)?{voiceId:args.voiceId||(provider==='minimax'?config.minimaxVoiceId:provider==='elevenlabs'?config.elevenlabsVoiceId:config.mimoVoice)}:{})};
  }
  const provider=args.provider||config.provider;
  return {provider,model:args.model||(operation==='generate'?config[provider+'Model']:provider===config.provider?config.model:undefined)};
 }
 const context=(p,active=update(p.id))=>({videoId:p.videoId||'v-default',brand:p.brand||null,draft:!!p.draft,brief:p.brief||'',productionPlan:p.productionPlan||null,beatAnalyses:beats?.listSync(p.id)||[],beatBindings:beatGuides?.listSync(p.id)||[],visualPreviews:(active.visualPreviews||[]).filter(item=>item.videoId===(p.videoId||'v-default')).slice(-3),native:p.native||null,hypitTools:!!engine,id:p.id,name:p.name,template:p.template,limits:p.limits,productionLimits:productionLimits(p.productionPlan),capabilities:[...p.capabilities,...(images?['generate_image']:[]),...(audio?['generate_audio']:[]),...(tasks?['get_tasks','await_tasks']:[]),...(previews?['preview_frames','probe_export']:[]),...(beats?['analyze_beats','bind_beat_guides','list_beat_guides']:[]),...(generations?['generate_video']:[]),...(p.template==='product'&&generations?['apply_generated_video']:[]),...(references?['analyze_video']:[]),...(references?['analyze_reference','recover_reference_plan','edit_reference_plan','apply_reference_plan','generate_reference_video']:[])],references:references?.list(p.id).filter(r=>r.purpose!=='quality').sort((a,b)=>(b.id===p.productionPlan?.referenceId?1:0)-(a.id===p.productionPlan?.referenceId?1:0)).slice(0,3)||[],texts:p.texts,y:p.y,size:p.size,headingsVisible:p.headingsVisible,overlaysVisible:p.overlaysVisible,revision:p.revision,shots:p.shots,duration:p.duration,music:p.music,components:p.components||[],componentCatalog:p.template==='product'?componentCatalog:[],audioTracks:p.audioTracks||[],audioGenerations:audio?.list(p.id)||[],assets:p.assets,generations:generations?.list(p.id)||[],tasks:tasks?.list(p.id)||[],imageGenerations:images?.list(p.id)||[],selection:(!active.selection?.videoId||active.selection.videoId===(p.videoId||'v-default'))?active.selection||null:null,conversation:{id:active.id,title:active.title,sharedProject:true,targetVideoIds:active.targetVideoIds||[active.taskVideoId||p.videoId||'v-default'],productionPreferences:mergeProductionPreferences(active.activeProductionPreferences||active.productionPreferences||{},active.userProductionPreferences||{}),references:active.taskReferences||active.inputReferences||[]},conversations:[...states.values()].filter(s=>s.projectId===p.id).map(s=>({id:s.id,title:s.title,archived:!!s.archived,status:s.status})),output:p.draft?null:p.output||{width:540,height:960,fps:30}});
 const bridge={instanceId:crypto.randomUUID(),ready:false,error:null,state,
  notify:id=>{publishProject(id);resumeProject(id);},
  subscribe(projectId,fn,conversationId=projectId){const id=store.ensure(projectId,conversationId).id,videoId=service.currentVideoId?.(projectId)||'v-default';const receive=()=>service.withVideoContext(projectId,videoId,()=>fn(state(projectId,id))).catch(e=>console.error('对话状态发布失败:',e.message));if(!listeners.has(id))listeners.set(id,new Set());listeners.get(id).add(receive);return()=>listeners.get(id)?.delete(receive);},
  async ownTask(projectId,id,kind,job,origin={kind:'user'}){store.ensure(projectId,id);store.own(id,kind,job,origin);await store.queue;publishProject(projectId);},
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
  try{await service.withVideoContext(projectId,s.taskVideoId||s.videoId||'v-default',async()=>{
   let results=tasks.results(projectId,waiting.taskIds);if(results.some(r=>r.status==='running')){if(s.status!=='running')s.status='waiting';publish(id);persist(id);return;}
   results=await readyMedia(projectId,results,id,{respectJobVideo:true});
   if(nativeWeb){
    if(!s.waitRegistered){await bridge.ensure(projectId,id);setImmediate(()=>resume(id).catch(()=>{}));return;}
    if(s.awaiting!==waiting||s.stopping||waiting.turnId!==s.turnId)return;
    s.awaiting=null;s.waitRegistered=false;s.resuming=waiting.id;persist(id);await saving;
    child.send({type:'tasks-settled',projectId,videoId:s.taskVideoId||s.videoId||'v-default',conversationId:id,waitId:waiting.id,result:{userRequest:s.userRequest,instruction:waiting.instruction,results}});return;
   }
   if((s.continuations||0)>=4){s.awaiting=null;s.status='idle';s.messages.push({role:'error',text:'本次自动接续已达上限，已完成的结果保留。'});publish(id);persist(id);return;}
   s.continuations=(s.continuations||0)+1;s.awaiting=null;s.resuming=waiting.id;s.segmentId=waiting.id;s.segmentStarted=Date.now();s.status='running';persist(id);await saving;
   const p=await service.get(projectId);
   if(closed||s.stopping||s.turnId!==waiting.turnId){delete s.resuming;s.status='idle';persist(id);return;}
   child.send({type:'prompt',requestId:waiting.id,projectId,videoId:s.taskVideoId||s.videoId||'v-default',conversationId:id,sessionId:s.sessionId,prompt:JSON.stringify({userRequest:s.userRequest,taskContinuation:{instruction:waiting.instruction,results},project:context(p,s)})});
   armTimeout(id);publish(id);
  });}catch(e){s.status='idle';s.awaiting=null;delete s.resuming;s.messages.push({role:'error',text:'自动接续失败：'+e.message});persist(id);publish(id);}
  finally{resuming.delete(id);}
 }
 const unsubscribeTasks=tasks?.subscribe(id=>{publishProject(id);resumeProject(id);});
 const unsubscribeImages=tasks?undefined:images?.subscribe(j=>publishProject(j.projectId));
 function armTimeout(id){if(nativeWeb)return;clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>{bridge.cancel(update(id).projectId,id);update(id).messages.push({role:'error',text:'模型响应中断，已完成的结果保留。'});publish(id);persist(id);},180000));}
 const withTargetVideo=(m,fn)=>{if(!m.projectId)return fn();const s=store.ensure(m.projectId,m.conversationId||m.projectId),videoId=m.args?.videoId||(m.type==='native-input'?m.videoId||s.videoId:s.taskVideoId)||s.videoId||'v-default';return service.withVideoContext(m.projectId,videoId,fn);};
 const child=spawn(process.execPath,[path.join(root,'engines/agent/runtime/dsh/lib/bin.js'),'--profile',nativeWeb?'frame-native':'frame'],{cwd:harnessHome,stdio:['ignore','pipe','pipe','ipc'],env:{...agentRuntimeEnvironment(process.env),...protectedConfigurationEnvironment(await protectedConfiguration(root,{mcpConfig:process.env.FRAME_MCP_CONFIG})),...Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])),NODE_USE_ENV_PROXY:'1',FRAME_MCP_CONFIG:process.env.FRAME_MCP_CONFIG||path.join(harnessHome,'mcp.config.json'),FRAME_NATIVE_DSH:nativeWeb?'1':'0',FRAME_DSH_PORT:String(nativePort),FRAME_CODE_ROOT:path.join(service.dataRoot,'workspaces'),FRAME_SKILLS_DIR:path.join(root,'harness/skills'),FRAME_HYPIT_SKILLS_DIR:path.join(root,'engines/video/skills'),FRAME_DSH_STORAGE:path.join(service.dataRoot,'dsh-storage'),DSH_TELEMETRY_DISABLED:'1',DSH_PRODUCT_ANALYTICS_DISABLED:'1',PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,DSH_HOME:harnessHome,DSH_TELEMETRY:'0',FRAME_PLUGIN_PATH:path.join(root,'harness/plugin.mjs'),FRAME_SESSION_DIR:path.join(service.dataRoot,'sessions'),...Object.fromEntries(['CREATIVE_API_KEY','CREATIVE_MODEL','CREATIVE_BASE_URL','CREATIVE_PROTOCOL','CREATIVE_ENABLED','CREATIVE_BRIEF_MAX_BYTES'].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]])),DEEPSEEK_API_KEY:process.env.DEEPSEEK_API_KEY||'',DEEPSEEK_BASE_URL:process.env.DEEPSEEK_BASE_URL||'https://api.deepseek.com',DEEPSEEK_MODEL:process.env.DEEPSEEK_MODEL||'deepseek-flash'}});
 let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',x=>{logs=(logs+x).slice(-5000);});
 child.on('error',e=>{bridge.error=e.message;bridge.ready=false;});child.on('exit',code=>{bridge.ready=false;bridge.error='对话服务已退出 ('+code+') '+logs.slice(-1000);for(const [id,s] of states)if(s.status==='running'){s.status='idle';interruptMessages(s);clearTimeout(timers.get(id));s.messages.push({role:'error',text:'对话服务已停止，请重启工作台。'});publish(id);persist(id);}});
 const handleMessage=m=>withTargetVideo(m,()=>withConversationWorkspace(m.conversationId||m.projectId,async()=>{
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
 if(m.type==='native-input'){
  const s=update(cid),priorTurn=s.turnId,text=claimNativeInput(s,m.text,m),fresh=priorTurn!==s.turnId||!s.taskVideoId;
  s.userProductionPreferences=productionPreferencesFromUserText(text,s.userProductionPreferences||{});
  if(fresh){s.taskVideoId=m.videoId||s.videoId||'v-default';s.activeProductionPreferences={...s.productionPreferences};s.taskReferences=[];}
  s.taskReferences=mergeTaskReferences(s.taskReferences,s.inputReferences);s.inputReferences=[];
  s.targetVideoIds=[...new Set([s.taskVideoId,...s.taskReferences.map(ref=>ref.videoId)])];
  await service.withVideoContext(s.projectId,s.taskVideoId,()=>skills?.materializeWorkspace(s.projectId,cid));
  s.taskSkillIds=skills?(await skills.list({projectId:s.projectId})).filter(skill=>skill.enabled).map(skill=>skill.id):[];
  store.nameFromMessage(cid,text);s.segmentId=crypto.randomUUID();s.segmentStarted=Date.now();s.status='running';armTimeout(cid);
 }
 if(m.type==='tool'&&m.operation==='input-ready'){await nativePreparations.get(m.ownerSessionId);child.send({type:'tool-result',id:m.id,value:{ready:true}});return;}
 if(m.type==='wait-delivered'){const s=update(cid);if(s.resuming===m.waitId){delete s.resuming;persist(cid);}}
 if(m.type==='native-wakeup'){const s=update(cid);claimNativeWakeup(s,m);s.segmentId=crypto.randomUUID();s.segmentStarted=Date.now();s.stopping=false;s.status='running';armTimeout(cid);}
 if(m.type==='wait-registered'){const s=update(cid);if(s.awaiting?.id===m.waitId){s.waitRegistered=true;s.awaiting.ownerSessionId=m.ownerSessionId;persist(cid);}resume(cid).catch(()=>{});}
 if(m.type==='wait-cancelled'&&!closed){const s=update(cid);if(s.awaiting?.id===m.waitId){s.awaiting=null;s.waitRegistered=false;persist(cid);}}
  if(m.type==='tool'){let rpcRecord;try{const {record:receipt,fresh}=await operations.beginRPC(m.id,{...m,conversationId:cid});rpcRecord=receipt;if(!fresh){if(receipt.status==='completed')child.send({type:'tool-result',id:m.id,value:m.operation==='preview-frames'?await previews.recoverPreview(m.projectId,{previewId:receipt.result.previewId,videoId:receipt.result.videoId,revision:receipt.result.revision}):receipt.result});else if(receipt.status==='failed')child.send({type:'tool-result',id:m.id,error:receipt.error});else child.send({type:'tool-result',id:m.id,value:unknownOperation(m.id,m.operation)});return;}if(update(cid).stopping)throw Error('用户已停止任务');const active=update(cid),taskOrigin={kind:'agent',turnId:active.turnId,rpcId:m.id};active.toolCalls=(active.toolCalls||0)+1;if(active.toolCalls>productionLimits((await service.get(m.projectId)).productionPlan).operations)throw Error('本次任务已达到操作上限');m.args=await enforceProductionPreferences(m.operation,m.args,active.activeProductionPreferences||active.productionPreferences,{userPreferences:active.userProductionPreferences||{},resolveDefaults:({mediaType,kind,selection})=>({video:generations,image:images,audio}[mediaType]).capabilities({...selection,...(mediaType==='audio'?{kind}:{})})});const p=await service.get(m.projectId);const snapshotEdit=p.native&&snapshot&&['hypit-mutation','hypit-timing','hypit-replace-media'].includes(m.operation),beforeSnapshot=snapshotEdit?await snapshot(m.projectId).catch(()=>undefined):undefined;let value;if(m.operation==='operation-status')value=await operations.inspect(m.projectId,m.args.operationId,cid,(operation,id)=>{const adapter={'generate':generations,'generate-image':images,'generate-audio':audio,'reference-analyze':references,'transcribe':transcriptions,'hypit-build':nativeBuilds}[operation];return adapter?.list(m.projectId).find(job=>operation==='hypit-build'?job.operationId===id:job.id===id);});
  else if(m.operation==='conversation-history'){const other=store.ensure(m.projectId,m.args.conversationId);value={id:other.id,title:other.title,messages:other.messages.filter(x=>['user','assistant'].includes(x.role)).slice(-Math.min(10,Math.max(1,Number(m.args.limit)||6))).map(x=>({role:x.role,text:x.text?.slice(0,2000)}))};}
  else if(m.operation==='context'){
   if(p.native&&!p.draft&&active.selection?.nativeSelection&&(!active.selection.videoId||active.selection.videoId===(p.videoId||'v-default'))){const scene=await snapshot(p.id);active.selection={...active.selection,...nativeSelectionContext(scene,active.selection.nativeSelection,active.selection.playhead)};}
   value={...context(p,active),videos:(await service.listVideos(p.id)).map(({videoId,name,parentId,difference,revision,duration,output,draft})=>({videoId,name,parentId,difference,revision,duration,output,draft})),skills:skills?(await skills.list({projectId:p.id})).filter(skill=>skill.builtin||(active.taskSkillIds?active.taskSkillIds.includes(skill.id):skill.enabled)).map(({id,name,description,builtin})=>({id,name,description,builtin})):[],workspace:{directory:conversationWorkspace(service.dataRoot,p.id,cid),checkout:'checkout_hypit_project 返回真实 directory/CLI 路径；只在返回目录读写工程，不猜默认 cwd/hypit'},mediaOperations:{productionId:productionIdentity(p),operations:operations.listMedia(p.id),...(operations.loadDiagnostics.length?{recovery:{unreadableRecords:operations.loadDiagnostics.length,message:'部分生成记录损坏，已保留原文件；已知任务可复用，未匹配的生成先核对历史，不能自动重新付费。'}}:{}),retry:'相同制作方案中的相同 operationId、operationVersion、attemptId 与生成参数会复用任务；跨对话、跨轮次同样有效。修改提示词/参考/模型会形成新请求。明确重新生成同样参数才设置新的 attemptId；响应未确认时先 get_operation_status，不能换 ID 重发。'},editing:p.native||p.draft?{engine:'hypit',skill:'hypit',sourceOfTruth:'SVML/SVS/SVRun',inspect:'inspect_hypit_scene',mutate:'edit_hypit_scene',timing:'adjust_hypit_timing',author:'checkout_hypit_project → commit_hypit_project'}:null,audioConfiguration:await effectiveMediaConfiguration(audio,'audio',active.activeProductionPreferences||active.productionPreferences,active.userProductionPreferences),transcriptionConfiguration:await transcriptions?.configuration(),imageConfiguration:await effectiveMediaConfiguration(images,'image',active.activeProductionPreferences||active.productionPreferences,active.userProductionPreferences),videoConfiguration:await effectiveMediaConfiguration(generations,'video',active.activeProductionPreferences||active.productionPreferences,active.userProductionPreferences),videoUnderstandingConfiguration:await references?.configuration?.()};
  }
 else if(m.operation==='video-list')value=await service.listVideos(m.projectId);
 else if(m.operation==='video-variant')value=await service.createVariant(m.projectId,m.args);
 else if(m.operation==='library-search')value=await library.list(m.args);
 else if(m.operation==='library-use')value=await library.attach(m.projectId,m.args.assetId);
 else if(m.operation==='library-publish')value=await library.publish(m.projectId,m.args.assetFile);
 else if(m.operation==='preview-frames'){
  value=await previews.previewFrames(m.projectId,m.args);
  const item={...previewMetadata(value),conversationId:cid,turnId:active.turnId,created:new Date().toISOString()};
  active.visualPreviews=[...(active.visualPreviews||[]).filter(previous=>previous.previewId!==item.previewId),item].slice(-12);
 }
 else if(m.operation==='probe-export')value=await previews.probeExport(m.projectId,m.args);
 else if(m.operation==='media-capabilities'){
  const adapter={video:generations,image:images,audio}[m.args.mediaType];if(!adapter?.capabilities)throw Error('请选择已接入的媒体类型');
  value=await effectiveMediaCapabilities(adapter,m.args,active.activeProductionPreferences||active.productionPreferences,active.userProductionPreferences);
 }
 else if(m.operation==='analyze-beats')value=await beats.analyze(m.projectId,m.args);
 else if(m.operation==='bind-beat-guides')value=await beatGuides.bind(m.projectId,m.args);
 else if(m.operation==='beat-guides')value=await beatGuides.load(m.projectId);
 else if(m.operation==='transcribe')value=await mediaOperation(p,m.operation,m.args,transcriptions,{assetFile:m.args.assetFile,languageCode:m.args.languageCode||'zh'},undefined,m.id);
 else if(m.operation==='hypit-command')value=await engine.command(m.projectId,JSON.parse(m.args.args));
 else if(m.operation==='hypit-import')value=await engine.importProject(m.args);
 else if(m.operation==='hypit-speech')value=await engine.speechEvidence(m.projectId,m.args.assetFile);
 else if(m.operation==='hypit-catalog')value=await engine.catalog();
 else if(m.operation==='motion-list')value=await engine.motionLibrary.list();
 else if(m.operation==='motion-get')value=await engine.motionLibrary.get(m.args.componentId);
 else if(m.operation==='motion-use')value=await engine.motionLibrary.use(m.projectId,m.args.componentId,{segmentId:m.args.segmentId,start:m.args.start,duration:m.args.duration,initializeDraft:m.args.initializeDraft});
 else if(m.operation==='motion-rebuild')value=await engine.motionLibrary.rebuild(m.projectId,m.args);
 else if(m.operation==='motion-save')value=await engine.motionLibrary.save(m.projectId,m.args);
 else if(m.operation==='hypit-docs')value=await engine.docs(m.args.path);
 else if(m.operation==='hypit-read')value=await engine.read(m.projectId,m.args.path);
 else if(m.operation==='hypit-edit')value=await engine.edit(m.projectId,m.args.revision,JSON.parse(m.args.files),m.args.options?JSON.parse(m.args.options):{});
 else if(m.operation==='hypit-replace-media'){
  if(p.revision!==m.args.revision)throw Error('项目已更新，请重新读取');
  const replacement=await prepareNativeMediaReplacement({projectDir:service.dir(m.projectId),sourceFiles:await sourceFiles(service.dir(m.projectId)),assets:p.assets,replacements:JSON.parse(m.args.replacements)});
  const edited=await engine.edit(m.projectId,m.args.revision,replacement.files);
  value={revision:edited.revision,duration:edited.duration,output:edited.output,replacements:replacement.bindings,preserves:replacement.preserves};
 }
 else if(m.operation==='hypit-checkout')value=await engine.checkout(m.projectId);
 else if(m.operation==='hypit-sync')value=await engine.syncAssets(m.projectId,m.args.assetFiles);
 else if(m.operation==='hypit-compose')value=await engine.compose(m.projectId,m.args.revision,JSON.parse(m.args.composition));
 else if(m.operation==='hypit-commit')value=await engine.applyWorkspace(m.projectId,m.args.revision,m.args.options?JSON.parse(m.args.options):{});
 else if(m.operation==='hypit-inspect')value=compactAgentScene(await snapshot(m.projectId),m.args);
 else if(m.operation==='hypit-build'){const input={...m.args,outputs:JSON.parse(m.args.outputs)};value=await operations.runMedia({projectId:p.id,productionId:productionIdentity(p,m.args.productionId),operation:m.operation,operationId:m.args.operationId,operationVersion:m.args.operationVersion,attemptId:m.args.attemptId,input,configuration:{revision:m.args.revision},rpcId:m.id},requestId=>nativeBuilds.create(m.projectId,{...input,operationId:requestId,conversationId:cid}),requestId=>nativeBuilds.list(m.projectId).find(job=>job.operationId===requestId));}
 else if(m.operation==='hypit-runtime')value=await nativeRuntime.status(service.dir(m.projectId));
 else if(m.operation==='hypit-index-assets')value=await engine.indexAssets(m.projectId);
 else if(m.operation==='hypit-timing')value=await adjustTiming(m.projectId,{...m.args,semantic:m.args.semantic?JSON.parse(m.args.semantic):undefined});
 else if(m.operation==='hypit-mutation')value=await studioMutation(m.projectId,JSON.parse(m.args.mutation));
 else if(m.operation==='hypit-fork')value=await engine.fork(m.projectId,m.args.name);
 else if(m.operation==='stage-asset'){
  const asset=p.assets.find(a=>a.filename===m.args.assetFile);if(!asset)throw Error('素材不属于当前项目');
  const base=await codeWorkspace(m.projectId,cid);await fs.mkdir(path.join(base,'input'),{recursive:true});
  const input=await fs.realpath(path.join(base,'input'));if(!input.startsWith(base+path.sep))throw Error('素材目录不在当前代码工作区');
  const file=path.join('input',crypto.randomUUID()+'-'+asset.filename);await fs.writeFile(path.join(base,file),await fs.readFile(path.join(service.dir(m.projectId),'assets',asset.filename)),{flag:'wx'});value={file:path.join(base,file),relativeFile:file,workspaceDirectory:base,videoId:p.videoId||'v-default',kind:asset.kind,name:asset.name};
 }
 else if(m.operation==='stage-export'){
  const job=await getExportStatus(m.projectId,m.args.jobId);if(job.status!=='done')throw Error('成片尚未完成');
  const base=await codeWorkspace(m.projectId,cid);await fs.mkdir(path.join(base,'input'),{recursive:true});
  const input=await fs.realpath(path.join(base,'input'));if(!input.startsWith(base+path.sep))throw Error('素材目录不在当前代码工作区');
  const file=path.join('input','成片-'+job.id+'.mp4'),destination=path.join(base,file);
  try{await fs.writeFile(destination,await fs.readFile(path.join(service.dataRoot,'exports',job.id,'final.mp4')),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const real=await fs.realpath(destination);if(!real.startsWith(input+path.sep))throw Error('成片文件不在输入目录');}
  value={file:destination,relativeFile:file,workspaceDirectory:base,videoId:job.videoId||p.videoId||'v-default',id:job.id,status:'done',download:'/api/jobs/'+job.id+'/download',duration:job.duration,output:job.output};
 }
 else if(m.operation==='publish-workspace'){
  const base=await codeWorkspace(m.projectId,cid);
  if(typeof m.args.file!=='string'||!m.args.file)throw Error('使用目标代码工作区内的真实路径');
  const file=await fs.realpath(path.resolve(base,m.args.file));if(!file.startsWith(base+path.sep))throw Error('文件不在当前代码工作区');
  const stat=await fs.stat(file);if(!stat.isFile()||stat.size>80e6)throw Error('产物需为不超过 80 MB 的媒体文件');
  const bytes=await fs.readFile(file),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  value=p.assets.find(a=>a.provenance?.provider==='code'&&a.provenance?.sha256===sha256)||await importAsset(service.dir(m.projectId),bytes,m.args.name?String(m.args.name).replace(/\.[a-z0-9]+$/i,'')+path.extname(file):path.basename(file),{provider:'code',workspaceFile:m.args.file,sha256});publishProject(m.projectId);
 }
 else if(m.operation==='resume-video'){const job=generations.get(m.projectId,m.args.jobId);if(!job.remoteId)throw Error('没有可恢复查询的远端任务，不能重复生成');job.pollFailures=0;value=await generations.poll(job.id);}
 else if(m.operation==='tasks')value=await readyMedia(m.projectId,tasks.list(m.projectId),cid);
 else if(m.operation==='await-tasks'){
  tasks.results(m.projectId,m.args.taskIds);if(typeof m.args.instruction!=='string'||!m.args.instruction.trim()||m.args.instruction.length>2000)throw Error('请说明任务完成后的下一步');
  const s=update(cid),prior=s.awaiting?.turnId===s.turnId?s.awaiting:null;if(prior?.ownerSessionId&&m.ownerSessionId&&prior.ownerSessionId!==m.ownerSessionId)throw Error('此对话已有另一代理等待媒体任务，请在它完成后继续，已提交素材不会丢失');s.awaiting={ownerSessionId:m.ownerSessionId||prior?.ownerSessionId,id:prior?.id||crypto.randomUUID(),turnId:s.turnId,taskIds:[...new Set([...(prior?.taskIds||[]),...m.args.taskIds])],instruction:m.args.instruction,nextStep:String(m.args.nextStep||'').slice(0,60)};persist(cid);await saving;value={waiting:true,taskIds:s.awaiting.taskIds,waitId:s.awaiting.id};
 }
 else if(m.operation==='audio-voices')value=await audio.voices(m.args.provider);
 else if(m.operation==='production-plan'){const input={...m.args,scenes:JSON.parse(m.args.scenes),...(m.args.creative!==undefined?{creative:JSON.parse(m.args.creative)}:{})},referenceId=m.args.referenceId||p.productionPlan?.referenceId;value=referenceId?await references.updateProductionPlan(m.projectId,referenceId,input):await service.plan(m.projectId,input);}
 else if(m.operation==='asset-metadata'){value=await updateAssetMetadata(service.dir(m.projectId),m.args);publishProject(m.projectId);}
 else if(m.operation==='rename')value=await service.rename(m.projectId,{name:m.args.name,expectedName:p.name});
 else if(m.operation==='generate-audio'){
  if(!audio)throw Error('声音生成不可用');
  value=await mediaOperation(p,m.operation,m.args,audio,m.args,await generationConfiguration(m.operation,m.args,audio),m.id);
 }
 else if(m.operation==='resume-image'){const job=images.get(m.projectId,m.args.jobId);if(!job.remoteId&&!(job.provider==='kuaipao'&&job.resultUrl))throw Error('图片任务没有可恢复的结果，请先核对服务商记录');value=await images.poll(job.id);}
 else if(m.operation==='generate-image'){
  if(!images)throw Error('图片生成不可用');
  const ratio=p.output?.width/p.output?.height;const size=Math.abs(ratio-4/3)<.01?'2368x1776':Math.abs(ratio-3/4)<.01?'1776x2368':Math.abs(ratio-16/9)<.01?'2560x1440':Math.abs(ratio-1)<.01?'2048x2048':'1440x2560';value=await mediaOperation(p,m.operation,m.args,images,{size,...m.args},await generationConfiguration(m.operation,m.args,images),m.id);
 }
 else if(m.operation==='change'){const {revision,clearAsset,...change}=m.args;if(clearAsset)change.assetFile=null;value=await service.change(m.projectId,revision,change);}
 else if(m.operation==='timeline'){const {revision,...args}=m.args;value=await service.change(m.projectId,revision,{type:'timeline',...args});}
 else if(m.operation==='batch')value=await service.change(m.projectId,m.args.revision,{type:'batch',changes:JSON.parse(m.args.changes)});
 else if(m.operation==='generate'){
  if(!generations||!['product','hypit-native','draft'].includes(p.template))throw Error('当前项目不支持视频生成');
  const ratio=['9:16','16:9','1:1','4:3','3:4','21:9'].find(r=>{const [w,h]=r.split(':').map(Number);return Math.abs(w/h-p.output?.width/p.output?.height)<.01;})||'9:16';value=await mediaOperation(p,m.operation,m.args,generations,{ratio,...m.args,...(typeof m.args.references==='string'?{references:JSON.parse(m.args.references)}:{}),imageFile:m.args.imageFile||null,imageMode:m.args.imageMode||'reference_image',resolution:m.args.resolution,audio:m.args.audio!==false,autoApply:p.native||p.draft?false:m.args.autoApply!==false,confirmed:true},await generationConfiguration(m.operation,m.args,generations),m.id);
 }
 else if(m.operation==='reference-analyze'){
  value=await mediaOperation(p,m.operation,m.args,references,m.args,await references.configuration(m.args.purpose||'remix'),m.id);
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
 if(['hypit-edit','hypit-commit'].includes(m.operation))value={revision:value.revision,validated:true,duration:value.duration,output:value.output,native:value.native,...(m.operation==='hypit-edit'?{changedPaths:Object.keys(JSON.parse(m.args.files))}:{}),nextAction:'工程已保存且原生编译通过。无新修改无需再次 validate_video；需要画面验收请查看实际预览或导出帧。'};
 if(['publish-workspace','generate','generate-image','generate-audio','resume-video','resume-image'].includes(m.operation)&&value&&(value.assetFile||value.filename))value=(await readyMedia(m.projectId,[value],cid))[0];
 const jobKind={'generate':'video','generate-image':'image','generate-audio':'audio','reference-analyze':'reference','transcribe':'transcript','export':'export','hypit-build':'hypit'}[m.operation];if(jobKind)store.own(cid,jobKind,value,taskOrigin);if(m.operation==='reference-generate')for(const job of value.jobs||[])store.own(cid,'video',job,taskOrigin);
 if(['production-plan','asset-metadata','hypit-edit','hypit-replace-media','hypit-commit','hypit-compose','hypit-mutation','hypit-timing','rename','reference-apply','change','timeline','batch','apply-generation','batch-text','chat-timing','undo'].includes(m.operation)){for(const id of store.projectIds(m.projectId))update(id).projectRevision=value.revision||value.project?.revision;}
 if(['production-plan','rename','asset-metadata'].includes(m.operation)){for(const id of store.projectIds(m.projectId))update(id).metadataUpdated=Date.now();}
 const after=await service.get(m.projectId),afterSnapshot=snapshotEdit?(value?.snapshot||await snapshot(m.projectId).catch(()=>undefined)):undefined;await changes.record({beforeSnapshot,afterSnapshot,projectId:m.projectId,conversationId:cid,turnId:active.turnId,title:active.title,before:p,after,operation:m.operation,args:m.args});
 await operations.finishRPC(m.id,{result:m.operation==='preview-frames'?previewMetadata(value):value});child.send({type:'tool-result',id:m.id,value});}catch(e){if(rpcRecord)await operations.finishRPC(m.id,{error:e.message});child.send({type:'tool-result',id:m.id,error:e.message});}}
  if(m.type==='status'){const s=update(cid);if(nativeWeb)trackNativeTurnStatus(s,m.status);if(nativeWeb&&m.status==='running'&&s.status!=='running'){s.segmentStarted=Date.now();s.lastProgress=Date.now();s.stopping=false;armTimeout(cid);}s.status=m.status;if(m.status==='idle'){if(s.awaiting&&!s.stopping)s.status='waiting';setImmediate(()=>resume(cid).catch(()=>{}));interruptMessages(s);clearTimeout(timers.get(cid));const latestUser=s.messages.findLastIndex(x=>x.role==='user');if(!s.stopping&&!s.awaiting&&!s.messages.slice(latestUser+1).some(x=>x.role==='assistant'&&x.turnToken===(s.segmentId||s.turnId)&&x.text?.trim()||x.role==='error'))s.messages.push({role:'error',text:'模型本轮未返回可见答复，已经完成的操作保留，可继续当前任务。'});s.stopping=false;}}
  if(m.type==='error'){pendingSessions.get(m.requestId)?.reject(Error(m.error));pendingSessions.delete(m.requestId);if(!m.projectId)return;const s=update(cid);s.status='idle';clearTimeout(timers.get(cid));interruptMessages(s);s.messages.push({role:'error',text:m.error});}
  if(m.type==='event'||m.type==='stream'){const s=update(cid);reduceChatEvent(s,m);if(!nativeWeb&&s.status==='running'&&Date.now()-(s.lastProgress||0)>10000){s.lastProgress=Date.now();if(Date.now()-(s.segmentStarted||Date.now())>900000)bridge.cancel(m.projectId,cid);else armTimeout(cid);}}
 if(m.projectId&&states.has(cid)){publishProject(m.projectId);if(m.type!=='stream')persist(cid);}

 }));
 child.on('message',m=>{
  const handled=m.type==='native-input'&&m.sessionId?Promise.resolve(nativePreparations.get(m.sessionId)).catch(()=>{}).then(()=>handleMessage(m)):handleMessage(m);
  if(m.type==='native-input'&&m.sessionId)nativePreparations.set(m.sessionId,handled);
  handled.catch(e=>{console.error('对话事件处理失败:',e.message);if(m.type==='tool')child.send({type:'tool-result',id:m.id,error:e.message});});
 });
 bridge.inspectNative=async(projectId,compact=false,conversationId=projectId)=>{const s=store.ensure(projectId,conversationId),requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('原生诊断超时'));},20000);pendingSessions.set(requestId,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.send({type:'inspect-native',projectId,conversationId:s.id,videoId:(['running','waiting'].includes(s.status)?s.taskVideoId:undefined)||s.videoId||'v-default',sessionId:s.sessionId,requestId,compact});});};
 bridge.ensureHome=async()=>{const requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('输入框连接超时'));},25000);pendingSessions.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});child.send({type:'ensure-home',requestId});});};
 bridge.ensure=async(projectId,conversationId=projectId)=>{
  const s=store.ensure(projectId,conversationId);if(s.archived)throw Error('请先恢复这段对话');
  const videoId=(['running','waiting'].includes(s.status)||s.awaiting?s.taskVideoId:undefined)||s.videoId||'v-default';
  return service.withVideoContext(projectId,videoId,async()=>{if(!ensuredSessions.has(s.id)||!['running','waiting'].includes(s.status))await skills?.materializeWorkspace(projectId,s.id);const cwd=await codeWorkspace(projectId,s.id),requestId=crypto.randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pendingSessions.delete(requestId);reject(Error('原生会话初始化超时'));},25000);pendingSessions.set(requestId,{resolve:v=>{clearTimeout(timer);ensuredSessions.add(s.id);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});child.send({type:'ensure',requestId,projectId,conversationId:s.id,videoId,cwd,sessionId:s.sessionId,waiting:s.awaiting});});});
 };
 bridge.refreshSkills=async(projectId)=>{await service.getVideo(projectId);child.send({type:'skills-changed',projectId});return {effective:'next-turn'};};
 bridge.configureInput=async(projectId,{conversationId=projectId,videoId,preferences,references:inputReferences}={})=>{
  const s=store.ensure(projectId,conversationId),target=videoId||s.videoId||'v-default';await service.getVideo(projectId,target);
  const selected=preferences!==undefined?validateProductionPreferences(preferences):s.productionPreferences;
  let validated=s.inputReferences;
  if(inputReferences!==undefined){
   if(!Array.isArray(inputReferences)||inputReferences.length>30)throw Error('一次最多引用 30 处');
   validated=[];for(const ref of inputReferences){if(ref?.projectId&&ref.projectId!==projectId)throw Error('引用不属于当前项目');const source=await service.getVideo(projectId,ref?.videoId||target);validated.push(...validateReferences([ref],source));}
  }
  if(s.videoId!==target&&s.selection?.videoId!==target)s.selection=null;
  s.videoId=target;if(preferences!==undefined){s.productionPreferences=selected;s.activeProductionPreferences={...selected};for(const kind of Object.keys(selected))if(s.userProductionPreferences)delete s.userProductionPreferences[kind];}if(inputReferences!==undefined)s.inputReferences=validated;
  await persist(s.id);publish(s.id);return bridge.input(projectId,conversationId);
 };
 bridge.input= (projectId,conversationId=projectId)=>{const s=store.ensure(projectId,conversationId);return {videoId:s.videoId||'v-default',preferences:mergeProductionPreferences(s.productionPreferences||{},s.userProductionPreferences||{}),references:s.inputReferences||[]};};
 bridge.undoTurn=async(projectId,id)=>{const p=await changes.undo(projectId,id);publishProject(projectId);return p;};
 bridge.historyOrigin=(projectId,entry)=>changes.historyOrigin(projectId,entry);
 bridge.select=async(id,{selectedId,selectedAsset,mode,nativeSelection,playhead,conversationId=id,videoId})=>{
  const state=store.ensure(id,conversationId),target=videoId||state.videoId||'v-default';
  return service.withVideoContext(id,target,async()=>{
   const p=await service.get(id),previous=state.selection?.videoId===target?state.selection:null;state.videoId=target;
   if(p.native&&!p.draft){
    const selection=nativeSelection||(selectedId?{kind:'clip',clipId:selectedId}:previous?.nativeSelection||{kind:'none'});
    state.selection={...nativeSelectionContext(await snapshot(id),selection,playhead??previous?.playhead),assetFile:p.assets.some(a=>a.filename===selectedAsset)?selectedAsset:null};
   }else state.selection={selectedId:p.texts.some(t=>t.id===selectedId)?selectedId:null,shotId:p.shots?.find(s=>s.captionId===selectedId)?.id||null,assetFile:p.assets.some(a=>a.filename===selectedAsset)?selectedAsset:null};
   state.selection.videoId=target;state.selection.mode=mode==='guided'||mode==='guide'?'guided':'free';await persist(state.id);return state.selection;
  });
 };
 bridge.prompt=async(projectId,{text,selectedId,selectedAsset,mode,conversationId=projectId})=>{
  if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('请输入 1–4000 字的指令');
  const s=store.ensure(projectId,conversationId),id=s.id;if(s.archived)throw Error('请先恢复这段对话');if(prompting.has(id)||['running','waiting'].includes(s.status))throw Error('当前对话仍在进行，请在对话中调整要求');
  prompting.add(id);try{
  const currentProject=await service.getVideo(projectId,s.videoId||'v-default');await bridge.ensure(projectId,id);await bridge.select(projectId,{selectedId,selectedAsset,mode,conversationId:id});
  delete s.outcome;s.status='running';s.turnId=crypto.randomUUID();s.segmentId=s.turnId;s.stopping=false;s.awaiting=null;s.resuming=null;s.continuations=0;s.toolCalls=0;s.segmentStarted=Date.now();s.turnStarted=Date.now();s.userRequest=text;s.userProductionPreferences=productionPreferencesFromUserText(text,s.userProductionPreferences||{});s.taskVideoId=s.videoId||'v-default';s.targetVideoIds=[s.taskVideoId];s.activeProductionPreferences={...s.productionPreferences};s.taskReferences=mergeTaskReferences([],s.inputReferences);s.targetVideoIds=[...new Set([s.taskVideoId,...s.taskReferences.map(ref=>ref.videoId)])];s.inputReferences=[];if(nativeWeb)s.pendingNativeText=text;s.messages.push({role:'user',text});store.nameFromMessage(id,text);
  child.send({type:'prompt',requestId:crypto.randomUUID(),projectId,conversationId:id,videoId:s.taskVideoId,sessionId:s.sessionId,prompt:nativeWeb?text:JSON.stringify({userRequest:text,selectedId,selectedAsset:currentProject.assets.find(a=>a.filename===selectedAsset)||null,mode,project:context(currentProject,s)})});publish(id);persist(id);armTimeout(id);return s;
  }finally{prompting.delete(id);}
 };
 bridge.cancel=async(projectId,conversationId=projectId)=>{const s=store.ensure(projectId,conversationId),id=s.id;s.outcome='stopped';s.stopping=true;s.awaiting=null;s.resuming=null;if(s.status==='waiting')s.status='idle';clearTimeout(timers.get(id));child.send({type:'cancel',projectId,conversationId:id});s.messages.push({role:'tool',text:'已请求停止；已完成的修改可撤销。'});publish(id);persist(id);};
 bridge.close=()=>closed||(closed=(async()=>{unsubscribeGenerations?.();unsubscribeReferences?.();unsubscribeTasks?.();unsubscribeImages?.();for(const timer of timers.values())clearTimeout(timer);if(child.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit;}await store.queue;})());
 await new Promise(r=>{const timer=setTimeout(r,12000);const listener=m=>{if(m.type==='ready'){clearTimeout(timer);child.off('message',listener);r();}};child.on('message',listener);child.once('exit',()=>{clearTimeout(timer);r();});});
 if(!bridge.ready&&!bridge.error)bridge.error='对话服务尚未启动完成：'+logs.slice(-1000);
 return bridge;
}
