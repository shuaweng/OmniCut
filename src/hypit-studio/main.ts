import {makeStudioReference,makePreviewReference,targetForSelection,readPanelPreferences} from './references.js';
import '../design-system.css';
import '../select.css';
const params=new URL(location.href).searchParams;
const projectId=params.get('project');
const videoId=params.get('videoId');
const loadId=params.get('loadId');
if(!/^p-[a-f0-9]{12}$/.test(projectId||''))throw Error('项目不存在');
const prefix='/__studio/projects/'+projectId+'/';
const scopedUrl=(value:string)=>{const url=new URL(value,location.href);if(videoId)url.searchParams.set('videoId',videoId);return url.pathname+url.search;};
const originalFetch=window.fetch.bind(window);
let frameRevision='',busy=0,initialError='',initialErrorStage='';
const snapshotRevisions=new Map<number,string>();
const host=(data:Record<string,unknown>)=>parent.postMessage({type:'frame:studio',projectId,...(videoId?{videoId}:{}),...(loadId?{loadId}:{}),...data},location.origin);
host({event:'loading',stage:'project'});
// Start the original Studio session while its UI bundle and locale load. Both
// consumers share this one read; project compilation is never repeated here.
let initialSession:Promise<Response>|undefined=originalFetch(scopedUrl(prefix+'session'));
void initialSession.catch(()=>{});

// All native mutations go through the same project lock, undo history and
// revision check as Agent edits. Keep Hypit's own mutation payload intact.
window.fetch=async(input,init)=>{
 const raw=input instanceof Request?input.url:String(input),url=new URL(raw,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/__studio/'))return originalFetch(input,init);
 const resource=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):url.pathname.slice('/__studio/'.length);
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
 const writing=!['GET','HEAD'].includes(method);
 if(writing){headers.set('x-frame-revision',frameRevision);busy++;host({event:'saving'});}
 const destination=scopedUrl(prefix+resource+url.search);
 try{
  const response=await (resource==='session'&&method==='GET'&&initialSession?(()=>{const pending=initialSession!;initialSession=undefined;return pending;})():originalFetch(destination,{...init,method,headers}));
  const accepted=response.headers.get('x-frame-revision');if(accepted)frameRevision=accepted;
  if(resource==='session'){
   const data=await response.clone().json();
   if(response.ok&&data.tracks){frameRevision=data.frameRevision;snapshotRevisions.set(data.revision,data.frameRevision);initialError='';}
   else{initialError=String(data.error||'剪辑工程暂时无法读取');initialErrorStage=data.stage||'project';}
  }
  // Booting /locales shares the same project compiler as /session. The
  // upstream i18n status-only exception would otherwise hide a real font,
  // audio or source diagnostic behind "Could not load Studio languages".
  if(resource==='locales'&&!response.ok){
   const data=await response.clone().json().catch(()=>({}));
   initialError=String(data.error||'工作台连接失败');initialErrorStage=data.stage||'connection';
   throw Error(initialError);
  }
  if(writing&&response.ok)host({event:'saved',revision:frameRevision});
  else if(writing)host({event:'save-error'});
  return response;
 }finally{if(writing)busy--;}
};
// OmniCut is a Chinese, dark-only product; earlier light or English picks
// from the upstream toggles must not survive their removal below.
try{localStorage.setItem('hypit-studio.language','zh-CN');localStorage.setItem('hypit-studio.theme','dark');}catch{}

// This imports the actual upstream UI, including its semantic rulers, visual
// handles, source navigation, trim/snap gestures and parameter forms.
let native:typeof import('../../engines/video/packages/studio/src/ui/main.ts');
try{native=await import('../../engines/video/packages/studio/src/ui/main.ts');}
catch(error){host({event:'load-error',stage:initialErrorStage||'connection',revision:frameRevision,message:initialError|| (error instanceof Error?error.message:'工作台连接失败')});throw error;}
await import('./shell.css');
await import('../select.css');
let lastSelection='',lastSnapshot='',refreshing=false,disconnected=false,readyReported=!initialError,previewRevision=initialError?'':frameRevision;
let updatePanels=()=>{},highlightChanges=()=>{};
let consumeBeatGuides=(_snapshot:unknown)=>{};
native.store.subscribe(({selection,playhead,snapshot})=>{
 const value=JSON.stringify(selection);
 if(value!==lastSelection){lastSelection=value;host({event:'selection',selection,frame:playhead.frame});}
 lastSnapshot=frameRevision+':'+snapshot.revision;
 updatePanels();highlightChanges();consumeBeatGuides(snapshot);
});
const current=native.store.current();
if(current)lastSnapshot=frameRevision+':'+current.snapshot.revision;

// Frame has its own project events. Refresh the native store in place; never
// reload the iframe or reset the playhead/selection for an Agent edit.
async function refresh(){
 if(refreshing||busy||document.hidden)return;
 refreshing=true;
 try{const response=await fetch('/__studio/session');const data=await response.json();
  if(response.ok&&data.tracks){const key=frameRevision+':'+data.revision;if(key!==lastSnapshot){native.applySnapshot(data);lastSnapshot=key;}consumeBeatGuides(data);previewRevision=frameRevision;host({event:'preview-ready',revision:previewRevision});if(!readyReported){readyReported=true;host({event:'ready',revision:frameRevision});}if(disconnected){disconnected=false;host({event:'connected'});}}
  else{native.applyFailure(data);host({event:'preview-error',revision:frameRevision,previewRevision,message:String(data.error||data.message||'当前修改暂时无法预览')});}
 }catch{disconnected=true;host({event:'disconnected'});}finally{refreshing=false;}
}
const toggles=document.createElement('div');toggles.className='frame-studio-toggles';
const app=document.querySelector<HTMLElement>('#app')!;
// The host owns product identity. Upstream source and license records remain
// intact; media and editing controls continue to be the original components.
app.querySelector('.topbar .brand')?.remove();
for(const element of app.querySelectorAll('.topbar .language-select,.topbar .theme-toggle'))element.remove();
// Comments are replaced at the host surface; existing feedback files remain.
app.querySelector('.view-tabs')?.remove();
for(const element of app.querySelectorAll('.comments-panel,.comments-handle'))element.remove();
if(location.hash==='#comments'){history.replaceState(null,'',location.pathname+location.search);window.dispatchEvent(new HashChangeEvent('hashchange'));}
app.querySelector<HTMLElement>('.studio-shell')!.dataset.view='studio';
let developerMode=params.get('developer')==='1';
let preferences={source:false,properties:true};
try{preferences=readPanelPreferences(localStorage);}catch{}
const savePreferences=()=>{try{localStorage.setItem('omnicut.studio.panels.v1',JSON.stringify(preferences));}catch{}};
const sourceButton=document.createElement('button');sourceButton.type='button';sourceButton.textContent='源码';
const propertyButton=document.createElement('button');propertyButton.type='button';propertyButton.textContent='属性';
sourceButton.onclick=()=>{preferences.source=!preferences.source;savePreferences();updatePanels();};
propertyButton.onclick=()=>{preferences.properties=!preferences.properties;savePreferences();updatePanels();};
toggles.append(sourceButton,propertyButton);
const referenceButton=document.createElement('button');referenceButton.type='button';referenceButton.className='frame-reference-button';referenceButton.textContent='引用到对话';
referenceButton.title='选中片段后引用；按住 Shift 拖动时间线可选取范围';
toggles.append(referenceButton);
updatePanels=()=>{
 const selected=native.store.current()?.selection.kind!=='none'&&Boolean(native.store.current());
 const source=developerMode&&preferences.source,properties=selected&&preferences.properties;
 const changed=app.dataset.source!==(source?'open':'closed')||app.dataset.properties!==(properties?'open':'closed');
 app.dataset.source=source?'open':'closed';app.dataset.properties=properties?'open':'closed';app.dataset.developer=String(developerMode);
 sourceButton.hidden=!developerMode;propertyButton.hidden=!selected;
 sourceButton.setAttribute('aria-pressed',String(source));propertyButton.setAttribute('aria-pressed',String(properties));
 if(changed)window.dispatchEvent(new Event('resize'));
};updatePanels();
document.querySelector('.topbar-right')?.prepend(toggles);
const timeline=app.querySelector<HTMLElement>('.timeline')!;
timeline.dataset.frameReferences='true';
// The host keeps one project undo history. This seat only moves its existing
// action next to the native timeline and mirrors its availability.
const undoButton=document.createElement('button');undoButton.type='button';undoButton.className='frame-timeline-undo';undoButton.textContent='撤销';undoButton.setAttribute('aria-label','撤销');undoButton.disabled=true;undoButton.onclick=()=>host({event:'undo'});
timeline.querySelector('.timeline-tools')?.append(undoButton);
type BeatBinding={id:string;clipId:string;analysisId:string;assetFile:string;sourceOrigin:number;enabled:boolean};
type BeatClip={id:string;name:string;audio:{timelineStart:number;trimStart:number;playbackRate:number;sourceAssetPath?:string}};
type BeatAnalysis={id:string;assetFile:string;assetName?:string;bpm:number|null;stale?:boolean;confidence:number};
type BeatData={videoId:string;revision:string;bindings:BeatBinding[];clips:BeatClip[];guides:Array<{frame:number;kind:'beat'|'downbeat'|'accent-candidate';confidence?:number}>;warnings:string[]};
let beatData:BeatData|undefined,lastBeatSnapshotData:BeatData|undefined,beatAnalyses:BeatAnalysis[]=[],beatAssets:Array<{filename:string;name:string}>=[],beatDialog:HTMLDialogElement|undefined;
const beatPrefsKey='omnicut.studio.beats.'+projectId+'.'+(videoId||'v-default');
let beatPrefs={visible:true,snap:false};try{beatPrefs={...beatPrefs,...JSON.parse(localStorage.getItem(beatPrefsKey)||'{}')};}catch{}
const publishBeatGuides=()=>{
 const state=native.store.current(),valid=state&&beatData?.videoId===(videoId||'v-default')&&beatData.revision===snapshotRevisions.get(state.snapshot.revision);
 timeline.dispatchEvent(new CustomEvent('studio:beat-guides',{detail:{revision:state?.snapshot.revision,guides:valid?beatData!.guides:[],visible:beatPrefs.visible,snap:beatPrefs.snap}}));
};
consumeBeatGuides=value=>{
 const data=value as {beatGuides?:BeatData};if(data?.beatGuides&&data.beatGuides!==lastBeatSnapshotData&&data.beatGuides.videoId===(videoId||'v-default')){beatData=data.beatGuides;lastBeatSnapshotData=data.beatGuides;}
 publishBeatGuides();
};consumeBeatGuides(native.store.current()?.snapshot);
const beatButton=document.createElement('button');beatButton.type='button';beatButton.textContent='拍点';beatButton.title='将音乐节拍绑定到实际音频片段';toggles.append(beatButton);
const beatRequest=async(action:string,body?:Record<string,unknown>)=>{
 const response=await originalFetch(scopedUrl('/api/projects/'+projectId+(action?'/'+action:'')),body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);
 const data=await response.json();if(!response.ok)throw Error(data.error||'节拍操作失败');return data;
};
beatButton.onclick=async()=>{
 if(beatDialog){beatDialog.showModal();return;}
 const dialog=document.createElement('dialog');dialog.className='frame-beat-dialog';dialog.innerHTML=`<form method="dialog" class="frame-beat-heading"><strong>音乐拍点</strong><button type="submit" aria-label="关闭">×</button></form><p>拍点来自音乐分析，随音轨移动和裁切同步。</p><label>音频片段<select data-beat-clip></select></label><label>音乐素材<select data-beat-asset></select></label><label>节拍分析<select data-beat-analysis></select></label><p data-beat-placement></p><div data-beat-origin hidden><label>原素材对应当前音源 0 秒的位置<input data-beat-source type="number" min="0" step="0.001" value="0"></label><label class="frame-beat-check"><input data-beat-confirm type="checkbox">已确认同一音频素材和源起点</label><small>仅适用于裁切、未额外变速的派生音源。填入原素材秒数；其他处理请先分析实际使用的音源。</small></div><div class="frame-beat-options"><label class="frame-beat-check"><input data-beat-visible type="checkbox">显示拍点</label><label class="frame-beat-check"><input data-beat-snap type="checkbox">吸附拍点</label></div><p data-beat-message role="status"></p><details><summary>分析说明</summary><p data-beat-warnings></p></details><div class="frame-beat-actions"><button type="button" data-beat-analyze>分析音乐</button><button type="button" data-beat-bind>绑定音轨</button><button type="button" data-beat-disable>移除参考</button></div>`;
 document.body.append(dialog);beatDialog=dialog;dialog.showModal();dialog.addEventListener('close',()=>{dialog.remove();beatDialog=undefined;});
 dialog.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!.onclick=event=>{event.preventDefault();event.stopPropagation();dialog.close();};
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}});
 const clips=dialog.querySelector<HTMLSelectElement>('[data-beat-clip]')!,assets=dialog.querySelector<HTMLSelectElement>('[data-beat-asset]')!,analyses=dialog.querySelector<HTMLSelectElement>('[data-beat-analysis]')!,message=dialog.querySelector<HTMLElement>('[data-beat-message]')!,warnings=dialog.querySelector<HTMLElement>('[data-beat-warnings]')!,placement=dialog.querySelector<HTMLElement>('[data-beat-placement]')!,origin=dialog.querySelector<HTMLElement>('[data-beat-origin]')!,source=dialog.querySelector<HTMLInputElement>('[data-beat-source]')!,confirmed=dialog.querySelector<HTMLInputElement>('[data-beat-confirm]')!,visible=dialog.querySelector<HTMLInputElement>('[data-beat-visible]')!,snap=dialog.querySelector<HTMLInputElement>('[data-beat-snap]')!,analyze=dialog.querySelector<HTMLButtonElement>('[data-beat-analyze]')!,bind=dialog.querySelector<HTMLButtonElement>('[data-beat-bind]')!,disable=dialog.querySelector<HTMLButtonElement>('[data-beat-disable]')!;
 const options=(select:HTMLSelectElement,items:Array<{id:string;name:string;disabled?:boolean}>,value='')=>{select.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.disabled=!!item.disabled;select.append(option);}if(items.some(item=>item.id===value))select.value=value;};
 const clipName=(clip:BeatClip)=>{if(/[\u3400-\u9fff]/.test(clip.name))return clip.name;const file=clip.audio.sourceAssetPath?.replace(/^assets\//,''),asset=beatAssets.find(item=>item.filename===file);return asset?.name?asset.name.replace(/^音效[_-]*/,'').replace(/\.[a-z0-9]+$/i,'')+' · '+clip.audio.timelineStart.toFixed(1)+'s':clip.name;};
 const chosenClip=()=>beatData?.clips.find(clip=>clip.id===clips.value);
 const updateAnalyses=()=>{const old=analyses.value;options(analyses,beatAnalyses.filter(item=>item.assetFile===assets.value).map(item=>({id:item.id,name:item.stale?'素材或版本已改变，请重新分析':item.bpm?`${item.bpm} BPM${item.confidence<.6?' · 仅供参考':''}`:'起音参考 · 速度未确认',disabled:item.stale})),old);bind.disabled=!clips.value||!analyses.value;};
 const updateClip=()=>{const clip=chosenClip(),binding=beatData?.bindings.find(item=>item.clipId===clip?.id);if(!clip){placement.textContent='请先把音乐放到时间线上。';origin.hidden=true;return;}
  placement.textContent=`时间线 ${clip.audio.timelineStart.toFixed(3)}s 开始 · 音源裁切 ${clip.audio.trimStart.toFixed(3)}s · ${clip.audio.playbackRate.toFixed(3)} 倍速`;
  const file=clip.audio.sourceAssetPath?.startsWith('assets/')?clip.audio.sourceAssetPath.slice(7):undefined;if(file&&beatAssets.some(asset=>asset.filename===file))assets.value=file;else if(binding)assets.value=binding.assetFile;
  origin.hidden=Boolean(file);source.value=String(binding?.sourceOrigin??0);confirmed.checked=false;disable.disabled=!binding?.enabled;updateAnalyses();
 };
 visible.checked=beatPrefs.visible;snap.checked=beatPrefs.snap;
 const preference=()=>{beatPrefs={visible:visible.checked,snap:snap.checked};try{localStorage.setItem(beatPrefsKey,JSON.stringify(beatPrefs));}catch{}publishBeatGuides();};visible.onchange=preference;snap.onchange=preference;
 clips.onchange=updateClip;assets.onchange=updateAnalyses;
 const transaction=async(fn:()=>Promise<void>)=>{analyze.disabled=bind.disabled=disable.disabled=true;try{await fn();}catch(error){message.textContent=error instanceof Error?error.message:'节拍操作失败';}finally{analyze.disabled=!assets.value;updateAnalyses();disable.disabled=!beatData?.bindings.some(item=>item.clipId===clips.value&&item.enabled);}};
 analyze.onclick=()=>void transaction(async()=>{if(!assets.value)throw Error('请选择实际音乐素材');message.textContent='正在本地分析音乐…';await beatRequest('beats',{assetFile:assets.value});beatAnalyses=await beatRequest('beats');updateAnalyses();message.textContent='分析完成，请确认音频片段后绑定。';});
 const bindInput=(enabled:boolean)=>({revision:frameRevision,analysisId:enabled?analyses.value:beatData?.bindings.find(item=>item.clipId===clips.value)?.analysisId,assetFile:assets.value,clipId:clips.value,enabled,...(!origin.hidden?{sourceOrigin:Number(source.value),confirmedSource:confirmed.checked}:{}),...(videoId?{videoId}:{})});
 bind.onclick=()=>void transaction(async()=>{message.textContent='正在绑定…';beatData=await beatRequest('beat-guides',bindInput(true));publishBeatGuides();warnings.textContent=beatData!.warnings.join(' ');message.textContent=beatData!.guides.length?'拍点已绑定，音轨移动和裁切后会重新映射。':beatData!.warnings.join(' ')||'当前取段内没有分析拍点。';});
 disable.onclick=()=>void transaction(async()=>{const binding=beatData?.bindings.find(item=>item.clipId===clips.value);if(!binding)throw Error('此片段没有节拍参考');beatData=await beatRequest('beat-guides',{...bindInput(false),assetFile:binding.assetFile,sourceOrigin:binding.sourceOrigin,confirmedSource:true});publishBeatGuides();message.textContent='已移除该音轨的拍点参考。';});
 try{message.textContent='正在读取音乐与时间线…';const [data,records,project]=await Promise.all([beatRequest('beat-guides'),beatRequest('beats'),beatRequest('')]);if(!dialog.isConnected)return;beatData=data;beatAnalyses=records;beatAssets=(project.assets||[]).filter((asset:{kind:string})=>asset.kind==='audio');options(clips,data.clips.map((clip:BeatClip)=>({id:clip.id,name:clipName(clip)})),native.store.current()?.selection.kind==='clip'?(native.store.current()!.selection as {clipId:string}).clipId:'');options(assets,beatAssets.map(asset=>({id:asset.filename,name:asset.name})));updateClip();publishBeatGuides();warnings.textContent=data.warnings.join(' ');message.textContent=!data.clips.length?'请先把音乐放到时间线上。':!records.length?'先分析音乐，再绑定音频片段。':data.guides.length?'拍点已绑定。':data.warnings.join(' ')||'确认音乐素材和片段后绑定。';analyze.disabled=!assets.value;}
 catch(error){message.textContent=error instanceof Error?error.message:'节拍信息读取失败';}
};
type HostChangeSet={id:string;undone?:boolean;videos:Array<{videoId:string;revision:string;changes:Array<{entityId?:string}>}>};
let pendingHighlight:HostChangeSet|undefined,lastHighlight='';
highlightChanges=()=>{
 const current=native.store.current(),change=pendingHighlight;if(!current||!change||change.undone||!Array.isArray(change.videos))return;
 const video=change.videos.find(item=>item.videoId===(videoId||'v-default'));
 if(!video||video.revision!==snapshotRevisions.get(current.snapshot.revision)||!Array.isArray(video.changes))return;
 const ids=new Set(video.changes.map(item=>item.entityId).filter((id):id is string=>typeof id==='string'&&!!id)),key=change.id+':'+video.revision;
 if(key===lastHighlight)return;lastHighlight=key;
 for(const node of timeline.querySelectorAll<HTMLElement>('[data-clip],[data-semantic-segment],[data-semantic-selection],[data-semantic-token],[data-semantic-moment]')){
  const entity=node.dataset.clip||node.dataset.semanticSegment||node.dataset.semanticSelection||node.dataset.semanticToken||node.dataset.semanticMoment;
  if(!entity||!ids.has(entity))continue;
  node.classList.add('frame-change-highlight');node.dataset.frameChangeRevision=key;
  setTimeout(()=>{if(node.dataset.frameChangeRevision===key){node.classList.remove('frame-change-highlight');delete node.dataset.frameChangeRevision;}},2200);
 }
};

let referenceRange:Record<string,unknown>|null=null,referenceMenu:HTMLElement|undefined;
const closeReferenceMenu=()=>{referenceMenu?.remove();referenceMenu=undefined;};
const showReferenceMenu=(items:Array<{label:string;reference:Record<string,unknown>|null}>,x:number,y:number)=>{
 closeReferenceMenu();if(!items.some(item=>item.reference))return;
 const menu=document.createElement('div');menu.className='frame-reference-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','引用到对话');
 for(const item of items){
  const action=document.createElement('button');action.type='button';action.setAttribute('role','menuitem');action.textContent=item.label;action.disabled=!item.reference;
  action.onclick=()=>{if(item.reference)host({event:'reference',references:[item.reference]});closeReferenceMenu();};menu.append(action);
 }
 document.body.append(menu);menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';referenceMenu=menu;
 menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
 menu.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
  const actions=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],at=actions.indexOf(document.activeElement as HTMLButtonElement);
  actions[event.key==='Home'?0:event.key==='End'?actions.length-1:(at+(event.key==='ArrowDown'?1:-1)+actions.length)%actions.length]?.focus();
 });
};
const displayedReference=(target:Record<string,unknown>|null)=>{
 const current=native.store.current();const reference=current?makeStudioReference(current.snapshot,snapshotRevisions.get(current.snapshot.revision)||'',target):null;return reference?{...reference,videoId:videoId||'v-default'}:null;
};
const publishReference=(target:Record<string,unknown>|null)=>{
 const reference=displayedReference(target);if(!reference)return;
 host({event:'reference',references:[reference]});closeReferenceMenu();
};
referenceButton.onclick=()=>{
 const target=referenceRange?{kind:'range',...referenceRange}:targetForSelection(native.store.current()?.selection);
 if(target)publishReference(target);else app.querySelector('.stage')?.dispatchEvent(new CustomEvent('studio:preview-reference-request'));
};
timeline.addEventListener('studio:reference-selection',event=>{referenceRange=(event as CustomEvent).detail||null;});
timeline.addEventListener('studio:reference-menu',event=>{
 const {target,x,y}=(event as CustomEvent).detail;showReferenceMenu([{label:'引用到对话',reference:displayedReference(target)}],x,y);
});
const previewStage=app.querySelector<HTMLElement>('.stage');if(previewStage)previewStage.dataset.frameReferences='true';
app.addEventListener('studio:preview-reference-menu',event=>{
 const {snapshot,frame,x,y}=(event as CustomEvent).detail,revision=snapshotRevisions.get(snapshot?.revision)||'';
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 const items=[['moment','引用这一刻'],['visual','引用画面'],['audio','引用声音'],['caption','引用字幕']].map(([facet,label])=>{
  const reference=makePreviewReference(snapshot,revision,frame,facet);return {label,reference:reference?{...reference,videoId:videoId||'v-default'}:null};
 });
 showReferenceMenu(items,x,y);
});
app.addEventListener('studio:preview-pointerdown',closeReferenceMenu);
document.addEventListener('pointerdown',event=>{if(!referenceMenu?.contains(event.target as Node))closeReferenceMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeReferenceMenu();});
window.addEventListener('blur',closeReferenceMenu);

// The native resize handle still controls the timeline's budget. Cap its used
// height to the actual rows, so short projects return space to the preview.
const studioShell=app.querySelector<HTMLElement>('.studio-shell')!;
const timelineBody=timeline.querySelector<HTMLElement>('[data-timeline-body]')!;
const timelineRows=timeline.querySelector<HTMLElement>('[data-rows]')!;
const timelineLabels=timeline.querySelector<HTMLElement>('[data-labels]')!;
let timelineLayoutFrame=0;
const updateTimelineScrollHints=()=>{
 timelineBody.dataset.frameScrollUp=String(timelineBody.scrollTop>1);
 timelineBody.dataset.frameScrollDown=String(timelineBody.scrollTop+timelineBody.clientHeight<timelineBody.scrollHeight-2);
};
const fitTimelineToContent=()=>{
 timelineLayoutFrame=0;
 const chrome=Array.from(timeline.querySelectorAll<HTMLElement>(':scope > .timeline-toolbar,:scope > .timeline-zoom')).reduce((height,node)=>height+node.offsetHeight,0);
 const ruler=timeline.querySelector<HTMLElement>('[data-ruler]')?.offsetHeight||22;
 const rowHeight=Math.max(timelineRows.offsetHeight,timelineLabels.offsetHeight-ruler);
 const contentHeight=Math.ceil(chrome+ruler+rowHeight+2);
 const budget=Number.parseFloat(getComputedStyle(studioShell).getPropertyValue('--timeline-height'))||350;
 const available=Math.max(chrome+ruler+32,studioShell.clientHeight-268);
 const height=Math.min(contentHeight,budget,available);
 const value=`${Math.ceil(height)}px`;
 if(studioShell.style.getPropertyValue('--frame-timeline-height')!==value)studioShell.style.setProperty('--frame-timeline-height',value);
 timelineBody.dataset.frameOverflow=String(contentHeight>height+2);
 updateTimelineScrollHints();
};
const scheduleTimelineLayout=()=>{if(!timelineLayoutFrame)timelineLayoutFrame=requestAnimationFrame(fitTimelineToContent);};
const timelineResizeObserver=new ResizeObserver(scheduleTimelineLayout);
for(const node of [studioShell,timelineRows,timelineLabels])timelineResizeObserver.observe(node);
new MutationObserver(scheduleTimelineLayout).observe(timelineRows,{childList:true,subtree:true});
// Native dragging changes --timeline-height; it remains a preference, rather
// than forcing empty rows to stretch to that preference.
new MutationObserver(scheduleTimelineLayout).observe(studioShell,{attributes:true,attributeFilter:['style']});
window.addEventListener('resize',scheduleTimelineLayout);
timelineBody.addEventListener('scroll',updateTimelineScrollHints,{passive:true});
scheduleTimelineLayout();
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.projectId!==projectId)return;
 if(event.data.type==='frame:changes'&&(!event.data.videoId||event.data.videoId===videoId)){pendingHighlight=event.data.changeSet;highlightChanges();}
 if(event.data.type==='frame:studio-refresh')void refresh();
 if(event.data.type==='frame:studio-seek')native.store.seek(event.data.frame,'timeline');
 if(event.data.type==='frame:studio-config'){developerMode=event.data.developerMode===true;undoButton.disabled=event.data.canUndo!==true;updatePanels();}
});
// Fallback when a source file is edited by the code workspace rather than UI.
setInterval(refresh,2500);
host(initialError?{event:'load-error',stage:initialErrorStage||'project',revision:frameRevision,message:initialError}:{event:'ready',revision:frameRevision});
