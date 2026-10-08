import {installModelSelection} from '@deepseek-ai/dsh-agent';
import { defineTool } from '@deepseek-ai/dsh-tools';
import crypto from 'node:crypto';
import path from 'node:path';
import {promises as fs} from 'node:fs';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
export const name='frame-video-bridge';
export const inject=['agents','agentLoop','tools',...(process.env.FRAME_NATIVE_DSH==='1'?['agentPresets','sessionPersistence','sessions','jobs','connection','workspaceRegistry']:[])];
export function apply(ctx){
 const native=process.env.FRAME_NATIVE_DSH==='1', waitJobs=new Map();
 const ensuring=new Map();
 const homeSessionId='frame-home-composer';let homePending;
 const handles=new Map(),conversationBySession=new Map(),requests=new Map(),counts=new Map(),selections=new Map();
 const send=value=>process.send?.(value);
 const bindingType='frame/conversation';
 const scopeKey=scope=>JSON.stringify([scope.projectId,scope.conversationId]);
 const waitKey=(scope,waitId)=>JSON.stringify([scope.projectId,scope.conversationId,waitId]);
 function scopeOf(message){
  const scope={projectId:message.projectId,conversationId:message.conversationId||message.projectId};
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
   const options={agentOptions:{provider:'frame-deepseek',model:process.env.DEEPSEEK_MODEL||'deepseek-flash'}};
   const handle=saved?await ctx.agents.resume({resumeSessionId:homeSessionId,...options}):await ctx.agents.create({sessionId:homeSessionId,meta:{cwd},...options});
   await ctx.sessions.flush(handle.agent.session);
   const workspace=await ctx.workspaceRegistry.create(cwd,'OmniCut');await workspace.attachSession(homeSessionId);
   return homeSessionId;
  })().finally(()=>{homePending=undefined;});
  return homePending;
 }
 function rpc(scope,operation,args,signal){return new Promise((resolve,reject)=>{if(signal?.aborted)return reject(Error('操作已取消'));const id=crypto.randomUUID();const timeout=setTimeout(()=>{requests.delete(id);reject(Error('视频工具响应超时'));},60000);requests.set(id,{resolve,reject,timeout});send({type:'tool',id,...scope,operation,args});});}

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
  let h=handles.get(key);
  if(h&&ctx.agents.get(h.agent.session.id)===h.agent)return h;
  handles.delete(key);selections.delete(key);
  const agentOptions={provider:'frame-deepseek',model:process.env.DEEPSEEK_MODEL||'deepseek-flash',maxTokens:393216};
  const cwd=native?path.join(process.env.FRAME_CODE_ROOT,scope.projectId,...(scope.conversationId===scope.projectId?[]:['conversations',scope.conversationId])):process.cwd();await fs.mkdir(cwd,{recursive:true});
  const setup=native?async agentCtx=>{await ctx.agentPresets.mount(agentCtx,'frame');}:undefined;
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
  assertBinding(conversationBySession.get(sessionId),scope);
  assertBinding(savedBinding(h.agent.session),scope);
  handles.set(key,h);conversationBySession.set(sessionId,scope);
  const selection={current:{provider:'frame-deepseek',model:process.env.DEEPSEEK_MODEL||'deepseek-flash',reasoningEffort:'max'},assembled:undefined};installModelSelection(h.agent.ctx,selection);selections.set(key,selection);
  if(native){h.agent.session.append('model/selection',selection.current);await ctx.sessions.flush(h.agent.session);const workspace=await ctx.workspaceRegistry.create(cwd,'OmniCut');await workspace.attachSession(sessionId);}
  return h;
 }
 if(native)ctx.on('agent/inbox/claimed',({agent,message,turn})=>{
  const scope=conversationBySession.get(agent.session.id);if(!scope)return;
  const kind=message.source?.kind;
  if(kind==='user'){counts.set(agent.session.id,0);send({type:'native-input',...scope,sessionId:agent.session.id,nativeTurn:turn,text:message.content?.filter(x=>x.type==='text').map(x=>x.text).join('')||''});}
  else if(kind==='tool-jobs')send({type:'native-wakeup',...scope,sessionId:agent.session.id,nativeTurn:turn});
 });
 const registered=[];
 const output={schema:{type:'string'},render:(_a,v)=>[{type:'text',text:v}]};
 function tool(name,description,parameters,operation){registered.push(name);ctx.tools.register(defineTool({name,description,parameters,output,async execute(args,exec){const sessionId=exec.agent.session.id,scope=toolScope(exec.agent.session);if(!scope)throw Error('会话未绑定项目');const rpcScope={...scope,ownerSessionId:sessionId};const n=(counts.get(sessionId)||0)+1;counts.set(sessionId,n);if(!native&&n>12){exec.agent.cancel({kind:'user'});throw Error('本轮已达到 12 次操作限制');}const result=await rpc(rpcScope,operation,args,exec.signal);if(native&&operation==='await-tasks')return JSON.stringify({...result,jobId:startWait(exec.agent,scope,result.waitId,args.instruction)});
 const referencePending=operation==='reference-analyze'&&['preparing','analyzing','reviewing'].includes(result.status),videosPending=operation==='reference-generate'&&result.jobs?.filter(j=>['submitting','queued','running','downloading'].includes(j.status));
 if(native&&(referencePending||videosPending?.length)){
  const taskIds=referencePending?['reference:'+result.id]:videosPending.map(j=>'video:'+j.id);
  const instruction=referencePending?'读取已完成的参考分析。若用户选择先看方案，保存并展示方案后等待确认，不生成素材；若用户明确要求直接制作，沿用此方案继续原请求。分析失败则说明实际阻碍，不重复提交。':'读取已完成的参考镜头及 sceneId，复用素材继续同一项目的声音、字幕、剪辑、导出与成片检查。只处理原请求范围，失败只说明缺失项，不自动升级服务或重做成功项。';
  const waiting=await rpc(rpcScope,'await-tasks',{taskIds,instruction},exec.signal);return JSON.stringify({...result,continuation:{...waiting,jobId:startWait(exec.agent,scope,waiting.waitId,instruction)}});
 }
 return JSON.stringify(result);}}));}
 tool('transcribe_media','按 get_project_context.transcriptionConfiguration 识别现有视频或音频的实际台词与逐词时间戳。启用本地识别时使用原生 WhisperX 服务，无需 Key、不上传音视频；languageCode 缺省 zh，英语用 en。本地当前不区分说话人。返回 transcript:任务ID，用 await_tasks 等待，完成后 prepare_hypit_speech 把真实证据接入原生 Script 和字幕；也可对语音中的词语做精确剪辑。只在任务需要字幕或语音理解时使用，已有配音时序优先复用。缺失时间戳保持缺失，不能均分补齐。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},languageCode:{type:'string',enum:['zh','en']}},'transcribe');
 tool('resume_video_task','恢复查询已存在的 Seedance 任务，仅查询和取回已有结果，不重新提交生成、不重复扣费。用于 paused/中断任务；unknown且无remoteId的提交结果不明确，不可重建。',{jobId:{type:'string',required:true}},'resume-video');
 tool('get_hypit_runtime','查看原生 Hypit 已配置的执行端点与绑定。缺服务先明确告知，不把其他服务密钥混用。',{},'hypit-runtime');
 tool('build_hypit_project','异步执行已提交工程的任意 SVRun，支持图片、声音、视频和组合产出。outputs 为 JSON 数组 [{name:公开产出名,file:文件名含扩展名}]。使用 plan 检查所需服务；远端生成会产生费用，仅在用户创作请求范围内执行。operationId 重试不变。返回 hypit:ID，await_tasks 等待后原生结果可由后续 Run 复用，媒体自动进入共享库。',{operationId:{type:'string',required:true},revision:{type:'string',required:true},run:{type:'string',required:true},outputs:{type:'string',required:true}},'hypit-build');
 tool('run_hypit_tool','在 checkout 的 hypit/ 工程执行 Hypit 原生创作工具：vocabulary、media probe/cut/frames/tile/tiles/boundaries/fetch、capture、snapshot、transcribe、measure、check、plan、doctor、outputs、inspect、builds、history、paths、programs。programs 只操作明确指定的 Endpoint。args 是字符串数组 JSON，仅使用工程相对路径，工作区与 runtime 自动传入。先看对应帮助与文档；外部 provider 未配置时会如实报错，不能伪造结果。影片导出用 export_video；任意原生 Run 用 build_hypit_project，远端媒体优先使用已配置的 Frame 工具。',{args:{type:'string',required:true}},'hypit-command');
 tool('import_hypit_project','从用户指定的视频Agent工作区内本地目录导入完整 Hypit 工程，保留源码和素材，使用 Frame 本地 runtime；不复制凭证。返回独立项目，不覆盖当前工程。',{directory:{type:'string',required:true},author:{type:'string'},run:{type:'string'},target:{type:'string'},name:{type:'string'}},'hypit-import');
 tool('prepare_hypit_speech','把已有配音的真实字符时间戳接入 Hypit 原生语义链。导入 @frame/speech 适配包与时序 Evidence，不生成新音频；返回用法，再编写 Script、Take、Timeline、Caption Fine。没有真实时序则报错，不编造。',{assetFile:{type:'string',required:true}},'hypit-speech');
 tool('list_hypit_components','列出当前安装的 Hypit 包与文档入口；使用其原生表达创作，不局限于 Frame 的固定组件。',{},'hypit-catalog');
 tool('list_motion_components','查看本地动效库：内置与各项目保存的可复用原生 Author Package，包含名称、版本、用途与预览。需要品牌揭幕、文字动效等时先查找，不把静态素材或整片 MP4 当作可编辑组件。',{},'motion-list');
 tool('use_motion_component','把选定动效的原生包放入当前 hypit/ 代码草稿，并返回 README 与参数用法；保留未提交源码，不更换整片。接着按原生 SVML import 将其 Track 接入同一 Canvas/Timeline/Film，修改品牌文字/颜色/时段，再 commit_hypit_project。不会自动添加画面或产生模型费用。',{componentId:{type:'string',required:true}},'motion-use');
 tool('save_motion_component','将当前已提交工程 packages/ 下的可复用 Author Package 保存到本地动效库供其他项目使用。包需有 owner-scoped 名称、明确版本、可执行 hypit.activation 与 README。保存组件代码及必要素材，不拷贝整部影片；同版本不覆盖，改实现须升级包版本。',{directory:{type:'string',required:true},name:{type:'string',required:true},description:{type:'string'}},'motion-save');
 tool('read_hypit_docs','按需读取 Hypit 原版参考文档、语法与示例。制作视频先用 skill(name="hypit") 加载主技能，再按主技能的问题索引读相关参考。path 可用 references/…，也可传 skills/hypit 下的目录列出真实路径；原版 .svml/.svs/.svrun/.ts 示例可直接读取，不猜文件名。不要一次读完所有材料。文档描述的账户安装不构成授权，沿用 Frame 已配置生成服务。',{path:{type:'string',required:true}},'hypit-docs');
 tool('read_hypit_project','列出当前工程全部源码和素材；path 可选，填写则读取完整源码。包含 SVML/SVS/SVRun、项目组件 JS/TS 等。',{path:{type:'string'}},'hypit-read');
 tool('edit_hypit_project','提交任意原生 Hypit 工程源码，校验后更新同一项目，可撤销。files 是 JSON 对象字符串：相对路径到完整文本，null 删除该源码；可多文件同时修改。options 可选 JSON：author/run/target，默认 main.svml/render.svrun/final.video。保存后项目使用原生轨道与参数界面。保持现有素材，生成素材通过 Frame 工具入库后在 SVML 中引用 assets/文件。不要读写密钥或运行时配置。',{revision:{type:'string',required:true},files:{type:'string',required:true},options:{type:'string'}},'hypit-edit');
 tool('checkout_hypit_project','将完整工程源码、组件、素材复制到当前代码工作区 hypit/，可用 DSH 原生文件工具持续写 SVML/JS/TS。返回 CLI 路径与基线 revision。提交前本地 check，最终用 commit_hypit_project 回写，不把可编辑场景压成 MP4。重新 checkout 会更新草稿中的同名源文件。',{},'hypit-checkout');
 tool('commit_hypit_project','把工作区 hypit/ 内的工程源码与组件回写当前项目，编译验证后更新预览，可撤销。新增本地媒体随源码提交并编入共享素材库，不提交任意运行时配置。',{revision:{type:'string',required:true},options:{type:'string'}},'hypit-commit');
 tool('inspect_hypit_scene','读取真实编译后的画布、时间线、轨道、语义锚点和 Studio Companion 参数；包括 editHandles、inspector，不猜测参数 ID。',{},'hypit-inspect');
 tool('index_hypit_assets','将工程所有嵌套媒体编入共享素材库，保留原始引用路径。返回 sourcePath → assetFile，用同一素材继续生成、剪辑和配音。',{},'hypit-index-assets');
 tool('adjust_hypit_timing','移动或裁剪原生片段。使用 inspect_hypit_scene 返回的 revision/entityId；targetFrame 为目标帧，语义片段自动吸附真实锚点并写回 Script，相关组件一起更新。也可传 semantic JSON 精确指定原生 moment/selection 锚点。',{revision:{type:'string',required:true},entityId:{type:'string',required:true},gesture:{type:'string',required:true},targetFrame:{type:'number'},semantic:{type:'string'}},'hypit-timing');
 tool('edit_hypit_scene','使用 Hypit 原生 Studio mutation 协议修改组件参数或时间关系。mutation 是 JSON，取 inspect_hypit_scene 的 revision/entityId/parameterId；参数修改 {type:"parameter.adjust",revision,entityId,parameterId,value}，value 使用 Inspector 的 controlValue 与单位（和 UI 相同），不要直接复制 Author 的 value；例如 Gain 的 controlValue=20 表示20%，减半提交10，而不是0.1；时间修改使用返回的 editHandles。也可提交 {revision,mutations:[原生修改对象,...]}，一组操作共同撤销；失败整体回退。修改直接写入同一源码，保留其他组件与手动调整。',{mutation:{type:'string',required:true}},'hypit-mutation');
 tool('set_production_plan','保存用户可见的制作方案与目标规格，不生成素材、不写占位镜头。新片制作时尽早调用，调整方案时同步更新；scenes 是 JSON 数组，每项 id（参考改编保留 sceneId）/name/start/end/visual/voiceover，时间为秒。',{duration:{type:'number',required:true},ratio:{type:'string',required:true},scenes:{type:'string',required:true},referenceId:{type:'string'}},'production-plan');
 tool('organize_asset','修改已有素材中文名、所属场景和采用状态，不删除、不自动替换时间线。status=candidate/selected/superseded；replaces 指定被替换的同类素材，旧素材保留。新版本采用后必须同时编辑工程引用，不能仅改状态就声称已剪辑。',{assetFile:{type:'string',required:true},name:{type:'string'},scene:{type:'string'},status:{type:'string',enum:['candidate','selected','superseded']},replaces:{type:'string'}},'asset-metadata');
 tool('rename_video_project','修改当前项目名称，不复制工程、不生成素材。',{name:{type:'string',required:true}},'rename');
 tool('analyze_video','用已配置的创意模型检查已有视频的真实抽样帧、语音转录、字幕与叙事节奏。未直接听音，不能核实音色、口音、音乐或混音；抽样未覆盖瞬间也不能称已验收。只读分析，不生成复刻方案、不修改时间线。支持原生工程与成片；先 stage_export 后 publish_workspace_asset 可将成片加入素材。异步 reference:ID，await_tasks 完成后 result.analysis 返回带时间点的问题。不可用检查描述替代真实结果。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},brief:{type:'string',required:true},purpose:{type:'string',required:true,enum:['quality']}},'reference-analyze');
 tool('fork_video_project','复用当前完整工程、组件与素材，创建新版本以换商品、语言或 Hook；只复制不生成新素材。返回项目 ID，新版本独立保存。',{name:{type:'string',required:true}},'hypit-fork');
 tool('edit_visual_component','添加、修改、复制或删除可编辑的画面组件，与 UI 图层共用。先看 get_project_context.componentCatalog/components。type=component；add 指定 component；update/delete/duplicate 指定 id。props 为 JSON 对象字符串，支持 text/subtitle/imageFile/x/y/width/height/size/color/background/accent/align/motion/z/count；x/y/width/height 是画面百分比，z 为叠放顺序。timing 为 JSON 对象字符串：kind=absolute/shot/audio/phrase，targetId 为镜头或音轨 ID，phrase 为实际旁白文字，offset 秒，duration 显示秒数。shot/audio/phrase 绑定会随镜头移动或旁白取段更新；phrase 需要真实 alignment，unresolved 必须告知或改成镜头锚点，不编造。组件叠加在视频上，不重新生成视频，不会关闭原声。仅为明确的表达目的添加，不因制作广告默认添加标题、卡片或倒计时；文案须明确提供，空值不自动填充。',{revision:{type:'string',required:true},type:{type:'string',enum:['component'],required:true},action:{type:'string',enum:['add','update','duplicate','delete'],required:true},component:{type:'string'},id:{type:'string'},name:{type:'string'},visible:{type:'boolean'},props:{type:'string'},timing:{type:'string'}},'change');
 tool('list_audio_voices','列出指定服务商当前可用音色；provider=elevenlabs/minimax。中文广告优先选择中文或含 zh 验证的音色，使用真实文案试音后再合成整段。',{provider:{type:'string',enum:['elevenlabs','minimax']}},'audio-voices');
 tool('generate_audio','生成独立声音并加入共享素材库。kind=speech 配音（provider 可选 elevenlabs/minimax/mimo，缺省使用模型设置）；music 按默认配乐服务选择 ElevenLabs 或 MiniMax Music 3.0（仅历史付费账户）；sound 使用 ElevenLabs。MiniMax 配乐无精确时长参数，必须用实际时长裁剪；Speech 2.8 优先使用真实词级时间戳与 prepare_hypit_speech；只有未返回 words/evidence 才需 transcribe_media；voice-design 按 prompt 设计声音并说出 text，voice-clone 使用 referenceFile 音频复用音色（这两项使用 MiMo）。text 是实际要说的台词，prompt 是音乐/音效描述或 MiMo 声音风格。ElevenLabs 配音不要传 prompt，可在 text 使用当前模型支持的情绪标签。duration：音乐 3–180 秒、音效 0.5–30 秒；配音使用实际生成时长。operationId 重试不变；中文配音使用 languageCode=zh，speed 可选0.7–1.2。先 list_audio_voices 选音色，优先整段生成再按真实 alignment 编排，避免逐句拼接。先检查 audioConfiguration，缺 Key 请引导设置而非换付费服务。异步返回 audio:taskId，await_tasks 完成后检查实际时长和 alignment，再用 edit_audio_track 放到时间线。生成本身不改时间线，不关闭原声，不代表已试听。',{operationId:{type:'string',required:true},name:{type:'string',description:'简短中文素材名'},kind:{type:'string',required:true,enum:['speech','music','sound','voice-design','voice-clone']},provider:{type:'string',enum:['elevenlabs','mimo','minimax']},text:{type:'string'},prompt:{type:'string'},voiceId:{type:'string'},referenceFile:{type:'string'},duration:{type:'number'},languageCode:{type:'string'},speed:{type:'number'}},'generate-audio');
 tool('edit_audio_track','添加/更新/删除独立声音。生成、上传和代码制作的音频都可使用。action=add 时 type=audio，assetFile 来自素材库；role=narration/music/effect。start 是成片时间，trimStart 是源文件取段起点，duration 为使用时长。gain 为 0–2 的线性音量，fadeIn/fadeOut 单位秒，loop 默认 false。update/delete 指定 context.audioTracks 中的 trackId。必须使用最新 revision。只修改这段声音；要只重配一句，生成该句后 update 对应轨道 assetFile/duration。',{revision:{type:'string',required:true},type:{type:'string',enum:['audio'],required:true},action:{type:'string',required:true,enum:['add','update','delete']},trackId:{type:'string'},assetFile:{type:'string'},role:{type:'string',enum:['narration','music','effect']},start:{type:'number'},duration:{type:'number'},trimStart:{type:'number'},gain:{type:'number'},fadeIn:{type:'number'},fadeOut:{type:'number'},loop:{type:'boolean'}},'change');
 tool('generate_image','按 get_project_context.imageConfiguration 使用默认图像服务，provider 可选 musk、runninghub 或 seedream。Musk 使用 GPT Image 2.5 Sunburst，最多4张参考图；RunningHub 使用 Seedream 5 Pro，最多10张；火山最多4张。生成或编辑一张图片，结果进入项目共享素材库；可直接用于镜头，或给 generate_video 作为 imageFile。name 为简短场景名。默认均衡画质；仅在用户要求精细时用 quality=premium，Musk 为 high，火山升级 Pro，RunningHub 保持 Pro；不更换服务。size 表示画幅规格；Musk 按相同比例输出较省成本的尺寸，实际尺寸见入库素材。4:3 传2368x1776。imageFiles 可选，必须是当前项目已有图片，可使用之前生成的图片；留空文生图。operationId 在同一个用户任务内重试保持一致。异步返回 taskId；还有后续工作时用 await_tasks 接续，不轮询、不根据提示词声称已经看懂结果。',{operationId:{type:'string',required:true},prompt:{type:'string',required:true},provider:{type:'string',enum:['musk','runninghub','seedream']},imageFiles:{type:'array',items:{type:'string'}},size:{type:'string',enum:['1440x2560','2560x1440','2048x2048','2368x1776','1776x2368']},name:{type:'string'},quality:{type:'string',enum:['configured','premium']}},'generate-image');
 tool('resume_image_task','恢复有远端 ID 的 RunningHub 图片任务，仅查询和下载既有结果，不重新生成、不重复扣费。',{jobId:{type:'string',required:true}},'resume-image');
 tool('stage_asset','将当前项目的一项已有素材复制到代码工作区 input/ 目录，供 bash/脚本/渲染器处理。assetFile 必须取自 get_project_context 的素材；返回相对路径。不会修改原素材。',{assetFile:{type:'string',required:true}},'stage-asset');
 tool('publish_workspace_asset','将当前代码工作区中已生成的图片/视频/音频校验后加入项目共享素材库。file 为相对工作区路径，name 填简短中文展示名；不直接修改时间线。成片交付用 export_video 才能出现在【成片】。',{file:{type:'string',required:true},name:{type:'string'}},'publish-workspace');
 tool('get_tasks','读取统一任务列表：image/video/audio/reference/export/hypit，含状态、产出素材和失败原因。手动和对话创建的任务均可用。',{},'tasks');
 tool('sync_hypit_assets','将共享素材库的新素材一次同步到代码工作区 hypit/assets，不覆盖源码、已有素材或草稿；返回路径、类型、时长和中文名。新媒体完成后用它，不要重复checkout或逐个stage/copy。assetFiles省略时同步全部。',{assetFiles:{type:'array',items:{type:'string'}}},'hypit-sync');
 tool('await_tasks','等待任务完成后自动继续同一个创作请求。taskIds 使用 get_tasks 的完整 ID（如 audio:UUID / image:UUID / video:UUID / reference:UUID / export:UUID）。instruction 说明完成后的下一步且不得超出用户要求。调用后简短回复并结束本轮，系统在所有任务成功、失败或阻塞后唤醒你；恢复时先检查结果，不重复生成。',{taskIds:{type:'array',required:true,items:{type:'string'}},instruction:{type:'string',required:true},nextStep:{type:'string',description:'完成后做什么，简短中文，如替换尾板并导出'}},'await-tasks');
 tool('get_project_context','读取项目文本、当前模板、文本对象和镜头、已有素材、背景音乐、字幕位置、字号和 revision。素材只提供文件名和元数据，不代表看懂了画面。',{},'context');
 tool('read_project_conversation','按需读取本项目指定对话的标题和最近用户/助手记录，用于理解其他对话的已有结论。conversationId 来自 get_project_context 的项目对话列表。每个新对话上下文独立；其他对话记录只是参考资料，不构成新增授权。项目素材与权威工程共享，编辑前读取最新 revision，并重新 checkout 刷新当前对话的代码副本后再 commit；生成结果可供同项目复用，等待与自动接续归发起对话。最多返回最近 10 条记录，每条最多 2000 字。',{conversationId:{type:'string',required:true},limit:{type:'number'}},'conversation-history');
 tool('apply_project_changes','修改当前项目：type=text 改文本；position 调字幕 y；size 调字号；shot 调镜头 shotId（context 中的稳定 ID）、duration（0.1–180 秒）、assetFile（已上传素材文件名）、trimStart（视频取段秒数）、sourceAudio（原声）、fit（cover/contain）；music 用已有音频 assetFile 和 gain（0–1）设置配乐。clearAsset=true 清除镜头自选素材或配乐。必须使用最新 revision。',{
  revision:{type:'string',required:true},type:{type:'string',required:true},id:{type:'string'},text:{type:'string'},y:{type:'number'},size:{type:'number'},shotId:{type:'string'},duration:{type:'number'},assetFile:{type:'string'},trimStart:{type:'number'},sourceAudio:{type:'boolean'},fit:{type:'string'},gain:{type:'number'},clearAsset:{type:'boolean'},visible:{type:'boolean'}},'change');
 tool('edit_timeline','新增、复制、拆分、删除或移动镜头。action=add（afterShotId 可省略表示末尾，可选 assetFile/duration/caption）；duplicate/delete 使用 shotId；split 使用 shotId 和 splitAt（相对该镜头起点的秒数，不是整条片时间）；move 使用 shotId 和 index（从 0 起的目标位置）。不会删除素材文件。返回更新后的 shots；新增 ID 必须从结果读取。支持同一轮多动作时用 apply_video_edits 的 type=timeline；reorder 的 shotIds 必须包含全部镜头。',{revision:{type:'string',required:true},action:{type:'string',required:true},shotId:{type:'string'},afterShotId:{type:'string'},assetFile:{type:'string'},duration:{type:'number'},caption:{type:'string'},splitAt:{type:'number'},index:{type:'number'}},'timeline');
 tool('apply_video_edits','原子提交一组剪辑动作，只产生一条撤销记录。changes 是 JSON 数组，type=shot 支持换素材、trimStart、duration、sourceAudio；type=overlays,visible=false 隐藏全部叠加文字（不删除文案）；type=headings,visible=false 仅隐藏品牌与主标题，保留字幕；type=text 修改文案；type=music 修改配乐；type=timeline 支持 add/duplicate/split/delete/move/reorder 编排。不传的字段保持不变。',{revision:{type:'string',required:true},changes:{type:'string',required:true}},'batch');
 tool('generate_video','已有参考改编方案应使用 generate_reference_video，返回片段带 sceneId，与原生工程共享素材。其他情况下调用默认视频服务（get_project_context.videoConfiguration）；provider 可显式指定 runninghub/minimax/seedance。RunningHub 使用 Minimax H3 RH Enhanced（480p/768p/1080p，默认768p），原生有声；支持自动上传本地商品图、首尾帧、最多9张图/3段视频/3段音频参考。audioMode=native 原生声音，reference_only 参考音色，lock_source 锁定已有驱动音轨，remix_source 改编驱动音轨；后两者必须传 drivingAudioFile。MiniMax H3 使用768P/2K；H3 Max 使用480P/768P且最短5秒，Max 是极速版不是更高画质。H3 原生有声，audio 控制回填时是否保留；首帧模式按图片画幅，多模态参考可指定比例。不自动切到更贵服务。按用户要求的镜头与修订需要生成，按所选服务用量计费；剪辑已有视频不要调用。operationId 是本轮稳定唯一的镜头操作名，重试必须复用。返回异步任务，后台完成后自动回填目标镜头并保留生成原声；不要轮询等待或假称已完成。autoApply=false 仅加入素材。回填镜头才需要当前 revision；独立生成可省略。duration 为4–15秒，3秒镜头应生成4秒后剪取。只有 Seedance 的1080p需要 quality=premium；imageFile 只用已有图片。references 可选 JSON 数组，每项 {file,role}，role 可为 first_frame/last_frame/reference_image/reference_audio/reference_video；首尾帧与全模态参考不能混用。RunningHub 与 MiniMax 可直接用当前项目本地参考视频；Seedance 使用已有产物或用户提供 HTTPS url；音频使用已有 2–15 秒 WAV/MP3。所有工程均可省略 shotId 且 autoApply=false，生成独立素材；原生工程必须 autoApply=false。name 为场景名；quality=premium 使用 Seedance 2.0 正式版，支持1080p；未指定保留用户模型。ratio 必须跟随成片画幅，不要擅自改成adaptive。结果入库后编辑工程引用。',{operationId:{type:'string',required:true},revision:{type:'string'},shotId:{type:'string'},prompt:{type:'string',required:true},duration:{type:'number',required:true},provider:{type:'string',enum:['runninghub','minimax','seedance']},resolution:{type:'string',enum:['480p','720p','768p','1080p','480P','768P','2K']},audio:{type:'boolean'},audioMode:{type:'string',enum:['native','reference_only','lock_source','remix_source']},drivingAudioFile:{type:'string'},imageFile:{type:'string'},imageMode:{type:'string',enum:['first_frame','reference_image']},autoApply:{type:'boolean'},ratio:{type:'string',enum:['9:16','16:9','1:1','4:3','3:4','21:9','adaptive']},references:{type:'string'},name:{type:'string'},quality:{type:'string',enum:['configured','premium']}},'generate');
 tool('get_video_generations','读取本项目所有手动或对话生成任务、生成提示词、视频素材文件、状态和自动回填结果。只查询、不重新提交。',{},'generation-status');
 tool('apply_generated_video','把已完成的生成任务回填指定镜头；使用完整片段并保留原声。手动和对话生成的任务均可用；之后可继续剪辑。',{revision:{type:'string',required:true},jobId:{type:'string',required:true},shotId:{type:'string'}},'apply-generation');
 tool('analyze_reference','用已配置的创意模型分析参考原片的带时间戳真实抽样帧与本地语音转录，生成有原片依据的新商品改编方案。异步返回；不根据文件名或提示词猜测。抽样不能保证逐帧覆盖，语音转录不等于听过配音或音乐；结果会明确证据和未核实项。用户要分析或复刻时使用。brief 包含新商品真实事实、希望保留和替换的内容；可附商品图。operationId 本轮重试保持一致。最多180秒参考。不要重复提交或轮询。',{operationId:{type:'string',required:true},assetFile:{type:'string',required:true},brief:{type:'string',required:true},targetDuration:{type:'number'},ratio:{type:'string',enum:['16:9','9:16','4:3','3:4','1:1','21:9']},preserve:{type:'string',enum:['structure','style','shots']},imageFile:{type:'string'}},'reference-analyze');
 tool('get_reference_plans','读取参考分析进度、语义拆解、源时间点、新商品方案和每段生成结果。ready 才可称分析完成。',{},'reference-status');
 tool('recover_reference_plan','参考理解服务失败或中断后，将实际抽帧查看得到的分析接回同一参考工作台和 productionPlan。先读 get_reference_plans 的 version，stage_asset 原片、抽帧并真正 read_image 后再用；不能仅凭提示词补写观察。plan 是完整 JSON，格式与 edit_reference_plan 相同；evidence 是 JSON {frames:[{at:原片秒数,observation:实际画面}],audio:{reviewed:是否实际检查音轨,notes:检查依据或未检查原因}}，每个源时间段至少有一个实际查看时间点。不确定运镜、听不清台词必须说明。只接续 failed/interrupted 的改编分析，不生成视频、不修改既有时间线；随后按用户要求 apply_reference_plan 并继续制作。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},plan:{type:'string',required:true},evidence:{type:'string',required:true}},'reference-recover');
 tool('edit_reference_plan','修改已分析的复刻方案。plan 是完整 JSON 对象，保持源时间证据，scenes 保留原始 id；包含 role/observation/preserve/prompt/voiceover/caption/duration/sourceStart/sourceEnd；先读 get_reference_plans 的 version。每段为0.5–15秒剪辑时长；生成服务自动补足最短时长，编排时按方案剪取。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},plan:{type:'string',required:true},ratio:{type:'string',enum:['16:9','9:16','4:3','3:4','1:1','21:9']}},'reference-edit');
 tool('apply_reference_plan','采用参考改编方案作为项目共享 productionPlan，保留每段稳定 sceneId、目标画幅和时间；空白及原生工程不创建占位镜头、不覆写时间线。仅用户确认或要求直接制作后调用；生成、配音、剪辑、导出仍由你在同一任务完成。兼容旧商品模板的镜头回填。',{referenceId:{type:'string',required:true},version:{type:'number',required:true},revision:{type:'string',required:true}},'reference-apply');
 tool('generate_reference_video','用户明确要求生成复刻成片时，按已采用方案批量调用默认视频服务；可用 provider=runninghub 与 resolution=768p/1080p 指定 H3 RH Enhanced，或 MiniMax H3 2K，或 quality=premium 与1080p 使用Seedance正式版。按已确认方案逐镜生成（最多30段），按用量计费。镜头自己的 imageFile/references/useSourceVideo 在 edit_reference_plan 保存；RunningHub 与 MiniMax 的结构/运镜参考会携带对应的真实原片片段，商品身份以绑定图片为准。indices 可选 JSON 数字数组（从0起），省略为全部；已提交或已完成的片段不重复收费，retry=true 重试明确失败项；仅在用户明确要求重生成指定 indices 时，也允许重做已成功段，不会默认重做整片。原生/空白工程返回同一素材库的视频，每项 jobs 包含 sceneId/index，继续用这些素材编排原生工程；不要求旧 shotId。旧商品模板仍自动回填。视频只请求环境音，独立配音与整片连续配乐另行制作。调用后 await_tasks，恢复时读取方案和生成结果完成剪辑、字幕与导出，不把素材完成当作成片。',{referenceId:{type:'string',required:true},revision:{type:'string',required:true},indices:{type:'string'},retry:{type:'boolean'},provider:{type:'string',enum:['runninghub','minimax','seedance']},resolution:{type:'string',enum:['480p','720p','768p','1080p','480P','768P','2K']},quality:{type:'string',enum:['configured','premium']}},'reference-generate');
 tool('undo_project_change','撤销最近一次修改。',{revision:{type:'string',required:true}},'undo');
 tool('apply_text_edits','一次修改多个文本。edits 是 JSON 数组字符串，每项包含 id 和 text；只允许 context 中列出的对象。成功后自动完成 Hypit 编译校验。',{revision:{type:'string',required:true},edits:{type:'string',required:true}},'batch-text');
 tool('set_chat_timing','调整 hypit-chat 动画总时长和所有气泡的出现时间。arrivals 为秒数 JSON 数组字符串，顺序对应 context.shots；时间必须递增且小于总时长。',{revision:{type:'string',required:true},duration:{type:'number',required:true},arrivals:{type:'string',required:true}},'chat-timing');
 tool('validate_video','通过 Hypit 编译当前视频，返回真实校验结果。',{},'validate');
 tool('export_video','用户要求导出或制作成片时，启动 Hypit 本地渲染。返回任务 ID，之后使用 get_export_status 查询；仅 done 才能说导出完成。summary 填本版简短中文修改说明，例如字幕清晰度调整。',{revision:{type:'string',required:true},summary:{type:'string'}},'export');
 tool('stage_export','将已完成的本项目成片复制到代码工作区 input/，返回确切本地路径供 ffprobe/抽帧/音轨检查。不要猜 exports 或 native-builds 路径。不会生成、重新导出或增加素材。',{jobId:{type:'string',required:true}},'stage-export');
 tool('get_export_status','查询此项目的导出状态和下载链接。',{jobId:{type:'string',required:true}},'export-status');
 ctx.on('agent/assistant-stream',({agent,frame})=>{const scope=conversationBySession.get(agent.session.id);if(scope)send({type:'stream',...scope,frame});});
 ctx.on('session/event',(session,event)=>{const scope=conversationBySession.get(session.id);if(scope)send({type:'event',...scope,event});});
 ctx.on('agent/status',({agent,status})=>{const scope=conversationBySession.get(agent.session.id);if(scope)send({type:'status',...scope,status});});
 const receive=async m=>{try{
  if(m.type==='ensure-home'){send({type:'home-session',requestId:m.requestId,sessionId:await ensureHome()});return;}
  if(m.type==='tool-result'){const r=requests.get(m.id);if(r){clearTimeout(r.timeout);requests.delete(m.id);m.error?r.reject(Error(m.error)):r.resolve(m.value);}return;}
  const scope=scopeOf(m),key=scopeKey(scope);
  if(m.type==='cancel'){cancelWaits(scope);handles.get(key)?.agent.cancel({kind:'user'});return;}
  if(m.type==='inspect-native'){const h=await ensure({...m,requestId:undefined});const compact=ctx.agentPresets.serviceFor(h.agent,'compaction');const pruner=ctx.agentPresets.serviceFor(h.agent,'toolResultPruner');const pruned=m.compact?pruner.pruneSession(h.agent.session):undefined;const result=m.compact?await compact.compactNow(h.agent,new AbortController().signal):undefined;send({type:'native-inspection',requestId:m.requestId,...scope,result:{compaction:Boolean(compact),toolResultPruner:Boolean(pruner),cwd:h.agent.session.header.cwd,compacted:Boolean(result),pruned}});return;}
  if(m.type==='ensure'){const h=await ensure(m);if(m.waiting){const owner=m.waiting.ownerSessionId&&m.waiting.ownerSessionId!==h.agent.session.id?ctx.agents.get(m.waiting.ownerSessionId):h.agent;if(!owner||scopeKey(toolScope(owner.session)||{})!==key)throw Error('等待任务所属的原生会话不可用');startWait(owner,scope,m.waiting.id,m.waiting.instruction);}return;}
  if(m.type==='tasks-settled'){const wait=waitKey(scope,m.waitId),item=waitJobs.get(wait);if(item){waitJobs.delete(wait);item.settle({status:'completed',result:JSON.stringify(m.result)});await new Promise(resolve=>setImmediate(resolve));const session=ctx.agents.get(item.owner)?.session||ctx.sessions?.get(item.owner);if(session)await ctx.sessions.flush(session);send({type:'wait-delivered',...scope,waitId:m.waitId,ownerSessionId:item.owner});}return;}
  if(m.type==='prompt'){
    const h=await ensure(m);
    if(h.agent.status==='running')throw Error('上一轮还在执行');
    let selection=selections.get(key);if(!selection){selection={current:undefined,assembled:undefined};installModelSelection(h.agent.ctx,selection);selections.set(key,selection);}
    selection.current={provider:'frame-deepseek',model:process.env.DEEPSEEK_MODEL||'deepseek-flash',reasoningEffort:'max'};
    counts.set(h.agent.session.id,0);
    h.agent.followup(createUserMessage({content:[{type:'text',text:m.prompt}],source:{kind:'user'}}));send({type:'accepted',requestId:m.requestId,...scope});
  }
 }catch(e){send({type:'error',projectId:m.projectId,conversationId:m.conversationId||m.projectId,requestId:m.requestId,error:e.message});}};
 process.on('message',receive);ctx.on('dispose',()=>{process.off('message',receive);for(const r of requests.values()){clearTimeout(r.timeout);r.reject(Error('Agent 已停止'));}});
 send({type:'ready',tools:registered,...(native?{authURL:ctx.connection.authenticatedUrl('http://127.0.0.1:'+process.env.FRAME_DSH_PORT+'/')}:{})});
}
