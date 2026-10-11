import {agentModelSelection} from '../server/agent-model.mjs';
import {installModelSelection} from '@deepseek-ai/dsh-agent';
import { defineTool } from '@deepseek-ai/dsh-tools';
import crypto from 'node:crypto';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {createToolRPC} from './tool-rpc.mjs';
import {preparePreviewRequest,preparePreviewImages,previewImageOutput} from './preview-images.mjs';
import {installWorkflowPrompt} from './workflow-prompt.mjs';
import {motionListContract,motionDetailsContract,motionWorkspaceContract} from './motion-contracts.mjs';
export const name='frame-video-bridge';
export const inject=['agents','agentLoop','tools','systemPrompt',...(process.env.FRAME_NATIVE_DSH==='1'?['agentPresets','sessionPersistence','sessions','jobs','connection','workspaceRegistry','sessionController','webServer','skills']:[])];
export function apply(ctx){
 const native=process.env.FRAME_NATIVE_DSH==='1', waitJobs=new Map();
 const ensuring=new Map(),inputsPending=new Set();
 const homeSessionId='frame-home-composer';let homePending;
 const workflowContexts=new WeakSet();
 function installWorkflow(agentCtx){if(workflowContexts.has(agentCtx))return;installWorkflowPrompt(agentCtx);workflowContexts.add(agentCtx);}
 function installSelection(agent,selection){
  installModelSelection(agent.ctx,selection);
 }
 const handles=new Map(),conversationBySession=new Map(),counts=new Map(),selections=new Map();
 const send=value=>process.send?.(value);
 const transport=createToolRPC({send}),rpc=transport.call;
 const bindingType='frame/conversation';
 const scopeKey=scope=>JSON.stringify([scope.projectId,scope.conversationId]);
 const waitKey=(scope,waitId)=>JSON.stringify([scope.projectId,scope.conversationId,waitId]);
 function scopeOf(message){
  const scope={projectId:message.projectId,conversationId:message.conversationId||message.projectId};
  if(message.videoId!==undefined){if(!/^(?:v-default|v-[a-f0-9]{12})$/.test(message.videoId))throw Error('视频 ID 无效');scope.videoId=message.videoId;}
  if(scope.conversationId!==scope.projectId&&!/^(?:p|c)-[a-f0-9]{12}$/.test(scope.conversationId))throw Error('对话 ID 无效');
  return scope;
 }
 function savedBinding(session){return session.snapshotEvents().findLast(event=>event.type===bindingType)?.data;}
 function assertBinding(binding,scope){if(binding&&scopeKey(binding)!==scopeKey(scope))throw Error('原生会话已绑定其他对话');}
 function toolScope(session,seen=new Set()){
  if(!session||session.id===homeSessionId||seen.has(session.id))return;
  seen.add(session.id);
  const direct=conversationBySession.get(session.id);if(direct)return direct;
  const parentId=session.header.parentSession;
  // Child tools share their parent's project and conversation. Their own
  // streams and status never become top-level conversation events.
  if(parentId)return toolScope(ctx.agents.get(parentId)?.session||ctx.sessions?.get(parentId),seen);
 }
 // This retained scope exists only for the native draft editor. It is never
 // associated with a Frame project and cannot admit a model request.
 if(native){
  ctx.on('agent/pre-step',async(payload,next)=>payload.agent.session.id===homeSessionId?{kind:'reject'}:next());
  ctx.on('agent/request',async(payload,next)=>{if(payload.agent.session.id===homeSessionId)throw Error('首页输入框不能执行任务');return next();});
 }
 async function ensureHome(){
  const live=ctx.agents.get(homeSessionId);if(live)return homeSessionId;
  if(!homePending)homePending=(async()=>{
   const cwd=path.join(process.env.FRAME_CODE_ROOT,'.home-composer');await fs.mkdir(cwd,{recursive:true});
   const saved=await ctx.sessionPersistence.stat(homeSessionId);
   const options={agentOptions:agentModelSelection()};
   const handle=saved?await ctx.agents.resume({resumeSessionId:homeSessionId,...options}):await ctx.agents.create({sessionId:homeSessionId,meta:{cwd},...options});
   await ctx.sessions.flush(handle.agent.session);
   const workspace=await ctx.workspaceRegistry.create(cwd,'OmniCut');await workspace.attachSession(homeSessionId);
   return homeSessionId;
  })().finally(()=>{homePending=undefined;});
  return homePending;
 }
 function startWait(agent,scope,waitId,instruction){
  const key=waitKey(scope,waitId),owner=agent.session.id;
  if(waitJobs.has(key)){const item=waitJobs.get(key);if(item.owner!==owner)throw Error('等待任务已由另一个原生会话持有');send({type:'wait-registered',...scope,waitId,ownerSessionId:owner});return item.jobId;}
  let settle;const done=new Promise(resolve=>{settle=resolve;});
  const jobId=ctx.jobs.start({kind:'media',label:instruction,owner,outputLimitBytes:18000,run(job){job.updateProgress('等待媒体任务');return {done,cancel(){settle({status:'killed',detail:'已停止等待；远端已提交的媒体任务保留。'});waitJobs.delete(key);send({type:'wait-cancelled',...scope,waitId,ownerSessionId:owner});}};}});
  waitJobs.set(key,{jobId,settle,scope,owner});send({type:'wait-registered',...scope,waitId,ownerSessionId:owner});return jobId;
 }
 function cancelWaits(scope){
  for(const [key,item] of waitJobs)if(scopeKey(item.scope)===scopeKey(scope)){
   const owner=item.owner;
   // Collect cancellation ourselves so tool-jobs does not wake a superseded request.
   ctx.jobs.wait(item.jobId,30000,owner).then(()=>{try{ctx.jobs.remove(item.jobId,owner);}catch{}}).catch(()=>{});
   try{ctx.jobs.kill(item.jobId,owner,'用户停止或开始了新任务');}catch{}
   waitJobs.delete(key);
  }
 }
 async function ensure(m){
  const scope=scopeOf(m),key=scopeKey(scope);
  let pending=ensuring.get(key);
  if(!pending){pending=ensureAgent(m,scope);ensuring.set(key,pending);pending.finally(()=>{if(ensuring.get(key)===pending)ensuring.delete(key);}).catch(()=>{});}
  const h=await pending;send({type:'session',...scope,sessionId:h.agent.session.id,requestId:m.requestId});return h;
 }
 async function ensureAgent(m,scope){
  const key=scopeKey(scope);
  const expectedCwd=native?path.join(process.env.FRAME_CODE_ROOT,scope.projectId,...(scope.conversationId===scope.projectId?[]:['conversations',scope.conversationId]),...(scope.videoId&&scope.videoId!=='v-default'?['videos',scope.videoId]:[])):process.cwd();
  if(native&&m.cwd&&path.resolve(m.cwd)!==path.resolve(expectedCwd))throw Error('代码工作区不属于当前视频');
  const cwd=native?m.cwd||expectedCwd:process.cwd();await fs.mkdir(cwd,{recursive:true});
  let h=handles.get(key);
  if(h&&ctx.agents.get(h.agent.session.id)===h.agent&&h.agent.session.header.cwd===cwd)return h;
  if(h&&!m.sessionId)m={...m,sessionId:h.agent.session.id};
  handles.delete(key);selections.delete(key);
  const agentOptions=agentModelSelection();
  const setup=async agentCtx=>{if(native)await ctx.agentPresets.mount(agentCtx,'frame');installWorkflow(agentCtx);};
  let sessionId=m.sessionId,seed;
  if(sessionId===homeSessionId)throw Error('首页输入框不能绑定项目');
  if(sessionId)assertBinding(conversationBySession.get(sessionId),scope);
  if(native&&sessionId){const snapshot=await ctx.sessionPersistence.stat(sessionId);if(snapshot?.header.origin==='subagent')throw Error('子代理会话不能替代主对话');if(snapshot&&snapshot.header.cwd!==cwd){const reader=await ctx.sessionPersistence.open(sessionId,'read');try{seed=(await reader.read()).events;}finally{await reader.close();}assertBinding(seed.findLast(event=>event.type===bindingType)?.data,scope);sessionId=undefined;}}
  if(sessionId){
   const live=ctx.agents.get(sessionId);
   if(live)h={agent:live};
   else try{h=await ctx.agents.resume({resumeSessionId:sessionId,agentOptions,setup});}catch(error){
    // Native SessionController can be opening this same session concurrently.
    if(!/already owned by an active write handle/.test(error.message))throw error;
    for(let i=0;i<50&&!ctx.agents.get(sessionId);i++)await new Promise(r=>setTimeout(r,20));
    const adopted=ctx.agents.get(sessionId);if(!adopted)throw error;h={agent:adopted};
   }
  }
  else{
   sessionId='frame-'+scope.conversationId+'-'+crypto.randomUUID();
   // DSH keeps a fixed immutable header. An ignorable seed record preserves
   // plugin-owned metadata across restarts without changing model history.
   seed=[...(seed||[]),{type:bindingType,seq:seed?.length||0,time:Date.now(),data:scope,ignorable:true}];
   h=await ctx.agents.create({sessionId,meta:{cwd,...(native?{agentPreset:'frame'}:{})},seed,agentOptions,setup});
  }
  if(h.agent.session.header.origin==='subagent')throw Error('子代理会话不能替代主对话');
  installWorkflow(h.agent.ctx);
  assertBinding(conversationBySession.get(sessionId),scope);
  assertBinding(savedBinding(h.agent.session),scope);
  handles.set(key,h);conversationBySession.set(sessionId,scope);
  // Native SessionController owns the durable per-conversation choice. A
  // second Frame-owned selection would override composer picks and resumed
  // history. Only the legacy IPC-only profile follows the global default.
  if(!native){const selection={current:agentModelSelection(),assembled:undefined};installSelection(h.agent,selection);selections.set(key,selection);}
  if(native){await ctx.sessions.flush(h.agent.session);const workspace=await ctx.workspaceRegistry.create(cwd,'OmniCut');await workspace.attachSession(sessionId);}
  return h;
 }
 if(native)ctx.on('agent/inbox/claimed',({agent,message,turn})=>{
  const scope=conversationBySession.get(agent.session.id);if(!scope)return;
  const kind=message.source?.kind;
  if(kind==='user'){counts.set(agent.session.id,0);inputsPending.add(agent.session.id);send({type:'native-input',...scope,sessionId:agent.session.id,nativeTurn:turn,text:message.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||''});}
  else if(kind==='tool-jobs')send({type:'native-wakeup',...scope,sessionId:agent.session.id,nativeTurn:turn});
 });
 if(native)ctx.on('agent/pre-step',async({agent,signal},next)=>{
  if(inputsPending.delete(agent.session.id)){
   const scope=conversationBySession.get(agent.session.id);
   const prepared=await rpc({...scope,ownerSessionId:agent.session.id},'input-ready',{},signal);
   if(!prepared.ready)throw Error('本次输入上下文未准备完成，请重新连接对话');
   // Discovery is refreshed only at a real user-input boundary. Tool/job
   // wakeups keep the current task's catalog; skill bodies remain lazy.
   ctx.skills.invalidate({cwd:agent.session.header.cwd});
  }
  return next();
 });
 const registered=[];
 const output={schema:{type:'string'},render:(_a,v)=>[{type:'text',text:v}]};
 const generatedOperations=new Set(['generate','generate-image','generate-audio','reference-analyze','transcribe','hypit-build']);
 const identityParameters={productionId:{type:'string',description:'独立的新制作意图可指定新 ID；沿用当前制作方案通常省略，由服务端识别，不用旧的项目信息猜 ID'},operationVersion:{type:'string',description:'逻辑镜头/声音的版本，默认1；参数改变会自动形成新请求'},attemptId:{type:'string',description:'只在用户要求同参数重新生成时指定新的尝试 ID；继续、查询、网络重试不能改变'}};
 function tool(name,description,parameters,operation,contract){parameters={videoId:{type:'string',description:'目标视频 ID，来自 get_project_context；省略沿用本次任务提交时选中的视频。跨视频操作逐个明确指定。'},...parameters};if(name.startsWith('generate_'))parameters={...parameters,model:{type:'string',description:'明确选择的生成模型 ID；省略使用本次制作选项或已配置默认值。'}};if(generatedOperations.has(operation)){parameters={...parameters,...identityParameters};description+=' operationId 为制作意图的稳定 ID；同参数重生成才改 attemptId，独立新制作才改 productionId。未知响应先 get_operation_status。';}registered.push(name);ctx.tools.register(defineTool({name,description,parameters,output:contract?.output||output,async execute(args,exec){const sessionId=exec.agent.session.id,scope=toolScope(exec.agent.session);if(!scope)throw Error('会话未绑定项目');const rpcScope={...scope,ownerSessionId:sessionId};const n=(counts.get(sessionId)||0)+1;counts.set(sessionId,n);if(!native&&n>12){exec.agent.cancel({kind:'user'});throw Error('本轮已达到 12 次操作限制');}const callArgs=await contract?.before?.(ctx,exec,args)||args;const result=await rpc(rpcScope,operation,callArgs,exec.signal);if(contract)return contract.prepare(ctx,result,exec,callArgs);if(result.status==='unknown'&&result.nextAction?.tool==='get_operation_status')return JSON.stringify(result);if(native&&operation==='await-tasks'){const jobId=startWait(exec.agent,scope,result.waitId,args.instruction);return JSON.stringify({...result,jobId,nextAction:{tool:'job_output',arguments:{job_id:jobId,wait:true}},instruction:'等待已登记，素材或导出尚未完成。没有独立工作时使用 nextAction 等待结果，或简短告知进度并结束当前执行段，由任务完成后自动接续。收到真实完成结果前不要 stage_export、使用素材或宣布完成。'});}
 const referencePending=operation==='reference-analyze'&&['preparing','analyzing','reviewing'].includes(result.status),videosPending=operation==='reference-generate'&&result.jobs?.filter(j=>['submitting','queued','running','downloading'].includes(j.status));
 if(native&&(referencePending||videosPending?.length)){
  const taskIds=referencePending?['reference:'+result.id]:videosPending.map(j=>'video:'+j.id);
  const instruction=referencePending?'读取已完成的参考分析。若用户选择先看方案，保存并展示方案后等待确认，不生成素材；若用户明确要求直接制作，沿用此方案继续原请求。分析失败则说明实际阻碍，不重复提交。':'读取已完成的参考镜头及 sceneId，复用素材继续同一项目的声音、字幕、剪辑、导出与成片检查。只处理原请求范围，失败只说明缺失项，不自动升级服务或重做成功项。';
  const waiting=await rpc(rpcScope,'await-tasks',{taskIds,instruction},exec.signal);if(waiting.status==='unknown')return JSON.stringify({...result,continuation:waiting,nextAction:waiting.nextAction,instruction:'媒体任务已创建，等待登记的响应尚未确认；先查询这项登记，不要重复分析或生成。'});return JSON.stringify({...result,continuation:{...waiting,jobId:startWait(exec.agent,scope,waiting.waitId,instruction)}});
 }
 if(operation==='operation-status'&&result.status==='completed'&&result.result?.waiting&&result.result?.taskIds)return JSON.stringify({...result,nextAction:{tool:'await_tasks',arguments:{taskIds:result.result.taskIds,instruction:'继续原请求中已登记的制作任务'}}});
 return JSON.stringify(result);}}));}
 tool('get_operation_status','查询中断或超时响应的实际状态，不重发原操作。operationId 使用未知响应返回的确切 ID；completed.result 是原结果，媒体仍运行则按 nextAction 等待。running/unknown 保留原 ID，failed 才依据任务决定修复或明确重试。',{operationId:{type:'string',required:true}},'operation-status');
 tool('transcribe_media','识别现有音视频的真实台词与逐词时间，按 transcriptionConfiguration 选择本地 WhisperX 或已配置服务。返回 transcript:ID，用 await_tasks 等待；prepare_hypit_speech 接入语义字幕。已有可信 alignment 优先复用；缺失时序保持缺失。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},languageCode:{type:'string',enum:['zh','en']}},'transcribe');
 tool('resume_video_task','恢复查询已存在的 Seedance 任务，仅查询和取回已有结果，不重新提交生成、不重复扣费。用于 paused/中断任务；unknown且无remoteId的提交结果不明确，不可重建。',{jobId:{type:'string',required:true}},'resume-video');
 tool('get_hypit_runtime','查看原生 Hypit 已配置的执行端点与绑定。缺服务先明确告知，不把其他服务密钥混用。',{},'hypit-runtime');
 tool('build_hypit_project','异步执行当前已提交工程的任意 SVRun，产出图片、声音、视频或组合。outputs 为 JSON 数组 [{name:公开产出名,file:文件名含扩展名}]；原生 plan 可检查依赖。返回 hypit:ID，用 await_tasks 取真实产出，后续 Run 可复用，媒体自动入共享库。',{operationId:{type:'string',required:true},revision:{type:'string',required:true},run:{type:'string',required:true},outputs:{type:'string',required:true}},'hypit-build');
 tool('run_hypit_tool','在 checkout 返回的工程目录运行原生创作 CLI。args 为字符串数组 JSON，路径相对工程；按当前任务读取对应帮助。支持媒体探测/取段/抽帧、编译、检查、构建记录与 Endpoint 查询。影片导出用 export_video，任意 SVRun 用 build_hypit_project，生成使用当前配置。',{args:{type:'string',required:true}},'hypit-command');
 tool('import_hypit_project','从用户指定的视频Agent工作区内本地目录导入完整 Hypit 工程，保留源码和素材，使用 当前本地 runtime；不复制凭证。返回独立项目，不覆盖当前工程。',{directory:{type:'string',required:true},author:{type:'string'},run:{type:'string'},target:{type:'string'},name:{type:'string'}},'hypit-import');
 tool('prepare_hypit_speech','把已有配音的真实字符时间戳接入 Hypit 原生语义链。导入 @frame/speech 适配包与时序 Evidence，不生成新音频；返回用法，再编写 Script、Take、Timeline、Caption Fine。没有真实时序则报错，不编造。',{assetFile:{type:'string',required:true}},'hypit-speech');
 tool('list_hypit_components','列出当前安装的 Hypit 包与文档入口；使用其原生表达创作，不局限于 固定组件。',{},'hypit-catalog');
 tool('list_motion_components','检索本地可编辑原生动效库。query 按名称、用途、标签及段落名的关键词筛选（多词空格分隔）；kind=scene 为完整设计场景，effect 为基础动作/叠层。返回真实 id、参数、字体、源码入口与源时间段。按当前镜头意图选候选，get_motion_component 读详情后再 use；基础动效数量不代表商业设计质量。',{query:{type:'string'},kind:{type:'string',enum:['scene','effect']}},'motion-list',motionListContract);
 tool('get_motion_component','只读查看选定动效的 README、公开参数、原字体 nativeFonts、源场景段落 segments、sourceDuration 与源码文件列表；不复制包、不改影片、不收费。完整场景先读其接线及源时间说明；真实源码在 use 后通过原生文件 read 读取。',{componentId:{type:'string',required:true}},'motion-get',motionDetailsContract);
 tool('use_motion_component','复制选定原生动效到当前草稿并链接依赖，返回 starter：真实字体、可运行的空白 Film、合并现有 Film 的片段、公开编辑参数和 commit→preview 步骤。先读当前 main.svml/look.svs，空白稿用 emptyDraft，已有影片用 merge 保留原镜头/音轨；公开参数改稿无需先遍读整个包。segments 的真实 id 可选源片段，duration 不能越过源窗。默认仅在真正空白工程且未修改草稿时写入最小 Film，返回 draftPrepared，可立即 commit→preview；initializeDraft=false 只准备包，true 要求初始化，已有影片或草稿不能覆盖。未公开行为才读取相关源码并 rebuild。不提交、不收费，不再次 checkout 覆盖。',{componentId:{type:'string',required:true},initializeDraft:{type:'boolean',description:'默认空白工程自动准备最小 Film；false仅复制，true要求初始化。不会提交，拒绝覆盖已有工程或未提交内容'},segmentId:{type:'string',description:'可选：详情 segments 的真实 id，直接给出对应源起点和时长的接线'},start:{type:'number',description:'可选：镜头在成片内起点，秒，默认0'},duration:{type:'number',description:'可选：镜头时长，秒；省略沿用所选源片段，不延长至越界'}},'motion-use',motionWorkspaceContract);
 tool('rebuild_motion_component','在当前视频草稿中运行所选原生动效包声明的本地 buildScript，用已有依赖重建 bundle/scene.js。源码修改后使用 use 返回的 localBuild 参数调用；不会安装依赖、生成媒体或自动提交工程。成功后 commit_hypit_project，再预览本次改动。仅支持包声明的构建入口，错误按实际结果修复。',{directory:{type:'string',required:true,description:'use_motion_component 返回的确切 directory，例如 hypit/packages/frame--swiss-poster-1.0.0；不能猜组件库或另一个项目路径。'}},'motion-rebuild');
 tool('save_motion_component','将当前已提交工程 packages/ 下的可复用 Author Package 保存到本地动效库供其他项目使用。包需有 owner-scoped 名称、明确版本、可执行 hypit.activation 与 README。保存组件代码及必要素材，不拷贝整部影片；同版本不覆盖，改实现须升级包版本。',{directory:{type:'string',required:true},name:{type:'string',required:true},description:{type:'string'}},'motion-save');
 tool('read_hypit_docs','按任务读取原版参考与示例。先加载 skill(name="hypit")，再依问题索引读相关文档。path 支持 references/…、skills/hypit 下目录及原版源码示例；目录返回真实文件名，已读文档复用。',{path:{type:'string',required:true}},'hypit-docs');
 tool('read_hypit_project','读取权威工程文件列表，传 path 时读取完整源码。少量修改先定位文件再 edit_hypit_project；跨文件编辑先 checkout。新对话工作副本未同步时，以本工具结果为准。',{path:{type:'string'}},'hypit-read');
 tool('edit_hypit_project','原子提交源码到同一工程，可撤销。files 为 JSON 对象：相对路径→完整文本，null 删除源码；options 可选 author/run/target，默认 main.svml/render.svrun/final.video。validated:true 已完成原生编译，保存后仍可编辑轨道与参数。',{revision:{type:'string',required:true},files:{type:'string',required:true},options:{type:'string'}},'hypit-edit');
 tool('checkout_hypit_project','复制完整工程、组件与素材到本视频代码工作副本，返回真实 directory/CLI 和基线 revision。使用返回的绝对路径读写，修改后 commit_hypit_project。重复 checkout 会刷新同名源文件，提交前保留需要的草稿。',{},'hypit-checkout');
 tool('commit_hypit_project','把工作区 hypit/ 内的工程源码与组件回写当前项目，编译验证后更新预览，可撤销。新增本地媒体随源码提交并编入共享素材库，不提交任意运行时配置。',{revision:{type:'string',required:true},options:{type:'string'}},'hypit-commit');
 tool('inspect_hypit_scene','读取实际编译场景的精简轨道和语义摘要；传 entityId 展开该实体 inspector/controlValue/editHandles。detail=full 仅用于整个结构。场景结构不是渲染画面，画面使用 preview_frames。',{entityId:{type:'string'},detail:{type:'string',enum:['summary','full']}},'hypit-inspect');
 tool('index_hypit_assets','将工程所有嵌套媒体编入共享素材库，保留原始引用路径。返回 sourcePath → assetFile，用同一素材继续生成、剪辑和配音。',{},'hypit-index-assets');
 tool('adjust_hypit_timing','移动或裁剪原生片段。使用 inspect_hypit_scene 返回的 revision/entityId；targetFrame 为目标帧，语义片段自动吸附真实锚点并写回 Script，相关组件一起更新。也可传 semantic JSON 精确指定原生 moment/selection 锚点。',{revision:{type:'string',required:true},entityId:{type:'string',required:true},gesture:{type:'string',required:true},targetFrame:{type:'number'},semantic:{type:'string'}},'hypit-timing');
 tool('edit_hypit_scene','提交原生 mutation JSON，参数对象 {type:"parameter.adjust",revision,entityId,parameterId,value}；ID 来自 inspect_hypit_scene，value 用 UI 的 controlValue/单位（20% 减半传10）。批量为 {revision,mutations:[…]}，共同撤销，失败整体回退；时间用 editHandles。',{mutation:{type:'string',required:true}},'hypit-mutation');
 tool('set_production_plan','保存用户可见方案，不生成或改时间线。导演 productionPlanInput 可核对后直接传入；每镜 route=generated/code/hybrid。时间为秒，保持参考 sceneId。creative 保存创意主张、开场、商品作用、记忆、结尾、声音及风险，方案调整时同步更新。',{duration:{type:'number',required:true},ratio:{type:'string',required:true},scenes:{type:'string',required:true,description:'JSON 数组：id/name/start/end/route/visual/product/text/voiceover/sfx/transition；route 为 generated、code 或 hybrid。时间为秒。'},creative:{type:'string',description:'可选创意元信息 JSON 对象：claim/reason/opening/productRole/memory/endAction/voiceover/music/risks。可直接用导演 productionPlanInput.creative。'},referenceId:{type:'string'}},'production-plan');
 tool('organize_asset','修改已有素材中文名、所属场景和采用状态，不删除、不自动替换时间线。status=candidate/selected/superseded；replaces 指定被替换的同类素材，旧素材保留。新版本采用后必须同时编辑工程引用，不能仅改状态就声称已剪辑。',{assetFile:{type:'string',required:true},name:{type:'string'},scene:{type:'string'},status:{type:'string',enum:['candidate','selected','superseded']},replaces:{type:'string'}},'asset-metadata');
 tool('rename_video_project','修改当前项目名称，不复制工程、不生成素材。',{name:{type:'string',required:true}},'rename');
 tool('analyze_video','只读分析已有视频的质量，异步 reference:ID，用 await_tasks 取结果。证据按实际 evidenceMode：video-audio 可分析输入画面与音轨；frames-transcript 仅抽样帧及转录，无法判断音色/音乐/混音。只对已覆盖区间下结论，分析不自动改工程。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},brief:{type:'string',required:true},purpose:{type:'string',required:true,enum:['quality']}},'reference-analyze');
 tool('fork_video_project','复用当前完整工程、组件与素材，创建新版本以换商品、语言或 Hook；只复制不生成新素材。返回项目 ID，新版本独立保存。',{name:{type:'string',required:true}},'hypit-fork');
 tool('edit_visual_component','按 context.componentCatalog 添加/修改/复制/删除可编辑叠加组件。props 是 JSON 属性，位置/尺寸用百分比，z 决定叠放。timing 为 {kind:absolute|shot|audio|phrase,targetId,phrase,offset,duration}；phrase 需要实际 alignment，unresolved 须解决。为明确表达添加，既有视频原声与素材保留。',{revision:{type:'string',required:true},type:{type:'string',enum:['component'],required:true},action:{type:'string',enum:['add','update','duplicate','delete'],required:true},component:{type:'string'},id:{type:'string'},name:{type:'string'},visible:{type:'boolean'},props:{type:'string'},timing:{type:'string'}},'change');
 tool('list_audio_voices','列出指定服务商当前可用音色；provider=elevenlabs/minimax。中文广告优先选择中文或含 zh 验证的音色，使用真实文案试音后再合成整段。',{provider:{type:'string',enum:['elevenlabs','minimax']}},'audio-voices');
 tool('replace_hypit_media','原子替换原生工程绑定素材：replacements 为 [{document,elementId,oldAssetFile,newAssetFile}] JSON。先读取声明，只改同类 asset.src，保留 Take、语义锚点、时序和增益。切段对应先按实际来源准备；换声自动匹配响度时沿用结果的 gainCompensationNeeded。',{revision:{type:'string',required:true},replacements:{type:'string',required:true,description:'JSON数组：[{document,elementId,oldAssetFile,newAssetFile}]'}},'hypit-replace-media');
 tool('generate_audio','生成 speech/music/sound 或设计/克隆/更换音色，入共享素材库而不改时间线。参数依 get_media_capabilities(mediaType="audio",kind,…).productionSelection；未要求换声则省略 voiceId/provider/model，沿用用户当前音色，text 为真实台词，prompt 为该服务支持的声音描述。整段配音优先，中文 languageCode=zh；真实 alignment 接 prepare_hypit_speech，缺时序才转录。voice-change 传 referenceFile 干声及 voiceId；按返回的 timing/gainCompensationNeeded 编排，不复制旧 alignment。异步 audio:ID，用 await_tasks 取结果。',{operationId:{type:'string',required:true},name:{type:'string',description:'简短中文素材名'},kind:{type:'string',required:true,enum:['speech','music','sound','voice-design','voice-clone','voice-change']},provider:{type:'string',enum:['elevenlabs','mimo','minimax']},text:{type:'string'},prompt:{type:'string'},voiceId:{type:'string'},referenceFile:{type:'string'},duration:{type:'number'},languageCode:{type:'string'},speed:{type:'number'}},'generate-audio');
 tool('edit_audio_track','添加/更新/删除独立声音。生成、上传和代码制作的音频都可使用。action=add 时 type=audio，assetFile 来自素材库；role=narration/music/effect。start 是成片时间，trimStart 是源文件取段起点，duration 为使用时长。gain 为 0–2 的线性音量，fadeIn/fadeOut 单位秒，loop 默认 false。update/delete 指定 context.audioTracks 中的 trackId。必须使用最新 revision。只修改这段声音；要只重配一句，生成该句后 update 对应轨道 assetFile/duration。',{revision:{type:'string',required:true},type:{type:'string',enum:['audio'],required:true},action:{type:'string',required:true,enum:['add','update','delete']},trackId:{type:'string'},assetFile:{type:'string'},role:{type:'string',enum:['narration','music','effect']},start:{type:'number'},duration:{type:'number'},trimStart:{type:'number'},gain:{type:'number'},fadeIn:{type:'number'},fadeOut:{type:'number'},loop:{type:'boolean'}},'change');
 tool('generate_image','生成或编辑图片并加入共享素材库；参数依 get_media_capabilities(mediaType="image",…)。imageFiles 只引用本项目已有图片，留空文生图；size 按画幅选择；quality/provider/model 默认省略沿用用户当前选择，显式填写只用 capabilities.productionSelection.allowedArguments；name 用中文。异步返回任务，用 await_tasks 取真实结果后检查画面。',{operationId:{type:'string',required:true},prompt:{type:'string',required:true},provider:{type:'string',enum:['kuaipao','musk','runninghub','seedream']},imageFiles:{type:'array',items:{type:'string'}},size:{type:'string',enum:['1440x2560','2560x1440','2048x2048','2368x1776','1776x2368']},name:{type:'string'},quality:{type:'string',enum:['configured','premium']}},'generate-image');
 tool('resume_image_task','恢复已有结果的图片任务：RunningHub 查询远端 ID，快跑只重试保存过的图片地址下载。不重新生成、不重复扣费；快跑提交超时且未拿到地址时不能恢复。',{jobId:{type:'string',required:true}},'resume-image');
 tool('stage_asset','将项目已有素材复制到代码工作区 input/，不改原素材。assetFile 来自项目上下文，使用返回的确切 file/relativeFile/workspaceDirectory；跨视频脚本使用绝对 file。',{assetFile:{type:'string',required:true}},'stage-asset');
 tool('publish_workspace_asset','将当前代码工作区中已生成的图片/视频/音频校验后加入项目共享素材库。file 使用目标工作区的真实绝对路径或相对 workspaceDirectory 路径，name 填简短中文展示名；不直接修改时间线。成片交付用 export_video 才能出现在【成片】。',{file:{type:'string',required:true},name:{type:'string'}},'publish-workspace');
 tool('get_tasks','读取统一任务列表：image/video/audio/reference/export/hypit，含状态、产出素材和失败原因。手动和对话创建的任务均可用。',{},'tasks');
 tool('sync_hypit_assets','批量同步共享素材到本视频工作区 hypit/assets，保留草稿和既有素材。返回真实 directory 与 file/absoluteFile；工程引用用 file。assetFiles 省略同步全部，已有 editing.document/media 可直接引用时复用。',{assetFiles:{type:'array',items:{type:'string'}}},'hypit-sync');
 tool('await_tasks','登记完整任务 ID（audio:/image:/video:/reference:/export:/hypit:ID）与原任务内的下一步。按返回的 nextAction 用原生 job 等待，或简短说明进度后让完成事件接续；等待状态不是完成。唤醒后先读真实结果，同一意图复用已有任务。',{taskIds:{type:'array',required:true,items:{type:'string'}},instruction:{type:'string',required:true},nextStep:{type:'string',description:'完成后做什么，简短中文，如替换尾板并导出'}},'await-tasks');
 tool('get_media_capabilities','只读查询本地媒体服务能力与本次用户实际选择，无远程调用。productionSelection.arguments 可直接用于生成，allowedArguments 是本次允许值；省略生成的模型/质量/音色即沿用。qualityMapping 只是服务能力，不授权自动改选；查询不符合本次选择时返回 conflicts。当前默认能力见 Configuration.capabilities，音频按 kind 分别查询。',{mediaType:{type:'string',required:true,enum:['video','image','audio']},provider:{type:'string'},model:{type:'string'},quality:{type:'string',enum:['configured','premium']},kind:{type:'string',enum:['speech','music','sound','voice-design','voice-clone','voice-change']}},'media-capabilities');
 tool('get_project_context','一次读取项目及视频列表、targetVideoIds、当前任务作用的视频、制作选项、结构化引用与真实选区，同时读取工程、素材、镜头和最新 revision。先依据这些信息准确定位目标与用户指定的服务/模型，跨视频修改明确传 videoId；省略沿用提交时选中的视频。素材文件名和元数据不代表看懂画面。',{},'context');
 tool('list_project_videos','列出同一项目的所有视频、变体关系和当前作用视频，便于明确选择跨视频任务的目标；不生成或修改素材。',{},'video-list');
 tool('create_video_variant','在同一项目内基于已有视频创建可独立编辑的变体，共享素材，不生成新素材。parentVideoId 可取视频列表，省略使用当前任务视频；difference 记录 Hook、语言、画幅等预期变化，创建后仍需实际编辑落实。',{name:{type:'string',required:true},parentVideoId:{type:'string'},difference:{type:'string'}},'video-variant');
 tool('search_library','检索全局素材库，按名称/描述和媒体类型筛选；返回真实素材 ID，避免重复生成。',{query:{type:'string'},kind:{type:'string',enum:['image','video','audio']}},'library-search');
 tool('use_library_asset','把全局素材关联到当前项目，返回当前项目可引用的真实素材文件；不重新生成。',{assetId:{type:'string',required:true}},'library-use');
 tool('publish_library_asset','将当前项目的一项真实素材保存到全局素材库，供其他项目复用；assetFile 必须来自当前项目素材列表。',{assetFile:{type:'string',required:true}},'library-publish');
 tool('read_project_conversation','读取本项目指定独立对话的近期结论，conversationId 来自项目列表，最多10条/每条2000字。其他对话仅作资料；修改共享工程仍需最新 revision，工作副本先 checkout 同步；异步接续归发起对话。',{conversationId:{type:'string',required:true},limit:{type:'number'}},'conversation-history');
 tool('apply_project_changes','修改当前项目：type=text 改文本；position 调字幕 y；size 调字号；shot 调镜头 shotId（context 中的稳定 ID）、duration（0.1–180 秒）、assetFile（已上传素材文件名）、trimStart（视频取段秒数）、sourceAudio（原声）、fit（cover/contain）；music 用已有音频 assetFile 和 gain（0–1）设置配乐。clearAsset=true 清除镜头自选素材或配乐。必须使用最新 revision。',{
  revision:{type:'string',required:true},type:{type:'string',required:true},id:{type:'string'},text:{type:'string'},y:{type:'number'},size:{type:'number'},shotId:{type:'string'},duration:{type:'number'},assetFile:{type:'string'},trimStart:{type:'number'},sourceAudio:{type:'boolean'},fit:{type:'string'},gain:{type:'number'},clearAsset:{type:'boolean'},visible:{type:'boolean'}},'change');
 tool('edit_timeline','新增、复制、拆分、删除或移动镜头。action=add（afterShotId 可省略表示末尾，可选 assetFile/duration/caption）；duplicate/delete 使用 shotId；split 使用 shotId 和 splitAt（相对该镜头起点的秒数，不是整条片时间）；move 使用 shotId 和 index（从 0 起的目标位置）。不会删除素材文件。返回更新后的 shots；新增 ID 必须从结果读取。支持同一轮多动作时用 apply_video_edits 的 type=timeline；reorder 的 shotIds 必须包含全部镜头。',{revision:{type:'string',required:true},action:{type:'string',required:true},shotId:{type:'string'},afterShotId:{type:'string'},assetFile:{type:'string'},duration:{type:'number'},caption:{type:'string'},splitAt:{type:'number'},index:{type:'number'}},'timeline');
 tool('apply_video_edits','原子提交一组剪辑动作，只产生一条撤销记录。changes 是 JSON 数组，type=shot 支持换素材、trimStart、duration、sourceAudio；type=overlays,visible=false 隐藏全部叠加文字（不删除文案）；type=headings,visible=false 仅隐藏品牌与主标题，保留字幕；type=text 修改文案；type=music 修改配乐；type=timeline 支持 add/duplicate/split/delete/move/reorder 编排。不传的字段保持不变。',{revision:{type:'string',required:true},changes:{type:'string',required:true}},'batch');
 tool('generate_video','生成独立视频或回填兼容模板镜头。先按 get_media_capabilities(mediaType="video",…) 选择时长、画幅、分辨率、参考及声音模式；references 为 [{file,role}] JSON，role 使用 first_frame/last_frame/reference_image/reference_video/reference_audio。锁定/改编驱动音轨需 drivingAudioFile，imageFile 为已有图片。原生工程 autoApply=false，结果入库后编排；采用参考方案用 generate_reference_video。异步返回，用 await_tasks 取真实视频。',{operationId:{type:'string',required:true},revision:{type:'string'},shotId:{type:'string'},prompt:{type:'string',required:true},duration:{type:'number',required:true},provider:{type:'string',enum:['runninghub','minimax','seedance']},resolution:{type:'string',enum:['480p','720p','768p','1080p','480P','768P','2K']},audio:{type:'boolean'},audioMode:{type:'string',enum:['native','reference_only','lock_source','remix_source']},drivingAudioFile:{type:'string'},imageFile:{type:'string'},imageMode:{type:'string',enum:['first_frame','reference_image']},autoApply:{type:'boolean'},ratio:{type:'string',enum:['9:16','16:9','1:1','4:3','3:4','21:9','adaptive']},references:{type:'string'},name:{type:'string'},quality:{type:'string',enum:['configured','premium']}},'generate');
 tool('get_video_generations','读取本项目所有手动或对话生成任务、生成提示词、视频素材文件、状态和自动回填结果。只查询、不重新提交。',{},'generation-status');
 tool('apply_generated_video','把已完成的生成任务回填指定镜头；使用完整片段并保留原声。手动和对话生成的任务均可用；之后可继续剪辑。',{revision:{type:'string',required:true},jobId:{type:'string',required:true},shotId:{type:'string'}},'apply-generation');
 tool('analyze_reference','以原片实际抽样帧和本地转录形成新商品改编方案，抽样范围与未核实声音会标明。brief 包含商品事实、保留与替换方向；可附商品图。最长180秒，异步返回 reference:ID，按等待结果继续；文件名与提示词不是原片证据。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},brief:{type:'string',required:true},targetDuration:{type:'number'},ratio:{type:'string',enum:['16:9','9:16','4:3','3:4','1:1','21:9']},preserve:{type:'string',enum:['structure','style','shots']},imageFile:{type:'string'}},'reference-analyze');
 tool('get_reference_plans','读取参考分析进度、语义拆解、源时间点、新商品方案和每段生成结果。ready 才可称分析完成。',{},'reference-status');
 tool('recover_reference_plan','将 failed/interrupted 参考分析接回同一工作台。先读取 version，实际查看原片抽帧；plan 为 edit_reference_plan 同格式完整 JSON，evidence 为 {frames:[{at,observation}],audio:{reviewed,notes}}。每个源区间要有真实查看时点；未知保持未知。只恢复分析，后续按用户目标制作。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},plan:{type:'string',required:true},evidence:{type:'string',required:true}},'reference-recover');
 tool('edit_reference_plan','修改已分析的复刻方案。plan 是完整 JSON 对象，保持源时间证据，scenes 保留原始 id；包含 role/observation/preserve/prompt/voiceover/caption/duration/sourceStart/sourceEnd；先读 get_reference_plans 的 version。每段为0.5–15秒剪辑时长；生成服务自动补足最短时长，编排时按方案剪取。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},plan:{type:'string',required:true},ratio:{type:'string',enum:['16:9','9:16','4:3','3:4','1:1','21:9']}},'reference-edit');
 tool('apply_reference_plan','采用参考改编方案作为项目共享 productionPlan，保留每段稳定 sceneId、目标画幅和时间；空白及原生工程不创建占位镜头、不覆写时间线。仅用户确认或要求直接制作后调用；生成、配音、剪辑、导出仍由你在同一任务完成。兼容旧商品模板的镜头回填。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},revision:{type:'string',required:true}},'reference-apply');
 tool('generate_reference_video','按已采用方案逐镜生成并保留 sceneId/index，参数依所选视频能力。indices 为从0起的 JSON 数组，省略全部；已提交/完成段复用，retry=true 处理明确失败段，重做成功段需明确指定。原生工程继续用返回素材编排，声音按方案独立安排。批量提交后按任务等待，素材完成后继续剪辑至成片。',{referenceId:{type:'string',required:true},revision:{type:'string',required:true},indices:{type:'string'},retry:{type:'boolean'},provider:{type:'string',enum:['runninghub','minimax','seedance']},resolution:{type:'string',enum:['480p','720p','768p','1080p','480P','768P','2K']},quality:{type:'string',enum:['configured','premium']}},'reference-generate');
 tool('undo_project_change','撤销最近一次修改。',{revision:{type:'string',required:true}},'undo');
 tool('apply_text_edits','一次修改多个文本。edits 是 JSON 数组字符串，每项包含 id 和 text；只允许 context 中列出的对象。成功后自动完成 Hypit 编译校验。',{revision:{type:'string',required:true},edits:{type:'string',required:true}},'batch-text');
 tool('set_chat_timing','调整 hypit-chat 动画总时长和所有气泡的出现时间。arrivals 为秒数 JSON 数组字符串，顺序对应 context.shots；时间必须递增且小于总时长。',{revision:{type:'string',required:true},duration:{type:'number',required:true},arrivals:{type:'string',required:true}},'chat-timing');
 tool('validate_video','通过 Hypit 编译当前视频，返回真实校验结果。',{},'validate');
 tool('export_video','用户要求导出或制作成片时，启动 Hypit 本地渲染。返回任务 ID，之后使用 get_export_status 查询；仅 done 才能说导出完成。summary 填本版简短中文修改说明，例如字幕清晰度调整。',{revision:{type:'string',required:true},summary:{type:'string'}},'export');
 tool('preview_frames','读取已保存工程或已完成 jobId 的真实渲染图片。frames/times 互斥；省略取 cuts，auto 可 beats 或 every:Ns；sampleDuration 最多3秒，工程小样静音。UI 保留完整帧和小样；模型只接收拼图加最多3张检查帧，避免长会话塞入全尺寸图片。其他时间点按需另查。抽样只证明覆盖画面，声音需另查。',{revision:{type:'string'},jobId:{type:'string',description:'已完成成片的真实任务ID；省略预览当前原生工程'},sampleDuration:{type:'number',description:'可选小样时长，必须大于0且不超过3秒；工程小样静音'},frames:{type:'array',items:{type:'number'},description:'明确帧号，整数数组，与 times 互斥'},times:{type:'array',items:{type:'number'},description:'片长内秒数，与 frames 互斥'},auto:{type:'string',description:'cuts、beats 或 every:Ns，例如 every:2s；beats 需要真实已映射的节奏证据'},maxFrames:{type:'number',description:'1–24，默认12；完整渲染帧数量；模型图片另受预览和累计请求预算限制'},grid:{type:'boolean',description:'默认返回拼图；false 仍只选少量检查帧，全部帧由 UI 保留'}},'preview-frames',{output:previewImageOutput,before:preparePreviewRequest,prepare:preparePreviewImages});
 tool('probe_export','本地只读探测实际已完成成片或音视频素材的时长、分辨率、帧率、音轨、响度，以及带时间点的疑似黑帧/静帧区间。jobId 与 assetFile 选一种。检测是阈值线索，静态品牌尾板或暗场可能符合创意；结合真实画面核实后再局部修改。元数据合格不等于听过音色或验收创意。',{jobId:{type:'string',description:'已完成成片的真实任务ID'},assetFile:{type:'string',description:'当前项目的真实视频或音频素材文件名'},analysisSeconds:{type:'number',description:'分析上限秒数，默认300，最大1800；未覆盖区间不能称已检查'}},'probe-export');
 tool('analyze_beats','本地分析已有音频的节奏证据，返回源音频秒数上的 BPM 估计、起音节拍、强拍候选与置信度。低置信度/静音/短片可能没有 BPM；强拍候选不是已确认的小节第一拍。仅作旁白语义区间内的动作、强调和局部切点建议，不能机械每拍换镜头。映射到时间线需结合音乐起点、trimStart 与变速；不生成音频、不修改剪辑。',{assetFile:{type:'string',required:true},start:{type:'number',description:'源音频起点秒数，默认0'},end:{type:'number',description:'源音频结束秒数，默认实际片长；一次最长600秒'}},'analyze-beats');
 tool('bind_beat_guides','将真实节拍分析绑定到当前原生音乐clip，生成随实际trim/rate映射的可见节奏Guide，不改镜头或台词。先 list_beat_guides/read context定位真实音轨实体，revision使用当前项目版本。普通Normalize→Audio链自动核对原音频；未知派生源只有用户明确确认 sourceOrigin（原音频对应派生源0的秒数）与 confirmedSource=true才绑定，不能猜偏移。enabled=false关闭既有绑定。',{analysisId:{type:'string',required:true},assetFile:{type:'string',required:true},clipId:{type:'string',required:true},revision:{type:'string',required:true},sourceOrigin:{type:'number',description:'仅未知派生源：原音频中对应当前派生源0的真实秒数'},confirmedSource:{type:'boolean',description:'仅用户明确确认未知派生源映射时 true'},enabled:{type:'boolean',description:'默认true，false关闭绑定'}},'bind-beat-guides');
 tool('list_beat_guides','读取当前原生工程的实际节拍绑定、音轨实体和精确映射的可见Guide及限制。Guide随音乐trim/rate改变，不能拿源音频秒数直接当剪辑时间；beats只辅助真实旁白语义内的动作与强调。',{},'beat-guides');
 tool('stage_export','将已完成的本项目成片复制到代码工作区 input/，返回确切本地路径供 ffprobe/抽帧/音轨检查。不要猜 exports 或 native-builds 路径。不会生成、重新导出或增加素材。',{jobId:{type:'string',required:true}},'stage-export');
 tool('get_export_status','查询此项目的导出状态和下载链接。',{jobId:{type:'string',required:true}},'export-status');
 ctx.on('agent/assistant-stream',({agent,frame})=>{const scope=conversationBySession.get(agent.session.id);if(scope)send({type:'stream',...scope,frame});});
 ctx.on('session/event',(session,event)=>{const scope=conversationBySession.get(session.id);if(scope)send({type:'event',...scope,event});});
 ctx.on('agent/status',({agent,status})=>{const scope=conversationBySession.get(agent.session.id);if(scope)send({type:'status',...scope,status});});
 const receive=async m=>{try{
  if(m.type==='skills-changed')return;
  if(m.type==='ensure-home'){send({type:'home-session',requestId:m.requestId,sessionId:await ensureHome()});return;}
  if(m.type==='tool-result'){transport.receive(m);return;}
  const scope=scopeOf(m),key=scopeKey(scope);
  if(m.type==='cancel'){cancelWaits(scope);handles.get(key)?.agent.cancel({kind:'user'});return;}
  if(m.type==='inspect-native'){const h=await ensure({...m,requestId:undefined});const compact=ctx.agentPresets.serviceFor(h.agent,'compaction');const pruner=ctx.agentPresets.serviceFor(h.agent,'toolResultPruner');const pruned=m.compact?pruner.pruneSession(h.agent.session):undefined;const result=m.compact?await compact.compactNow(h.agent,new AbortController().signal):undefined;send({type:'native-inspection',requestId:m.requestId,...scope,result:{compaction:Boolean(compact),toolResultPruner:Boolean(pruner),cwd:h.agent.session.header.cwd,compacted:Boolean(result),pruned}});return;}
  if(m.type==='ensure'){const h=await ensure(m);if(m.waiting){const owner=m.waiting.ownerSessionId&&m.waiting.ownerSessionId!==h.agent.session.id?ctx.agents.get(m.waiting.ownerSessionId):h.agent;if(!owner||scopeKey(toolScope(owner.session)||{})!==key)throw Error('等待任务所属的原生会话不可用');startWait(owner,scope,m.waiting.id,m.waiting.instruction);}return;}
  if(m.type==='tasks-settled'){const wait=waitKey(scope,m.waitId),item=waitJobs.get(wait);if(item){waitJobs.delete(wait);item.settle({status:'completed',result:JSON.stringify(m.result)});await new Promise(resolve=>setImmediate(resolve));const session=ctx.agents.get(item.owner)?.session||ctx.sessions?.get(item.owner);if(session)await ctx.sessions.flush(session);send({type:'wait-delivered',...scope,waitId:m.waitId,ownerSessionId:item.owner});}return;}
  if(m.type==='prompt'){
    const h=await ensure(m);
    if(h.agent.status==='running')throw Error('上一轮还在执行');
    counts.set(h.agent.session.id,0);
    if(native)await ctx.sessionController.prompt({sessionId:h.agent.session.id,requestId:m.requestId||crypto.randomUUID(),mode:'queue',content:[{type:'text',text:m.prompt}]},new AbortController().signal);
    else{let selection=selections.get(key);if(!selection){selection={current:undefined,assembled:undefined};installSelection(h.agent,selection);selections.set(key,selection);}selection.current=agentModelSelection();h.agent.followup(createUserMessage({content:[{type:'text',text:m.prompt}],source:{kind:'user'}}));}
    send({type:'accepted',requestId:m.requestId,...scope});
  }
 }catch(e){send({type:'error',projectId:m.projectId,conversationId:m.conversationId||m.projectId,requestId:m.requestId,error:e.message});}};
 process.on('message',receive);ctx.on('dispose',()=>{process.off('message',receive);transport.close();});
 send({type:'ready',tools:registered,...(native?{authURL:ctx.connection.authenticatedUrl('http://127.0.0.1:'+(ctx.webServer?.port??process.env.FRAME_DSH_PORT)+'/')}:{})});
}
