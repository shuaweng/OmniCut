import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../harness/frame-ui/client.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({refresh=async()=>{},embedded=false,search='?frame=1&session=parent',chat,nativeEvents=[],responses={}}={}){
 const cleanups=[],styles=[],listeners=new Set(),opened=[],entries=[],messageListeners=new Set(),requests=[],events=[];
 const previewTypes=[],parentMessages=[],commands=[],triggerSources=[];
 let plugin,active='previous',navigation=new AbortController(),expanded=true,focusCount=0;
 const emit=()=>{for(const listener of [...listeners])listener();};
 const nativeLineage={options:{name:'conversation.session.header.lineage'},component:()=>null};
 const nativeCatalog={options:{name:'conversation.session.header.actions',id:'subagent-catalog',order:-30},component:()=>null};
 entries.push(nativeLineage,nativeCatalog);
 const documentElement={dataset:{}};
 // The native '/' catalog: host commands and other plugins' contributions.
 const nativeCommands=[{name:'file',section:'添加'},{name:'feedback',section:'添加'},{name:'compact',label:'压缩',section:'指令'},{name:'permission',section:'指令'},{name:'model',section:'指令'},{name:'export',section:'指令'}];
 const commandUi={register:entry=>{commands.push(entry);return()=>commands.splice(commands.indexOf(entry),1);},async candidates(_session,{query}){const rows=[...nativeCommands,...commands.map(entry=>({name:entry.name,label:entry.label(),section:'指令'}))];return query===''?rows:rows.filter(row=>row.name.includes(query)||row.label?.includes(query));}};
 const ctx={
  inject:(_names,fn)=>fn(ctx),
  get:name=>name==='commandUi'?commandUi:undefined,
  effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);},
  sessions:{
   refresh,
   binding:()=>({eventSource:{getSnapshot:()=>({entries:nativeEvents})}}),
   list:{getSnapshot:()=>({phase:'ready',byId:Object.fromEntries(['parent','child','grandchild','previous'].map(id=>[id,{id,retainedBy:{mainView:id===active?1:0}}]))}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}},
  },
  layout:{beginNavigation:()=>{navigation.abort();navigation=new AbortController();return navigation.signal;}},
  sidebarRight:{mounted:{getSnapshot:()=>active},isExpanded:()=>expanded,toggleExpanded:()=>{expanded=!expanded;}},
  sidebarRightTabs:{register:definition=>{previewTypes.push(definition);return()=>previewTypes.splice(previewTypes.indexOf(definition),1);}},
  uiWorkspace:{openSession:target=>{opened.push(target);active=typeof target==='string'?target:target.childSessionId;emit();}},
  locale:{addLanguage:()=>()=>{},register:()=>()=>{},bind:()=>key=>({'section.add':'添加'})[key]||key,getLocale:()=>({active:'zh-Hans-x-frame'})},
  inputTriggers:{registerSource:source=>{triggerSources.push(source);return()=>triggerSources.splice(triggerSources.indexOf(source),1);}},
  slots:{
   inject:(_name,fn)=>fn(),
   entries:name=>entries.filter(entry=>entry.options.name===name),
   register:(options,component)=>{const entry={options,component};entries.push(entry);return()=>entries.splice(entries.indexOf(entry),1);},
  },
 };
 const window={addEventListener:(name,fn)=>{if(name==='message')messageListeners.add(fn);},removeEventListener:(name,fn)=>{if(name==='message')messageListeners.delete(fn);},__ModuleLoader__:{load:({factory})=>{plugin=factory(()=>({createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_subscribe,get)=>get(),useEffect:effect=>effect(),useMemo:fn=>fn()}));}}};
 const parent=embedded?{postMessage:data=>parentMessages.push(data)}:window;
 vm.runInNewContext(source,{
  window,parent,location:{origin:'http://frame.test',search},
  document:{documentElement,querySelector:selector=>selector.includes('[contenteditable=')?{focus:()=>{focusCount++;}}:null,createElement:()=>({remove(){}}),head:{append:style=>styles.push(style)}},
  fetch:async url=>{requests.push(url);const hit=Object.entries(responses).find(([prefix])=>url.startsWith(prefix));return {ok:true,json:async()=>hit?hit[1]:url.includes('/progress')?chat:{assets:[]}};},
  EventSource:class{constructor(url){this.url=url;events.push(this);}close(){}},
  URLSearchParams,AbortSignal,console,queueMicrotask,
 });
 return {ctx,plugin,triggerSources,entries,nativeLineage,nativeCatalog,opened,styles,emit,requests,events,previewTypes,parentMessages,commands,commandUi,documentElement,message(data){for(const fn of messageListeners)fn({origin:'http://frame.test',source:parent,data});},productionLabel(){return renderNodes(turnView(this)).find(node=>node.props?.className==='frame-generation-state')?.children[1]?.children[0];},get active(){return active;},get expanded(){return expanded;},get focusCount(){return focusCount;},get signal(){return navigation.signal;},dispose(){for(const cleanup of cleanups.reverse())cleanup();}};
}

test('嵌入会话只覆盖启动恢复，原生子代理导航及返回不被拉回',async()=>{
 const f=fixture(),startup=f.signal;
 await f.plugin.apply(f.ctx);
 assert.equal(startup.aborted,true,'取消 DSH 尚未完成的启动恢复');
 assert.equal(f.active,'parent');
 assert.deepEqual(f.opened,['parent']);
 const child={parentSessionId:'parent',childSessionId:'child',mode:'continuable'};
 const grandchild={parentSessionId:'child',childSessionId:'grandchild',mode:'one-shot'};
 for(const target of [child,grandchild,'child','parent']){
  f.ctx.uiWorkspace.openSession(target);
  f.emit();
  await flush();
  assert.equal(f.active,typeof target==='string'?target:target.childSessionId);
 }
 assert.deepEqual(f.opened,['parent',child,grandchild,'child','parent']);
 f.dispose();
});

test('项目页保留原生子代理谱系和目录，制作进度作为独立动作追加',async()=>{
 const f=fixture();
 await f.plugin.apply(f.ctx);
 assert.deepEqual(f.entries.filter(entry=>entry.options.name==='conversation.session.header.lineage'),[f.nativeLineage]);
 const actions=f.entries.filter(entry=>entry.options.name==='conversation.session.header.actions');
 assert.ok(actions.includes(f.nativeCatalog));
 assert.ok(actions.some(entry=>entry.options.id==='frame-production-status'));
 f.dispose();
});

test('会话刷新期间卸载 iframe 不再执行迟到的导航',async()=>{
 let finish;
 const refresh=new Promise(resolve=>{finish=resolve;});
 const f=fixture({refresh:()=>refresh});
 const applying=f.plugin.apply(f.ctx);
 f.dispose();finish();await applying;
 assert.deepEqual(f.opened,[]);
});

test('嵌入页初始进度携带对话 ID，拒绝父页面发来的其他对话状态',async()=>{
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation',chat:{conversationId:'conversation',status:'waiting'}});
 await f.plugin.apply(f.ctx);await flush();
 assert.ok(f.requests.includes('/api/projects/project/progress?conversationId=conversation&videoId=v-default'));
 assert.equal(f.productionLabel(),'等待素材完成');
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'other',status:'running'}});
 assert.equal(f.productionLabel(),'等待素材完成');
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'conversation',status:'running'}});
 assert.equal(f.productionLabel(),'正在处理中');
 f.dispose();
});

test('独立对话页事件流携带对话 ID，拒绝不匹配的事件',async()=>{
 const f=fixture({search:'?frame=1&session=parent&project=project&conversation=conversation'});
 await f.plugin.apply(f.ctx);
 assert.equal(f.events[0].url,'/api/projects/project/events?conversationId=conversation&videoId=v-default');
 f.events[0].onmessage({data:JSON.stringify({conversationId:'conversation',status:'waiting'})});
 f.events[0].onmessage({data:JSON.stringify({conversationId:'other',status:'running'})});
 assert.equal(f.productionLabel(),'等待素材完成');
 f.events[0].onmessage({data:JSON.stringify({conversationId:'conversation',status:'running'})});
 assert.equal(f.productionLabel(),'正在处理中');
 f.dispose();
});

const recordedTool=(name,id,args,result)=>[
 {event:{type:'tool/call',data:{turn:1,callId:id,name,arguments:JSON.stringify(args)}}},
 {event:{type:'tool/result',data:{turn:1,message:{toolCallId:id,content:[{type:'text',text:JSON.stringify(result)}]}}}},
];

test('媒体查看器只认真实工具绑定的完整路径，成片路由至父页面并收起原生栏',async()=>{
 const nativeEvents=[...recordedTool('stage_export','stage-one',{jobId:'export-one'},{file:'input/已验证.mp4',id:'export-one',status:'done'}),...recordedTool('stage_asset','asset-one',{assetFile:'asset.png'},{file:'input/random-asset.png'})];
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project',nativeEvents});
 await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'project',assets:[{filename:'asset.png'}]}});
 const viewer=f.previewTypes.find(type=>type.id==='frame-project-media'),address='dsh-resource://file/session/parent/input/'+encodeURIComponent('已验证.mp4');
 assert.equal(viewer.canOpen(address),true);
 assert.equal(viewer.canOpen('dsh-resource://file/session/parent/input/random-asset.png'),true);
 for(const other of ['dsh-resource://file/session/parent/guessed/已验证.mp4','dsh-resource://file/session/child/input/已验证.mp4','dsh-resource://file/session/parent/input/unknown.mp4','dsh-resource://file/session/parent/input/%ZZ'])assert.equal(viewer.canOpen(other),false,other);
 let closed=0;
 f.entries.find(entry=>entry.options.key==='frame-project-media').component({useTabInfo:()=>({tab:{contentId:address,visible:true,signal:new AbortController().signal,navigation:{revision:1},actions:{close:()=>{closed++;}}}})});
 await flush();
 assert.equal(closed,1);assert.equal(f.expanded,false);assert.equal(f.focusCount,1);
 assert.deepEqual(JSON.parse(JSON.stringify(f.parentMessages.at(-1))),{projectId:'project',conversationId:'project',videoId:'v-default',type:'frame:preview',exportId:'export-one'});
 assert.deepEqual(f.opened,['parent'],'没有重建或切走原生对话');
 f.dispose();assert.equal(f.previewTypes.length,0);
});

test('未知文件仍使用原生查看器，返回对话动作在fullscreen预览上方且恢复输入焦点',async()=>{
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project'});
 await f.plugin.apply(f.ctx);
 assert.equal(f.previewTypes[0].canOpen('dsh-resource://file/session/parent/source.txt'),false);
 const button=f.entries.find(entry=>entry.options.id==='frame-preview-return').component();
 assert.equal(button.children[0],'返回对话');button.props.onClick();await flush();
 assert.equal(f.expanded,false);assert.equal(f.focusCount,1);
 const styles=f.styles.map(style=>style.textContent).join('\n');
 assert.match(styles,/\[data-shell-overlay\]\{z-index:80;pointer-events:none\}/);
 assert.match(styles,/:has\(\[data-sidebar-right-open\]\) \.frame-preview-return/);
 assert.ok(!f.parentMessages.some(message=>message.type==='frame:preview'));
 f.dispose();
});

test('导出、状态查询和stage_export合并为同jobId的一张可播放成片卡',async()=>{
 const nativeEvents=[...recordedTool('export_video','export',{}, {id:'job-one',status:'running'}),...recordedTool('get_export_status','status',{jobId:'job-one'},{id:'job-one',status:'done'}),...recordedTool('stage_export','stage',{jobId:'job-one'},{id:'job-one',status:'done',file:'input/exact.mp4'})];
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project',nativeEvents});
 await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'project',status:'idle',exports:[{id:'job-one',status:'done'}]}});
 const turn={turn:1,end:{time:2}},snapshot={order:[],nodes:new Map(),timeline:{turnOrder:[1]}};
 const view=f.entries.find(entry=>entry.options.id==='frame-media').component({turn,sessionId:'parent',useSession:select=>select({running:false}),useChat:select=>select(snapshot)});
 const buttons=[];
 const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(walk);if(typeof node.type==='function')return walk(node.type(node.props));if(node.type==='button')buttons.push(node);node.children?.forEach(walk);};
 walk(view);const previewButtons=buttons.filter(button=>button.props.className==='frame-media-open');assert.equal(previewButtons.length,1);previewButtons[0].props.onClick();
 assert.equal(f.parentMessages.at(-1).exportId,'job-one');
 f.dispose();
});


function renderNodes(value){
 const nodes=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node))return node.forEach(walk);if(typeof node.type==='function')return walk(node.type(node.props));nodes.push(node);node.children?.forEach(walk);};walk(value);return nodes;
}
function turnView(f,number=1,latest=number){const snapshot={order:[],nodes:new Map(),timeline:{turnOrder:[latest]}};return f.entries.find(entry=>entry.options.id==='frame-media').component({turn:{turn:number,end:{time:2}},sessionId:'parent',useSession:select=>select({running:false}),useChat:select=>select(snapshot)});}

test('真实帧缩略图引用保留来源视频、分数帧率和revision并追加已有引用',async()=>{
 const preview={previewId:'pv-exact',projectId:'project',videoId:'v-default',revision:'frozen',nativeRevision:'native',frames:[{frame:30,at:1.001,frameRate:{numerator:30000,denominator:1001},url:'/real-preview/frame.png',label:'00:01.00'}]};
 const nativeEvents=recordedTool('preview_frames','frames',{},preview),f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation',nativeEvents});await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'conversation',status:'idle',inputReferences:[{id:'previous',videoId:'v-default'}]}});
 const nodes=renderNodes(turnView(f)),images=nodes.filter(node=>node.type==='img');assert.equal(images.length,1);assert.equal(images[0].props.src,'/real-preview/frame.png');
 const reference=nodes.find(node=>node.type==='button'&&String(node.props['aria-label']||'').startsWith('引用'));assert.ok(reference);reference.props.onClick();
 const message=JSON.parse(JSON.stringify(f.parentMessages.at(-1)));assert.equal(message.type,'frame:references-add');assert.equal(message.references.length,1);
 assert.deepEqual(message.references[0].frameRate,{numerator:30000,denominator:1001});assert.equal(message.references[0].startFrame,30);assert.equal(message.references[0].endFrameExclusive,31);assert.equal(message.references[0].revision,'frozen');assert.equal(message.references[0].nativeRevision,'native');assert.equal(message.references[0].videoId,'v-default');
 f.dispose();
});

test('当前turnId预览只追加至最新轮，历史预览仍从原生tool/result读取',async()=>{
 const frame=label=>({frame:3,at:.1,url:'/preview/'+label+'.png',label});
 const nativeEvents=recordedTool('preview_frames','historic',{}, {previewId:'old',frames:[frame('old')],revision:'old'}),f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation',nativeEvents});await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'conversation',status:'idle',turnId:'current',visualPreviews:[{previewId:'old',turnId:'current',conversationId:'conversation',frames:[frame('old')]},{previewId:'new',turnId:'current',conversationId:'conversation',frames:[frame('new')]},{previewId:'foreign',turnId:'current',conversationId:'other',frames:[frame('foreign')]},{previewId:'prior',turnId:'prior',conversationId:'conversation',frames:[frame('prior')]}]}});
 assert.deepEqual(renderNodes(turnView(f,1,2)).filter(node=>node.type==='img').map(node=>node.props.src),['/preview/old.png']);
 assert.deepEqual(renderNodes(turnView(f,2,2)).filter(node=>node.type==='img').map(node=>node.props.src),['/preview/new.png']);f.dispose();
});

test('真实导出阶段与帧数出现在成片等待卡及任务详情',async()=>{
 const nativeEvents=recordedTool('export_video','export',{}, {id:'job-one',status:'running'}),f=fixture({embedded:true,search:'?frame=1&session=parent&project=project',nativeEvents});await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'project',status:'waiting',tasks:[{id:'export:job-one',kind:'export',status:'running',name:'手机广告'}],projectExports:[{id:'job-one',status:'running',progress:{phase:'渲染画面',framesCompleted:152,framesTotal:600}}]}});
 const text=renderNodes(turnView(f)).flatMap(node=>node.children||[]).filter(value=>typeof value==='string').join(' ');assert.match(text,/渲染画面 · 152\/600 帧/);f.dispose();
});

test('素材入口进入原生加号菜单，子代理不误用父会话素材目标',async()=>{
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation'});
 await f.plugin.apply(f.ctx);
 assert.deepEqual(f.commands.map(command=>command.label()),['素材库','参考视频','动效库']);
 for(const command of f.commands){assert.equal(command.available({sessionId:'parent'}),true);assert.equal(command.available({sessionId:'child'}),false);}
 f.commands[1].ui.run({sessionId:'parent'});
 assert.deepEqual(JSON.parse(JSON.stringify(f.parentMessages.at(-1))),{projectId:'project',conversationId:'conversation',videoId:'v-default',type:'frame:reference'});
 for(const id of ['frame-library','frame-reference','frame-motion-library'])assert.ok(!f.entries.some(entry=>entry.options.id===id),'不重复占用输入框底部');
 const menu=async query=>[...(await f.commandUi.candidates({sessionId:'parent'},{query}))].map(row=>[row.name,row.section].filter(Boolean).join(':'));
 assert.deepEqual(await menu(''),['omnicut-assets:添加','omnicut-reference:添加','omnicut-motion:添加','compact:指令'],'创作者只看到素材入口和压缩');
 assert.deepEqual(await menu('o'),['compact:指令','omnicut-assets:指令','omnicut-reference:指令','omnicut-motion:指令'],'搜索也不露出模型、权限、日志等命令');
 f.documentElement.dataset.frameDeveloper='true';
 assert.equal((await menu('')).length,9,'开发者模式保留原生全部命令');
 f.dispose();assert.equal(f.commands.length,0);assert.equal(Object.hasOwn(f.commandUi,'candidates'),false,'卸载后恢复原生菜单');
});

test('@ 只列本项目素材、素材库与动效，发送时换成工具可用的真实 ID',async()=>{
 const responses={'/api/projects/project?videoId=':{name:'可口可乐',assets:[{filename:'early.jpg',name:'可口可乐·早到素材.jpg',kind:'image'}]},'/api/library':[{id:'lib-1',name:'夏日海浪.mp4',kind:'video'},{id:'lib-2',name:'海风.mp3',kind:'audio'}],'/api/motion-library':[{id:'frame--brand-reveal@1.0.0',name:'轻盈揭幕',category:'品牌文字',tags:['片尾'],poster:{kind:'image'}},{id:'frame--bars@1.0.0',name:'柱形生长',category:'数据图表'}]};
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation',responses});await f.plugin.apply(f.ctx);
 const early=await f.triggerSources[0].candidates({sessionId:'parent'},{query:'',signal:new AbortController().signal});assert.equal(early[0].name,'早到素材','工作台状态未到时直接读取项目素材');
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'conversation',status:'idle',videoName:'可口可乐',assets:[{filename:'a.mp4',name:'可口可乐·成片.mp4',kind:'video',created:'2026-10-09T10:00:00Z'},{filename:'b.mp4',name:'可口可乐·成片.mp4',kind:'video',created:'2026-10-09T11:00:00Z'},{filename:'c.jpg',name:'拉环特写.jpg',kind:'image',poster:'c.preview.jpg',created:'2026-10-08T10:00:00Z'},{filename:'h.jpg',name:'隐藏',kind:'image',hidden:true}]}});
 assert.equal(f.triggerSources.length,1);const source=f.triggerSources[0];assert.equal(source.trigger,'@');
 const signal=new AbortController().signal,all=await source.candidates({sessionId:'parent'},{query:'',signal});
 assert.deepEqual([...all].map(item=>item.section+':'+item.name),['本项目素材:成片','本项目素材:成片','本项目素材:拉环特写','素材库:夏日海浪','素材库:海风','动效:轻盈揭幕','动效:柱形生长']);
 assert.equal(JSON.parse(all[0].value).id,'b.mp4','新素材在前');assert.match(all[0].description,/视频/);assert.notEqual(all[0].description,all[1].description,'同名素材以时间区分');
 assert.ok(!all.some(item=>/文件|对话|子智能体/.test(item.section||'')));
 const filtered=await source.candidates({sessionId:'parent'},{query:'片尾',signal});assert.deepEqual([...filtered].filter(item=>item.section==='动效').map(item=>item.name),['轻盈揭幕']);
 const serialized=[];for(const item of [all[2],all[3],all[5]]){const outcome=source.onPick({candidate:item,action:'pick'});assert.equal(outcome.insert.source,source.name);assert.equal(outcome.insert.label,item.name);assert.equal(source.codec.clipboardText(outcome.insert.ref),'@'+item.name);serialized.push(await source.codec.serialize(outcome.insert.ref,signal));}
 assert.match(serialized[0],/本项目素材「拉环特写」.*assetFile: c\.jpg/);
 assert.match(serialized[1],/素材库「夏日海浪」.*assetId: lib-1.*use_library_asset/);
 assert.match(serialized[2],/动效库「轻盈揭幕」.*componentId: frame--brand-reveal@1\.0\.0.*get_motion_component/);
 f.dispose();assert.equal(f.triggerSources.length,0);
});

test('工作步骤用创作说法：路径换成素材名、时间点或剪辑工程，开发者模式保持原样',async()=>{
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project'});
 for(const key of ['read_image','read','write','edit','bash'])f.entries.push({options:{name:'tool.call.toolview',key},locale:'conversation',component:()=>null});
 await f.plugin.apply(f.ctx);
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'project',videoName:'夏日',assets:[{filename:'aa11.jpg',kind:'image',name:'夏日·镜3·开罐特写'}]}});
 const row=key=>f.entries.find(entry=>entry.options.name==='tool.call.toolview'&&entry.options.key===key&&entry.options.priority===-20);
 const shown=(key,args,meta)=>{const block={kind:'result',call:{name:key,argsRaw:JSON.stringify(args)},...(meta?{meta}:{})},view=row(key).component({block,openFile:()=>{}});return {args:JSON.parse(view.props.block.call.argsRaw),meta:view.props.block.meta,openFile:view.props.openFile,same:view.props.block===block};};
 const picture=shown('read_image',{file_path:'/ws/p/hypit/assets/aa11.jpg'},{path:'/ws/p/hypit/assets/aa11.jpg'});
 assert.equal(picture.args.file_path,'镜3·开罐特写','对上项目素材时显示素材名，去掉视频名前缀');
 assert.equal(picture.meta.path,'镜3·开罐特写','看图卡片的标签同样不露路径');
 assert.equal(picture.openFile,undefined,'换成说明后不再当文件路径打开');
 assert.equal(shown('read_image',{file_path:'/ws/p/hypit/analysis/frames/h-5.0.jpg'}).args.file_path,'5 秒处画面');
 assert.equal(shown('read_image',{file_path:'/ws/p/work/g1b_grid.jpg'}).args.file_path,'画面拼图');
 assert.equal(shown('read',{file_path:'/ws/p/hypit/main.svml'}).args.file_path,'剪辑工程');
 assert.equal(shown('write',{file_path:'/ws/p/videos/v/production-notes.md',content:'x'}).args.file_path,'制作笔记');
 assert.equal(shown('edit',{file_path:'/ws/p/hypit/packages/scenes/src/anim.js',old_string:'a',new_string:'b'}).args.file_path,'动效代码');
 const shell=shown('bash',{command:'ffmpeg -i a.mp4 out.jpg'});
 assert.equal(shell.args.description,'后台处理','没有说明的命令不直接露出命令行');assert.equal(shell.args.command,'ffmpeg -i a.mp4 out.jpg','展开后的原生命令卡片保持原样');
 f.documentElement.dataset.frameDeveloper='true';
 assert.equal(shown('read',{file_path:'/ws/p/hypit/main.svml'}).same,true,'开发者模式原样显示');
 f.dispose();
});
