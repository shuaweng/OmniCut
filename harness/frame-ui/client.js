window.__ModuleLoader__.load({id:'frame-dsh-ui',factory:require=>{
 const React=require('react'),h=React.createElement;
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
   html[data-frame-home] body{--dsh-content-font-size:16px;--dsh-composer-side-clearance:8px;--dsh-composer-card-max-width:100%;--dsh-composer-text-max-height:220px;--dsw-alias-button-info-fill:#ff6b35;--dsw-alias-button-info-hover:#ff8556;--dsw-alias-state-business-primary:#ff6b35;--dsw-specific-input-major:#242424}
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
   [data-composer-card]{border-radius:22px!important;padding-top:18px!important;gap:14px!important;box-shadow:inset 0 0 0 1px #ffffff0a!important}
   [data-composer-card]:focus-within{box-shadow:inset 0 0 0 1px #8b543d!important}
   html[data-frame-home] [data-composer-card] [contenteditable]{min-height:82px!important;padding:0 22px!important;outline:none!important;box-shadow:none!important;font-size:16px!important;line-height:26px!important}
   html[data-frame-home] [data-composer-card] [class*="_placeholder"]{inset:0 22px auto!important;font-size:16px!important;line-height:26px!important}
   [data-composer-card] [class*="_row"]{padding:0 14px 13px!important}
   [data-composer-card] button[class*="_add"]{width:34px;height:34px}
   [data-composer-card] button[class*="_primary"]{width:auto!important;height:38px!important;min-width:100px;padding:0 20px!important;border-radius:999px!important;font:inherit!important;font-size:14px!important;font-weight:500!important;transform:none!important}
   [data-composer-card] button[class*="_primary"]>svg{display:none!important}
   [data-composer-card] button[class*="_primary"]:after{content:attr(aria-label)}
   [data-composer-card] [class*="_modes"],[data-composer-card] [class*="_standardControls"],[class*="uV2eYG_dock"]{display:none!important}
   .frame-home-error{margin:8px 18px 0;color:#efad90;font-size:12px;line-height:1.5}
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
 const labels={build_hypit_project:'工程产出',generate_audio:'生成声音',generate_image:'生成图片',generate_video:'生成镜头',generate_reference_video:'制作参考镜头',export_video:'导出成片',publish_workspace_asset:'素材'};
 async function apply(ctx){let disposedExtension=false;ctx.effect(()=>()=>{disposedExtension=true;});try{
  const params=new URLSearchParams(location.search),session=params.get('session'),project=params.get('project'),conversation=params.get('conversation')||project;
  const framed=params.get('frame')==='1',embedded=framed&&parent!==window;
  if(session){
   // The URL selects the initial conversation only. Cancel any pending startup
   // restoration, then let DSH own navigation to children and their ancestors.
   // A persistent list reconciler would immediately undo openSession(child).
   await ctx.sessions.refresh();if(disposedExtension)return;
   ctx.layout.beginNavigation();ctx.uiWorkspace.openSession(session);
  }
  if(params.get('home')==='1'&&embedded){installHomeComposer(ctx);return;}
  if(framed){
   // Use the harness's locale and slot APIs, keeping its chat/composer intact.
   const language='zh-Hans-x-frame';
   const removeLanguage=ctx.locale.addLanguage({id:language,label:'简体中文',fallback:'zh'});
   const removeWords=ctx.locale.register('conversation',language,{
    'placeholder.hero':'描述你想做的视频或修改…',
    'placeholder.default':'描述你的想法，或 @ 引用素材…',
    'hero.headline':'', 'hero.preview':''
   });
   if(ctx.locale.getLocale().active!==language)ctx.locale.setLocale(language);ctx.effect(()=>()=>{removeWords();removeLanguage();});
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
      h('button',{type:'button',onClick:()=>parent.postMessage({type:'frame:reference'},location.origin)},'参考改编'),
      h('button',{type:'button',onClick:()=>parent.postMessage({type:'frame:motion-library'},location.origin)},'添加动效')))));
   const style=document.createElement('style');style.textContent=`
   [class*="_stack"]:has([data-frame-brand]){display:none!important}
   [class*="_heroWorkspaceRow"]{display:none!important}
   .frame-conversation-welcome{display:none}
   [data-conversation-content][data-content-phase="hero"]>[data-conversation-scroll]{justify-content:flex-start!important}
   [data-content-phase="hero"] .frame-conversation-welcome{display:flex;flex:1 0 180px;min-height:180px;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:28px 22px 54px;text-align:center}
   .frame-conversation-welcome h2{margin:0;color:#e6e6e6;font-size:22px;line-height:1.4;font-weight:500;letter-spacing:-.5px}
   .frame-welcome-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:330px}
   .frame-welcome-actions button{border:1px solid #343434;background:#1d1d1d;color:#bcbcbc;border-radius:8px;font:inherit;font-size:12px;padding:9px 12px;cursor:pointer;transition:background .15s,color .15s}
   .frame-welcome-actions button:hover{background:#29231f;color:#ffb394;border-color:#66412e}
   [data-content-phase="hero"] [data-composer-seat]{flex:1;min-height:0;padding-bottom:16px}
   [data-content-phase="hero"] [data-chain-overlay-fallback="conversation.composer"]>div{flex:1;min-height:0;padding-bottom:0}
   [data-content-phase="hero"] [data-chain-overlay-fallback="conversation.composer"]>div>div:has([data-slot="conversation.hero.brand.mark"]){display:none}
   /* Fill the hidden workspace sidebar's columns while leaving DSH's right
      track, resize handle, fullscreen panel and overlay stacking intact. */
   [class*="centerCol"]{grid-column:1 / 3!important}
   [class*="sidebarCol"],[data-side="sidebar"],[data-shell-leading],[class*="headerUtilities"],button[aria-label="在新对话中分支"]{display:none!important}
   body[data-ds-dark-theme]{--dsw-alias-button-info-fill:#ff6b35;--dsw-alias-button-info-hover:#ff8556;--dsw-alias-state-business-primary:#ff6b35;--dsw-alias-label-link:#ff9469;--dsh-content-font-size:14px}
   .frame-skill{color:#d6d6d6;background:transparent;border:0;white-space:nowrap;cursor:pointer;font:inherit;font-size:12px;padding:4px 6px}.frame-native-header{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;font-size:14px;font-weight:600;border-bottom:1px solid #333}
   .frame-native-header button,.frame-media-actions button{border:1px solid #444;background:#292929;border-radius:7px;color:inherit;padding:6px 10px;font:inherit;cursor:pointer}
   .frame-media-result{margin:8px 0 14px;min-width:0}.frame-media-result strong{font-size:13px;font-weight:500}.frame-media-result img,.frame-media-result video{display:block;max-width:100%;max-height:270px;border-radius:8px;margin-top:10px}.frame-media-result audio{display:block;width:100%;margin-top:12px;height:36px}.frame-media-actions{display:flex;gap:8px;margin-top:10px;font-size:12px}.frame-media-open{position:relative;display:block;width:100%;min-height:86px;border:0;border-radius:8px;background:#242424;color:#eee;padding:0;cursor:pointer;margin-top:8px;overflow:hidden}.frame-media-open img{margin:0;width:100%;object-fit:cover}.frame-media-play{position:absolute;inset:0;display:grid;place-items:center;text-shadow:0 1px 5px #000;font-size:24px}.frame-media-open:has(img) .frame-media-play{background:#0002}.frame-receipt{font-size:11px;color:#b99b8a;padding:4px 6px}.frame-media-result p{font-size:12px;color:#aaa}
   .frame-media-batch{margin:10px 0;color:#bbb;font-size:12px}.frame-media-batch>summary{cursor:pointer;padding:7px 0}.frame-media-batch[open]>summary{margin-bottom:8px}.frame-image-open{display:block;border:0;background:transparent;padding:0;cursor:zoom-in;width:100%;text-align:left}.frame-image-open img{margin-top:8px}.frame-task-details{font-size:12px;color:#9b9b9b;margin:8px 0}.frame-task-details summary{cursor:pointer;list-style:none;display:flex;gap:7px;align-items:center}.frame-task-details summary:before{content:'›';color:#ba8c73}.frame-task-details[open] summary:before{transform:rotate(90deg)}.frame-task-details pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:11px;padding:10px;background:#171717;border-radius:8px;color:#aaa}
   [data-turn-tail]:has([data-frame-turn-pending])>[data-clock="end"]{display:none!important}
   .frame-generation-state{display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px 14px;border:1px solid #543426;border-radius:12px;background:linear-gradient(110deg,#32231c,#211d1b);font-size:12px;color:#ffc1a0;width:fit-content}.frame-progress-orbit{width:14px;height:14px;border:2px solid #72503c;border-top-color:#ff9563;border-radius:50%;animation:frame-spin 1s linear infinite}.frame-progress-dots{letter-spacing:3px;color:#b07958;animation:frame-pulse 1.5s ease-in-out infinite}@keyframes frame-spin{to{transform:rotate(360deg)}}@keyframes frame-pulse{50%{opacity:.25}}@media(prefers-reduced-motion:reduce){.frame-progress-orbit,.frame-progress-dots{animation:none}}

   `;document.head.append(style);ctx.effect(()=>()=>style.remove());
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
   ctx.slots.inject('conversation.input.model',()=>ctx.slots.register({name:'conversation.input.model',priority:-20},()=>null));
   ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'frame-reference'},()=>h('button',{className:'frame-skill',onClick:()=>parent.postMessage({type:'frame:reference'},location.origin)},'参考改编')));
   ctx.slots.inject('conversation.input.left',()=>ctx.slots.register({name:'conversation.input.left',id:'frame-motion-library'},()=>h('button',{className:'frame-skill',onClick:()=>parent.postMessage({type:'frame:motion-library'},location.origin)},'动效库')));
  }
  const onMessage=e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='frame:draft'||!session)return;const actx=ctx.sessions.scope(session);if(actx)ctx.conversation.input.for(actx).setDraft(String(e.data.text||''));};
  window.addEventListener('message',onMessage);ctx.effect(()=>()=>window.removeEventListener('message',onMessage));
  const state={value:null,listeners:new Set()};
  const acceptsState=value=>value&&(value.conversationId||project)===conversation;
  const conversationQuery='?conversationId='+encodeURIComponent(conversation||'');
  if(project&&embedded){const receive=e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='frame:state'||e.data.projectId!==project||!acceptsState(e.data.state))return;state.value=e.data.state;for(const fn of state.listeners)fn();};window.addEventListener('message',receive);parent.postMessage({type:'frame:state-request',conversationId:conversation},location.origin);ctx.effect(()=>()=>window.removeEventListener('message',receive));}
  else if(project){const events=new EventSource('/api/projects/'+encodeURIComponent(project)+'/events'+conversationQuery);events.onmessage=e=>{try{const value=JSON.parse(e.data);if(!acceptsState(value))return;state.value=value;for(const fn of state.listeners)fn();}catch{}};ctx.effect(()=>()=>events.close());}
  // A project may finish before the iframe subscribes. Bootstrap once so old
  // asynchronous tool results do not stay stuck at their submitted status.
  if(project&&embedded)Promise.all([fetch('/api/projects/'+encodeURIComponent(project)+'/progress'+conversationQuery,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('读取进度失败');return r.json();}),fetch('/api/projects/'+encodeURIComponent(project)).then(r=>{if(!r.ok)throw Error('读取素材失败');return r.json();})]).then(([chat,p])=>{if(disposedExtension||state.value||!acceptsState(chat))return;state.value={...chat,assets:p.assets};for(const fn of state.listeners)fn();}).catch(()=>{});
  // A native turn can close while its media job is still running. Keep its
  // native reply, disclosure and media slots, but defer completion chrome until
  // the whole user request (including automatic continuations) has settled.
  function useProductionCompletion(props){
   const live=React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);
   const running=props.useSession(value=>value.running);
   const firstTurn=props.useChat(snapshot=>{
    for(let i=snapshot.order.length-1;i>=0;i--){
     const node=snapshot.nodes.get(snapshot.order[i]);
     if(node?.kind==='user'&&['turn','step'].includes(node.location?.kind))return node.location.turn.turn;
    }
    return undefined;
   });
   const latestTurn=props.useChat(snapshot=>snapshot.timeline.turnOrder.at(-1));
   const turn=props.node.location?.turn;
   if(!project||props.sessionId!==session||!turn||turn.turn<firstTurn)return null;
   // Long chats can page the initiating user message out of the window. In
   // that case Frame's request start still covers every visible continuation.
   if(firstTurn===undefined&&!live?.turnStarted&&turn.turn!==latestTurn)return null;
   // A new submission may reach Frame before its user node reaches the chat.
   // Do not temporarily remove the previous request's completed controls.
   if(live?.turnStarted&&turn.end?.time<live.turnStarted)return null;
   if(live?.outcome==='stopped')return null;
   const tasks=(live?.tasks||[]).filter(task=>task.status==='running'&&(!live.turnStarted||Date.parse(task.created)>=live.turnStarted));
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
    return h(original.component,{...props,node,t});
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
     finished=true;observer.disconnect();parent.postMessage({type:'frame:chat-ready',projectId:project},location.origin);
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
  function ProductionStatus(){const live=React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);const active=(live?.tasks||[]).filter(t=>t.status==='running');const text=active.length?(active.some(t=>t.kind==='export')?'正在导出成片':'生成素材 · '+active.length+' 项'):live?.status==='waiting'?'等待后台任务':live?.status==='running'?'助手处理中':'制作进度';return h('button',{className:'frame-skill',onClick:()=>parent.postMessage({type:'frame:progress'},location.origin)},live?.production?.label||text);}
  const readableName=(value,fallback)=>{const text=String(value||'');return /[\u3400-\u9fff]/.test(text)?text.replace(/\.(mp4|mp3|wav|jpg|png|jpeg)$/i,''):fallback;};
  function Progress({text='正在生成'}){return h('div',{className:'frame-generation-state',role:'status'},h('span',{className:'frame-progress-orbit','aria-hidden':true}),h('span',null,text),h('span',{className:'frame-progress-dots','aria-hidden':true},'•••'));}
  function Failure({message}){return h('details',{className:'frame-task-details'},h('summary',null,'任务未完成'),h('pre',null,String(message||'打开制作进度查看任务状态')));}
  function MediaTool(props){
   const live=React.useSyncExternalStore(fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);},()=>state.value);
   const block=props.block;let result;try{result=JSON.parse(block.content?.filter(b=>b.type==='text').map(b=>b.text).join('')||'null');}catch{}
   if(block.isError)return h(Failure,{message:block.content?.filter(b=>b.type==='text').map(b=>b.text).join('')});
   if(result?.jobs)return h('div',null,result.jobs.map((job,i)=>h(MediaTool,{key:job.id||i,toolName:'generate_video',phase:'result',block:{content:[{type:'text',text:JSON.stringify(job)}]}})));
   const kind=props.toolName==='generate_audio'?'audio':props.toolName==='generate_image'?'image':props.toolName==='export_video'?'export':props.toolName==='build_hypit_project'?'hypit':'video';
   const roster=kind==='audio'?live?.audio:kind==='image'?live?.images:kind==='export'?live?.exports:live?.generations;
   const task=kind==='hypit'?live?.tasks?.find(x=>x.id==='hypit:'+result?.id):null;
   const job=task||roster?.find(x=>x.id===result?.id)||result;
   const renderFile=(file,type,name,src)=>{
    const label=readableName(name,({image:'生成图片',audio:'生成声音',video:'生成视频',export:'广告成片'})[type]||'创作素材');
    const asset=live?.assets?.find(a=>a.filename===file),poster=type==='export'?'/api/jobs/'+job.id+'/poster':asset?.poster?'/api/projects/'+project+'/assets/'+asset.poster:null;
    const preview=()=>{if(embedded)parent.postMessage({type:'frame:preview',file,exportId:type==='export'?job.id:undefined},location.origin);else import('/media-preview.js').then(m=>m.openMediaPreview({src,name:label,kind:type==='export'?'video':type}));};
    // Historical cards (even folded turns) never mount media decoders or hold
    // HTTP connections. The single user-opened player owns loading/playback.
    return h('div',{className:'frame-media-result',key:file||src},h('strong',null,label),h('button',{className:type==='image'?'frame-image-open':'frame-media-open',onClick:preview,'aria-label':label},type==='image'?h('img',{src,alt:label,loading:'lazy'}):h(React.Fragment,null,poster?h('img',{src:poster,alt:'',loading:'lazy'}):null,h('span',{className:'frame-media-play','aria-hidden':true},type==='audio'?'播放声音':'▶'))));
   };
   if(kind==='hypit'){const outputs=task?.result?.outputs||result?.outputs||[];const media=outputs.filter(o=>o.assetFile);if(media.length)return h('div',null,media.map(o=>renderFile(o.assetFile,/\.(png|jpe?g|webp|gif|avif)$/i.test(o.assetFile)?'image':/\.(mp3|wav|m4a|ogg|flac)$/i.test(o.assetFile)?'audio':'video',o.name,'/api/projects/'+project+'/assets/'+o.assetFile)));}
   const file=job?.assetFile||job?.filename,src=file?'/api/projects/'+project+'/assets/'+encodeURIComponent(file):kind==='export'&&job?.status==='done'?'/api/jobs/'+job.id+'/download':null;
   if(src){const asset=live?.assets?.find(a=>a.filename===file);const type=kind==='export'?'export':asset?.kind||(['image','audio','video'].includes(job.kind)?job.kind:null)||(/\.(png|jpe?g|webp|gif|avif)$/i.test(file||'')?'image':/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file||'')?'audio':kind);return renderFile(file,type,asset?.name||job.name||labels[props.toolName],src);}
   if(job?.status!=='recovering'&&job?.error||['failed','unknown','blocked','paused','interrupted'].includes(job?.status))return h(Failure,{message:job?.failure?[job.failure.message,job.failure.nextAction].join('。'):job?.error});
   if(['succeeded','done'].includes(job?.status))return null;
   const status=job?.status==='recovering'?'恢复连接':kind==='export'?'导出中':job?.status==='queued'?'排队中':'生成中';return h(Progress,{text:readableName(job?.name,labels[props.toolName]||'素材')+' · '+status});
  }
  function TurnMedia(props){
   const {turn,sessionId}=props;
   const pending=useProductionCompletion({...props,node:{location:{turn}}});
   const source=ctx.sessions.binding(sessionId)?.eventSource;
   const window=React.useSyncExternalStore(fn=>source?.subscribe(fn)||(()=>{}),()=>source?.getSnapshot());
   const calls=new Map(),results=[];
   for(const entry of window?.entries||[]){const event=entry.event;if(event.data?.turn!==turn.turn)continue;
    if(event.type==='tool/call'&&labels[event.data.name])calls.set(event.data.callId,event.data.name);
    if(event.type==='tool/result'){const message=event.data.message,name=calls.get(message.toolCallId);if(name&&!message.isError)results.push({name,block:message});}
   }
   const final=results.filter(r=>r.name==='export_video'),process=results.filter(r=>r.name!=='export_video');
   const cards=list=>list.map((r,i)=>h(MediaTool,{key:r.block.toolCallId||i,toolName:r.name,block:r.block,phase:'result'}));
   // Keep DSH's original turn-tail owner, feedback, usage and extension slots.
   // Its end-clock action row stays hidden (including keyboard/AX access)
   // only while this exact request is awaiting its final continuation.
   return h(React.Fragment,null,pending?h('span',{'data-frame-turn-pending':'',hidden:true}):null,results.length?h('div',{className:'frame-turn-media'},final.length?h('div',null,cards(final)):null,process.length?h('details',{className:'frame-media-batch'},h('summary',null,'本轮素材 · '+process.length+' 项'),cards(process)):null):null);
  }

  // Finished media lives once beside the reply. The native tool disclosure keeps
  // a compact operation row, rather than repeating every video in both places.
  function MediaActivity(props){return props.block?.isError?h(Failure,{message:props.block.content?.filter(b=>b.type==='text').map(b=>b.text).join('')}):null;}
  ctx.slots.inject('conversation.chat.turnTail',()=>ctx.slots.register({name:'conversation.chat.turnTail',id:'frame-media'},TurnMedia));
  const operations={recover_reference_plan:'接续参考分析',edit_reference_plan:'更新参考方案',apply_reference_plan:'采用参考方案',get_reference_plans:'读取参考方案',compose_video:'编排成片',sync_hypit_assets:'同步素材',rename_video_project:'修改名称',set_production_plan:'更新制作方案',organize_asset:'整理素材',checkout_hypit_project:'准备工程',commit_hypit_project:'保存剪辑',edit_hypit_project:'更新画面',read_hypit_docs:'查阅制作方法',read_hypit_project:'读取工程',get_project_context:'读取项目',get_tasks:'读取任务',prepare_hypit_speech:'对齐字幕',transcribe_media:'识别旁白',analyze_video:'审片',await_tasks:'等待素材'};
  function OperationResult(props){const text=props.block?.content?.filter(b=>b.type==='text').map(b=>b.text).join('');return props.block?.isError?h(Failure,{message:text}):text?h('details',{className:'frame-task-details'},h('summary',null,operations[props.toolName]||'制作详情'),h('pre',null,text)):null;}
  for(const name of Object.keys(operations))ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},OperationResult));
  for(const name of Object.keys(labels))ctx.slots.inject('tool.call.toolview',()=>ctx.slots.register({name:'tool.call.toolview',key:name},MediaActivity));
 }catch(error){if(disposedExtension)return;console.error('Frame native extension:',error.stack||error.message);throw error;} }
 return {inject:['slots','uiWorkspace','sessions','conversation','layout','locale'],apply};
}});
