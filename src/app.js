import {requestJSON as rawApi} from '/request.js';
import {mountStudioWorkbench} from '/studio-workbench.js';
import {mountHomeComposer} from '/home-composer.js';
import {mountConversations} from '/conversations.js';
let studioWorkbench;
let projectNavigation=0,disposeNativeChat,conversationHeader,conversationId=null,conversationNavigation=0;
const ownsConversation=(id,cid,navigation)=>project?.id===id&&conversationId===cid&&(navigation===undefined||conversationNavigation===navigation);
const conversationProgress=(id,cid)=>`/api/projects/${id}/progress?conversationId=${encodeURIComponent(cid)}`;
function api(url,method='GET',body,options){
 if(method==='POST'&&body&&typeof body==='object'&&!Array.isArray(body)&&body.conversationId===undefined&&conversationId&&project&&url.startsWith(`/api/projects/${project.id}/`))body={...body,conversationId};
 return rawApi(url,method,body,options);
}
const projectProduction=()=>productionState({...chat,tasks:chat.projectTasks||chat.tasks,exports:chat.projectExports||chat.exports,references:chat.projectReferences||chat.references},project);
import {bindPanelLayout} from '/panel-layout.js';
import {productionState} from '/production-state.js';
import {openMediaPreview} from '/media-preview.js';
import {renderNativeInspector} from '/native-view.js';
import {componentRows,renderComponents,componentDialog} from '/components-view.js';
import {audioTrackRows,renderAudioInspector,audioTrackDialog,audioGenerationDialog} from '/audio-view.js';
import {openModelSettings} from '/model-settings.js';
import {openReference} from '/reference-view.js';
import {openMotionLibrary} from '/motion-library.js';
import {updateMessages,withGenerations} from '/chat-view.js';
const $=s=>document.querySelector(s), app=$('#app');
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const brandIcon=(size=24)=>`<img class="brand-icon" src="/omnicut-mark.svg" width="${Math.round(size*386/216)}" height="${size}" alt="">`;
const icon=(name,size=18)=>`<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
let disposePanelLayout,homeComposer;let homeFiles=[],homeDraft='';
let selectedAsset=null,nativeSelectionContext=null,generationSerial='',metadataSerial=0,previewRequest=0;
let projects=[],config={},project,snapshot,selected='caption-1',tab='镜头',mode='free',frame=0,playing=false,raf,busy=false,upload,job,chat={status:'idle',messages:[]},lastChat='',poll,previewObserver,chatEvents,syncingProject=false,pendingSync=false;

function formatRatio(output){const w=output?.width||540,h=output?.height||960;const gcd=(a,b)=>b?gcd(b,a%b):a;const d=gcd(w,h);return output?w/d+':'+h/d:'';}
function toast(text,error=false){const e=$('#toast');e.textContent=text;e.className=error?'show error':'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.className='',4500);}
function icons(){window.lucide?.createIcons();}
const coverUrl=p=>{const file=p.shots?.find(s=>s.assetFile)?.assetFile,a=p.assets?.find(a=>a.filename===file);return a?`/api/projects/${p.id}/assets/${a.poster||a.filename}`:p.assets?.find(a=>a.kind==='video'&&a.poster)?`/api/projects/${p.id}/assets/${p.assets.find(a=>a.kind==='video'&&a.poster).poster}`:p.hasImage?`/api/projects/${p.id}/image`:null;};
const btn=(id,label,i,cls='')=>`<button id="${id}" aria-label="${label||({back:'返回创作空间',settings:'模型设置',previous:'上一帧',next:'下一帧',play:'播放或暂停'}[id]||id)}" class="${cls}">${i?icon(i):''}${label}</button>`;
function modes(){return '';}
function skills(){return `<div class="skills"><span class="skill active">${icon(homeFiles.some(f=>f.type.startsWith('video/'))?'film':'shopping-bag',14)} ${homeFiles.some(f=>f.type.startsWith('video/'))?'参考改编':'商品成片'}</span><button type="button" class="skill" data-reference-entry>参考改编</button></div>`;}
async function startReference(){try{if(!project){$('#home-reference-upload')?.click();return;}openReference({project,api,initialId:project.productionPlan?.referenceId,onProject:async updated=>{if(project?.id===updated.id){const changed=project.revision!==updated.revision;project=updated;renderInspector();renderDraftPlan();if(changed)queuePreview();}}});}catch(e){toast(e.message,true);}}
function bindModes(){document.querySelectorAll('[data-reference-entry]').forEach(b=>b.onclick=startReference);}
function renderHomeFiles(){const skill=$('.skills .skill.active');if(skill){skill.innerHTML=icon(homeFiles.some(f=>f.type.startsWith('video/'))?'film':'shopping-bag',14)+' '+(homeFiles.some(f=>f.type.startsWith('video/'))?'参考改编':'商品成片');icons();}}
async function home(){const navigation=++projectNavigation;++conversationNavigation;conversationHeader?.destroy();conversationHeader=null;conversationId=null;homeComposer?.destroy();homeComposer=null;disposeNativeChat?.();studioWorkbench?.destroy();studioWorkbench=null;pause();previewObserver?.disconnect();clearInterval(poll);chatEvents?.close();project=null;location.hash='';const [items,settings]=await Promise.all([api('/api/projects'),api('/api/config')]);if(navigation!==projectNavigation)return;projects=items;config=settings;renderHome();}
function initialProjectName(brief){return brief.replace(/^(?:请|帮我|给我|试着|做|制作|生成|创作|来)[\s，,]*(?:一条|一个|一个关于|一支)?/g,'').split(/[\n。！？，,]/)[0].trim().slice(0,18)||'新项目';}
function renderHome(){homeComposer?.destroy();app.innerHTML=`<div class="home-shell"><aside class="home-nav"><a class="brand" href="#">${brandIcon(24)} OmniCut</a><button class="navitem chosen">${icon('layout-grid')} 创作空间</button><div class="nav-caption">你的项目</div>${projects.slice(0,7).map(p=>`<button class="navitem project-link" data-id="${p.id}">${icon('clapperboard',16)}<span>${esc(p.name)}</span></button>`).join('')}<div class="nav-bottom">${btn('settings','模型设置','settings-2')}</div></aside><main class="home-main"><section class="entry"><h1>开始创作</h1>${modes()}<div id="create-form"><div class="home-native-composer" id="home-input"></div><input hidden id="home-reference-upload" type="file" accept="video/mp4,video/quicktime,video/webm">${skills()}</div></section><section class="projects"><div class="section-heading"><h2>最近的创作</h2><details class="project-more"><summary>更多</summary><div><button id="import-hypit" class="secondary">导入工程</button><button id="hypit-example" class="secondary">聊天动画示例</button></div></details><span>${projects.length} 个项目</span></div><div class="project-grid">${projects.map(p=>`<button class="project-card project-link" data-id="${p.id}"><div class="cover ${coverUrl(p)?'':'type-cover'}">${coverUrl(p)?`<img src="${coverUrl(p)}" alt="${esc(p.name)}商品图">`:`<strong>${esc(p.name)}</strong><span>${p.draft?'待创作':'视频项目'}</span>`}${p.draft?'':'<b>'+timeLabel(p.duration||0)+'</b>'}</div><div class="project-info"><strong>${esc(p.name)}</strong><span>${new Date(p.updated).toLocaleDateString('zh-CN')} · ${formatRatio(p.output)}</span></div></button>`).join('')||`<button class="empty-project" id="example">${icon('clapperboard',30)}<strong>开始新的创作</strong></button>`}</div></section></main></div>`;icons();bindModes();$('#settings').onclick=settings;$('#hypit-example').onclick=async()=>{try{const p=await api('/api/projects','POST',{name:'聊天动画',template:'hypit-chat'});await openProject(p.id);}catch(e){toast(e.message,true);}};bindProjectLinks();$('#example')?.addEventListener('click',()=>homeComposer?.focus());
 homeComposer=mountHomeComposer({element:$('#home-input'),api,getState:()=>({text:homeDraft,files:homeFiles,busy}),onChange:({text,files})=>{homeDraft=text;homeFiles=files;renderHomeFiles();},onSubmit:({text,files})=>{homeDraft=text;homeFiles=files;return create(initialProjectName(text),text);},onError:error=>toast(error.message,true)});
 $('#home-reference-upload').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';homeComposer.addFiles(files);};renderHomeFiles();}

async function create(name,title){
 if(busy)return;
 const brief=title?.trim();
 if(!brief||brief.length>3000){const error=brief?'创作要求请控制在 3000 字以内':'先写下你想做的视频';toast(error,true);homeComposer?.setState({text:homeDraft,files:homeFiles,busy:false,error});return;}
 busy=true;homeComposer?.setState({text:homeDraft,files:homeFiles,busy:true});
 const files=[...homeFiles],owner=homeComposer,navigation=projectNavigation;
 const ownsHome=()=>homeComposer===owner&&projectNavigation===navigation&&!project;
 try{
  const p=await api('/api/projects','POST',{name,brief});const added=[];
  for(const file of files){const r=await fetch(`/api/projects/${p.id}/assets`,{method:'POST',headers:{'X-Filename':encodeURIComponent(file.name)},body:file});const a=await r.json();if(!r.ok)throw Error(a.error);added.push(a);}
  const first=await api(`/api/projects/${p.id}/conversations`);
  const firstConversationId=first.conversations.find(item=>!item.archived)?.id;
  if(!firstConversationId)throw Error('未能创建项目对话，请重新打开项目后发送');
  if(ownsHome()){owner?.reset();homeFiles=[];homeDraft='';await openProject(p.id);}
  const source=added.find(a=>a.kind==='video'),image=added.find(a=>a.kind==='image');
  const instruction=brief+(source?'\n使用本项目已上传的参考视频改编。':'')+(image?'\n商品外观以已上传商品图为准。':'');
  await api(`/api/projects/${p.id}/chat`,'POST',{text:instruction,conversationId:firstConversationId});
 }catch(error){toast(error.message,true);}
 finally{busy=false;homeComposer?.setState({text:homeDraft,files:homeFiles,busy:false});}
}

async function sendImage(p,file){if(p.draft){const r=await fetch(`/api/projects/${p.id}/assets`,{method:'POST',headers:{'X-Filename':encodeURIComponent(file.name)},body:file});const result=await r.json();if(!r.ok)throw Error(result.error);return api('/api/projects/'+p.id);}const r=await fetch(`/api/projects/${p.id}/image`,{method:'POST',headers:{'content-type':file.type,'x-revision':p.revision},body:file});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
async function openProject(id){
 const navigation=++projectNavigation,previousConversationId=project?.id===id?conversationId:null;
 ++conversationNavigation;conversationHeader?.destroy();conversationHeader=null;conversationId=null;disposeNativeChat?.();
 try{
  selectedAsset=null;nativeSelectionContext=null;generationSerial='';metadataSerial=0;clearInterval(poll);chatEvents?.close();
  // Project data is enough to paint the workbench. Model settings, native chat
  // and progress have independent lifecycles and must not block its first frame.
  const settings=api('/api/config').then(value=>{if(navigation===projectNavigation)config=value;}).catch(()=>{});
  const loaded=await api('/api/projects/'+id);if(navigation!==projectNavigation)return;
  project=loaded;location.hash='project/'+id;snapshot=null;
  if(project.draft||project.native)tab='素材';
  if(project.template==='hypit-chat'&&['镜头','素材'].includes(tab))tab='字幕';
  selected=project.template==='product'?project.shots[0]?.captionId:project.texts[0]?.id;
  frame=0;chat={status:'idle',messages:[]};renderEditor();
  conversationHeader=mountConversations({element:$('#conversation-header'),api,projectId:id,initialId:previousConversationId,onSelect:cid=>navigation===projectNavigation?activateConversation(id,cid):undefined,onError:error=>toast(error.message,true)});
  await Promise.all([conversationHeader.ready,refreshPreview(),settings]);
 }catch(e){if(navigation===projectNavigation)toast(e.message,true);}
}
function renderEditor(){homeComposer?.destroy();homeComposer=null;disposeNativeChat?.();studioWorkbench?.destroy();studioWorkbench=null;disposePanelLayout?.();app.innerHTML=`<div class="editor ${project.draft?'is-draft':''}"><header class="editor-header"><div class="header-left">${btn('back','', 'arrow-left','icon-button')}<a class="brand small" href="#">${brandIcon(20)}OmniCut</a><span class="divider"></span><strong>${esc(project.name)}</strong><span class="pill">${formatRatio(project.output)}</span></div><div class="header-right"><span id="connection-state" role="status" hidden></span><button id="production-status" hidden></button><span id="save-state" class="muted">已保存</span><button class="secondary" data-reference-entry>参考改编</button>${btn('fork-project','创建变体','copy')}${btn('undo','撤销','undo-2')}${btn('export','导出视频','arrow-up-right','primary')}</div></header><aside class="left-panel"><div class="tabs">${(project.draft?['素材']:project.native?['素材','历史','成片']:project.template==='hypit-chat'?['字幕','历史','成片']:['镜头','图层','素材','声音','字幕','工程','历史','成片']).map(t=>`<button data-tab="${t}" class="${tab===t?'active':''}">${t}</button>`).join('')}</div><div id="inspector"></div></aside><main class="canvas-panel"><div class="canvas-toolbar"><span>画面预览</span><span class="muted">${project.draft?'':(project.output?.width||540)+' × '+(project.output?.height||960)+' · '+(project.output?.fps||30)+' 帧/秒'}</span></div><div class="preview-area">${project.draft?'<div class="draft-canvas" id="draft-plan"></div>':''}<div id="preview-fit"><div id="preview-scale"><iframe id="video-preview" title="视频画面预览" sandbox="allow-scripts allow-same-origin" allow="autoplay"></iframe></div></div><div id="preview-loading">加载中…</div></div><div class="transport"><span id="time">00:00 / ${timeLabel(project.duration||0)}</span><div>${btn('previous','','skip-back','icon-button')}${btn('play','','play','icon-button play')}${btn('next','','skip-forward','icon-button')}</div><span>适应画布</span></div><section class="timeline" id="timeline"></section></main><aside class="chat-panel native-chat"><div id="conversation-header" class="conversation-header"></div><div class="native-chat-body"><div id="messages"></div><div class="chat-bottom"><div id="selection-context"></div>${modes()}<form id="chat-form" class="composer"><textarea id="prompt" placeholder="描述你的想法…" aria-label="视频制作指令" maxlength="4000"></textarea><div class="composer-actions"><button id="send" class="send" title="发送指令" aria-label="发送指令">${icon('arrow-up')}</button><button id="stop" type="button" hidden>停止</button></div></form>${skills()}</div></div></aside></div>`;disposePanelLayout=bindPanelLayout($('.editor'));icons();bindModes();renderInspector();renderChat();$('#back').onclick=home;$('.brand.small').onclick=e=>{e.preventDefault();home();};$('#fork-project').onclick=async()=>{try{const copy=await api(`/api/projects/${project.id}/fork`,'POST',{});await openProject(copy.id);}catch(e){toast(e.message,true);}};$('#undo').onclick=undo;$('#export').onclick=exportCurrent;document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));renderInspector();});$('#play').onclick=togglePlay;$('#previous').onclick=()=>{pause();seek(frame-1);};$('#next').onclick=()=>{pause();seek(frame+1);};$('#chat-form').onsubmit=sendChat;$('#stop').onclick=()=>conversationId&&api(`/api/projects/${project.id}/stop`,'POST',{conversationId}).catch(error=>toast(error.message,true));previewObserver?.disconnect();previewObserver=new ResizeObserver(fitPreview);previewObserver.observe($('.preview-area'));if(project.native&&!project.draft)studioWorkbench=mountStudioWorkbench({project,editor:$('.editor'),onSelection:(selection,playhead)=>{nativeSelectionContext={nativeSelection:selection,playhead};syncSelection();},onSaved:()=>syncProject(project.id),onError:message=>{$('#save-state').textContent=message;}});}
function renderInspector(){if(project.draft){$('#export').disabled=true;$('#undo').disabled=!project.history.length;$('#timeline').innerHTML='';return renderNativeInspector({el:$('#inspector'),project,snapshot:null,tab:'素材',api,onRefresh:refreshNative,onSeek:seek,onDraft:nativeDraft,onAudio:openAudio,onImage:imageDialog,onVideo:()=>generationDialog(),onUpload:uploadMedia});}if(project.native&& !['历史','成片'].includes(tab)||tab==='工程'){renderTimeline();$('#undo').disabled=!project.history.length;return renderNativeInspector({el:$('#inspector'),project,snapshot,tab,api,onRefresh:refreshNative,onSeek:seek,onDraft:nativeDraft,onAudio:openAudio,onImage:imageDialog,onVideo:()=>generationDialog(),onUpload:uploadMedia}).catch(e=>toast(e.message,true));}if($('#messages'))renderChat();if(!project.texts.some(t=>t.id===selected))selected=project.shots[0]?.captionId||project.texts[0]?.id;if(project.template==='hypit-chat'&&['镜头','字幕'].includes(tab))return renderChatTemplateInspector();renderTimeline();document.querySelectorAll('[data-clip]').forEach(b=>{const t=project.texts.find(t=>t.id===b.dataset.clip);if(t)b.querySelector('span').textContent=t.text;});const text=project.texts.find(t=>t.id===selected);$('#undo').disabled=!project.history.length||busy;
 if(tab==='镜头')renderShotInspector();
 else if(tab==='图层')renderComponents({el:$('#inspector'),project,onAdd:kind=>openComponent(null,kind),onEdit:id=>openComponent(id),onAction:componentAction,onChat:id=>{const c=project.components.find(c=>c.id===id);nativeDraft('修改画面组件「'+c.name+'」（ID: '+id+'）：');}});
 else if(tab==='声音')renderAudioInspector({el:$('#inspector'),project,onGenerate:openAudio,onTrack:id=>openAudioTrack(id),onAsset:file=>project.native||project.draft?nativeDraft('把声音素材 assets/'+file+' 放入当前工程的声音轨道。'):openAudioTrack(null,file),onChat:audioToChat});
 else if(tab==='字幕')$('#inspector').innerHTML=`<div class="panel-title"><h2>文案与字幕</h2><span>${project.texts.length} 个文本</span></div><label class="text-visibility-control" for="text-visibility">画面文字<select id="text-visibility"><option value="none" ${!project.overlaysVisible?'selected':''}>不显示</option><option value="captions" ${project.overlaysVisible&&project.headingsVisible===false?'selected':''}>仅字幕</option><option value="all" ${project.overlaysVisible&&project.headingsVisible!==false?'selected':''}>字幕、品牌与标题</option></select></label><div class="text-list">${project.texts.map((t,i)=>`<button data-text="${t.id}" class="text-row ${selected===t.id?'selected':''}"><span class="text-type">${i<2?(i===0?'品牌':'标题'):'0'+(i-1)}</span><span>${esc(t.text)}</span>${selected===t.id?icon('chevron-right',14):''}</button>`).join('')}</div><form id="text-form" class="properties"><label>文本内容<textarea id="text-value" maxlength="70">${esc(text?.text)}</textarea></label><button class="secondary wide" type="submit">保存文案 ${icon('check',15)}</button><div class="property-divider"></div><div class="property-heading">字幕样式 <span>全部字幕</span></div><label>字号 <div class="number-control"><input id="font-size" type="number" min="18" max="48" value="${project.size}"><span>px</span><button id="save-size" type="button" title="应用字号">${icon('check',14)}</button></div></label><label>纵向位置 <div class="number-control"><input id="position" type="number" min="40" max="80" value="${project.y}"><span>%</span><button id="save-position" type="button" title="应用位置">${icon('check',14)}</button></div></label><div class="nudge">${btn('up','上移','arrow-up')}${btn('down','下移','arrow-down')}</div></form>`;
 else if(tab==='素材')renderAssetInspector();
 else if(tab==='成片'){ $('#inspector').innerHTML='<div class="panel-title"><h2>成片</h2></div><div id="export-list" class="asset-panel" role="status">正在读取…</div>';loadExports();}
 else $('#inspector').innerHTML=`<div class="panel-title"><h2>修改记录</h2><span>${project.history.length} 条</span></div><div class="history-list">${[...project.history].reverse().map((h,i)=>`<div class="history-row">${icon('history',16)}<div><strong>${esc(h.label)}</strong><span>${new Date(h.time).toLocaleTimeString('zh-CN')}</span></div>${i===0?'<span class="pill">最近</span>':''}</div>`).join('')||'<p class="help">暂无修改</p>'}</div>`;
 $('#text-visibility')?.addEventListener('change',e=>{const value=e.target.value;change(value==='none'?{type:'overlays',visible:false}:{type:'batch',changes:[{type:'headings',visible:value==='all'},{type:'overlays',visible:true}]});});$('#overlays-visible')?.addEventListener('change',e=>change({type:'overlays',visible:e.target.checked}));bindMediaInspector();const t=project.texts.find(x=>x.id===selected);if($('#selection-context'))$('#selection-context').innerHTML=`${icon('crosshair',14)} 当前选中 <strong>${esc(project.assets.find(a=>a.filename===selectedAsset)?.name||t?.text.slice(0,12))}</strong>`;icons();document.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>select(b.dataset.text));$('#text-form')?.addEventListener('submit',e=>{e.preventDefault();change({type:'text',id:selected,text:$('#text-value').value});});$('#save-size')?.addEventListener('click',()=>change({type:'size',size:Number($('#font-size').value)}));$('#save-position')?.addEventListener('click',()=>change({type:'position',y:Number($('#position').value)}));$('#up')?.addEventListener('click',()=>change({type:'position',y:Math.max(40,project.y-4)}));$('#down')?.addEventListener('click',()=>change({type:'position',y:Math.min(80,project.y+4)}));$('#asset-upload')?.addEventListener('change',async e=>{if(!e.target.files[0])return;try{busy=true;$('#save-state').textContent='正在校验图片…';project=await sendImage(project,e.target.files[0]);renderInspector();await refreshPreview();toast('商品图已更新');}catch(e){toast(e.message,true);}finally{busy=false;$('#save-state').textContent='已保存';}});}
function select(id){pause();selectedAsset=null;selected=id;syncSelection();const shot=project.shots?.find(s=>s.captionId===id);if(shot)seek(Math.round(shot.start*30));renderInspector();document.querySelectorAll('[data-clip]').forEach(b=>b.classList.toggle('active',b.dataset.clip===id));}
async function change(change,selectNew=false){if(busy)return;busy=true;updateShotActions();pause();$('#save-state').textContent='保存中…';try{const previous=new Set(project.shots.map(s=>s.id)),selectedIndex=Math.max(0,project.shots.findIndex(s=>s.captionId===selected));project=await api(`/api/projects/${project.id}/change`,'POST',{revision:project.revision,change});if(!project.texts.some(t=>t.id===selected))selected=project.shots[Math.min(selectedIndex,project.shots.length-1)]?.captionId;if(selectNew){const added=project.shots.find(s=>!previous.has(s.id));if(added){selected=added.captionId;frame=Math.round(added.start*30);}}renderInspector();document.querySelectorAll('[data-clip]').forEach(b=>b.querySelector('span').textContent=project.texts.find(t=>t.id===b.dataset.clip).text);queuePreview();toast('修改已保存');return true;}catch(e){toast(e.message,true);project=await api('/api/projects/'+project.id);renderInspector();}finally{busy=false;updateShotActions();$('#save-state').textContent='已保存';$('#undo').disabled=!project.history.length;}}
async function undo(){if(busy)return;busy=true;updateShotActions();pause();try{const wasNative=!!project.native;project=await api(`/api/projects/${project.id}/undo`,'POST',{revision:project.revision});if(wasNative!==!!project.native)await openProject(project.id);else{renderInspector();queuePreview();}toast('已撤销');}catch(e){toast(e.message,true);}finally{busy=false;updateShotActions();$('#undo').disabled=!project.history.length;}}
async function refreshPreview(){
 if(!project)return;if(studioWorkbench&&project.native&&!project.draft){studioWorkbench.refresh();return;}if(project.draft){renderDraftPlan();const l=$('#preview-loading');if(l)l.hidden=true;return;}const request=++previewRequest,id=project.id,revision=project.revision,loading=$('#preview-loading');if(!loading)return;loading.hidden=false;
 try{const next=await api(`/api/projects/${id}/snapshot`);if(request!==previewRequest||project?.id!==id||project.revision!==revision||!$('#video-preview'))return;snapshot=next;if(project.native){project.duration=next.space.durationSec;project.output={width:next.space.canvasWidth,height:next.space.canvasHeight,fps:next.space.frameRate.numerator/next.space.frameRate.denominator};renderInspector();$('.canvas-toolbar .muted').textContent=project.output.width+' × '+project.output.height+' · '+project.output.fps+' 帧/秒';}const iframe=$('#video-preview');iframe.onload=()=>{if(project?.id!==id)return;fitPreview();setTimeout(()=>{if(project?.id===id)seek(frame);},160);};iframe.srcdoc=snapshot.preview.srcdoc;}
 finally{if(request===previewRequest&&loading.isConnected)loading.hidden=true;}
}
function fitPreview(){if(studioWorkbench)return;const area=$('.preview-area');if(!area)return;const width=project.output?.width||540,height=project.output?.height||960;const scale=Math.min((area.clientHeight-36)/height,(area.clientWidth-50)/width);$('#preview-fit').style.width=width*scale+'px';$('#preview-fit').style.height=height*scale+'px';$('#preview-scale').style.width=width+'px';$('#preview-scale').style.height=height+'px';$('#video-preview').style.width=width+'px';$('#video-preview').style.height=height+'px';$('#preview-scale').style.transform=`scale(${scale})`;}
function seek(n){if(studioWorkbench){studioWorkbench.seek(n);return;}frame=Math.max(0,Math.min(totalFrames()-1,n));const w=$('#video-preview')?.contentWindow;w?.__hypitSeekFrame?.(frame);updatePlayhead();}
function totalFrames(){return Math.round((project?.duration||12)*(project?.output?.fps||30));}
function timeLabel(seconds){const base=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');return base+(Math.abs(seconds-Math.round(seconds))>.001?'.'+Math.floor((seconds%1)*10):'');}
function updatePlayhead(){if($('#scrub'))$('#scrub').value=frame;if($('#time'))$('#time').textContent=`${timeLabel(Math.floor(frame/(project.output?.fps||30)))} / ${timeLabel(project?.duration||12)}`;}
function pause(){playing=false;cancelAnimationFrame(raf);$('#video-preview')?.contentWindow?.__hypitSeekFrame?.(frame);if($('#play')){$('#play').innerHTML=icon('play');icons();}}
function togglePlay(){if(playing)return pause();if(frame>=totalFrames()-1)frame=0;playing=true;$('#play').innerHTML=icon('pause');icons();const start=performance.now(),initial=frame;
 function tick(t){if(!playing)return;frame=Math.min(totalFrames()-1,initial+Math.floor((t-start)*(project.output?.fps||30)/1000));$('#video-preview')?.contentWindow?.__hypitPlayFrame?.(frame);updatePlayhead();if(frame>=totalFrames()-1)return pause();raf=requestAnimationFrame(tick);}tick(start);}
function renderChat(){if($('#native-chat')||$('.chat-panel')?.classList.contains('native-chat'))return;const box=$('#messages');if(!box)return;
 const follow=box.scrollHeight-box.scrollTop-box.clientHeight<72;
 const messages=withGenerations(chat.messages,chat.generations||[],project,chat.images||[]);
 if(messages.length)updateMessages(box,messages);
 else box.innerHTML='<div class="chat-welcome"><button class="suggestion" data-prompt="介绍一下这个项目中可以编辑的内容">看看可以怎么改 ↗</button></div>';
 bindGenerationActions(box);renderExportActivity();renderReferenceActivity();
 if(follow)box.scrollTop=box.scrollHeight;
 let activity=$('#chat-activity');if(!activity){activity=document.createElement('div');activity.id='chat-activity';box.after(activity);}
 const current=chat.messages.findLast(m=>m.status==='running'||m.status==='streaming');
 activity.hidden=!['running','waiting'].includes(chat.status);activity.innerHTML='<span class="dot"></span> '+(chat.status==='waiting'?'等待任务完成':current?.role==='tool'?'正在执行工具':current?.reasoning&&!current?.text?'正在思考':current?.text?'正在回复':'正在处理');
 $('#send').hidden=chat.status==='running';$('#stop').hidden=!['running','waiting'].includes(chat.status);
 document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{$('#prompt').value=b.dataset.prompt;$('#prompt').focus();});
}
async function activateConversation(id,cid){
 if(project?.id!==id||!cid)return;
 const navigation=++conversationNavigation;conversationId=cid;
 chatEvents?.close();disposeNativeChat?.();chat={status:'idle',messages:[],projectTasks:chat.projectTasks,projectExports:chat.projectExports,projectReferences:chat.projectReferences};
 document.querySelector('.task-progress-dialog')?.remove();
 const state=$('#connection-state');if(state)state.hidden=true;
 renderProductionStatus();connectChat(id,cid,navigation);
 await mountNativeChat(id,cid,navigation);
}
function connectChat(id,cid,navigation=conversationNavigation){
 chatEvents?.close();let closed=false,timer,inFlight=false,serviceInstance=chat.serviceInstance;
 const current=()=>!closed&&ownsConversation(id,cid,navigation);
 const update=async()=>{clearTimeout(timer);if(!current()||document.hidden||inFlight)return;inFlight=true;
  try{const data=await api(conversationProgress(id,cid));if(!current())return;chat=data;
   if(serviceInstance&&data.serviceInstance&&serviceInstance!==data.serviceInstance){
    // Refresh the process-bound cookie after a restart without replacing the
    // active DSH frame or its unsent draft.
    await api(`/api/projects/${id}/native-session`,'POST',{conversationId:cid});if(!current())return;
   }
   serviceInstance=data.serviceInstance;
   $('#native-chat')?.contentWindow?.postMessage({type:'frame:state',projectId:id,conversationId:cid,state:{...chat,assets:project.assets,production:productionState(chat,project)}},location.origin);
   conversationHeader?.updateStatus(cid,data.conversation?.status||data.conversationStatus||data.status);
   conversationHeader?.refresh().catch(()=>{});
   renderChat();renderDraftPlan();renderProductionStatus();if(tab==='成片')renderExportList(chat.projectExports||chat.exports||[]);
   const next=JSON.stringify([chat.generations||[],chat.images||[],chat.audio||[],chat.projectTasks||chat.tasks||[]]);
   if(next!==generationSerial||chat.projectRevision&&chat.projectRevision!==project.revision||chat.metadataUpdated&&chat.metadataUpdated!==metadataSerial)syncProject(id);
   generationSerial=next;metadataSerial=chat.metadataUpdated;const b=$('#connection-state');if(b)b.hidden=true;
  }catch{if(current()){const b=$('#connection-state');if(b){b.hidden=false;b.textContent='连接中断 · 正在重连';}}}
  finally{inFlight=false;if(current()&&!document.hidden)timer=setTimeout(update,['running','waiting'].includes(chat.status)?1200:4000);}
 };
 const visible=()=>{if(document.hidden)clearTimeout(timer);else update();};
 document.addEventListener('visibilitychange',visible);
 chatEvents={close(){closed=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visible);}};
 // Switching closes only this view's reads. Server-side generation continues.
 update();
}
async function syncProject(id){
 if(syncingProject){pendingSync=true;return;}syncingProject=true;
 try{const latest=await api('/api/projects/'+id);if(project?.id===id){const changed=project.revision!==latest.revision,assetsChanged=JSON.stringify(project.assets)!==JSON.stringify(latest.assets);const metadataChanged=project.name!==latest.name||JSON.stringify(project.productionPlan)!==JSON.stringify(latest.productionPlan);if(changed||assetsChanged||metadataChanged){const switched=project.template!==latest.template;project=latest;$('.header-left>strong').textContent=project.name;$('.header-left>.pill').textContent=formatRatio(project.output);renderDraftPlan();if(switched){await openProject(id);return;}renderInspector();if(changed)await refreshPreview();}}}
 catch(e){toast(e.message,true);}finally{syncingProject=false;if(pendingSync){pendingSync=false;if(project)syncProject(project.id);}}
}
async function sendChat(e){e.preventDefault();const input=$('#prompt'),text=input.value.trim(),id=project.id,cid=conversationId;if(!text||!cid)return;if(!config.agentConfigured)return settings();try{await api(`/api/projects/${id}/chat`,'POST',{text,selectedId:selected,selectedAsset,mode,conversationId:cid});if(ownsConversation(id,cid)&&input.isConnected){input.value='';renderChat();}}catch(e){if(ownsConversation(id,cid))toast(e.message,true);}}
async function exportCurrent(){if(job?.status==='running')return;pause();try{job=await api(`/api/projects/${project.id}/export`,'POST',{revision:project.revision});$('#export').disabled=true;$('#export').textContent='正在渲染…';const id=job.id;const timer=setInterval(async()=>{try{job=await api('/api/jobs/'+id);if(job.status==='running')return;clearInterval(timer);if($('#export')){$('#export').disabled=false;$('#export').innerHTML='导出视频 '+icon('arrow-up-right');icons();}if(job.status==='done'){const dialog=document.createElement('dialog');dialog.innerHTML=`<div class="dialog-heading"><h2>视频已导出</h2><button class="close">${icon('x')}</button></div><p>${job.duration||12} 秒 · ${job.output?.width||project.output?.width||540} × ${job.output?.height||project.output?.height||960} · MP4</p><video src="/api/jobs/${id}/download" controls controlsList="nodownload" class="export-preview"></video>`;document.body.append(dialog);dialog.showModal();dialog.querySelector('.close').onclick=()=>dialog.remove();dialog.addEventListener('cancel',()=>dialog.remove());icons();}else toast(job.error||'导出失败',true);}catch(e){clearInterval(timer);toast(e.message,true);}},1500);}catch(e){toast(e.message,true);}}
function settings(provider){return openModelSettings({api,initialProvider:typeof provider==='string'?provider:'defaults',onSaved:value=>{config={...config,...value};}}).catch(e=>toast(e.message,true));}
document.addEventListener('keydown',e=>{if(e.code==='Space'&&project&&!document.querySelector('dialog')&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();togglePlay();}});
window.addEventListener('hashchange',()=>{const target=location.hash.match(/^#project\/(p-[a-f0-9]{12})$/)?.[1];if(target&&project?.id!==target)openProject(target);else if(!target&&project)home();});
const initial=location.hash.match(/^#project\/(p-[a-f0-9]{12})$/);if(initial)await openProject(initial[1]);else await home();

function assetUrl(asset,poster=false){return `/api/projects/${project.id}/assets/${poster&&asset.poster?asset.poster:asset.filename}`;}
function currentShot(){return project.shots.find(s=>s.captionId===selected)||project.shots[0];}
function shotLabel(id){const n=project.shots.findIndex(s=>s.id===id);return n<0?'已删除':String(n+1);}
function assetFor(shot){return project.assets.find(a=>a.filename===(shot?.assetFile||selectedAsset));}
function shotPicture(shot){const a=assetFor(shot);return a?`<button class="media-thumb" data-preview-asset="${a.filename}" aria-label="预览 ${esc(a.name)}"><img src="${assetUrl(a,true)}" alt="${esc(a.name)}"></button>`:project.hasImage?`<img src="/api/projects/${project.id}/image?v=${project.revision}" alt="商品图">`:icon('image',18);}
function renderTimeline(){if(project.native||studioWorkbench)return;
 if(project.template==='hypit-chat')return renderChatTimeline();
 const shots=project.shots||[];const total=project.duration||12;const scroll=$('.timeline-scroll')?.scrollLeft||0;
 $('#timeline').innerHTML=`<div class="timeline-heading"><strong>时间线</strong><span>${total} 秒</span></div><div class="timeline-scroll"><div class="timeline-content" style="min-width:${Math.max(shots.length*70,total*22)}px"><div class="ruler">${[0,total/4,total/2,total*3/4,total].map(n=>`<span style="left:${n/total*100}%">${timeLabel(n)}</span>`).join('')}</div>
 <div class="timeline-row"><span>${icon('film',14)} 镜头</span><div class="shot-track">${shots.map((s,i)=>`<button class="timeline-shot ${selected===s.captionId?'active':''}" data-shot="${s.id}" style="flex:${s.duration}" title="镜头 ${i+1}">${shotPicture(s)}<span>${String(i+1).padStart(2,'0')}<small>${s.duration}s</small></span></button>`).join('')}</div></div>
 <div class="timeline-row ${project.overlaysVisible?'':'text-hidden'}" title="${project.overlaysVisible?'字幕':'文字已隐藏'}"><span>${icon(project.overlaysVisible?'type':'eye-off',14)} 字幕</span><div class="caption-track">${shots.map(s=>`<button class="clip ${selected===s.captionId?'active':''}" style="flex:${s.duration}" data-clip="${s.captionId}"><span>${esc(project.texts.find(t=>t.id===s.captionId)?.text)}</span><small>${timeLabel(s.start)}</small></button>`).join('')}</div></div>
 ${project.music?`<div class="timeline-row audio-row"><span>${icon('music-2',14)} 配乐</span><div class="music-track">${esc(project.assets.find(a=>a.filename===project.music.assetFile)?.name)} · ${Math.round(project.music.gain*100)}%</div></div>`:''}
 ${audioTrackRows(project)}
 ${componentRows(project)}
 <input id="scrub" type="range" min="0" max="${Math.round(total*30)-1}" step="1" value="${Math.min(frame,Math.round(total*30)-1)}" aria-label="播放位置"></div></div>`;
 document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{tab='图层';syncTabs();renderInspector();openComponent(b.dataset.layer);});
 document.querySelectorAll('[data-audio-track]').forEach(b=>b.onclick=()=>openAudioTrack(b.dataset.audioTrack));
 if($('.timeline-scroll'))$('.timeline-scroll').scrollLeft=scroll;
 $('#scrub').oninput=e=>{pause();seek(Number(e.target.value));};
 document.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>{tab='字幕';syncTabs();select(b.dataset.clip);});
 document.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>{tab='镜头';syncTabs();select(shots.find(s=>s.id===b.dataset.shot).captionId);});
 frame=Math.min(frame,Math.round(total*30)-1);updatePlayhead();icons();
}
function syncTabs(){document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));}
function renderShotInspector(){
 const shot=currentShot(),asset=assetFor(shot),caption=project.texts.find(t=>t.id===shot.captionId);
 $('#inspector').innerHTML=`<div class="panel-title"><h2>镜头编排</h2><span>${project.shots.length} 个镜头 · ${project.duration}s</span></div>
 <div class="shot-actions" role="group" aria-label="镜头操作"><button id="add-shot" title="新增镜头" ${project.shots.length>=30?'disabled':''}>${icon('plus',14)}新增</button><button id="split-shot" title="拆分镜头" ${shot.duration<.2||project.shots.length>=30?'disabled':''}>${icon('scissors',14)}拆分</button><button id="duplicate-shot" title="复制镜头" ${project.shots.length>=30?'disabled':''}>${icon('copy',14)}复制</button><button id="move-shot-up" aria-label="前移镜头" title="前移镜头" ${project.shots[0].id===shot.id?'disabled':''}>${icon('arrow-up',14)}</button><button id="move-shot-down" aria-label="后移镜头" title="后移镜头" ${project.shots.at(-1).id===shot.id?'disabled':''}>${icon('arrow-down',14)}</button><button id="delete-shot" aria-label="删除镜头" title="删除镜头" ${project.shots.length===1?'disabled':''}>${icon('trash-2',14)}</button></div>
 <div class="shot-list">${project.shots.map((s,i)=>`<button class="shot-row ${s.id===shot.id?'selected':''}" data-select-shot="${s.captionId}"><div class="shot-thumb">${shotPicture(s)}</div><div><strong>镜头 ${String(i+1).padStart(2,'0')}</strong><span>${esc(project.texts.find(t=>t.id===s.captionId)?.text)}</span></div><small>${s.duration}s</small></button>`).join('')}</div>
 <form id="shot-form" class="shot-properties"><div class="property-heading">镜头 ${shotLabel(shot.id)}<span>${asset?.kind==='video'?'视频':asset?.kind==='image'?'图片':'商品图'}</span></div>
 <label>画面<select id="shot-asset" aria-label="镜头画面"><option value="">沿用商品图</option>${project.assets.filter(a=>a.kind!=='audio').map(a=>`<option value="${a.filename}" ${a.filename===(shot?.assetFile||selectedAsset)?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
 <button type="button" class="generate-shot" id="generate-shot">${icon('clapperboard',15)} 生成视频</button><label class="secondary upload-button" for="shot-upload">${icon('upload',14)} 导入图片 / 视频</label><input hidden type="file" id="shot-upload" accept="image/png,image/jpeg,video/mp4,video/quicktime,video/webm">
 <div class="shot-two-fields"><label>时长（秒）<input id="shot-duration" aria-label="镜头时长" type="number" min="0.1" max="180" step="0.1" value="${shot.duration}" required></label><label>画面适应<select id="shot-fit" aria-label="画面适应"><option value="cover" ${shot.fit==='cover'?'selected':''}>铺满</option><option value="contain" ${shot.fit==='contain'?'selected':''}>完整显示</option></select></label></div>
 <div id="video-options" ${asset?.kind==='video'?'':'hidden'}><label>取段起点（秒）<input id="shot-trim" aria-label="取段起点" type="number" min="0" step="0.1" value="${shot.trimStart}"></label><label class="checkbox-label"><input id="shot-audio" type="checkbox" ${shot.sourceAudio?'checked':''} ${asset?.hasAudio?'':'disabled'}>保留视频原声</label></div>
 <label>这段字幕<textarea id="shot-caption" aria-label="镜头字幕" maxlength="70" placeholder="添加字幕">${esc(caption?.text)}</textarea></label><button type="submit" class="primary wide">保存镜头</button></form>`;
}
function renderAssetInspector(){
 const audio=project.assets.filter(a=>a.kind==='audio'&&(!a.provenance?.kind||a.provenance.kind==='music'));
 $('#inspector').innerHTML=`<div class="panel-title"><h2>项目素材</h2><span>${project.assets.length} 个</span></div><div class="asset-panel"><button class="secondary wide" id="generate-image">生成图片</button><label class="secondary wide upload-button" for="library-upload">${icon('plus',15)} 导入素材</label><input hidden id="library-upload" type="file" accept=".png,.jpg,.jpeg,.mp4,.mov,.webm,.mp3,.wav,.m4a" multiple><div class="media-library">${project.assets.map(a=>`<div class="media-card">${a.kind==='audio'?`<button class="audio-thumbnail" data-preview-asset="${a.filename}" aria-label="试听 ${esc(a.name)}">${icon('music-2',24)}</button>`:`<button class="media-thumb" data-preview-asset="${a.filename}" aria-label="预览 ${esc(a.name)}"><img src="${assetUrl(a,true)}" alt="${esc(a.name)}"></button>`}<strong title="${esc(a.name)}">${esc(a.name)}</strong><span>${a.kind==='image'?'图片':a.kind==='audio'?'音频':'视频'}${a.duration?' · '+a.duration.toFixed(1)+'s':''}</span><button class="secondary" data-use-asset="${a.filename}">${a.kind==='audio'?'加入时间线':'用于镜头 '+shotLabel(currentShot().id)}</button></div>`).join('')||'<div class="library-empty">'+icon('folder-open',24)+'<span>添加图片、视频或音乐</span></div>'}</div>
 <form id="music-form" class="music-properties"><div class="property-heading">背景音乐</div><select id="music-asset" aria-label="背景音乐"><option value="">无配乐</option>${audio.map(a=>`<option value="${a.filename}" ${project.music?.assetFile===a.filename?'selected':''}>${esc(a.name)}</option>`).join('')}</select><label>音量 <output id="music-gain-label">${Math.round((project.music?.gain??.25)*100)}%</output><input id="music-gain" type="range" min="0" max="100" value="${Math.round((project.music?.gain??.25)*100)}" aria-label="配乐音量"></label><button type="submit" class="secondary wide">保存配乐</button></form></div>`;
}
async function uploadMedia(file){const response=await fetch(`/api/projects/${project.id}/assets`,{method:'POST',headers:{'content-type':'application/octet-stream','x-filename':encodeURIComponent(file.name)},body:file});const result=await response.json();if(!response.ok)throw Error(result.error);return result;}
function bindMediaInspector(){
 updateShotActions();
 $('#generate-image')?.addEventListener('click',imageDialog);
 bindAssetChat($('#inspector'));$('#inspector').querySelectorAll('[data-preview-asset]').forEach(b=>b.onclick=()=>previewAsset(b.dataset.previewAsset));
 $('#add-shot')?.addEventListener('click',()=>timelineDialog('add'));
 $('#split-shot')?.addEventListener('click',()=>timelineDialog('split'));
 $('#duplicate-shot')?.addEventListener('click',()=>change({type:'timeline',action:'duplicate',shotId:currentShot().id},true));
 $('#delete-shot')?.addEventListener('click',()=>change({type:'timeline',action:'delete',shotId:currentShot().id}));
 for(const [id,offset] of [['move-shot-up',-1],['move-shot-down',1]])$('#'+id)?.addEventListener('click',()=>{const shot=currentShot();change({type:'timeline',action:'move',shotId:shot.id,index:project.shots.indexOf(shot)+offset});});
 $('#generate-shot')?.addEventListener('click',()=>generationDialog(currentShot().id));
 document.querySelectorAll('[data-select-shot]').forEach(b=>b.onclick=()=>select(b.dataset.selectShot));
 $('#shot-asset')?.addEventListener('change',e=>{const a=project.assets.find(a=>a.filename===e.target.value);$('#video-options').hidden=a?.kind!=='video';$('#shot-audio').checked=Boolean(a?.hasAudio);$('#shot-audio').disabled=!a?.hasAudio;$('#shot-trim').value=0;});
 $('#shot-form')?.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;const shot=currentShot(),file=$('#shot-asset').value||null,a=project.assets.find(a=>a.filename===file),text=$('#shot-caption').value;
 const edits=[{type:'shot',shotId:shot.id,duration:Number($('#shot-duration').value),fit:$('#shot-fit').value,trimStart:a?.kind==='video'?Number($('#shot-trim').value):0,sourceAudio:a?.kind==='video'&&$('#shot-audio').checked}];if(file!==shot.assetFile)edits[0].assetFile=file;
 if(text!==project.texts.find(t=>t.id===shot.captionId)?.text)edits.push({type:'text',id:shot.captionId,text});await change({type:'batch',changes:edits});});
 $('#shot-upload')?.addEventListener('change',async e=>{const file=e.target.files[0];if(!file||busy)return;const shot=currentShot();busy=true;pause();$('#save-state').textContent='正在导入…';try{const asset=await uploadMedia(file);project=await api(`/api/projects/${project.id}/change`,'POST',{revision:project.revision,change:{type:'shot',shotId:shot.id,assetFile:asset.filename}});renderInspector();await refreshPreview();toast('镜头已更新');}catch(error){toast(error.message,true);project=await api('/api/projects/'+project.id);renderInspector();}finally{busy=false;$('#save-state').textContent='已保存';}});
 $('#library-upload')?.addEventListener('change',async e=>{const files=Array.from(e.target.files);if(!files.length||busy)return;busy=true;$('#save-state').textContent='正在导入…';try{for(const file of files)await uploadMedia(file);toast('素材已导入');}catch(error){toast(error.message,true);}finally{project=await api('/api/projects/'+project.id);busy=false;renderInspector();$('#save-state').textContent='已保存';}});
 document.querySelectorAll('[data-use-asset]').forEach(b=>b.onclick=()=>{const a=project.assets.find(a=>a.filename===b.dataset.useAsset);if(a.kind==='audio')openAudioTrack(null,a.filename);else change({type:'shot',shotId:currentShot().id,assetFile:a.filename});});
 $('#music-gain')?.addEventListener('input',e=>$('#music-gain-label').value=e.target.value+'%');
 $('#music-form')?.addEventListener('submit',e=>{e.preventDefault();change({type:'music',assetFile:$('#music-asset').value||null,gain:Number($('#music-gain').value)/100});});
}

async function generationDialog(shotId){
 if(document.querySelector('.generation-dialog'))return;
 pause();const projectId=project.id,shot=project.shots.find(s=>s.id===shotId),d=document.createElement('dialog');d.className='generation-dialog';d.setAttribute('aria-labelledby','generation-heading');
 config=await api('/api/config');
 const images=project.assets.filter(a=>a.kind==='image'),selectedImage=images.find(a=>a.filename===(shot?.assetFile||selectedAsset));
 let requestId=crypto.randomUUID(),timer,fetching=false,creating=false,disposed=false,lastList='';
 d.innerHTML=`<div class="dialog-heading"><div><h2 id="generation-heading">${shotId?'生成镜头 '+shotLabel(shotId):'生成视频'}</h2><span class="generation-model">${esc(config.seedanceModel||'未选择模型')}</span></div><button type="button" class="close" aria-label="关闭生成面板">${icon('x')}</button></div>
 <form class="generation-form"><label>视频服务<select name="provider"><option value="runninghub" ${config.videoProvider==='runninghub'?'selected':''}>RunningHub · H3 Enhanced</option><option value="minimax" ${config.videoProvider==='minimax'?'selected':''}>MiniMax H3</option><option value="seedance" ${config.videoProvider==='seedance'?'selected':''}>Seedance</option></select></label><div class="generation-reference" hidden></div><label>图片参考<select name="imageFile" aria-label="首帧图片"><option value="">不使用图片 · 文生视频</option>${project.hasImage?'<option value="__product__">商品图</option>':''}${images.map(a=>`<option value="${a.filename}" ${a===selectedImage?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
 <label>图片用途<select name="imageMode"><option value="reference_image">参考商品外观</option><option value="first_frame">作为首帧</option></select></label>
 <label>镜头描述<textarea name="prompt" aria-label="镜头描述" required maxlength="2000" placeholder="描述画面、动作和镜头运动…">${selectedImage||project.hasImage?'保持商品外观、颜色和形状一致，镜头缓慢推进，光线自然柔和。不要新增文字、标志或商品功能。':''}</textarea></label>
 <div class="generation-specs"><label>画面比例<select name="ratio">${["9:16","16:9","4:3","3:4","1:1"].map(r=>`<option value="${r}" ${r===(formatRatio(project.output)||"9:16")?"selected":""}>${r}</option>`).join("")}</select></label><label>生成时长<select name="duration" aria-label="生成时长">${[4,5,6,8,10,12,15].map(n=>`<option value="${n}" ${n===([4,5,6,8,10,12,15].find(n=>n>=(shot?.duration||5))||15)?'selected':''}>${n} 秒</option>`).join('')}</select></label><label>清晰度<select name="resolution" aria-label="生成清晰度"><option value="480p">480p</option><option value="720p" selected>720p</option><option value="1080p">1080p</option></select></label><label>生成方式<select name="quality"><option value="configured">当前模型</option><option value="premium">精细 · Seedance 2.0</option></select></label><label class="generation-audio"><input type="checkbox" name="audio" checked>生成声音</label></div>
 <div class="generation-submit"><a class="video-pricing" href="https://platform.minimax.cn/docs/guides/pricing-paygo" target="_blank" rel="noopener">查看计费 ${icon('arrow-up-right',12)}</a><button type="submit" class="primary" ${config.seedanceConfigured&&config.seedanceModel?'':'disabled'}>生成视频 ${icon('arrow-up-right',15)}</button></div>
 <button type="button" class="secondary wide" id="generation-settings">模型设置</button><p class="generation-feedback" role="status"></p></form>
 <section class="generation-results" aria-label="生成记录"><div class="generation-results-title">生成记录</div><div class="generation-list">正在读取…</div></section>`;
 document.body.append(d);d.showModal();icons();
 const form=d.querySelector('form'),feedback=d.querySelector('.generation-feedback'),submit=form.querySelector('[type="submit"]'),list=d.querySelector('.generation-list');
 const configured=()=>form.elements.provider.value==='runninghub'?config.runninghubConfigured:form.elements.provider.value==='minimax'?config.minimaxConfigured:config.seedanceConfigured&&config.seedanceModel;
 const updateEstimate=()=>{const mini=form.elements.provider.value==='minimax',price=form.elements.resolution.value==='2K'?.8:form.elements.resolution.value==='480P'?.33:.5;d.querySelector('.video-pricing').textContent=mini?'预计 ¥'+(Number(form.elements.duration.value)*price).toFixed(2)+' · 查看计费':'查看计费';};form.elements.duration.onchange=updateEstimate;form.elements.resolution.onchange=updateEstimate;
 const updateProvider=()=>{
  const provider=form.elements.provider.value,mini=provider==='minimax',rh=provider==='runninghub',model=rh?'Minimax H3 RH Enhanced':mini?config.minimaxVideoModel:config.seedanceModel;
  d.querySelector('.generation-model').textContent=model;
  form.elements.resolution.innerHTML=(rh?['480p','768p','1080p']:mini?(model==='MiniMax-H3-Max'?['480P','768P']:['768P','2K']):['480p','720p','1080p']).map(v=>`<option ${v===(rh?'768p':mini?'768P':'720p')?'selected':''}>${v}</option>`).join('');
  form.elements.quality.closest('label').hidden=mini||rh;form.elements.quality.value='configured';
  form.elements.audio.closest('label').hidden=mini;form.elements.audio.closest('label').lastChild.textContent=rh?'保留生成原声':'生成声音';form.elements.audio.checked=true;
  form.elements.duration.querySelector('[value="4"]').disabled=mini&&model==='MiniMax-H3-Max';if(mini&&model==='MiniMax-H3-Max'&&form.elements.duration.value==='4')form.elements.duration.value='5';
  submit.disabled=!configured();d.querySelector('.video-pricing').href=rh?'https://www.runninghub.cn/call-api/search-api/standard-model':mini?'https://platform.minimax.cn/docs/guides/pricing-paygo':'https://docs.volcengine.com/docs/ark/model-pricing';updateEstimate();
 };form.elements.provider.onchange=()=>{requestId=crypto.randomUUID();updateProvider();};updateProvider();
 const plan=project.generationPlans?.find(p=>p.shotId===shotId);if(plan){for(const key of ['prompt','imageFile','imageMode','duration','resolution'])if(form.elements[key]&&(key!=='resolution'||[...form.elements.resolution.options].some(o=>o.value===plan[key])))form.elements[key].value=String(plan[key]);form.elements.audio.checked=Boolean(plan.audio);}
 const reference=d.querySelector('.generation-reference');const updateReference=()=>{const file=form.elements.imageFile.value,a=images.find(a=>a.filename===file);reference.hidden=!file;reference.innerHTML=file?`<img src="${file==='__product__'?'/api/projects/'+projectId+'/image':'/api/projects/'+projectId+'/assets/'+(a?.poster||file)}" alt="生成首帧"><div><strong>${esc(a?.name||'商品图')}</strong><span>${form.elements.imageMode.value==='reference_image'?'商品外观参考':'首帧生视频'}</span></div>`:'';};form.elements.imageFile.onchange=updateReference;form.elements.imageMode.onchange=updateReference;updateReference();
 const close=()=>{disposed=true;clearTimeout(timer);d.remove();};d.querySelector('.close').onclick=close;d.addEventListener('cancel',close);d.querySelector('#generation-settings')?.addEventListener('click',()=>{const provider=form.elements.provider.value;close();settings(provider==='seedance'?'ark':provider);});
 const statuses={submitting:'正在提交',queued:'排队中',running:'生成中',downloading:'正在保存视频',succeeded:'已生成',recovering:'正在恢复连接',failed:'生成失败',paused:'获取中断',unknown:'提交结果未知',cancelled:'已取消',expired:'已过期'};
 async function refresh(){
  if(disposed||!d.isConnected||fetching)return;fetching=true;
  try{const all=await api(`/api/projects/${projectId}/generations`),items=all.filter(j=>shotId?j.shotId===shotId:!j.shotId),serial=JSON.stringify(items);
   submit.disabled=creating||!configured()||Boolean(shotId&&items.some(j=>['submitting','queued','running','downloading'].includes(j.status)));
   if(serial!==lastList){lastList=serial;list.innerHTML=items.length?items.map(j=>`<article class="generation-item"><div class="generation-item-heading"><strong>${esc(j.name||statuses[j.status]||j.status)}</strong><span>${statuses[j.status]||esc(j.status)} · ${j.duration}s · ${esc(j.resolution)}</span></div><details class="task-diagnostic"><summary>生成描述</summary><p class="generation-prompt">${esc(j.prompt)}</p></details>${j.status==='succeeded'?`<video controls preload="metadata" src="/api/projects/${projectId}/assets/${j.assetFile}" class="generated-preview"></video>${shotId?`<button type="button" class="primary wide" data-apply-generation="${j.id}">用于镜头 ${shotLabel(shotId)}</button>`:''}`:`${j.error?`<details class="task-diagnostic"><summary>任务未完成</summary><p>${esc(j.failure?.message||j.error)}${j.failure?.nextAction?'。'+esc(j.failure.nextAction):''}</p></details>`:''}${j.remoteId?`<button type="button" class="secondary" data-refresh-generation="${j.id}">刷新状态</button>`:''}${j.status==='unknown'?'<span class="generation-error">请先在对应服务商控制台核对任务，避免重复提交</span>':''}`}</article>`).join(''):'<div class="generation-empty">暂无生成记录</div>';
    list.querySelectorAll('[data-chat-generation]').forEach(b=>b.onclick=async()=>{await syncProject(projectId);close();const file=b.dataset.chatGeneration,a=project.assets.find(a=>a.filename===file);if(a){selectedAsset=file;syncSelection();nativeDraft('使用素材「'+a.name+'」（assets/'+file+'），');}});
    list.querySelectorAll('[data-refresh-generation]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/api/projects/${projectId}/generations/${b.dataset.refreshGeneration}/refresh`,'POST',{});lastList='';}catch(e){feedback.textContent=e.message;}finally{b.disabled=false;await refresh();}});
    list.querySelectorAll('[data-apply-generation]').forEach(b=>b.onclick=async()=>{if(busy)return;b.disabled=true;busy=true;try{const latest=await api('/api/projects/'+projectId);const updated=await api(`/api/projects/${projectId}/generations/${b.dataset.applyGeneration}/apply`,'POST',{revision:latest.revision});close();if(project?.id===projectId){project=updated;selected=shot.captionId;tab='镜头';syncTabs();renderInspector();await refreshPreview();}toast('生成视频已用于镜头 '+shotLabel(shotId));}catch(e){feedback.textContent=e.message;}finally{busy=false;b.disabled=false;}});
   }
  }catch(e){feedback.textContent=e.message;}finally{fetching=false;if(d.isConnected&&!disposed){clearTimeout(timer);timer=setTimeout(refresh,3000);}}
 }
 form.onsubmit=async e=>{e.preventDefault();if(submit.disabled||creating)return;creating=true;submit.disabled=true;feedback.textContent='正在提交…';const values=new FormData(form);
  try{const latest=await api('/api/projects/'+projectId);const result=await api(`/api/projects/${projectId}/generations`,'POST',{requestId,revision:latest.revision,shotId,autoApply:false,provider:values.get('provider'),ratio:values.get('ratio'),quality:values.get('quality'),name:shotId?'镜头 '+shotLabel(shotId):String(values.get('prompt')).slice(0,24),prompt:values.get('prompt'),imageFile:values.get('imageFile')||null,imageMode:values.get('imageMode')||'first_frame',duration:Number(values.get('duration')),resolution:values.get('resolution'),audio:values.get('audio')==='on',confirmed:true});requestId=crypto.randomUUID();feedback.textContent=result.error||'任务已提交';lastList='';}
  catch(e){feedback.textContent=e.message;}finally{creating=false;await refresh();}
 };
 await refresh();
}

function renderChatTemplateInspector(){
 renderTimeline();$('#undo').disabled=!project.history.length||busy;
 const text=project.texts.find(t=>t.id===selected)||project.texts[0];selected=text.id;
 $('#inspector').innerHTML=`<div class="panel-title"><h2>聊天动画</h2><span>${project.duration}s</span></div><label class="checkbox-label overlay-control"><input id="overlays-visible" type="checkbox" ${project.overlaysVisible?'checked':''}>显示文字</label><div class="text-list">${project.texts.map(t=>`<button class="text-row ${selected===t.id?'selected':''}" data-text="${t.id}"><span class="text-type">${esc(t.label)}</span><span>${esc(t.text)}</span></button>`).join('')}</div><form id="text-form" class="properties"><label>${esc(text.label)}<textarea id="text-value" maxlength="70">${esc(text.text)}</textarea></label><button class="secondary wide" type="submit">保存文案</button></form><form id="timing-form" class="properties"><div class="property-heading">播放节奏</div><label>总时长（秒）<input id="chat-duration" type="number" min="4" max="60" step="0.1" value="${project.duration}" required></label>${project.shots.map((s,i)=>`<label>气泡 ${i+1} 出现时间<input data-arrival type="number" min="0" max="60" step="0.1" value="${s.start}" required></label>`).join('')}<button class="secondary wide">保存节奏</button></form>`;
 if($('#selection-context'))$('#selection-context').innerHTML=`${icon('crosshair',14)} 当前选中 <strong>${esc(text.text.slice(0,12))}</strong>`;
 document.querySelectorAll('[data-text]').forEach(b=>b.onclick=()=>select(b.dataset.text));$('#text-form').onsubmit=e=>{e.preventDefault();change({type:'text',id:selected,text:$('#text-value').value});};$('#timing-form').onsubmit=e=>{e.preventDefault();change({type:'chat-timing',duration:Number($('#chat-duration').value),arrivals:[...document.querySelectorAll('[data-arrival]')].map(n=>Number(n.value))});};icons();
}

function renderChatTimeline(){
 const shots=project.shots,total=project.duration;
 $('#timeline').innerHTML=`<div class="timeline-heading"><strong>气泡进场</strong><span>${total} 秒</span></div><div class="ruler">${[0,...shots.slice(1).map(s=>s.start),total].map(n=>`<span style="left:${n/total*100}%">${timeLabel(n)}</span>`).join('')}</div><div class="timeline-row"><span>${icon('message-square',14)} 对话</span><div class="caption-track"><span style="flex:${shots[0].start}"></span>${shots.map(s=>`<button class="clip ${selected===s.captionId?'active':''}" style="flex:${s.duration}" data-clip="${s.captionId}"><span>${esc(project.texts.find(t=>t.id===s.captionId)?.text)}</span><small>${timeLabel(s.start)}</small></button>`).join('')}</div></div><input id="scrub" type="range" min="0" max="${Math.round(total*30)-1}" step="1" value="${Math.min(frame,Math.round(total*30)-1)}" aria-label="播放位置">`;
 $('#scrub').oninput=e=>{pause();seek(Number(e.target.value));};document.querySelectorAll('[data-clip]').forEach(b=>b.onclick=()=>{tab='字幕';syncTabs();select(b.dataset.clip);});frame=Math.min(frame,totalFrames()-1);updatePlayhead();icons();
}

function bindAssetChat(container){container?.querySelectorAll('[data-chat-asset]').forEach(b=>b.onclick=()=>{
 selectedAsset=b.dataset.chatAsset;const a=project.assets.find(a=>a.filename===selectedAsset);if(!a)return;
 if($('#selection-context'))$('#selection-context').innerHTML=`${icon('film',14)} <strong>${esc(a.name)}</strong><button id="clear-asset-context" type="button" aria-label="取消选中素材">×</button>`;icons();
 syncSelection();$('#clear-asset-context').onclick=()=>{selectedAsset=null;syncSelection();renderInspector();};if(nativeDraft('使用素材「'+a.name+'」，'))return;$('#prompt').focus();$('#prompt').placeholder=a.kind==='image'?'这张图片要怎么用？':'这段素材要怎么改？';
});}
function bindGenerationActions(box){
 bindAssetChat(box);
 box.querySelectorAll('[data-image-use]').forEach(b=>b.onclick=()=>change({type:'shot',shotId:currentShot().id,assetFile:b.dataset.imageUse},true));
 box.querySelectorAll('[data-chat-apply]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const latest=await api('/api/projects/'+project.id);await api(`/api/projects/${project.id}/generations/${b.dataset.chatApply}/apply`,'POST',{revision:latest.revision,shotId:project.shots.some(s=>s.id===(chat.generations||[]).find(j=>j.id===b.dataset.chatApply)?.shotId)?undefined:currentShot().id});await syncProject(project.id);}catch(e){toast(e.message,true);}finally{b.disabled=false;}});
 box.querySelectorAll('[data-chat-refresh]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api(`/api/projects/${project.id}/generations/${b.dataset.chatRefresh}/refresh`,'POST',{});}catch(e){toast(e.message,true);}finally{b.disabled=false;}});
}

function renderExportActivity(){
 let box=$('#export-activity');if(!box){box=document.createElement('div');box.id='export-activity';$('#messages').append(box);}
 const latest=chat.exports?.at(-1);box.hidden=!latest||chat.messages.some(m=>m.result?.includes('/api/jobs/'+latest.id+'/download'));
 const serial=JSON.stringify(latest);if(box.dataset.state===serial)return;box.dataset.state=serial;
 box.innerHTML=latest?`<div class="chat-export"><strong>${latest.status==='done'?'成片已就绪':latest.status==='failed'?'导出失败':'正在导出'}</strong><span>${latest.duration}s · MP4</span>${latest.status==='done'?`<a class="secondary" href="${latest.download}" download>下载成片</a>`:''}${latest.error?`<p>${esc(latest.error)}</p>`:''}</div>`:'';
}

function timelineDialog(action){
 if(busy)return;pause();const p=project.id,shot=currentShot(),revision=project.revision,dialog=document.createElement('dialog');
 dialog.className='timeline-dialog';const split=action==='split';const localTime=Math.round((frame/30-shot.start)*10)/10;
 dialog.innerHTML=`<div class="dialog-heading"><h2>${split?'拆分镜头 '+shotLabel(shot.id):'新增镜头'}</h2><button class="close" aria-label="关闭">${icon('x')}</button></div><form>${split?`<label>分割位置（镜头内秒数）<input name="splitAt" aria-label="分割位置" type="number" min="0.1" max="${Math.round((shot.duration-.1)*10)/10}" step="0.1" required value="${localTime>.09&&localTime<shot.duration?localTime:Math.max(.1,Math.floor(shot.duration*5)/10)}"></label>`:`<label>画面<select name="assetFile" aria-label="新镜头素材"><option value="">沿用商品图</option>${project.assets.filter(a=>a.kind!=='audio').map(a=>`<option value="${a.filename}">${esc(a.name)}</option>`).join('')}</select></label><label>时长（秒）<input name="duration" aria-label="新镜头时长" type="number" min="0.1" max="180" step="0.1" required value="4"></label>`}<p class="dialog-error" role="status"></p><button type="submit" class="primary wide">${split?'拆分':'添加到当前镜头之后'}</button></form>`;
 document.body.append(dialog);dialog.showModal();icons();dialog.querySelector('.close').onclick=()=>dialog.remove();dialog.addEventListener('cancel',()=>dialog.remove());
 const form=dialog.querySelector('form');if(!split)form.elements.assetFile.onchange=()=>{const a=project.assets.find(a=>a.filename===form.elements.assetFile.value);form.elements.duration.value=a?.kind==='video'?Math.floor((a.videoDuration||a.duration)*10)/10:4;};
 form.onsubmit=async e=>{e.preventDefault();if(project?.id!==p||project.revision!==revision){dialog.querySelector('.dialog-error').textContent='项目已更新，请重新打开';return;}const button=form.querySelector('[type=submit]');button.disabled=true;
 const edit=split?{type:'timeline',action,shotId:shot.id,splitAt:Number(form.elements.splitAt.value)}:{type:'timeline',action,afterShotId:shot.id,assetFile:form.elements.assetFile.value||null,duration:Number(form.elements.duration.value)};
 if(await change(edit,true))dialog.remove();else button.disabled=false;
 };
}

function updateShotActions(){
 if(project?.template!=='product')return;const shot=currentShot(),index=project.shots.indexOf(shot);
 const disabled={'add-shot':project.shots.length>=30,'split-shot':project.shots.length>=30||shot.duration<.2,'duplicate-shot':project.shots.length>=30,'move-shot-up':index===0,'move-shot-down':index===project.shots.length-1,'delete-shot':project.shots.length===1};
 for(const [id,value] of Object.entries(disabled))if($('#'+id))$('#'+id).disabled=busy||value;
}

function queuePreview(){const id=project?.id,revision=project?.revision;refreshPreview().catch(()=>{if(project?.id===id&&project?.revision===revision)toast('已保存，预览暂不可用',true);});}

function renderReferenceActivity(){
 let box=$('#reference-activity');if(!box){box=document.createElement('div');box.id='reference-activity';$('#messages').append(box);}
 const ref=chat.references?.[0];box.hidden=!ref;
 const key=JSON.stringify(ref&&[ref.id,ref.status,ref.version,ref.generations?.map(g=>g.status)]);if(box.dataset.state===key)return;box.dataset.state=key;
 const labels={preparing:'提取画面',analyzing:'拆解画面与声音',reviewing:'核对商品脚本',ready:'查看复刻方案',failed:'分析失败',interrupted:'分析中断'};
 box.innerHTML=ref?`<button class="reference-status-card" id="open-reference-status"><span>参考改编</span><strong>${esc(labels[ref.status]||ref.status)}</strong><small>${esc(ref.assetName)} ↗</small></button>`:'';
 $('#open-reference-status')?.addEventListener('click',startReference);
}

function bindProjectLinks(){
 $('#import-hypit')?.addEventListener('click',importHypitDialog);
 document.querySelectorAll('.project-link').forEach(b=>{
  b.onclick=()=>openProject(b.dataset.id);
  b.oncontextmenu=e=>{e.preventDefault();showProjectMenu(b,e.clientX,e.clientY);};
  b.onkeydown=e=>{if(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10'){e.preventDefault();const r=b.getBoundingClientRect();showProjectMenu(b,r.left+12,r.bottom);}};
 });
}
function showProjectMenu(anchor,x,y){
 document.querySelector('.project-context-menu')?.dismiss();
 const item=projects.find(p=>p.id===anchor.dataset.id);if(!item)return;
 const menu=document.createElement('div');menu.className='project-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','项目操作');menu.innerHTML='<button role="menuitem">修改名称</button>';document.body.append(menu);
 menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';
 const abort=new AbortController();const close=()=>{menu.remove();abort.abort();};menu.dismiss=close;
 menu.querySelector('button').onclick=()=>{close();renameProject(item);};
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close();},{signal:abort.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();anchor.focus();}},{signal:abort.signal});
 window.addEventListener('blur',close,{signal:abort.signal});menu.querySelector('button').focus();
}
function renameProject(item){
 const d=document.createElement('dialog');d.className='rename-dialog';d.innerHTML=`<h2>修改名称</h2><form><input name="name" aria-label="项目名称" maxlength="50" required value="${esc(item.name)}"><p class="rename-error" role="status"></p><div class="rename-actions"><button type="button" class="cancel">取消</button><button type="submit" class="primary">保存</button></div></form>`;
 document.body.append(d);d.showModal();const input=d.querySelector('input');input.focus();input.select();d.querySelector('.cancel').onclick=()=>d.remove();d.addEventListener('cancel',()=>d.remove());
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const save=d.querySelector('[type=submit]');if(save.disabled)return;save.disabled=true;try{const updated=await api(`/api/projects/${item.id}/rename`,'POST',{name:input.value,expectedName:item.name});projects=projects.map(p=>p.id===item.id?updated:p);d.remove();renderHome();}catch(error){d.querySelector('.rename-error').textContent=error.message;save.disabled=false;}};
}

async function imageDialog(){
 if(document.querySelector('.generation-dialog'))return;config=await api('/api/config');
 const d=document.createElement('dialog');d.className='generation-dialog';const projectId=project.id;
 d.innerHTML=`<div class="dialog-heading"><h2>生成图片</h2><button class="close" aria-label="关闭图片生成">×</button></div><form class="generation-form"><label>图像服务<select name="provider"><option value="musk" ${config.imageProvider==='musk'?'selected':''}>Musk API · GPT Image 2.5 Sunburst</option><option value="runninghub" ${config.imageProvider==='runninghub'?'selected':''}>RunningHub · Seedream 5 Pro</option><option value="seedream" ${config.imageProvider==='seedream'?'selected':''}>火山方舟 · Seedream</option></select></label><label>描述画面<textarea name="prompt" aria-label="图片描述" required maxlength="4000" rows="5"></textarea></label><label>参考图<select name="imageFile" aria-label="图片参考"><option value="">不使用参考图</option>${project.assets.filter(a=>a.kind==='image').map(a=>`<option value="${a.filename}" ${selectedAsset===a.filename?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label>画面比例<select name="size"><option value="1440x2560">9:16</option><option value="2560x1440">16:9</option><option value="2048x2048">1:1</option><option value="2368x1776">4:3</option><option value="1776x2368">3:4</option></select></label><label>生成方式<select name="quality"><option value="configured">当前模型</option><option value="premium">精细 · Seedream 5 Pro</option></select></label><p class="generation-feedback" role="status"></p><button class="primary" type="submit">生成图片</button></form>`;
 document.body.append(d);d.showModal();d.querySelector('.close').onclick=()=>d.remove();d.addEventListener('cancel',()=>d.remove());let requestId=crypto.randomUUID(),lastBody='';d.querySelector('[name=size]').value=({'4:3':'2368x1776','3:4':'1776x2368','16:9':'2560x1440','1:1':'2048x2048'})[formatRatio(project.output)]||'1440x2560';
 const form=d.querySelector('form');const updateImageProvider=()=>{const musk=form.elements.provider.value==='musk';form.elements.quality.closest('label').hidden=form.elements.provider.value==='runninghub';form.elements.quality.options[0].textContent=musk?'均衡':'当前模型';form.elements.quality.options[1].textContent=musk?'精细':'精细 · Seedream 5 Pro';form.elements.quality.value='configured';};form.elements.provider.onchange=updateImageProvider;updateImageProvider();
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.target,button=f.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;const values={provider:f.elements.provider.value,prompt:f.elements.prompt.value.trim(),imageFiles:f.elements.imageFile.value?[f.elements.imageFile.value]:[],size:f.elements.size.value,quality:f.elements.quality.value};const serial=JSON.stringify(values);if(lastBody&&serial!==lastBody)requestId=crypto.randomUUID();lastBody=serial;
 try{await api(`/api/projects/${projectId}/images`,'POST',{...values,requestId});d.remove();const cid=conversationId;if(project?.id===projectId&&cid){const latest=await api(conversationProgress(projectId,cid));if(ownsConversation(projectId,cid)){chat=latest;renderChat();}}}catch(err){d.querySelector('[role=status]').textContent=err.message;button.disabled=false;}};
}

async function mountNativeChat(id,cid=conversationId,navigation=conversationNavigation){
 if(!ownsConversation(id,cid,navigation))return;
 disposeNativeChat?.();
 const panel=$('.native-chat-body');if(!panel)return;
 for(const media of panel.querySelectorAll('video,audio')){media.pause();media.removeAttribute('src');media.load();}
 const frame=document.createElement('iframe');frame.id='native-chat';frame.title='项目对话';frame.dataset.conversationId=cid;
 const loading=document.createElement('div');loading.className='native-chat-loading';loading.setAttribute('role','status');loading.innerHTML='<span class="studio-loading-spinner" aria-hidden="true"></span><span>正在连接对话</span>';
 panel.replaceChildren(frame,loading);
 let timeout;
 const current=()=>ownsConversation(id,cid,navigation)&&frame.isConnected;
 const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);loading.remove();};
 const receive=e=>{if(e.origin===location.origin&&e.source===frame.contentWindow&&e.data?.type==='frame:chat-ready'&&e.data.projectId===id&&current())cleanup();};
 window.addEventListener('message',receive);disposeNativeChat=cleanup;
 timeout=setTimeout(()=>{if(!current())return;loading.innerHTML='<span>对话仍在连接</span><button class="secondary">重新连接</button>';loading.querySelector('button').onclick=()=>{cleanup();mountNativeChat(id,cid,navigation);};},20000);
 try{const result=await api('/api/projects/'+id+'/native-session','POST',{conversationId:cid});if(current()){frame.src=result.url;syncSelection();}else cleanup();}
 catch(e){cleanup();if(!current())return;frame.remove();panel.innerHTML='<div class="native-connect-error"><p>'+esc(e.message)+'</p><button id="retry-native">重新连接</button></div>';$('#retry-native').onclick=()=>mountNativeChat(id,cid,navigation);}
}
function syncSelection(){if(project&&conversationId)api('/api/projects/'+project.id+'/selection','POST',{selectedId:selected,selectedAsset,...nativeSelectionContext,mode,conversationId}).catch(()=>{});}
function nativeDraft(text){const frame=$('#native-chat');if(frame&&project&&frame.dataset.conversationId===conversationId){frame.contentWindow.postMessage({type:'frame:draft',conversationId,text},location.origin);return true;}return false;}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#native-chat')?.contentWindow||e.data?.type!=='frame:motion-library'||!project||!conversationId)return;const id=project.id,cid=conversationId,navigation=conversationNavigation;openMotionLibrary({api,projectId:id,onChoose:item=>{if(ownsConversation(id,cid,navigation))nativeDraft('使用动效库里的「'+item.name+'」，文案、颜色和素材按当前项目调整，把它加入视频并保留可编辑。');}}).catch(error=>{if(ownsConversation(id,cid,navigation))toast(error.message,true);});});
window.addEventListener('message',e=>{if(!project||!conversationId||e.origin!==location.origin||e.source!==$('#native-chat')?.contentWindow||$('#native-chat')?.dataset.conversationId!==conversationId)return;if(e.data?.type==='frame:state-request')e.source.postMessage({type:'frame:state',projectId:project.id,conversationId,state:{...chat,assets:project.assets,production:productionState(chat,project)}},location.origin);if(e.data?.type==='frame:progress')openProduction();if(e.data?.type==='frame:settings')settings();if(e.data?.type==='frame:reference')startReference();if(e.data?.type==='frame:preview'){if(e.data.exportId)openMediaPreview({src:'/api/jobs/'+e.data.exportId+'/download',name:project.name,kind:'video'});else previewAsset(e.data.file);}if(e.data?.type==='frame:asset'){const a=project.assets.find(a=>a.filename===e.data.file);if(a){selectedAsset=a.filename;syncSelection();nativeDraft('使用素材「'+a.name+'」（assets/'+a.filename+'），');}}});

function audioToChat(file){const a=project.assets.find(a=>a.filename===file);if(!a)return;selectedAsset=file;syncSelection();const text='使用声音素材「'+a.name+'」，';if(!nativeDraft(text)){$('#prompt').value=text;$('#prompt').focus();}}
async function refreshNative(){const id=project.id;const oldTemplate=project.template;project=await api('/api/projects/'+id);if(project.template!==oldTemplate){await openProject(id);return;}await refreshPreview();renderInspector();}
function openAudio(){pause();return audioGenerationDialog({project,api,onSettings:settings,onAsset:file=>project.native||project.draft?nativeDraft('把声音素材 assets/'+file+' 放入当前工程的声音轨道。'):openAudioTrack(null,file),onChat:audioToChat,onRefresh:()=>syncProject(project.id)}).catch(e=>toast(e.message,true));}
function openAudioTrack(trackId,assetFile){pause();try{audioTrackDialog({project,trackId,assetFile,api,onProject:async updated=>{if(project?.id!==updated.id)return;project=updated;tab='声音';syncTabs();renderInspector();await refreshPreview();}});}catch(e){toast(e.message,true);}}

async function saveComponent(edit){if(!await change(edit))throw Error('未能保存图层，请检查参数');}
async function openComponent(id,kind){pause();const definitions=await api('/api/components');componentDialog({project,layerId:id,component:kind,definition:definitions.find(c=>c.id===kind),onSave:saveComponent,onSeek:s=>seek(Math.round(s*30))});}
async function componentAction(id,action){const c=project.components.find(c=>c.id===id);await change(action==='visibility'?{type:'component',action:'update',id,visible:!c.visible}:{type:'component',action,id});}

function importHypitDialog(){const d=document.createElement('dialog');d.className='component-dialog';d.innerHTML=`<header class="dialog-heading"><h2>导入工程</h2><button aria-label="关闭">×</button></header><form class="properties"><label>本地工程目录<input name="directory" required placeholder="工程文件夹的完整路径"></label><label>工程文件（SVML）<input name="author" value="main.svml" required></label><label>运行配置（SVRun）<input name="run" value="render.svrun" required></label><label>成片输出<input name="target" value="final.video" required></label><p role="status"></p><button class="primary" type="submit">导入工程</button></form>`;document.body.append(d);d.showModal();d.querySelector('header button').onclick=()=>d.remove();d.addEventListener('cancel',()=>d.remove());d.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const result=await api('/api/hypit/import','POST',Object.fromEntries(new FormData(e.target)));d.remove();await openProject(result.id);}catch(e){d.querySelector('[role=status]').textContent=e.message;}};}

function previewAsset(file){const a=project?.assets.find(a=>a.filename===file);if(!a)return;pause();openMediaPreview({src:assetUrl(a),name:a.name,kind:a.kind,onChat:()=>{selectedAsset=file;syncSelection();nativeDraft('使用素材「'+a.name+'」（assets/'+file+'），');}});}
async function loadExports(){
 const id=project.id,el=$('#export-list');
 if(chat.exports?.length)renderExportList(chat.exports);
 try{const list=await api(`/api/projects/${id}/exports`);if(project?.id!==id||tab!=='成片')return;chat.projectExports=list;renderExportList(list);}
 catch(error){if(project?.id!==id||!el?.isConnected)return;const retry=document.createElement('div');retry.className='export-retry';retry.innerHTML='<p role="alert">'+esc(error.message)+'</p><button class="secondary">重新读取</button>';if(!chat.projectExports?.length)el.replaceChildren();el.querySelector('.export-retry')?.remove();el.append(retry);retry.querySelector('button').onclick=()=>{retry.remove();loadExports();};}
}
function previewExport(item){pause();openMediaPreview({src:'/api/jobs/'+item.id+'/download',name:project.name,kind:'video'});}
function renderExportList(list){
 const el=$('#export-list');if(!el)return;
 const items=[...list].sort((a,b)=>b.created.localeCompare(a.created)),latest=items.find(j=>j.status==='done'),history=items.filter(j=>j!==latest),wasOpen=el.querySelector('details')?.open;
 const row=(j,primary=false)=>`<article class="export-item ${primary?'export-latest':''}"><strong>${j.status==='done'?(primary?(j.revision===project.revision?'当前成片':'上次成片 · 工程已修改'):'历史成片'):j.status==='running'?'正在导出':'未完成的导出'}</strong>${j.status==='done'?`<button class="export-cover" data-preview-export="${j.id}" aria-label="播放${primary?'最新':'历史'}成片"><img loading="lazy" src="/api/jobs/${j.id}/poster" alt=""><span aria-hidden="true">▶</span></button>`:''}<span>${j.duration?.toFixed(1)||''} 秒 · ${j.output?.width||''} × ${j.output?.height||''}</span><span>${esc(j.changeSummary||'')}</span><time>${esc(new Date(j.created).toLocaleString('zh-CN'))}</time>${j.status!=='done'?`<details class="task-diagnostic"><summary>${j.status==='running'?'查看进度':'查看原因'}</summary><p>${esc(j.error||j.phase)}</p></details>`:''}</article>`;
 el.innerHTML=latest?row(latest,true)+(history.length?`<details class="export-history" ${wasOpen?'open':''}><summary>历史导出 · ${history.length}</summary>${history.map(j=>row(j)).join('')}</details>`:''):items.length?items.map(j=>row(j)).join(''):'<p class="help">暂无成片</p>';
 el.querySelectorAll('[data-preview-export]').forEach(b=>b.onclick=()=>previewExport(items.find(j=>j.id===b.dataset.previewExport)));
}

function renderDraftPlan(){
 const el=$('#draft-plan');if(!el||!project)return;const plan=project.productionPlan,p=projectProduction(),references=chat.projectReferences||chat.references,ref=references?.find(r=>r.id===plan?.referenceId)||references?.find(r=>r.purpose!=='quality');
 const taskRows=p.tasks.filter(t=>['image','video','audio','export'].includes(t.kind));
 const currentRows=taskRows.filter(t=>t.status!=='succeeded'),doneRows=taskRows.filter(t=>t.status==='succeeded');
 const status=t=>t.status==='succeeded'?'已完成':t.status==='running'?'制作中':['failed','blocked'].includes(t.status)?'待处理':'已停止';
 const completedOpen=el.querySelector('[data-draft-completed]')?.open;
 const live=taskRows.length?`<div class="draft-media-progress">${currentRows.map(t=>`<div><span class="task-dot ${esc(t.status)}"></span><strong>${esc(t.name||({image:'图片',video:'镜头',audio:'声音',export:'成片'})[t.kind])}</strong><small>${status(t)}</small></div>`).join('')}${doneRows.length?`<details data-draft-completed ${completedOpen?'open':''}><summary>已完成 ${doneRows.length} 项素材</summary>${doneRows.map(t=>`<div><strong>${esc(t.name||'素材')}</strong><small>已完成</small></div>`).join('')}</details>`:''}</div>`:'';
 el.innerHTML=`<div class="draft-plan-heading"><strong>${p.busy?esc(p.label):ref?'参考改编':plan?'制作方案':'创作要求'}</strong><span>${plan?plan.duration+' 秒 · '+esc(plan.ratio):esc(p.detail)}</span></div>`+(p.nextStep?`<p class="production-next">接下来 · ${esc(p.nextStep)}</p>`:'')+live+(ref?`<button class="reference-plan-launch" data-reference-entry>${ref.status==='ready'?'查看改编方案':'查看参考进度'}</button>`:plan?`<div class="draft-scene-list">${plan.scenes.map(s=>`<article><small>${s.start}–${s.end}s</small><strong>${esc(s.name)}</strong><p>${esc(s.visual)}</p>${s.voiceover?`<span>${esc(s.voiceover)}</span>`:''}</article>`).join('')}</div>${!p.busy&&!taskRows.length?'<div class="draft-plan-actions"><button class="primary" data-plan-produce>按方案制作</button><button class="secondary" data-plan-edit>调整方案</button></div>':''}`:!taskRows.length?`<p class="draft-brief">${esc(project.brief||'描述你的创作要求')}</p>`:'')+(taskRows.length?'<button class="secondary" data-draft-progress>查看制作进度</button>':'');
 el.querySelector('[data-draft-progress]')?.addEventListener('click',openProduction);
 el.querySelector('[data-reference-entry]')?.addEventListener('click',startReference);el.querySelector('[data-plan-edit]')?.addEventListener('click',()=>nativeDraft('调整当前制作方案：'));el.querySelector('[data-plan-produce]')?.addEventListener('click',async e=>{e.target.disabled=true;try{await api('/api/projects/'+project.id+'/chat','POST',{conversationId,text:'确认当前制作方案，请沿用方案与已上传素材完成视频、声音、字幕、剪辑、导出及成片检查。'});}catch(err){toast(err.message,true);e.target.disabled=false;}});
}
function renderProductionStatus(){const b=$('#production-status');if(!b)return;const p=projectProduction();b.hidden=false;b.classList.toggle('is-producing',p.busy);b.textContent=p.label+(p.detail&&p.detail.length<24?' · '+p.detail:'');b.onclick=p.currentExport&&!p.busy?()=>previewExport(p.currentExport):openProduction;renderProductionDetails();}
function openProduction(){let d=document.querySelector('.task-progress-dialog');if(d)return;d=document.createElement('dialog');d.className='task-progress-dialog';d.innerHTML='<header class="dialog-heading"><h2>制作进度</h2><button aria-label="关闭进度">×</button></header><div data-progress-body></div>';document.body.append(d);d.showModal();d.querySelector('header button').onclick=()=>d.remove();d.addEventListener('cancel',()=>d.remove());renderProductionDetails();}
function renderProductionDetails(){
 const el=document.querySelector('[data-progress-body]');if(!el)return;
 const p=projectProduction(),labels={video:'视频',image:'图片',audio:'声音',export:'成片',hypit:'工程',reference:'参考分析'},statuses={recovering:'正在恢复连接',submitting:'提交中',queued:'服务商排队中',running:'制作中',downloading:'保存素材',saving:'保存素材',paused:'查询已暂停',unknown:'提交结果待确认',interrupted:'已中断'};
 const row=t=>`<div class="task-progress-row"><strong>${esc(t.name||labels[t.kind]||t.kind)}</strong><span>${esc(statuses[t.nativeStatus]||({succeeded:t.kind==='export'?'已导出':'已完成',failed:'失败',blocked:'待处理',cancelled:'已停止'})[t.status]||'制作中')}</span>${t.error?`<details class="task-diagnostic"><summary>查看原因</summary><p>${esc(t.failure?.message||t.error)}${t.failure?.nextAction?' · '+esc(t.failure.nextAction):''}</p></details>`:''}</div>`;
 const historyOpen=el.querySelector('[data-task-history]')?.open;const doneOpen=el.querySelector('[data-task-done]')?.open;
 el.innerHTML='<ol class="production-stages">'+['构思','素材','剪辑','导出'].map((s,i)=>'<li class="'+(i<p.stage?'done':i===p.stage?'active':'')+'">'+s+'</li>').join('')+'</ol><h3>'+esc(p.label)+'</h3>'+(p.latestExport?'<button class="production-delivery" data-progress-export><img src="/api/jobs/'+p.latestExport.id+'/poster" alt=""><span><strong>'+(p.currentExport?'播放当前成片':'播放上次成片')+'</strong><small>'+p.latestExport.duration+' 秒</small></span></button>':'')+(p.detail?'<p class="muted">'+esc(p.detail)+'</p>':'')+(p.nextStep?'<p class="production-next">接下来 · '+esc(p.nextStep)+'</p>':'')+p.tasks.filter(t=>t.status!=='succeeded').map(row).join('')+(p.tasks.some(t=>t.status==='succeeded')?'<details data-task-done '+(doneOpen?'open':'')+'><summary>已完成 '+p.tasks.filter(t=>t.status==='succeeded').length+' 项</summary>'+p.tasks.filter(t=>t.status==='succeeded').map(row).join('')+'</details>':'')+(p.history.length?'<details data-task-history '+(historyOpen?'open':'')+'><summary>历史任务</summary>'+p.history.map(row).join('')+'</details>':'')+(['running','waiting'].includes(chat.status)?'<button class="secondary" data-stop-production '+(chat.stopping?'disabled':'')+'>'+(chat.stopping?'正在停止助手…':'停止助手')+'</button>':'');
 el.querySelector('[data-progress-export]')?.addEventListener('click',()=>{el.closest('dialog').remove();previewExport(p.latestExport);});
 el.querySelector('[data-stop-production]')?.addEventListener('click',async e=>{const b=e.currentTarget,id=project.id,cid=conversationId,navigation=conversationNavigation;if(!cid)return;b.disabled=true;b.textContent='正在请求停止…';try{await api('/api/projects/'+id+'/stop','POST',{conversationId:cid}, {timeout:12000});if(ownsConversation(id,cid,navigation))toast('已请求停止');}catch(error){if(ownsConversation(id,cid,navigation)){toast(error.message,true);b.disabled=false;b.textContent='重新请求停止';}}});
}
