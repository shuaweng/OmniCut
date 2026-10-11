window.__ModuleLoader__.load({id:'frame-dsh-ui',factory:require=>{
 const React=require('react'),h=React.createElement;
 function installDesignSystem(ctx){
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/design-system.css';document.head.append(sheet);
  const style=document.createElement('style');style.textContent=`
   html[data-frame-embedded] body{
    --dsw-font-family:var(--oc-font-family);--dsh-content-font-size:var(--oc-font-md);
    --dsw-alias-background-primary:var(--oc-bg-page);--dsw-alias-background-secondary:var(--oc-bg-panel);--dsw-alias-background-tertiary:var(--oc-bg-elevated);
    --dsw-alias-label-primary:var(--oc-text-primary);--dsw-alias-label-primary-bluish:var(--oc-text-primary);--dsw-alias-label-primary-dimmed:var(--oc-text-primary);
    --dsw-alias-label-secondary:var(--oc-text-secondary);--dsw-alias-label-tertiary:var(--oc-text-muted);--dsw-alias-label-caption:var(--oc-text-muted);--dsw-alias-label-deep-diving:var(--oc-text-muted);--dsw-alias-label-deep-diving-shimmer:var(--oc-text-secondary);
    --dsw-alias-border-l1:var(--oc-border);--dsw-alias-border-l2:var(--oc-border);--dsw-alias-border-l3:var(--oc-border);--dsw-alias-border-l4:var(--oc-border);
    --dsw-alias-state-business-primary:var(--oc-text-primary);--dsw-alias-button-info-fill:var(--oc-text-primary);--dsw-alias-button-info-hover:var(--oc-text-secondary);--dsw-alias-link:var(--oc-text-primary);
    --dsw-specific-input-major:var(--oc-bg-elevated);--dsw-specific-bubble:var(--oc-bg-panel);--dsw-specific-selector:var(--oc-border);--dsw-specific-menu:var(--oc-bg-elevated);
    --dsw-menu-surface-fill:var(--oc-bg-elevated);--dsw-alias-menu-group-header-fill:var(--oc-bg-elevated);--dsw-alias-interactive-bg-hover-solid:var(--oc-bg-elevated);--dsw-alias-markdown-code-block:var(--oc-bg-panel);--dsw-alias-markdown-inline-code:var(--oc-bg-elevated);
    --dsw-radius-sm:var(--oc-radius-control);--dsw-radius-md:var(--oc-radius-card);--dsw-radius-panel:var(--oc-radius-card);--dsw-radius-lg:var(--oc-radius-modal);
    font-family:var(--oc-font-family);font-weight:var(--oc-weight-regular);color:var(--oc-text-primary);background:var(--oc-bg-page);
   }
   html[data-frame-embedded] :is(button,input,select,textarea){font-family:var(--oc-font-family);font-weight:var(--oc-weight-regular)}
   html[data-frame-embedded] :is(strong,b,h2,h3){font-weight:var(--oc-weight-strong)}
   html[data-frame-embedded] [data-composer-card]{background:var(--oc-bg-elevated);border-radius:var(--oc-radius-card);box-shadow:inset 0 0 0 1px var(--oc-border);transition:box-shadow .15s}
   html[data-frame-embedded] [data-composer-card]:focus-within{box-shadow:inset 0 0 0 1px var(--oc-text-muted)}
   html[data-frame-embedded] [data-composer-card] :is([contenteditable],[contenteditable]:focus,[contenteditable] p){outline:none!important;box-shadow:none!important;border:0!important;caret-color:var(--oc-text-primary)}
   html[data-frame-embedded] [data-composer-card] [class*="_modes"]{display:none}
   html[data-frame-embedded] [data-composer-card] button[class*="_primary"]{background:var(--oc-text-primary);color:var(--oc-bg-page);border-radius:var(--oc-radius-control);opacity:1}
   html[data-frame-embedded] [data-composer-card] button[class*="_primary"]:disabled{background:var(--oc-border);color:var(--oc-text-muted);opacity:1}
   html[data-frame-home] [data-composer-card] button[class*="_primary"]:not(:disabled){background:var(--oc-accent);color:var(--oc-bg-page)}
   html[data-frame-home] [data-composer-card]:focus-within{box-shadow:inset 0 0 0 1px var(--oc-accent)!important}
   /* Keep the actual native action seats: the descendant catalog belongs to
      titleCluster/headerActions, and the sidebar control to the corner/utility
      seat. Flatten wrappers, never hide these controls with their title row. */
   html[data-frame-main-session="true"] header[data-window-drag]{grid-template-columns:minmax(0,1fr) auto auto;grid-template-rows:38px;min-height:38px!important;height:38px;padding:0 14px!important;border-bottom:1px solid var(--oc-border);column-gap:8px}
   html[data-frame-main-session="true"] header[data-window-drag] :is([class*="_titleRow"],[class*="_titleCluster"]){display:contents}
   html[data-frame-main-session="true"] nav[aria-label="会话层级"],html[data-frame-main-session="true"] [data-conversation-header-leading]{display:none}
   html[data-frame-main-session="true"] header[data-window-drag] [class*="_headerActions"]{display:flex;grid-column:2;grid-row:1;height:38px;align-items:center}
   html[data-frame-main-session="true"] header[data-window-drag] [class*="_headerActions"] :is(span[title],.frame-status-badge){display:none}
   html[data-frame-main-session="true"] header[data-window-drag] :is([class*="_headerUtilities"],[data-conversation-header-corner]){display:flex;grid-column:3;grid-row:1;height:38px;margin:0;align-items:center;justify-content:flex-end}
   html[data-frame-main-session="true"] header[data-window-drag] [class*="_headerUtilities"]:not(:has([data-sidebar-right-expand])){display:none}
   html[data-frame-main-session="true"] header[data-window-drag] [class*="_headerUtilities"]>:not([data-sidebar-right-expand]):not(:has([data-sidebar-right-expand])){display:none}
   html[data-frame-main-session="true"] [data-conversation-tabs]{grid-column:1;grid-row:1;margin:0;padding:0;gap:24px;height:38px;align-items:center}
   html[data-frame-main-session="true"] [data-conversation-tabs]>button{height:38px;padding:0;font-size:var(--oc-font-sm);font-weight:var(--oc-weight-regular);line-height:38px}
   /* Creators see the header row only for the subagent catalog, placed first. */
   html[data-frame-main-session="true"]:not([data-frame-developer="true"]) header[data-window-drag]:not(:has([class*="_headerActions"] button:not(.frame-status-badge))){display:none!important}
   html[data-frame-main-session="true"]:not([data-frame-developer="true"]) header[data-window-drag] [class*="_headerActions"]{grid-column:1;justify-self:start}
  `;document.head.append(style);ctx.effect(()=>()=>{sheet.remove();style.remove();});
 }
 // Pinned adapter for DSH 0.2.0-rc.2: the native slot owns the Lexical editor,
 // keyboard and attachment presentation; Frame owns only local files and submit.
 function installHomeComposer(ctx){
  const post=data=>parent.postMessage(data,location.origin),language='zh-Hans-x-frame';
  const removeLanguage=ctx.locale.addLanguage({id:language,label:'简体中文',fallback:'zh'});
  const removeWords=ctx.locale.register('conversation',language,{'placeholder.hero':'描述你想做的视频…','placeholder.default':'描述你想做的视频…','input.commands':'添加素材','input.send':'开始创作','hero.headline':'','hero.preview':''});
  if(ctx.locale.getLocale().active!==language)ctx.locale.setLocale(language);ctx.effect(()=>()=>{removeWords();removeLanguage();});
  document.documentElement.dataset.frameHome='';
  document.title='OmniCut';
  const titleObserver=new MutationObserver(()=>{if(document.title!=='OmniCut')document.title='OmniCut';});
  titleObserver.observe(document.querySelector('title'),{childList:true,subtree:true,characterData:true});ctx.effect(()=>()=>titleObserver.disconnect());
  const style=document.createElement('style');style.textContent=`
   html[data-frame-home],html[data-frame-home] body{background:transparent!important;overflow:hidden!important}
   html[data-frame-home] body{--dsh-content-font-size:var(--oc-font-md);--dsh-composer-side-clearance:8px;--dsh-composer-card-max-width:100%;--dsh-composer-text-max-height:220px;--dsw-alias-button-info-fill:var(--oc-text-muted);--dsw-alias-button-info-hover:var(--oc-text-muted);--dsw-alias-state-business-primary:var(--oc-text-muted);--dsw-specific-input-major:var(--oc-bg-panel)}
   [class*="frame"][data-sidebar-collapsed],[class*="frame"][data-rightbar-collapsed]{grid-template-columns:0 minmax(0,1fr) 0!important;background:transparent!important}
   [class*="centerCol"]{grid-column:2!important;background:transparent!important}
   [class*="sidebarCol"],[class*="DragHandle"],[data-rightbar-col],[data-shell-leading],header[data-window-drag],[class*="_heroWorkspaceRow"],[class*="_stack"]:has([data-slot="conversation.hero.brand.mark"]){display:none!important}
   [data-conversation-content],[data-conversation-scroll],[data-composer-seat],[class*="_composerStack"],[class*="_composerHero"]{background:transparent!important;min-height:0!important;padding:0!important;justify-content:flex-start!important;gap:0!important}
   /* DSH defines these variables on the content body, overriding body-level
      values. Keep its native width calculation, scoped to this home surface. */
   html[data-frame-home] [data-conversation-content]{--dsh-chat-content-width:100%;--dsh-composer-card-max-width:100%;--dsh-composer-side-clearance:2px}
   html[data-frame-home] [data-conversation-scroll]{margin-right:0;scrollbar-gutter:auto;overflow:hidden}
   html[data-frame-home] [data-composer-seat]{--dsh-composer-text-max-height:220px;width:100%}
   .frame-home-native-composer{width:100%;min-width:0}
   .frame-home-native-composer>[class*="_root"]{box-sizing:border-box;width:100%}
   [data-conversation-scroll]>:not([data-composer-seat]){display:none!important}
   [data-composer-card]{border-radius:var(--oc-radius-card)!important;padding-top:18px!important;gap:14px!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--oc-text-primary) 8%,transparent)!important}
   [data-composer-card]:focus-within{box-shadow:inset 0 0 0 1px var(--oc-accent)!important}
   html[data-frame-home] [data-composer-card] [contenteditable]{min-height:82px!important;padding:0 22px!important;outline:none!important;box-shadow:none!important;font-size:var(--oc-font-md)!important;line-height:26px!important}
   html[data-frame-home] [data-composer-card] [class*="_placeholder"]{inset:0 22px auto!important;font-size:var(--oc-font-md)!important;line-height:26px!important}
   [data-composer-card] [class*="_row"]{padding:0 14px 13px!important}
   [data-composer-card] button[class*="_add"]{width:34px;height:34px}
   [data-composer-card] button[class*="_primary"]{width:auto!important;height:38px!important;min-width:100px;padding:0 20px!important;border-radius:var(--oc-radius-control)!important;font:inherit!important;font-size:var(--oc-font-sm)!important;font-weight:var(--oc-weight-regular)!important;transform:none!important}
   [data-composer-card] button[class*="_primary"]>svg{display:none!important}
   [data-composer-card] button[class*="_primary"]:after{content:attr(aria-label)}
   [data-composer-card] [class*="_modes"],[data-composer-card] [class*="_standardControls"],[class*="uV2eYG_dock"]{display:none!important}
   .frame-home-error{margin:8px 18px 0;color:var(--oc-text-secondary);font-size:var(--oc-font-xs);line-height:1.5}
  `;document.head.append(style);ctx.effect(()=>()=>{style.remove();delete document.documentElement.dataset.frameHome;});
  for(const name of ['conversation.hero.workspace','conversation.hero.agentPreset','conversation.hero.brand.mark'])ctx.slots.inject(name,()=>ctx.slots.register({name,priority:-30},()=>null));
  ctx.slots.inject('conversation.composer.bar',()=>{
   const original=ctx.slots.entries('conversation.composer.bar').find(entry=>(entry.options.priority||0)===0);
   if(!original)throw Error('原生输入组件尚未安装');
   // Child slots already belong to the original entry. Do not redeclare them:
   // the pinned adapter renders the shipped attachment component directly.
   return ctx.slots.register({name:'conversation.composer.bar',priority:-30,locale:original.locale,inject:original.inject},function HomeComposer(props){
    const input=props.useInput(value=>value),[,render]=React.useReducer(n=>n+1,0),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
    const files=React.useRef(new Map()),picker=React.useRef(null),live=React.useRef(props),locked=React.useRef(false),initialized=React.useRef(false),root=React.useRef(null);
    live.current=props;locked.current=busy;
    const adapters=React.useMemo(()=>{
     const release=id=>{const file=files.current.get(id);if(file?.previewUrl)URL.revokeObjectURL(file.previewUrl);files.current.delete(id);};
     const clear=()=>{for(const id of files.current.keys())release(id);live.current.inputActions?.pruneAttachments([]);};
     const addFiles=batch=>{
      if(locked.current)return '正在创建项目';
      if(batch.some(file=>!/^image\/|^video\/|^audio\//.test(file.type)))return '请添加图片、视频或音频';
      const ids=[];
      for(const file of batch){const id=crypto.randomUUID();files.current.set(id,file.type.startsWith('image/')?{id,kind:'image',file,previewUrl:URL.createObjectURL(file)}:{id,kind:'file',file});ids.push(id);}
      if(!live.current.inputActions?.addAttachments(ids)){for(const id of ids)release(id);return '输入框正在连接';}
      render();return null;
     };
     const current=()=>{const state=live.current.keyboard?.snapshot;return {text:state?.draft||'',files:(state?.attachmentIds||[]).map(id=>files.current.get(id)?.file).filter(Boolean)};};
     const submit=()=>{if(locked.current||!initialized.current)return;locked.current=true;setBusy(true);setError('');post({type:'frame:home-submit',...current()});};
     return {clear,addFiles,current,submit,remove:id=>{release(id);live.current.inputActions.removeAttachment(id);render();},resolve:ids=>ids.map(id=>files.current.get(id)).filter(Boolean)};
    },[]);
    const keyboard=React.useMemo(()=>props.keyboard?new Proxy(props.keyboard,{get(target,key){
     if(key==='submit')return adapters.submit;
     if(key==='arbitrate')return ()=>'pass';
     if(key==='space')return ()=>false;
     if(key==='bindFilePicker')return value=>{picker.current=value;return ()=>{if(picker.current===value)picker.current=null;};};
     const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }}):undefined,[props.keyboard,adapters]);
    React.useEffect(()=>{
     if(!props.keyboard)return;
     const receive=e=>{if(e.origin!==location.origin||e.source!==parent)return;const data=e.data||{};
      if(data.type==='frame:home-state'){
       // Restore local files before applying the host's submission lock.
       locked.current=false;
       if(typeof data.text==='string'&&live.current.keyboard.snapshot.draft!==data.text)live.current.inputActions.setDraft(data.text);
       if(Array.isArray(data.files)){adapters.clear();const message=adapters.addFiles(data.files);if(message)setError(message);}
       initialized.current=true;locked.current=!!data.busy;setBusy(!!data.busy);setError(data.error||'');render();
      }
      if(data.type==='frame:home-files'){const message=adapters.addFiles(Array.isArray(data.files)?data.files:[]);if(message)setError(message);}
      if(data.type==='frame:home-reset'){adapters.clear();live.current.inputActions.setDraft('');locked.current=false;setBusy(false);setError('');}
     };
     window.addEventListener('message',receive);post({type:'frame:home-ready'});
     return()=>{window.removeEventListener('message',receive);adapters.clear();};
    },[props.keyboard,adapters]);
    React.useEffect(()=>{if(initialized.current)post({type:'frame:home-change',...adapters.current()});},[input?.draft,input?.attachmentIds,adapters]);
    React.useEffect(()=>{const element=root.current;if(!element)return;const publish=()=>post({type:'frame:home-height',height:Math.ceil(element.getBoundingClientRect().height+16)});const observer=new ResizeObserver(publish);observer.observe(element);publish();return()=>observer.disconnect();},[]);
    const uploads=Object.fromEntries((input?.attachmentIds||[]).map(id=>[id,{status:'ready'}]));
    const attachment=ctx.slots.entries('conversation.input.attachments').find(entry=>(entry.options.priority||0)===0);
    const renderSlot=(name,owner)=>name==='conversation.input.attachments'&&attachment?h(attachment.component,{...owner,t:props.t}):null;
    const inputActions=React.useMemo(()=>props.inputActions?{...props.inputActions,submit:adapters.submit}:undefined,[props.inputActions,adapters]);
    return h('div',{ref:root,className:'frame-home-native-composer'},h(original.component,{...props,variant:'hero',disabled:busy,placeholder:'描述你想做的视频…',keyboard,inputActions,renderSlot,addFiles:adapters.addFiles,removeAttachment:adapters.remove,resolveDraftAttachments:adapters.resolve,retryFileUpload:()=>{},toggleCommandMenu:()=>picker.current?.open(),useFileUploads:select=>select(uploads),useMenuLauncher:select=>select(null),useLexicon:select=>select(new Map()),t:(key,...args)=>key==='input.send'?(busy?'创建中…':'开始创作'):props.t(key,...args)}),error?h('p',{className:'frame-home-error',role:'alert'},error):null);
   });
  });
 }
 const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 function deliveryInfo(job={}){
  const duration=positive(job.duration),width=positive(job.output?.width??job.width),height=positive(job.output?.height??job.height),bytes=positive(job.fileSize??job.fileSizeBytes??job.bytes);
  const divisor=width&&height&&Number.isInteger(width)&&Number.isInteger(height)?gcd(width,height):null;
  const ratio=divisor?width/divisor+':'+height/divisor:null;
  const size=bytes?(bytes>=1048576?(bytes/1048576).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB'):null;
  return {duration,width,height,bytes,ratio,size,summary:[duration?duration.toFixed(1)+' 秒':null,ratio,size].filter(Boolean).join(' · ')};
 }
 function versionLabel(job={},info=deliveryInfo(job)){
  const created=new Date(job.created||job.updated||NaN),when=Number.isNaN(+created)?null:created.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  return [when,info.duration?Math.round(info.duration)+' 秒':null].filter(Boolean).join(' · ')||'较早版本';
 }
 function deliveryNextSteps(job={}){
  if(job.status!=='done')return [];
  const info=deliveryInfo(job),steps=[];
  if(info.width&&info.height&&Math.abs(info.width/info.height-9/16)>.01)steps.push({id:'vertical',label:'做竖版',icon:'rectangle-vertical',text:'基于这条视频做一个 9:16 竖版，保留主要内容，调整构图、字幕和画面布局。'});
  if(info.duration>15.25)steps.push({id:'short',label:'剪 15 秒版',icon:'scissors',text:'把这条视频剪成 15 秒版，保留最有吸引力的开场、核心内容和结尾。'});
  steps.push({id:'hooks',label:'做开场版本',icon:'copy-plus',text:'以这条视频为基础，先给我 3 个不同的开场方向，选定后在同一项目里做成独立视频，复用后面的素材。'});
  return steps;
 }
 function failurePresentation(input={}){
  const failure=input.failure||{},raw=String(failure.message||input.error||input.message||''),category=failure.category,status=input.nativeStatus||input.status;
  const engineering=(message,detail)=>({message,label:'让助手修复',action:'draft',engineering:true,prompt:'修复当前视频工程：'+detail+'。保留已有素材和影片内容，修好后提交工程并检查实际画面，不要重新生成媒体。'});
  if(/trim (?:start|end).*outside|取段.*超出|取段.*边界/i.test(raw))return engineering('声音或视频的截取范围超出了素材时长。','按实际素材时长修正取段边界');
  if(/duplicate font face|字体.*重复/i.test(raw))return engineering('同一个字体被重复引用，暂时无法渲染。','合并重复的字体引用');
  if(/audio:.*wrong Type|音频.*类型.*不匹配/i.test(raw))return engineering('声音尚未正确接到影片中。','使用已准备的音频引用，修正声音轨接线');
  if(/Film requires exactly|UNKNOWN_SOURCE_EXPORT|unknown source export|ENOENT[^\n]*(?:\.svml|\.svrun|packages)|(?:SVML|工程).*(?:编译失败|求值失败)/i.test(raw))return engineering('影片工程的结构或渲染入口需要调整。','读取当前影片的渲染入口和具体编译诊断，补齐必要结构或修正引用');
  if(/请求体过大|request (?:body|entity).*too large|HTTP 413|\b413\b/i.test(raw))return {message:'本次预览图片过多，模型请求未能继续。',label:'继续当前项目',action:'draft',prompt:'继续当前项目，保留已有工程和素材。只检查1–2个必要时间点，不重新批量生成媒体；完成后导出。'};
  if(['unknown','paused'].includes(status))return {message:'任务结果还未确认，先核对已有任务。',label:'核对结果',action:'status'};
  if(category==='quota'||/AccountOverdue|quota|balance|insufficient.*credit|余额|欠费|额度/i.test(raw))return {message:'当前服务的余额或额度不足。',label:'模型设置',action:'settings'};
  if(category==='plan'||/paid plan|subscription|套餐不足/i.test(raw))return {message:'当前套餐尚未开通这项能力。',label:'模型设置',action:'settings'};
  if(['authentication','permission'].includes(category)||/401|403|invalid.*key|Unauthorized|密钥|权限/i.test(raw))return {message:'当前服务的密钥或权限需要检查。',label:'模型设置',action:'settings'};
  if(/审核|违规|policy|moderation|content.*reject/i.test(raw))return {message:'这次生成未通过审核，请调整描述。',label:'调整描述',action:'draft'};
  if(category==='reference_rejected')return {message:'这张参考图未被服务接受，请更换图片或调整描述。',label:'调整要求',action:'draft'};
  if(category==='quality')return {message:raw==='声音接近静音'?'生成的声音接近静音。':'这次素材效果未达到要求。',label:'调整要求',action:'draft'};
  if(category==='network'||/timeout|fetch failed|network|ECONN|连接|超时/i.test(raw))return {message:'服务连接暂时中断，已完成的素材会保留。',label:'查看处理方式',action:'status'};
  if(category==='unavailable')return {message:'当前服务暂时无法完成这项任务。',label:'换服务',action:'settings'};
  return {message:'这项任务未完成，已完成的素材会保留。',label:'查看处理方式',action:'status'};
 }
 const evidenceTools=new Set(['preview_frames','probe_export','analyze_beats']);
 const exportTools=new Set(['export_video','stage_export','get_export_status']);
 const labels={build_hypit_project:'工程产出',generate_audio:'生成声音',generate_image:'生成图片',generate_video:'生成镜头',generate_reference_video:'制作参考镜头',export_video:'导出成片',stage_export:'检查成片',get_export_status:'成片状态',publish_workspace_asset:'素材'};
 const toolResult=block=>{try{return JSON.parse(block?.content?.filter(part=>part.type==='text').map(part=>part.text).join('')||'null');}catch{return null;}};
 async function apply(ctx){let disposedExtension=false;ctx.effect(()=>()=>{disposedExtension=true;});try{
  const params=new URLSearchParams(location.search),session=params.get('session'),project=params.get('project'),conversation=params.get('conversation')||project;
  const framed=params.get('frame')==='1',embedded=framed&&parent!==window;
  const videoId=params.get('videoId')||'v-default';
  const postFrame=data=>parent.postMessage({projectId:project,conversationId:conversation,videoId,...data},location.origin);
  function FrameIcon({name}){
   const key=name.split('-').map(part=>part[0].toUpperCase()+part.slice(1)).join(''),definition=(window.lucide||parent.lucide)?.icons?.[key];
   if(!definition)return null;
   const attributes={};for(const [name,value]of Object.entries(definition[1]))attributes[name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=value;
   return h('svg',{...attributes,width:15,height:15,'aria-hidden':true},definition[2].map(([tag,props],index)=>h(tag,{...props,key:index})));
  }
  function openFailure(presentation,job={}){
   if(presentation.action==='settings')postFrame({type:'frame:settings'});
   else if(presentation.action==='draft')postFrame({type:'frame:failure-draft',taskId:job.id,text:presentation.prompt||'调整任务「'+readableName(job.name,'当前素材')+'」的要求后继续：'});
   else postFrame({type:'frame:task-status',taskId:job.id});
  }
  if(embedded){document.documentElement.dataset.frameEmbedded='';installDesignSystem(ctx);ctx.effect(()=>()=>{delete document.documentElement.dataset.frameEmbedded;});}
  if(session){
   // The URL selects the initial conversation only. Cancel any pending startup
   // restoration, then let DSH own navigation to children and their ancestors.
   // A persistent list reconciler would immediately undo openSession(child).
   await ctx.sessions.refresh();if(disposedExtension)return;
   ctx.layout.beginNavigation();ctx.uiWorkspace.openSession(session);
  }
  if(params.get('home')==='1'&&embedded){installHomeComposer(ctx);return;}
  if(embedded){
   // Match the workbench's developer switch; keep native accounting intact.
   const updateDeveloperScope=()=>{
    let enabled=false;try{enabled=window.localStorage?.getItem('omnicut:developer')==='1';}catch{}
    document.documentElement.dataset.frameDeveloper=String(enabled);
   };
   const onDeveloperStorage=event=>{if(event.key==='omnicut:developer'||event.key===null)updateDeveloperScope();};
   updateDeveloperScope();window.addEventListener('storage',onDeveloperStorage);
   ctx.effect(()=>()=>{window.removeEventListener('storage',onDeveloperStorage);delete document.documentElement.dataset.frameDeveloper;});
  }
  if(framed){
   // Use the harness's locale and slot APIs, keeping its chat/composer intact.
   const language='zh-Hans-x-frame';
   const removeLanguage=ctx.locale.addLanguage({id:language,label:'简体中文',fallback:'zh'});
   const removeWords=ctx.locale.register('conversation',language,{
    'placeholder.hero':'描述你想做的视频或修改…',
    'placeholder.default':'描述你的想法，或 @ 引用素材…',
    'hero.headline':'', 'hero.preview':'', 'input.commands':'添加',
    // Work-step rows name the creative act; OmniCut's own tools carry their own rows.
    'tool.title.readImage':'看画面','tool.title.read':'查阅','tool.title.write':'编写','tool.title.edit':'修改','tool.title.bash':'处理','tool.title.pwsh':'处理','tool.title.code':'处理','tool.title.search':'查找','tool.title.grep':'查找','tool.title.glob':'查找','tool.title.generic':'制作步骤','tool.title.readJob':'查看处理结果','tool.title.listJobs':'查看后台处理','tool.title.killJob':'停止后台处理'
   });
   // Step groups are titled by what kind of work happened, never by tool family.
   const removeChatWords=ctx.locale.register('chat',language,{'chat.deepDiving':'思考中','chat.deepDivingFor':'思考中，用时 {duration} ···',
    'message.stepProcess.thinking':'正在构思','message.stepProcess.read':'正在查阅资料','message.stepProcess.readImage':'正在看画面','message.stepProcess.write':'正在编写工程','message.stepProcess.search':'正在查找资料','message.stepProcess.edit':'正在修改工程','message.stepProcess.commands':'正在处理','message.stepProcess.code':'正在处理','message.stepProcess.plan':'正在更新制作清单','message.stepProcess.tools':'正在制作',
    'message.stepProcess.prepare.read':'准备查阅资料','message.stepProcess.prepare.readImage':'准备看画面','message.stepProcess.prepare.write':'准备编写工程','message.stepProcess.prepare.search':'准备查找资料','message.stepProcess.prepare.edit':'准备修改工程','message.stepProcess.prepare.commands':'准备处理','message.stepProcess.prepare.code':'准备处理','message.stepProcess.prepare.plan':'准备更新制作清单','message.stepProcess.prepare.tools':'准备下一步',
    'message.stepProcess.done.thinking':'完成了构思','message.stepProcess.done.read':'查阅了资料','message.stepProcess.done.readImage':'看了画面','message.stepProcess.done.write':'编写了工程','message.stepProcess.done.search':'查找了资料','message.stepProcess.done.edit':'修改了工程','message.stepProcess.done.commands':'做了处理','message.stepProcess.done.code':'做了处理','message.stepProcess.done.webSearch':'搜索了网页','message.stepProcess.done.webFetch':'查看了网页','message.stepProcess.done.subagents':'协调了子智能体','message.stepProcess.done.plan':'更新了制作清单','message.stepProcess.done.questions':'向你确认了细节','message.stepProcess.done.tools':'推进了制作'});
   if(ctx.locale.getLocale().active!==language)ctx.locale.setLocale(language);ctx.effect(()=>()=>{removeChatWords();removeWords();removeLanguage();});
   // The embedded document follows Frame's identity even when its session title
   // changes. Limit observation to the title; never rewrite conversation text.
   const titleNode=document.querySelector('title');
   const updateTitle=()=>{const next=document.title.replace(/DeepSeek Harness/g,'OmniCut · 项目对话');if(next!==document.title)document.title=next;};
   if(titleNode){const observer=new MutationObserver(updateTitle);observer.observe(titleNode,{childList:true,subtree:true,characterData:true});ctx.effect(()=>()=>observer.disconnect());updateTitle();}
   ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark',priority:-20},()=>h('span',{'data-frame-brand':'',hidden:true})));
   for(const name of ['conversation.hero.workspace','conversation.hero.agentPreset'])ctx.slots.inject(name,()=>ctx.slots.register({name,priority:-20},()=>null));
   // The public dock is the native extension seat above the composer. Keep
   // Session rendering, child-slot authorization and draft restoration intact.
   ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'frame-welcome'},props=>
    h('section',{className:'frame-conversation-welcome','aria-label':'开始创作'},
     h('h2',null,'想从哪里开始？'),
     h('div',{className:'frame-welcome-actions'},
      h('button',{type:'button',onClick:()=>{props.inputActions.setDraft('帮我构思这条视频的创意和分镜：');document.querySelector('[contenteditable="true"]')?.focus();}},'构思脚本'),
      h('button',{type:'button',onClick:()=>postFrame({type:'frame:reference'})},'参考改编'),
      h('button',{type:'button',onClick:()=>postFrame({type:'frame:motion-library'})},'添加动效')))));
   const style=document.createElement('style');style.textContent=`
   [class*="_stack"]:has([data-frame-brand]){display:none!important}
   [class*="_heroWorkspaceRow"]{display:none!important}
   .frame-conversation-welcome{display:none}
   [data-conversation-content][data-content-phase="hero"]>[data-conversation-scroll]{justify-content:flex-start!important}
   [data-content-phase="hero"] .frame-conversation-welcome{display:flex;flex:1 0 180px;min-height:180px;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:28px 22px 54px;text-align:center}
   .frame-conversation-welcome h2{margin:0;color:var(--oc-text-primary);font-size:var(--oc-font-lg);line-height:1.4;font-weight:var(--oc-weight-strong);letter-spacing:-.5px}
   .frame-welcome-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:330px}
   .frame-welcome-actions button{border:1px solid var(--oc-border);background:var(--oc-bg-panel);color:var(--oc-text-secondary);border-radius:var(--oc-radius-control);font:inherit;font-size:var(--oc-font-xs);padding:9px 12px;cursor:pointer;transition:background .15s,color .15s}
   .frame-welcome-actions button:hover{background:var(--oc-bg-panel);color:var(--oc-text-secondary);border-color:var(--oc-border)}
   [data-content-phase="hero"] [data-composer-seat]{flex:1;min-height:0;padding-bottom:16px}
   [data-content-phase="hero"] [data-chain-overlay-fallback="conversation.composer"]>div{flex:1;min-height:0;padding-bottom:0}
   [data-content-phase="hero"] [data-chain-overlay-fallback="conversation.composer"]>div>div:has([data-slot="conversation.hero.brand.mark"]){display:none}
   /* Fill the hidden workspace sidebar's columns while leaving DSH's right
      track, resize handle, fullscreen panel and overlay stacking intact. */
   [class*="centerCol"]{grid-column:1 / 3!important}
   [class*="sidebarCol"],[data-side="sidebar"],[data-shell-leading],button[aria-label="在新对话中分支"]{display:none!important}
   body[data-ds-dark-theme]{--dsw-alias-button-info-fill:var(--oc-text-primary);--dsw-alias-button-info-hover:var(--oc-text-secondary);--dsw-alias-state-business-primary:var(--oc-text-primary);--dsw-alias-label-link:var(--oc-text-primary);--dsh-content-font-size:var(--oc-font-md)}
   .frame-skill{color:var(--oc-text-primary);background:transparent;border:0;white-space:nowrap;cursor:pointer;font:inherit;font-size:var(--oc-font-xs);padding:4px 6px}.frame-native-header{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;font-size:var(--oc-font-sm);font-weight:var(--oc-weight-strong);border-bottom:1px solid var(--oc-border)}
   .frame-native-header button,.frame-media-actions button{border:1px solid var(--oc-border);background:var(--oc-bg-panel);border-radius:var(--oc-radius-control);color:inherit;padding:6px 10px;font:inherit;cursor:pointer}
   .frame-media-result{margin:8px 0 14px;min-width:0}.frame-media-result strong{font-size:var(--oc-font-sm);font-weight:var(--oc-weight-regular)}.frame-media-result img,.frame-media-result video{display:block;max-width:100%;max-height:270px;border-radius:var(--oc-radius-control);margin-top:10px}.frame-media-result audio{display:block;width:100%;margin-top:12px;height:36px}.frame-media-actions{display:flex;gap:8px;margin-top:10px;font-size:var(--oc-font-xs)}.frame-media-open{position:relative;display:block;width:100%;min-height:86px;border:0;border-radius:var(--oc-radius-control);background:var(--oc-bg-panel);color:var(--oc-text-primary);padding:0;cursor:pointer;margin-top:8px;overflow:hidden}.frame-media-open img{margin:0;width:100%;object-fit:cover}.frame-media-play{position:absolute;inset:0;display:grid;place-items:center;text-shadow:0 1px 5px var(--oc-bg-page);font-size:var(--oc-font-lg)}.frame-media-open:has(img) .frame-media-play{background:color-mix(in srgb,var(--oc-bg-page) 70%,transparent)}.frame-receipt{font-size:var(--oc-font-xs);color:var(--oc-text-secondary);padding:4px 6px}.frame-media-result p{font-size:var(--oc-font-xs);color:var(--oc-text-secondary)}
   .frame-reference-chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px}.frame-reference-chips>span{display:flex;align-items:center;background:var(--oc-bg-panel);border:1px solid var(--oc-border);border-radius:var(--oc-radius-control);color:var(--oc-text-secondary)}.frame-reference-chips button{font:inherit;font-size:var(--oc-font-xs);color:inherit;border:0;background:transparent;padding:6px;cursor:pointer}.frame-status-badge{border-radius:var(--oc-radius-modal);background:var(--oc-bg-panel)!important;color:var(--oc-text-secondary)!important}.frame-change-card,.frame-review-card{margin:12px 0;padding:12px;border:1px solid var(--oc-border);border-radius:var(--oc-radius-card);font-size:var(--oc-font-xs)}.frame-change-card strong{font-weight:var(--oc-weight-regular);color:var(--oc-text-secondary)}.frame-change-card div>button,.frame-review-card button{display:block;text-align:left;border:0;background:transparent;color:var(--oc-text-primary);padding:7px 0;font:inherit;cursor:pointer}.frame-task-row{display:flex;flex-wrap:wrap;justify-content:space-between;padding:7px 0;gap:6px}.frame-task-row p{flex-basis:100%;margin:0;color:var(--oc-text-secondary)}.frame-image-open{display:block;border:0;background:transparent;padding:0;cursor:zoom-in;width:100%;text-align:left}.frame-image-open img{margin-top:8px}.frame-task-details{font-size:var(--oc-font-xs);color:var(--oc-text-muted);margin:8px 0}.frame-task-details summary{cursor:pointer;list-style:none;display:flex;gap:7px;align-items:center}.frame-task-details summary:before{content:'›';color:var(--oc-text-muted)}.frame-task-details[open] summary:before{transform:rotate(90deg)}.frame-task-details pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:var(--oc-font-xs);padding:10px;background:var(--oc-bg-page);border-radius:var(--oc-radius-control);color:var(--oc-text-secondary)}
   html[data-frame-embedded] [data-shell-overlay]{z-index:80;pointer-events:none}
   .frame-preview-return{display:none;position:absolute;right:12px;bottom:12px;pointer-events:auto;border:1px solid var(--oc-border);background:var(--oc-bg-panel);color:var(--oc-text-primary);border-radius:var(--oc-radius-card);padding:9px 13px;font:inherit;font-size:var(--oc-font-xs);cursor:pointer;box-shadow:0 4px 16px color-mix(in srgb,var(--oc-bg-page) 70%,transparent)}
   html[data-frame-embedded]:has([data-sidebar-right-open]) .frame-preview-return{display:block}
   .frame-preview-return:focus-visible{outline:2px solid var(--oc-text-secondary);outline-offset:3px}
   .frame-resource-preview{padding:22px;font-size:var(--oc-font-sm);line-height:1.6}.frame-resource-preview button{font:inherit;color:var(--oc-text-primary);background:var(--oc-bg-panel);border:1px solid var(--oc-border);border-radius:var(--oc-radius-control);padding:8px 12px;cursor:pointer}
   [data-turn-tail]:has([data-frame-turn-pending])>[data-clock="end"]{display:none!important}
   /* Composer statistics and the native Turn-usage pill are diagnostics.
      Keep reply feedback, timestamps and child-session navigation visible. */
   html[data-frame-embedded]:not([data-frame-home]):not([data-frame-developer="true"]) [data-composer-card]+[class*="_dock"],
   html[data-frame-embedded]:not([data-frame-home]):not([data-frame-developer="true"]) [data-turn-tail] [data-clock="end"] [class*="_endInfo"]>span:has(>button[aria-haspopup="dialog"]){display:none!important}
   /* Header utilities (open in Finder, session log, feedback) and the right
      sidebar toggle are developer tools; media previews still open that sidebar. */
   html[data-frame-embedded]:not([data-frame-home]):not([data-frame-developer="true"]) [data-slot="conversation.session.header.utilities"],
   html[data-frame-embedded]:not([data-frame-home]):not([data-frame-developer="true"]) [data-slot="conversation.session.header.corner"]{display:none!important}
   /* '/' rows already show a Chinese label; the command spelling stays a developer detail. */
   html[data-frame-embedded]:not([data-frame-developer="true"]) [id^="dsh-slash-option-command-"] [class*="_itemAlias"]{display:none}

   .frame-evidence-fact{margin:7px 0;color:var(--oc-text-secondary);font-size:var(--oc-font-xs)}.frame-evidence-fact button{border:0;background:transparent;color:var(--oc-text-secondary);cursor:pointer;font:inherit}.media-preview-dialog{box-sizing:border-box;width:min(94vw,850px);max-height:92vh;border:1px solid var(--oc-border);border-radius:var(--oc-radius-modal);background:var(--oc-bg-panel);color:var(--oc-text-primary);padding:16px}.media-preview-dialog::backdrop{background:color-mix(in srgb,var(--oc-bg-page) 70%,transparent)}.media-preview-dialog .dialog-heading{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.media-preview-dialog h2{font-size:var(--oc-font-sm);font-weight:var(--oc-weight-regular);margin:0}.media-preview-dialog header button{border:0;background:transparent;color:var(--oc-text-secondary);font-size:var(--oc-font-lg);cursor:pointer}.media-preview-stage{display:flex;justify-content:center;min-height:100px}.media-preview-stage img,.media-preview-stage video{max-width:100%;max-height:72vh;object-fit:contain}
   .frame-stopped-tasks{font-size:var(--oc-font-xs);color:var(--oc-text-secondary);line-height:1.6;margin:10px 0}.frame-failure-action{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:var(--oc-font-xs);border-radius:var(--oc-radius-control);padding:7px 10px;cursor:pointer;text-decoration:none}.frame-failure-action{color:var(--oc-text-secondary);background:var(--oc-bg-panel);border:1px solid var(--oc-border)}.frame-failure-action:hover{color:var(--oc-text-primary);border-color:var(--oc-border)}.frame-failure-action:focus-visible{outline:2px solid var(--oc-text-secondary);outline-offset:3px}.frame-failure-body{padding:10px 0 3px}.frame-failure-body p{margin:0 0 10px;line-height:1.6;color:var(--oc-text-secondary)}.frame-task-details summary svg{flex-shrink:0}
   .frame-operation{display:flex;align-items:center;gap:6px;font-size:var(--oc-font-xs);color:var(--oc-text-muted);margin:6px 0}.frame-operation svg{width:14px;height:14px;flex-shrink:0}.frame-media-open[data-delivery-cover]{aspect-ratio:16/9;min-height:0}.frame-media-open[data-delivery-cover] img{height:100%;max-height:240px;object-fit:contain;background:var(--oc-bg-page)}.frame-media-open[data-delivery-cover] .frame-media-play svg{width:30px;height:30px;filter:drop-shadow(0 1px 3px color-mix(in srgb,var(--oc-bg-page) 70%,transparent))}







   .frame-media-audio .frame-media-open{min-height:40px;height:40px;text-align:left}
   .frame-media-audio .frame-media-play{position:static;display:flex;padding:0 12px;font-size:var(--oc-font-xs);text-shadow:none}

   .frame-generation-state{display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px 14px;border:1px solid var(--oc-border);border-radius:var(--oc-radius-card);background:var(--oc-bg-panel);font-size:var(--oc-font-xs);color:var(--oc-text-secondary);width:fit-content}.frame-progress-orbit{width:14px;height:14px;border:2px solid var(--oc-border);border-top-color:var(--oc-text-secondary);border-radius:50%;animation:frame-spin 1s linear infinite}.frame-progress-dots{letter-spacing:3px;color:var(--oc-text-muted);animation:frame-pulse 1.5s ease-in-out infinite}@keyframes frame-spin{to{transform:rotate(360deg)}}@keyframes frame-pulse{50%{opacity:.25}}@media(prefers-reduced-motion:reduce){.frame-progress-orbit,.frame-progress-dots{animation:none}}


   [class*="_itemIcon"]:has(>.frame-mention-thumb){width:32px;height:18px}
   .frame-mention-thumb{display:grid;place-items:center;width:32px;height:18px;border-radius:3px;object-fit:cover;background:var(--oc-bg-elevated);color:var(--oc-text-muted)}
   .frame-mention-thumb svg{width:11px!important;height:11px!important}
   /* Section heads share one quiet line; disclosures use the task-details chevron. */
   .frame-section-heading,.frame-media-batch>summary{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:var(--oc-font-xs);color:var(--oc-text-muted)}
   .frame-section-heading button{border:0;background:transparent;color:var(--oc-text-secondary);font:inherit;padding:2px 0;cursor:pointer}
   .frame-section-heading span+button{margin-left:auto}.frame-section-heading button+button{margin-left:12px}
   .frame-section-heading button:hover,.frame-media-batch>summary:hover{color:var(--oc-text-primary)}
   .frame-media-batch{margin:14px 0}
   .frame-media-batch>summary{width:fit-content;margin:0;cursor:pointer;list-style:none}
   .frame-media-batch>summary::-webkit-details-marker{display:none}
   .frame-media-batch>summary:before{content:'›';display:inline-block;transition:transform .15s}
   .frame-media-batch[open]>summary{margin-bottom:10px}.frame-media-batch[open]>summary:before{transform:rotate(90deg)}
   /* Frames, materials and earlier versions share one tile: same size, picture first. */
   .frame-media-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:12px 8px}
   .frame-media-tiles>:not(.frame-media-tile,.frame-evidence-frame){grid-column:1 / -1}
   .frame-media-tile{display:flex;flex-direction:column;gap:6px;min-width:0;border:0;background:transparent;padding:0;color:var(--oc-text-secondary);font:inherit;font-size:var(--oc-font-xs);text-align:left;cursor:pointer}
   .frame-tile-picture{position:relative;display:grid;place-items:center;width:100%;aspect-ratio:16/9;border:0;padding:0;border-radius:8px;overflow:hidden;background:var(--oc-bg-elevated);color:var(--oc-text-muted);font:inherit;font-size:var(--oc-font-xs);cursor:zoom-in}
   .frame-tile-picture img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s}
   .frame-media-tile:hover img,.frame-evidence-frame:hover img{transform:scale(1.04)}
   .frame-tile-badge{position:absolute;left:6px;bottom:6px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--oc-bg-page) 60%,transparent);color:var(--oc-text-primary);backdrop-filter:blur(4px)}
   .frame-tile-badge svg{width:10px;height:10px;fill:currentColor}
   .frame-tile-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;line-height:1.45;overflow-wrap:anywhere}
   .frame-tile-picture>svg{width:20px;height:20px}
   .frame-preview-evidence .frame-media-tiles{grid-template-columns:repeat(auto-fit,minmax(76px,1fr))}
   .frame-media-tile:hover .frame-tile-name{color:var(--oc-text-primary)}
   .frame-preview-evidence{margin:14px 0}
   .frame-evidence-frame{position:relative;min-width:0}
   .frame-evidence-time,.frame-evidence-quote{position:absolute;border:0;background:color-mix(in srgb,var(--oc-bg-page) 65%,transparent);color:var(--oc-text-primary);font:inherit;cursor:pointer;backdrop-filter:blur(4px)}
   .frame-evidence-time{left:5px;bottom:5px;border-radius:4px;padding:1px 5px;font-size:11px;font-variant-numeric:tabular-nums}
   .frame-evidence-quote{right:5px;top:5px;display:grid;place-items:center;width:24px;height:24px;padding:0;border-radius:6px;opacity:0;transition:opacity .15s}
   .frame-evidence-frame:hover .frame-evidence-quote,.frame-evidence-quote:focus-visible{opacity:1}
   .frame-evidence-quote svg{width:13px;height:13px}
   /* The delivered film is the one card: its facts and save action ride a low
      scrim on the cover, then next steps. The scrim is not part of the play button. */
   .frame-delivery-cover{position:relative;aspect-ratio:16/9;max-height:360px;border-radius:var(--oc-radius-card);overflow:hidden;background:var(--oc-bg-elevated)}
   .frame-delivery-cover[data-orientation=portrait]{aspect-ratio:auto;height:360px}
   .frame-media-open[data-delivery-cover]{width:100%;height:100%;min-height:0;margin:0;border-radius:0;background:transparent}
   .frame-media-open[data-delivery-cover] img{display:block;width:100%;height:100%;max-height:none;margin:0;object-fit:contain}
   .frame-media-open[data-delivery-cover] .frame-media-play{background:transparent;transition:background .2s}
   .frame-media-open[data-delivery-cover]:hover .frame-media-play{background:color-mix(in srgb,var(--oc-bg-page) 20%,transparent)}
   .frame-media-open[data-delivery-cover] .frame-media-play svg{box-sizing:content-box;width:20px;height:20px;padding:14px;border-radius:50%;fill:currentColor;background:color-mix(in srgb,var(--oc-bg-page) 55%,transparent);backdrop-filter:blur(6px)}
   .frame-delivery-bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:10px;padding:22px 10px 8px 12px;background:linear-gradient(to top,color-mix(in srgb,var(--oc-bg-page) 82%,transparent),transparent);pointer-events:none}
   .frame-delivery-title{display:flex;align-items:baseline;gap:8px;flex:1;min-width:0;white-space:nowrap}
   .frame-delivery-title strong{flex:none;font-size:var(--oc-font-sm);font-weight:var(--oc-weight-strong);color:var(--oc-text-primary)}
   .frame-delivery-meta{overflow:hidden;text-overflow:ellipsis;font-size:var(--oc-font-xs);color:color-mix(in srgb,var(--oc-text-primary) 72%,transparent);font-variant-numeric:tabular-nums}
   .frame-delivery-save{flex:none;display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:999px;background:var(--oc-accent);color:var(--oc-bg-page);font-size:var(--oc-font-xs);font-weight:var(--oc-weight-strong);text-decoration:none;pointer-events:auto;transition:background .15s}
   .frame-delivery-save svg{width:13px;height:13px}
   .frame-delivery-save:hover{background:var(--oc-accent-hover)}
   .frame-delivery-next{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
   .frame-delivery-next button{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;background:var(--oc-bg-elevated);color:var(--oc-text-secondary);font:inherit;font-size:var(--oc-font-xs);padding:6px 12px;cursor:pointer;transition:background .15s,color .15s}
   .frame-delivery-next button:hover{color:var(--oc-text-primary);background:color-mix(in srgb,var(--oc-bg-elevated),var(--oc-text-primary) 8%)}
   .frame-delivery-next svg{width:13px;height:13px}
   :is(.frame-media-tile,.frame-tile-picture,.frame-evidence-time,.frame-evidence-quote,.frame-delivery-save,.frame-delivery-next button,.frame-section-heading button,.frame-media-batch>summary):focus-visible{outline:2px solid var(--oc-text-secondary);outline-offset:2px}
`;document.head.append(style);ctx.effect(()=>()=>style.remove());
   // Use the same selected-session ledger that native DSH uses for its window
   // title. A slot whose host is hidden must not own this presentation state.
   const headerScope=document.documentElement?.dataset;
   const updateHeaderScope=()=>{
    const active=Object.values(ctx.sessions.list?.getSnapshot?.()?.byId||{}).find(item=>(item.retainedBy?.mainView||0)>0);
    if(headerScope)headerScope.frameMainSession=String(!active||active.id===session);
   };
   updateHeaderScope();ctx.effect(()=>ctx.sessions.list?.subscribe?.(updateHeaderScope));
   ctx.effect(()=>()=>{if(headerScope)delete headerScope.frameMainSession;});
   // Keep the native lineage slot for child switching and ancestor navigation.
   ctx.slots.inject('conversation.session.header.actions',()=>ctx.slots.register({name:'conversation.session.header.actions',id:'frame-production-status',order:10},()=>h(ProductionStatus)));
   ctx.slots.inject('conversation.session.header.actions',()=>ctx.slots.register({name:'conversation.session.header.actions',id:'frame-settings'},()=>null));
  }
  // Preserve DSH's native bubble and actions; unwrap only legacy Frame envelopes.
  ctx.slots.inject('conversation.chat.node',()=>{
   const original=ctx.slots.entries('conversation.chat.node').find(e=>e.options.key==='user'&&(e.options.priority||0)===0);
   if(!original)return;
   return ctx.slots.register({name:'conversation.chat.node',key:'user',priority:-20,locale:original.locale},props=>{
    let node=props.node;
    if(node.data.content?.length===1&&node.data.content[0].type==='text')try{
     const envelope=JSON.parse(node.data.content[0].text);
     if(typeof envelope.userRequest==='string')node={...node,data:{...node.data,content:[{type:'text',text:envelope.taskContinuation?'继续完成：'+envelope.taskContinuation.instruction:envelope.userRequest}]}};
    }catch{}
    return h(original.component,{...props,node});
   });
  });
  if(embedded){
   ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'frame-chat-ready'},()=>h(ChatReady)));
   ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'frame-receipt'},()=>h(SubmissionReceipt)));
   ctx.slots.inject('conversation.input.dock',()=>ctx.slots.register({name:'conversation.input.dock',id:'frame-references'},ReferenceDock));
   ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'frame-production-options'},()=>h('button',{className:'frame-skill',onClick:()=>postFrame({type:'frame:preferences'})},'本次制作')));
   ctx.inject?.(['commandUi'],scope=>{
    const command=scope.get('commandUi');
    if(!command)return;
    const creatorCommands=[{name:'omnicut-assets',label:'素材库',icon:'folder-open',type:'frame:library'},{name:'omnicut-reference',label:'参考视频',icon:'film',type:'frame:reference'},{name:'omnicut-motion',label:'动效库',icon:'layers',type:'frame:motion-library'}];
    for(const item of creatorCommands){
     scope.effect(()=>command.register({name:item.name,label:()=>item.label,icon:()=>h(FrameIcon,{name:item.icon}),available:context=>context.sessionId===session,ui:{kind:'action',run:()=>postFrame({type:item.type})}}));
    }
    // Creators see the libraries and conversation compaction. Files, model,
    // permission, feedback and log export stay behind the developer switch;
    // typing one of those commands still runs it.
    const shown=[...creatorCommands.map(item=>item.name),'compact'],section=ctx.locale.bind?.('command')('section.add')||'添加',candidates=command.candidates;
    command.candidates=async function(session,request){
     const rows=await candidates.call(this,session,request);
     if(document.documentElement.dataset.frameDeveloper==='true')return rows;
     const kept=rows.filter(row=>shown.includes(row.name));
     return request.query===''?shown.flatMap(name=>kept.filter(row=>row.name===name)).map(row=>row.name==='compact'?row:{...row,section}):kept;
    };
    scope.effect(()=>()=>{delete command.candidates;});
   });
  }
  const onMessage=e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='frame:draft'||!session)return;const actx=ctx.sessions.scope(session);if(actx){const input=ctx.conversation.input.for(actx),text=String(e.data.text||'');input.setDraft(e.data.append?[input.state.getSnapshot().draft,text].filter(Boolean).join('\n'):text);}};
  window.addEventListener('message',onMessage);ctx.effect(()=>()=>window.removeEventListener('message',onMessage));
  const state={value:null,listeners:new Set()};
  // @ references what a creator works with: this project's media, the shared
  // library and the motion library. Each pick serializes to the real ID the
  // matching tool takes, never to workspace paths, sessions or subagents.
  if(framed&&project&&ctx.inputTriggers){
   const kindName={image:'图片',video:'视频',audio:'音频'},stem=value=>String(value||'').replace(/\.(mp4|mov|webm|png|jpe?g|webp|gif|avif|mp3|wav|m4a|ogg|flac|aac)$/i,'');
   const thumbs=new Map(),thumb=(src,kind)=>{const key=src||kind;if(!thumbs.has(key))thumbs.set(key,src?function MentionThumb(){return h('img',{className:'frame-mention-thumb',src,alt:'',loading:'lazy'});}:function MentionIcon(){return h('span',{className:'frame-mention-thumb'},h(FrameIcon,{name:kind==='audio'?'audio-lines':'sparkles'}));});return thumbs.get(key);};
   const matches=(needle,...fields)=>!needle||fields.filter(Boolean).join(' ').toLowerCase().includes(needle);
   const list=(url,signal)=>fetch(url,{signal}).then(r=>r.ok?r.json():[]).then(v=>Array.isArray(v)?v:[]).catch(()=>[]);
   let motions;const motionList=signal=>motions||=list('/api/motion-library?projectId='+encodeURIComponent(project),signal).then(v=>{if(!v.length)motions=undefined;return v;});
   const row=(section,ref,name,description,icon)=>({name,description,icon,section,value:JSON.stringify(ref)});
   const serialize=ref=>{
    const value=JSON.parse(ref);
    if(value.k==='project')return '[本项目素材「'+value.name+'」，'+(kindName[value.kind]||'素材')+'，assetFile: '+value.id+']';
    if(value.k==='library')return '[素材库「'+value.name+'」，'+(kindName[value.kind]||'素材')+'，assetId: '+value.id+'；先用 use_library_asset 关联到本项目再使用]';
    if(value.k==='motion')return '[动效库「'+value.name+'」，componentId: '+value.id+'；先用 get_motion_component 读取说明，再用 use_motion_component 接入]';
    throw Error('无法识别的引用');
   };
   ctx.effect(()=>ctx.inputTriggers.registerSource({
    trigger:'@',name:'omnicut-library',showGroupTitle:false,
    async candidates(_session,{query,signal}){
     const needle=query.trim().toLowerCase(),limit=needle?20:6;
     // Project media repeat the project name and exported versions share one;
     // drop the prefix, list newest first and date the names that repeat.
     // The menu can open on a restored draft before the workbench state arrives.
     const current=state.value?.assets?state.value:await fetch('/api/projects/'+encodeURIComponent(project)+'?videoId='+encodeURIComponent(videoId),{signal}).then(r=>r.ok?r.json():{}).then(p=>({assets:p.assets||[],videoName:p.name})).catch(()=>({assets:[]}));
     const prefix=String(current.videoName||'')+'·',short=a=>{const name=stem(a.name);return name.startsWith(prefix)&&name.length>prefix.length?name.slice(prefix.length):name;};
     const assets=(current.assets||[]).filter(a=>!a.hidden).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||''))),counts=new Map();for(const a of assets)counts.set(short(a),(counts.get(short(a))||0)+1);
     const when=a=>{const date=new Date(a.created||NaN);return Number.isNaN(+date)?null:date.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});};
     const own=assets.filter(a=>matches(needle,a.name,kindName[a.kind])).slice(0,limit).map(a=>row('本项目素材',{k:'project',id:a.filename,name:short(a),kind:a.kind},short(a),[counts.get(short(a))>1?when(a):null,kindName[a.kind]].filter(Boolean).join(' · '),thumb(a.poster?'/api/projects/'+encodeURIComponent(project)+'/assets/'+encodeURIComponent(a.poster):null,a.kind)));
     const [shared,motion]=await Promise.all([list('/api/library'+(needle?'?query='+encodeURIComponent(needle):''),signal),motionList(signal)]);
     return [...own,
      ...shared.slice(0,limit).map(a=>row('素材库',{k:'library',id:a.id,name:stem(a.name),kind:a.kind},stem(a.name),kindName[a.kind],thumb(a.kind==='audio'?null:'/api/library/'+encodeURIComponent(a.id)+'/preview',a.kind))),
      ...motion.filter(m=>matches(needle,m.name,m.description,m.category,...(m.tags||[]))).slice(0,needle?20:8).map(m=>row('动效',{k:'motion',id:m.id,name:m.name},m.name,m.category,thumb(m.poster?'/api/motion-library/'+encodeURIComponent(m.id)+'/poster':null,'motion')))];
    },
    onPick({candidate}){const value=JSON.parse(candidate.value||'null');if(!value)return undefined;return {insert:{source:'omnicut-library',ref:candidate.value,label:value.name,clipboardText:'@'+value.name}};},
    codec:{clipboardText:ref=>'@'+JSON.parse(ref).name,serialize:ref=>Promise.resolve(serialize(ref))},
   }),'frame-ui: @ library source');
  }
  const returnToConversation=()=>{
   if(ctx.sidebarRight?.isExpanded())ctx.sidebarRight.toggleExpanded();
   queueMicrotask(()=>document.querySelector('[data-composer-seat] [contenteditable="true"]')?.focus({preventScroll:true}));
  };
  // File addresses are supplied by DSH. Only exact paths recorded by successful
  // staging/publishing tools can refer to a project asset or export; a basename
  // or a plausible exports directory is never enough to claim a file.
  function projectMedia(address){
   const prefix='dsh-resource://file/session/';if(typeof address!=='string'||!address.startsWith(prefix))return null;
   let id,file;try{const end=address.search(/[?#]/),parts=address.slice(prefix.length,end<0?undefined:end).split('/');id=decodeURIComponent(parts.shift());file=parts.map(decodeURIComponent).join('/');}catch{return null;}
   if(!id||!file||ctx.sidebarRight?.mounted.getSnapshot()!==id)return null;
   const source=ctx.sessions.binding(id)?.eventSource,calls=new Map(),bindings=new Map(),knownPath=value=>value.replace(/\\/g,'/').replace(/^(?:\.\/)+/,'');
   for(const entry of source?.getSnapshot()?.entries||[]){const event=entry.event;
    if(event.type==='tool/call')calls.set(event.data.callId,event.data);
    if(event.type!=='tool/result'||event.data.message?.isError)continue;
    const call=calls.get(event.data.message.toolCallId),result=toolResult(event.data.message);if(!call||!result)continue;
    let args;try{args=JSON.parse(call.arguments||'{}');}catch{continue;}
    if(call.name==='stage_export'&&typeof result.file==='string'&&typeof result.id==='string'&&result.status==='done'){const target={exportId:result.id,videoId:result.videoId||videoId};bindings.set(knownPath(result.file),target);if(result.relativeFile)bindings.set(knownPath(result.relativeFile),target);}
    if(call.name==='stage_asset'&&typeof result.file==='string'&&state.value?.assets?.some(asset=>asset.filename===args.assetFile)){const target={file:args.assetFile,videoId:result.videoId||videoId};bindings.set(knownPath(result.file),target);if(result.relativeFile)bindings.set(knownPath(result.relativeFile),target);}
    if(call.name==='publish_workspace_asset'&&typeof args.file==='string'&&typeof result.filename==='string')bindings.set(knownPath(args.file),{file:result.filename});
   }
   return bindings.get(file)||null;
  }
  if(project&&embedded){
   ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'frame-preview-return'},()=>h('button',{type:'button',className:'frame-preview-return',onClick:returnToConversation},'返回对话')));
   if(ctx.sidebarRightTabs)ctx.effect(()=>ctx.sidebarRightTabs.register({id:'frame-project-media',kind:'frame-project-media',patterns:['dsh-resource://file/**'],priority:'extension',canOpen:address=>Boolean(projectMedia(address)),title:()=> '媒体预览'}));
   ctx.slots.inject('sidebar.right.pane.tab',()=>ctx.slots.register({name:'sidebar.right.pane.tab',key:'frame-project-media'},function ProjectMediaPreview(props){
    const info=props.useTabInfo(),target=projectMedia(info.tab.contentId);
    const open=()=>{if(!target||info.tab.signal.aborted)return;info.tab.actions.close();returnToConversation();postFrame({type:'frame:preview',...target});};
    React.useEffect(()=>{if(info.tab.visible)open();},[info.tab.contentId,info.tab.navigation.revision,info.tab.visible]);
    return h('div',{className:'frame-resource-preview'},h('p',null,target?'在项目预览中查看媒体':'此媒体的项目关联尚不可用，请返回对话查看成片或素材卡。'),h('button',{type:'button',onClick:target?open:returnToConversation},target?'打开媒体预览':'返回对话'));
   }));
  }
  const progressMessage=event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='frame:show-progress')document.querySelector('[data-frame-production-card]')?.scrollIntoView({behavior:'smooth',block:'nearest'});};window.addEventListener('message',progressMessage);ctx.effect(()=>()=>window.removeEventListener('message',progressMessage));
  const acceptsState=value=>value&&(value.conversationId||project)===conversation&&(!value.videoId||value.videoId===videoId);
  const conversationQuery='?conversationId='+encodeURIComponent(conversation||'')+'&videoId='+encodeURIComponent(videoId);
  if(project&&embedded){const receive=e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='frame:state'||e.data.projectId!==project||!acceptsState(e.data.state))return;state.value=e.data.state;for(const fn of state.listeners)fn();};window.addEventListener('message',receive);postFrame({type:'frame:state-request',conversationId:conversation});ctx.effect(()=>()=>window.removeEventListener('message',receive));}
  else if(project){const events=new EventSource('/api/projects/'+encodeURIComponent(project)+'/events'+conversationQuery);events.onmessage=e=>{try{const value=JSON.parse(e.data);if(!acceptsState(value))return;state.value=value;for(const fn of state.listeners)fn();}catch{}};ctx.effect(()=>()=>events.close());}
  // A project may finish before the iframe subscribes. Bootstrap once so old
  // asynchronous tool results do not stay stuck at their submitted status.
  if(project&&embedded)Promise.all([fetch('/api/projects/'+encodeURIComponent(project)+'/progress'+conversationQuery,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('读取进度失败');return r.json();}),fetch('/api/projects/'+encodeURIComponent(project)+'?videoId='+encodeURIComponent(videoId)).then(r=>{if(!r.ok)throw Error('读取素材失败');return r.json();})]).then(([chat,p])=>{if(disposedExtension||state.value||!acceptsState(chat))return;state.value={...chat,assets:p.assets};for(const fn of state.listeners)fn();}).catch(()=>{});
  // A native turn can close while its media job is still running. Keep its
  // native reply, disclosure and media slots, but defer completion chrome until
  // the whole user request (including automatic continuations) has settled.
  function useNativeEventWindow(sessionId){
   const source=ctx.sessions.binding(sessionId)?.eventSource;
   return React.useSyncExternalStore(fn=>source?.subscribe(fn)||(()=>{}),()=>source?.getSnapshot());
  }
  function requestTasks(live,entries,firstTurn,latestTurn){
   // ownedTasks is display ownership and also contains manual UI submissions.
   // Only a captured Agent request token or native tool evidence means work.
   const requests=live?.agentTaskRequests||{},evidence=new Set(),calls=new Map();
   const kinds={generate_image:'image',generate_audio:'audio',generate_video:'video',generate_reference_video:'video',export_video:'export',build_hypit_project:'hypit',analyze_reference:'reference',analyze_video:'reference',transcribe_media:'transcript'};
   for(const {event} of entries||[]){
    const inRequest=firstTurn===undefined?live?.turnStarted&&event.time>=live.turnStarted:event.data?.turn>=firstTurn&&event.data.turn<=latestTurn;
    if(!inRequest)continue;
    if(event.type==='tool/call'&&(kinds[event.data.name]||event.data.name==='await_tasks'))calls.set(event.data.callId,event.data.name);
    if(event.type!=='tool/result'||event.data.message?.isError)continue;
    const name=calls.get(event.data.message.toolCallId),value=toolResult(event.data.message);if(!name||!value)continue;
    if(name==='await_tasks'){for(const id of value.taskIds||[])if(typeof id==='string')evidence.add(id);continue;}
    for(const job of value.jobs||[value])if(typeof job.id==='string')evidence.add(kinds[name]+':'+job.id);
   }
   const awaiting=live?.awaiting&&(!live.awaiting.turnId||live.awaiting.turnId===live.turnId)?new Set(live.awaiting.taskIds||[]):new Set();
   return (live?.production?.tasks||live?.tasks||[]).filter(task=>{
    if(task.conversationId&&task.conversationId!==conversation)return false;
    if(task.turnId&&task.turnId!==live?.turnId)return false;
    return evidence.has(task.id)||awaiting.has(task.id)||typeof live?.turnId==='string'&&requests[task.id]?.turnId===live.turnId;
   });
  }
  function useRequestTasks(props,live){
   const firstTurn=props.useChat(snapshot=>{
    for(let i=snapshot.order.length-1;i>=0;i--){const node=snapshot.nodes.get(snapshot.order[i]);if(node?.kind==='user'&&['turn','step'].includes(node.location?.kind))return node.location.turn.turn;}
    return undefined;
   });
   const latestTurn=props.useChat(snapshot=>snapshot.timeline.turnOrder.at(-1)),events=useNativeEventWindow(props.sessionId);
   return {firstTurn,latestTurn,tasks:requestTasks(live,events?.entries,firstTurn,latestTurn)};
  }
  function useProductionCompletion(props){
   const live=React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);
   const running=props.useSession(value=>value.running);
   const {firstTurn,latestTurn,tasks:request}=useRequestTasks(props,live);
   const turn=props.node.location?.turn;
   if(!project||props.sessionId!==session||!turn||turn.turn<firstTurn)return null;
   // Long chats can page the initiating user message out of the window. In
   // that case Frame's request start still covers every visible continuation.
   if(firstTurn===undefined&&!live?.turnStarted&&turn.turn!==latestTurn)return null;
   // A new submission may reach Frame before its user node reaches the chat.
   // Do not temporarily remove the previous request's completed controls.
   if(live?.turnStarted&&turn.end?.time<live.turnStarted)return null;
   if(live?.outcome==='stopped')return null;
   const tasks=request.filter(task=>task.status==='running');
   const pending=!live||running||['running','waiting'].includes(live.status)||live.awaiting||live.resuming||tasks.length;
   if(!pending)return null;
   return tasks.some(task=>task.kind==='export')?'正在导出成片':tasks.length?'正在生成素材':live?.awaiting||live?.status==='waiting'?'等待素材完成':live?.resuming?'正在继续制作':'正在处理中';
  }
  for(const key of ['turn-process'])ctx.slots.inject('conversation.chat.node',()=>{
   const original=ctx.slots.entries('conversation.chat.node').find(entry=>entry.options.key===key&&(entry.options.priority||0)===0);
   if(!original)return;
   // Preserve the native process disclosure and its localized accessibility.
   return ctx.slots.register({name:'conversation.chat.node',key,priority:-20,locale:original.locale,inject:original.inject},function ProductionTurn(props){
    const pending=useProductionCompletion(props);
    if(!pending)return h(original.component,props);
    const node={...props.node,location:{...props.node.location,turn:{...props.node.location.turn,end:undefined}}};
    const t=(name,...args)=>name==='message.turnProcess.worked'?pending:props.t(name,...args);
    const process=h(original.component,{...props,node,t});
    // The native process node exists during tool work; its open-Turn renderer
    // is empty. Add only accepted image evidence there, never end-clock actions.
    return props.node.location.turn.status==='closed'?process:h(React.Fragment,null,process,h(RunningTurnPreviews,props));
   });
  });
  function ChatReady(){
   React.useEffect(()=>{
    let tick=0,finished=false;
    const observer=new MutationObserver(schedule);
    function schedule(){if(!finished&&!tick)tick=requestAnimationFrame(check);}
    function check(){
     tick=0;const input=document.querySelector('[data-composer-seat] [contenteditable="true"]');
     if(!input||!input.getClientRects().length||getComputedStyle(input).visibility!=='visible')return;
     finished=true;observer.disconnect();postFrame({type:'frame:chat-ready',projectId:project});
    }
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-content-phase','contenteditable']});schedule();
    return()=>{finished=true;observer.disconnect();cancelAnimationFrame(tick);};
   },[]);
   return null;
  }
  function SubmissionReceipt(){
   const face=ctx.sessions.binding(session)?.session;
   const snap=React.useSyncExternalStore(fn=>face?.subscribe(fn)||(()=>{}),()=>face?.getSnapshot());
   const pending=snap?.pendingSubmissions||[],[received,setReceived]=React.useState(false),previous=React.useRef(0);
   React.useEffect(()=>{let timer;if(previous.current&&pending.length===0&&!snap?.promptError){setReceived(true);timer=setTimeout(()=>setReceived(false),2500);}if(pending.length)setReceived(false);previous.current=pending.length;return()=>clearTimeout(timer);},[pending.length,snap?.promptError]);
   if(!pending.length&&!received)return null;
   return h('span',{className:'frame-receipt',role:'status'},pending.length?'正在发送…':'已接收');
  }
  function useFrameState(){return React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);}
  const progressLabel=job=>{const value=job?.progress;if(!value)return '';const frames=Number.isFinite(value.framesCompleted)&&Number.isFinite(value.framesTotal)&&value.framesTotal>0?value.framesCompleted+'/'+value.framesTotal+' 帧':'';return [value.phase,frames].filter(Boolean).join(' · ');};
  function PreviewEvidence({preview}){
   const live=useFrameState(),frames=preview.frames||[],sheet=preview.contactSheet||preview.grid;
   if(!frames.length)return null;
   const open=(src,label,kind='image')=>{if(!src)return;import('/media-preview.js').then(module=>module.openMediaPreview({src,name:label,kind}));};
   const seek=frame=>postFrame({type:'frame:seek',start:frame.time??frame.at??0,videoId:preview.videoId||videoId});
   const reference=frame=>{
    const rate=frame.frameRate||preview.frameRate,at=frame.frame;
    if(!Number.isSafeInteger(at)||!rate?.numerator||!rate?.denominator)return;
    const entity=frame.entities?.[0],ref=frame.reference||{id:(preview.previewId||preview.id)+':'+at,projectId:preview.projectId||project,videoId:preview.videoId||videoId,revision:preview.revision,nativeRevision:preview.nativeRevision,kind:'review',entityId:frame.entityId||entity?.entityId,trackId:entity?.trackId,startFrame:at,endFrameExclusive:at+1,frameRate:rate,start:at*rate.denominator/rate.numerator,end:(at+1)*rate.denominator/rate.numerator,label:frame.label||'画面 '+(frame.timecode||Number(frame.time??frame.at??0).toFixed(2)+'s')};
    const refs=live?.inputReferences||[];if(refs.length>=30&&!refs.some(item=>item.id===ref.id&&item.videoId===ref.videoId))return;
    postFrame({type:'frame:references-add',references:[ref]});
   };
   const time=frame=>String(frame.timecode||Number(frame.time??frame.at??0).toFixed(2)+'s').replace(/\.00$/,'');
   return h('section',{className:'frame-preview-evidence','aria-label':'画面检查'},h('div',{className:'frame-section-heading'},h('span',null,'画面检查 · '+frames.length+(preview.sampled?' · 抽样':'')),sheet?.url?h('button',{type:'button',onClick:()=>open(sheet.url,'画面检查拼图')},'看拼图'):null,preview.sample?.url?h('button',{type:'button',onClick:()=>open(preview.sample.url,'画面小样','video')},'播放小样'):null),h('div',{className:'frame-media-tiles'},frames.map((frame,index)=>h('div',{className:'frame-evidence-frame',key:frame.frame??index},h('button',{type:'button',className:'frame-tile-picture',onClick:()=>open(frame.url,frame.label||'画面检查'),'aria-label':'打开 '+(frame.label||'画面 '+time(frame)),disabled:!frame.url},frame.url?h('img',{src:frame.url,alt:'',loading:'lazy'}):h('span',null,'暂不可用')),h('button',{type:'button',className:'frame-evidence-time',onClick:()=>seek(frame),title:'跳到这一帧'},time(frame)),Number.isSafeInteger(frame.frame)?h('button',{type:'button',className:'frame-evidence-quote',onClick:()=>reference(frame),'aria-label':'引用 '+time(frame)+' 的画面',title:'引用到对话'},h(FrameIcon,{name:'text-quote'})):null))));
  }
  function EvidenceFact({name,result}){
   if(!result)return null;
   if(name==='analyze_beats'){const count=(result.beats||[]).length,tempo=Number.isFinite(result.bpm)&&result.bpm>0&&result.confidence>0;return h('div',{className:'frame-evidence-fact'},count?count+' 处音乐起音 · '+(tempo?Math.round(result.bpm)+' BPM':'速度未确认'):'未识别到可靠节拍',result.warnings?.length?h('details',null,h('summary',null,'分析说明'),result.warnings.map((text,index)=>h('p',{key:index},text))):null);}
   const metrics=[Number.isFinite(result.duration)?result.duration.toFixed(2)+'s':null,result.width&&result.height?result.width+'×'+result.height:null,Number.isFinite(result.fps)?Number(result.fps.toFixed(3))+' fps':null,Number.isFinite(result.audioTracks)?result.audioTracks+' 条音轨':null,Number.isFinite(result.loudness?.integratedLUFS)?result.loudness.integratedLUFS.toFixed(1)+' LUFS':null].filter(Boolean);
   const intervals=[...(result.blackFrames||result.blackIntervals||[]).map(item=>({...item,label:'疑似黑帧'})),...(result.staticFrames||result.staticIntervals||[]).map(item=>({...item,label:'静止画面'}))];
   return h('div',{className:'frame-evidence-fact'},h('span',null,metrics.join(' · ')),intervals.length?h('details',null,h('summary',null,intervals.length+' 处待核对'),intervals.map((item,index)=>h('div',{key:index},h('button',{type:'button',onClick:()=>postFrame({type:'frame:seek',start:item.start,videoId:result.videoId||videoId})},item.start.toFixed(2)+'–'+item.end.toFixed(2)+'s · '+item.label)))):null,result.analysis?.complete===false?h('span',null,' · 未完整分析'):null,result.warnings?.length?h('details',null,h('summary',null,'检查说明'),result.warnings.map((text,index)=>h('p',{key:index},text))):null);
  }
  function ReferenceDock(){const live=useFrameState(),refs=live?.inputReferences||[];if(!refs.length)return null;return h('div',{className:'frame-reference-chips'},refs.map(ref=>h('span',{key:ref.videoId+':'+ref.id},h('button',{type:'button',onClick:()=>postFrame({type:'frame:seek',start:ref.start,videoId:ref.videoId})},/\d{2}:\d{2}/.test(ref.label)?ref.label:ref.label+' · '+ref.start.toFixed(1)+'–'+ref.end.toFixed(1)+'s'),h('button',{type:'button','aria-label':'取消引用',onClick:()=>postFrame({type:'frame:references-update',references:refs.filter(r=>r.id!==ref.id||r.videoId!==ref.videoId)})},'×'))));}
  function ProductionStatus(){const live=useFrameState(),events=useNativeEventWindow(session),active=requestTasks(live,events?.entries).filter(t=>t.status==='running');if(!active.length&&!['running','waiting'].includes(live?.status))return null;return h('button',{className:'frame-skill frame-status-badge',onClick:()=>document.querySelector('[data-frame-production-card]')?.scrollIntoView({behavior:'smooth',block:'nearest'})},active.length?active.length+' 项进行中':'处理中');}
  function TaskSummary(props){
   const live=useFrameState(),{latestTurn,tasks}=useRequestTasks(props,live);if(props.sessionId!==session||props.turn.turn!==latestTurn)return null;
   const running=tasks.filter(t=>t.status==='running'),failed=tasks.filter(t=>['failed','blocked','unknown','paused'].includes(t.status)),review=[...(live?.references||[])].find(r=>r.purpose==='quality'&&r.analysis),changes=live?.changeSet,stopped=live?.outcome==='stopped';
   return h('div',{'data-frame-production-card':'',className:'frame-production-card'},
    stopped?h('p',{className:'frame-stopped-tasks',role:'status'},running.length?'助手已停止 · '+running.length+' 项已提交任务仍在处理，结果会保留':'助手已停止'):props.pending?h(Progress,{text:props.pending}):null,
    tasks.length?h('details',{className:'frame-task-details'},h('summary',null,running.length?running.length+' 项任务进行中':failed.length?failed.length+' 项需要处理':'制作记录'),tasks.map(task=>{const recovery=failed.includes(task)?failurePresentation(task):null;return h('div',{key:task.id,className:'frame-task-row'},h('span',null,task.name||({image:'图片',video:'镜头',audio:'声音',export:'成片',reference:'审片'})[task.kind]||'素材'),h('span',null,task.status==='running'?progressLabel(task)||progressLabel((live?.projectExports||live?.exports||[]).find(job=>task.id==='export:'+job.id))||'进行中':task.status==='succeeded'?'已完成':'未完成'),recovery?h('p',null,recovery.message):null,recovery?h('button',{className:'frame-failure-action',onClick:()=>openFailure(recovery,task)},recovery.label):null);})):null,
    !props.pending&&changes?h('section',{className:'frame-change-card'},h('strong',null,changes.undone?'本轮改动已撤销':'本轮改动'),changes.videos.map(video=>h('div',{key:video.videoId},video.changes.map((change,index)=>h('button',{key:index,onClick:()=>postFrame({type:'frame:seek',start:change.start||0,videoId:video.videoId})},change.label)))),changes.undoAvailable?h('button',{className:'frame-skill',onClick:()=>postFrame({type:'frame:undo-turn',changeSetId:changes.id})},'撤销本轮'):null):null,
    review?h('details',{className:'frame-review-card'},h('summary',null,'审片 · '+review.analysis.issues.length+' 个问题'),h('p',null,review.analysis.summary),review.analysis.issues.map((issue,i)=>h('button',{key:i,onClick:()=>postFrame({type:'frame:seek',start:issue.start,videoId:review.videoId||videoId})},issue.start.toFixed(1)+'s · '+issue.observation))):null);
  }

  const readableName=(value,fallback)=>{const text=String(value||'');return /[\u3400-\u9fff]/.test(text)?text.replace(/\.(mp4|mp3|wav|jpg|png|jpeg)$/i,''):fallback;};
  function Progress({text='正在生成'}){return h('div',{className:'frame-generation-state',role:'status'},h('span',{className:'frame-progress-orbit','aria-hidden':true}),h('span',null,text),h('span',{className:'frame-progress-dots','aria-hidden':true},'•••'));}
  function Failure({message,job={}}){const presentation=failurePresentation({...job,message});return h('details',{className:'frame-task-details'},h('summary',null,h(FrameIcon,{name:'circle-alert'}),presentation.engineering?'工程需要调整':'任务未完成'),h('div',{className:'frame-failure-body'},h('p',null,presentation.message),h('button',{type:'button',className:'frame-failure-action',onClick:()=>openFailure(presentation,job)},h(FrameIcon,{name:presentation.action==='settings'?'settings-2':'arrow-right'}),presentation.label)));}
  function MediaTool(props){
   const live=React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);
   const block=props.block,result=toolResult(block);
   if(block.isError)return h(Failure,{message:block.content?.filter(b=>b.type==='text').map(b=>b.text).join('')});
   if(result?.jobs)return h('div',null,result.jobs.map((job,i)=>h(MediaTool,{key:job.id||i,compact:props.compact,toolName:'generate_video',phase:'result',block:{content:[{type:'text',text:JSON.stringify(job)}]}})));
   const kind=props.toolName==='generate_audio'?'audio':props.toolName==='generate_image'?'image':exportTools.has(props.toolName)?'export':props.toolName==='build_hypit_project'?'hypit':'video';
   const roster=kind==='audio'?live?.audio:kind==='image'?live?.images:kind==='export'?live?.projectExports||live?.exports:live?.generations;
   const task=kind==='hypit'?live?.tasks?.find(x=>x.id==='hypit:'+result?.id):null;
   const job=task||roster?.find(x=>x.id===result?.id)||result;
   const renderFile=(file,type,name,src,compact=props.compact)=>{
    const label=readableName(name,({image:'生成图片',audio:'生成声音',video:'生成视频',export:'广告成片'})[type]||'创作素材');
    const asset=live?.assets?.find(a=>a.filename===file),poster=type==='export'?'/api/jobs/'+job.id+'/poster':asset?.poster?'/api/projects/'+project+'/assets/'+asset.poster:null;
    const preview=()=>{if(embedded)postFrame({type:'frame:preview',file,exportId:type==='export'?job.id:undefined,videoId:job.videoId||videoId});else import('/media-preview.js').then(m=>m.openMediaPreview({src,name:label,kind:type==='export'?'video':type,...(type==='export'?{download:{href:src,filename:label+'.mp4'},metadata:job}:{})}));};
    // Historical cards (even folded turns) never mount media decoders or hold
    // HTTP connections. The single user-opened player owns loading/playback.
    const delivered=type==='export',info=delivered?deliveryInfo(job):null,steps=delivered?deliveryNextSteps(job):[];
    const next=text=>{if(embedded)postFrame({type:'frame:delivery-next',exportId:job.id,videoId:job.videoId||videoId,text});else{const actx=ctx.sessions.scope(session);if(actx){ctx.conversation.input.for(actx).setDraft(text);document.querySelector('[contenteditable="true"]')?.focus();}}};
    const picture=type==='image'?asset?.poster?'/api/projects/'+project+'/assets/'+asset.poster:src:poster;
    // Materials and earlier versions share one tile; only the delivered film is a card.
    if(compact)return h('button',{type:'button',className:'frame-media-tile frame-media-'+type,key:file||src,onClick:preview,title:label,'aria-label':(type==='image'?'查看 ':'播放 ')+label},h('span',{className:'frame-tile-picture'},picture?h('img',{src:picture,alt:'',loading:'lazy'}):h(FrameIcon,{name:type==='audio'?'audio-lines':'film'}),type==='video'||type==='export'?h('span',{className:'frame-tile-badge','aria-hidden':true},h(FrameIcon,{name:'play'})):null),h('span',{className:'frame-tile-name'},delivered?versionLabel(job,info):label));
    if(delivered)return h('div',{className:'frame-media-result frame-media-export',key:file||src,'data-delivery':true},h('div',{className:'frame-delivery-cover','data-orientation':info.width&&info.height&&info.height>info.width?'portrait':undefined},h('button',{className:'frame-media-open','data-delivery-cover':true,onClick:preview,'aria-label':'播放'+label},poster?h('img',{src:poster,alt:'',loading:'lazy'}):null,h('span',{className:'frame-media-play','aria-hidden':true},h(FrameIcon,{name:'play'}))),h('div',{className:'frame-delivery-bar'},h('div',{className:'frame-delivery-title'},h('strong',null,'成片已就绪'),info.summary?h('span',{className:'frame-delivery-meta'},info.summary):null),h('a',{className:'frame-delivery-save',href:src,download:label+'.mp4'},h(FrameIcon,{name:'download'}),'保存成片'))),steps.length?h('div',{className:'frame-delivery-next','aria-label':'继续制作'},steps.map(step=>h('button',{type:'button',key:step.id,onClick:()=>next(step.text)},h(FrameIcon,{name:step.icon}),step.label))):null);
    return h('div',{className:'frame-media-result frame-media-'+type,key:file||src},h('strong',null,label),h('button',{className:type==='image'?'frame-image-open':'frame-media-open',onClick:preview,'aria-label':(type==='image'?'查看':'播放')+label},type==='image'?h('img',{src,alt:label,loading:'lazy'}):h(React.Fragment,null,poster?h('img',{src:poster,alt:'',loading:'lazy'}):null,h('span',{className:'frame-media-play','aria-hidden':true},type==='audio'?'播放声音':h(FrameIcon,{name:'play'})))));
   };
   if(kind==='hypit'){const outputs=task?.result?.outputs||result?.outputs||[];const media=outputs.filter(o=>o.assetFile);if(media.length)return h('div',null,media.map(o=>renderFile(o.assetFile,/\.(png|jpe?g|webp|gif|avif)$/i.test(o.assetFile)?'image':/\.(mp3|wav|m4a|ogg|flac)$/i.test(o.assetFile)?'audio':'video',o.name,'/api/projects/'+project+'/assets/'+o.assetFile)));}
   const file=kind==='export'?null:job?.assetFile||job?.filename,src=file?'/api/projects/'+project+'/assets/'+encodeURIComponent(file):kind==='export'&&job?.status==='done'&&typeof job.id==='string'&&job.id?'/api/jobs/'+encodeURIComponent(job.id)+'/download':null;
   if(src){const asset=live?.assets?.find(a=>a.filename===file);const type=kind==='export'?'export':asset?.kind||(['image','audio','video'].includes(job.kind)?job.kind:null)||(/\.(png|jpe?g|webp|gif|avif)$/i.test(file||'')?'image':/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file||'')?'audio':kind);return renderFile(file,type,asset?.name||job.name||labels[props.toolName],src);}
   if(job?.status!=='recovering'&&job?.error||['failed','unknown','blocked','paused','interrupted'].includes(job?.status))return h(Failure,{job,message:job?.failure?.message||job?.error});
   if(['succeeded','done'].includes(job?.status))return null;
   const status=job?.status==='recovering'?'恢复连接':kind==='export'?'导出中':job?.status==='queued'?'排队中':'生成中';return h(Progress,{text:readableName(job?.name,labels[props.toolName]||'素材')+' · '+(kind==='export'?progressLabel(job)||status:status)});
  }
  function useTurnEvidence(props){
   const {turn,sessionId}=props;
   const live=useFrameState(),latestTurn=props.useChat(value=>value.timeline.turnOrder.at(-1));
   const window=useNativeEventWindow(sessionId);
   const calls=new Map(),results=[];
   for(const entry of window?.entries||[]){const event=entry.event;if(event.data?.turn!==turn.turn)continue;
    if(event.type==='tool/call'&&(labels[event.data.name]||evidenceTools.has(event.data.name)))calls.set(event.data.callId,event.data.name);
    if(event.type==='tool/result'){const message=event.data.message,name=calls.get(message.toolCallId);if(name&&!message.isError)results.push({name,block:message,preview:event.data.meta?.preview});}
   }
   const recordedPreviewTurns=new Map();for(const entry of window?.entries||[]){if(entry.event.type!=='tool/result')continue;const value=entry.event.data.meta?.preview||toolResult(entry.event.data.message);if(value?.previewId&&value.frames?.length)recordedPreviewTurns.set(value.previewId,entry.event.data.turn);}
   const previews=new Map();for(const item of results.filter(item=>item.name==='preview_frames')){const value=item.preview||toolResult(item.block);if(value?.frames?.length)previews.set(value.previewId||value.id,value);}
   if(sessionId===session&&turn.turn===latestTurn)for(const value of live?.visualPreviews||[])if(value.turnId===live.turnId&&(!value.conversationId||value.conversationId===conversation)&&(!recordedPreviewTurns.has(value.previewId||value.id)||recordedPreviewTurns.get(value.previewId||value.id)===turn.turn))previews.set(value.previewId||value.id,value);
   return {results,previewItems:[...previews.values()],latestTurn};
  }
  function RunningTurnPreviews(props){
   const turn=props.node.location.turn,{previewItems,latestTurn}=useTurnEvidence({...props,turn});
   if(turn.status==='closed'||props.sessionId!==session||turn.turn!==latestTurn)return null;
   const current=previewItems.filter(preview=>preview.frames.some(frame=>typeof frame.url==='string'&&frame.url)).at(-1);
   return current?h('div',{'data-frame-running-previews':'',className:'frame-running-previews'},h(PreviewEvidence,{key:current.previewId||current.id,preview:current})):null;
  }
  function TurnMedia(props){
   const pending=useProductionCompletion({...props,node:{location:{turn:props.turn}}}),{results,previewItems}=useTurnEvidence(props);
   const byExport=new Map();for(const result of results)if(exportTools.has(result.name)){const id=toolResult(result.block)?.id;if(typeof id==='string'&&id)byExport.set(id,result);}
   const versions=[...byExport.values()].sort((a,b)=>Date.parse(toolResult(a.block)?.created||0)-Date.parse(toolResult(b.block)?.created||0)),final=versions.slice(-1),earlier=versions.slice(0,-1),process=results.filter(r=>!exportTools.has(r.name)&&!evidenceTools.has(r.name));
   const facts=results.filter(item=>['probe_export','analyze_beats'].includes(item.name));
   const currentPreview=previewItems.at(-1),previousPreviews=previewItems.slice(0,-1);
   const cards=list=>h('div',{className:'frame-delivery-cards'},list.map((r,i)=>h(MediaTool,{key:r.block.toolCallId||i,toolName:r.name,block:r.block,phase:'result'}))),tiles=list=>h('div',{className:'frame-media-tiles'},list.map((r,i)=>h(MediaTool,{key:r.block.toolCallId||i,compact:true,toolName:r.name,block:r.block,phase:'result'})));
   // Keep DSH's original turn-tail owner, feedback, usage and extension slots.
   // Its end-clock action row stays hidden (including keyboard/AX access)
   // only while this exact request is awaiting its final continuation.
   return h(React.Fragment,null,h(TaskSummary,{...props,pending}),currentPreview?h(PreviewEvidence,{key:currentPreview.previewId||currentPreview.id,preview:currentPreview}):null,previousPreviews.length?h('details',{className:'frame-media-batch'},h('summary',null,'此前画面检查 · '+previousPreviews.length),previousPreviews.map(value=>h(PreviewEvidence,{key:value.previewId||value.id,preview:value}))):null,facts.map(item=>h(EvidenceFact,{key:item.block.toolCallId,name:item.name,result:toolResult(item.block)})),pending?h('span',{'data-frame-turn-pending':'',hidden:true}):null,results.some(item=>!evidenceTools.has(item.name))?h('div',{className:'frame-turn-media'},final.length?h('div',null,cards(final)):null,earlier.length?h('details',{className:'frame-media-batch'},h('summary',null,'较早版本 · '+earlier.length),tiles(earlier)):null,process.length?h('details',{className:'frame-media-batch'},h('summary',null,'本轮素材 · '+process.length),tiles(process)):null):null);
  }

  // Finished media lives once beside the reply. The native tool disclosure keeps
  // a compact operation row, rather than repeating every video in both places.
  function MediaActivity(props){return props.block?.isError?h(Failure,{message:props.block.content?.filter(b=>b.type==='text').map(b=>b.text).join('')}):null;}
  ctx.slots.inject('conversation.chat.turnTail',()=>ctx.slots.register({name:'conversation.chat.turnTail',id:'frame-media'},TurnMedia));
  const operations={adjust_hypit_timing:'调整片段时间',analyze_reference:'分析参考视频',analyze_video:'审片',apply_generated_video:'换上新镜头',apply_project_changes:'应用修改',apply_reference_plan:'采用参考方案',apply_text_edits:'修改文字',apply_video_edits:'修改画面',await_tasks:'等待素材',bind_beat_guides:'绑定节奏参考',checkout_hypit_project:'准备工程',commit_hypit_project:'保存剪辑',compose_video:'编排成片',create_video_variant:'创建新版本',creative_director:'与创意导演讨论',edit_audio_track:'调整声音',edit_hypit_project:'更新画面',edit_hypit_scene:'调整画面',edit_reference_plan:'更新参考方案',edit_timeline:'调整时间线',edit_visual_component:'调整动效',fork_video_project:'复制视频',get_hypit_runtime:'检查预览环境',get_media_capabilities:'查看生成服务',get_motion_component:'查看动效',get_operation_status:'查看进度',get_project_context:'读取项目',get_reference_plans:'读取参考方案',get_tasks:'查看任务进度',get_video_generations:'查看已生成镜头',import_hypit_project:'导入工程',index_hypit_assets:'整理工程素材',inspect_hypit_scene:'查看画面结构',list_audio_voices:'查看可用音色',list_beat_guides:'读取节奏参考',list_hypit_components:'浏览动效库',list_motion_components:'浏览动效库',list_project_videos:'查看项目视频',organize_asset:'整理素材',prepare_hypit_speech:'对齐字幕',publish_library_asset:'发布到素材库',read_hypit_docs:'查阅制作方法',read_hypit_project:'读取工程',read_project_conversation:'查看其他对话',rebuild_motion_component:'重建动效',recover_reference_plan:'接续参考分析',rename_video_project:'修改名称',replace_hypit_media:'替换素材',resume_image_task:'继续生成图片',resume_video_task:'继续生成镜头',run_hypit_tool:'处理工程',save_motion_component:'保存动效',search_library:'搜索素材库',set_chat_timing:'调整对话节奏',set_production_plan:'更新制作方案',stage_asset:'准备素材',sync_hypit_assets:'同步素材',transcribe_media:'识别旁白',undo_project_change:'撤销修改',use_library_asset:'引用素材库素材',use_motion_component:'接入动效',validate_video:'检查影片'};
  const developerView=()=>document.documentElement.dataset.frameDeveloper==='true';
  // Creators see what a step did; the recorded tool output stays a developer detail.
  function OperationResult(props){const text=props.block?.content?.filter(b=>b.type==='text').map(b=>b.text).join(''),title=operations[props.toolName]||'制作步骤';if(props.block?.isError)return h(Failure,{message:text});if(!text)return null;return developerView()?h('details',{className:'frame-task-details'},h('summary',null,title),h('pre',null,text)):h('div',{className:'frame-operation'},h(FrameIcon,{name:'clapperboard'}),title);}
  for(const name of Object.keys(operations))ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},OperationResult));
  // Native picture, file and shell rows keep their cards. Creators read what a
  // step touched in the film (a material, a moment, the edit) instead of the
  // Agent's workspace paths; developers keep the original rows.
  const fileLabel=(tool,file,live)=>{
   const path=String(file||''),name=path.split(/[\\/]/).pop()||'',base=name.replace(/\.[^.]+$/,''),prefix=live?.videoName?live.videoName+'·':'';
   const asset=(live?.assets||[]).find(item=>item.filename===name||item.poster===name||String(item.filename||'').replace(/\.[^.]+$/,'')===base.replace(/\.preview$/,''));
   if(asset)return readableName(String(asset.name||'').replace(prefix,''),({image:'项目图片',video:'项目镜头',audio:'项目声音'})[asset.kind]||'项目素材');
   const moment=/[-_](\d+(?:\.\d+)?)s?$/.exec(base);
   if(tool==='read_image'&&moment&&/frames?|preview/i.test(path))return Number(moment[1])+' 秒处画面';
   if(/grid|sheet|contact/i.test(base))return '画面拼图';
   if(/[㐀-鿿]/.test(base))return base;
   if(/\.(svml|svs|svrun)$/i.test(name))return '剪辑工程';
   if(/^production-notes\.md$/i.test(name))return '制作笔记';
   if(/^skill\.md$/i.test(name)||/[\\/](skills?|docs?)[\\/]/i.test(path))return '制作方法';
   if(/[\\/]packages[\\/]/.test(path))return '动效代码';
   if(/[\\/]analysis[\\/]/.test(path))return '分析数据';
   return tool==='read_image'?'参考画面':'工作文件';
  };
  const creativeArgs=(tool,raw,live)=>{
   try{const args=JSON.parse(raw);if(!args||typeof args!=='object'||Array.isArray(args))return raw;const next={...args};for(const key of ['file_path','path'])if(typeof next[key]==='string'&&next[key])next[key]=fileLabel(tool,next[key],live);if(tool==='bash'&&!next.description)next.description='后台处理';return JSON.stringify(next);}catch{return raw;}
  };
  const creativeBlock=(tool,block,live)=>{
   if(!block||typeof block!=='object')return block;
   if('kind' in block)return {...block,...(block.call?{call:{...block.call,argsRaw:creativeArgs(tool,block.call.argsRaw,live)}}:{}),...(typeof block.meta?.path==='string'?{meta:{...block.meta,path:fileLabel(tool,block.meta.path,live)}}:{})};
   return typeof block.argsRaw==='string'?{...block,argsRaw:creativeArgs(tool,block.argsRaw,live)}:block;
  };
  for(const key of ['read_image','read','write','edit','bash'])ctx.slots.inject('tool.call.toolview',()=>{
   const original=ctx.slots.entries('tool.call.toolview').find(entry=>entry.options.key===key&&(entry.options.priority||0)===0);
   if(!original)return;
   // The native entry keeps declaring its child slots (the picture gallery).
   const {locale,inject}=original;
   return ctx.slots.register({name:'tool.call.toolview',key,priority:-20,locale,inject},function CreativeToolRow(props){
    const live=useFrameState(),block=React.useMemo(()=>creativeBlock(key,props.block,live),[props.block,live?.assets,live?.videoName]);
    return developerView()?h(original.component,props):h(original.component,{...props,block,openFile:undefined});
   });
  });
  for(const name of [...Object.keys(labels),...evidenceTools])ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},MediaActivity));
 }catch(error){if(disposedExtension)return;console.error('Frame native extension:',error.stack||error.message);throw error;} }
 return {inject:['slots','uiWorkspace','sessions','conversation','layout','locale','sidebarRight','sidebarRightTabs','inputTriggers'],apply};
}});
