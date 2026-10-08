import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../harness/frame-ui/client.js',import.meta.url),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture({refresh=async()=>{},embedded=false,search='?frame=1&session=parent',chat}={}){
 const cleanups=[],styles=[],listeners=new Set(),opened=[],entries=[],messageListeners=new Set(),requests=[],events=[];
 let plugin,active='previous',navigation=new AbortController();
 const emit=()=>{for(const listener of [...listeners])listener();};
 const nativeLineage={options:{name:'conversation.session.header.lineage'},component:()=>null};
 const nativeCatalog={options:{name:'conversation.session.header.actions',id:'subagent-catalog',order:-30},component:()=>null};
 entries.push(nativeLineage,nativeCatalog);
 const ctx={
  effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);},
  sessions:{
   refresh,
   list:{getSnapshot:()=>({phase:'ready',byId:Object.fromEntries(['parent','child','grandchild','previous'].map(id=>[id,{id,retainedBy:{mainView:id===active?1:0}}]))}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}},
  },
  layout:{beginNavigation:()=>{navigation.abort();navigation=new AbortController();return navigation.signal;}},
  uiWorkspace:{openSession:target=>{opened.push(target);active=typeof target==='string'?target:target.childSessionId;emit();}},
  locale:{addLanguage:()=>()=>{},register:()=>()=>{},getLocale:()=>({active:'zh-Hans-x-frame'})},
  slots:{
   inject:(_name,fn)=>fn(),
   entries:name=>entries.filter(entry=>entry.options.name===name),
   register:(options,component)=>{const entry={options,component};entries.push(entry);return()=>entries.splice(entries.indexOf(entry),1);},
  },
 };
 const window={addEventListener:(name,fn)=>{if(name==='message')messageListeners.add(fn);},removeEventListener:(name,fn)=>{if(name==='message')messageListeners.delete(fn);},__ModuleLoader__:{load:({factory})=>{plugin=factory(()=>({createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_subscribe,get)=>get()}));}}};
 const parent=embedded?{postMessage(){}}:window;
 vm.runInNewContext(source,{
  window,parent,location:{origin:'http://frame.test',search},
  document:{querySelector:()=>null,createElement:()=>({remove(){}}),head:{append:style=>styles.push(style)}},
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('/progress')?chat:{assets:[]}};},
  EventSource:class{constructor(url){this.url=url;events.push(this);}close(){}},
  URLSearchParams,AbortSignal,console,queueMicrotask,
 });
 return {ctx,plugin,entries,nativeLineage,nativeCatalog,opened,styles,emit,requests,events,message(data){for(const fn of messageListeners)fn({origin:'http://frame.test',source:parent,data});},productionLabel(){return entries.find(entry=>entry.options.id==='frame-production-status').component().type().children[0];},get active(){return active;},get signal(){return navigation.signal;},dispose(){for(const cleanup of cleanups.reverse())cleanup();}};
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
 const f=fixture({embedded:true,search:'?frame=1&session=parent&project=project&conversation=conversation',chat:{conversationId:'conversation',production:{label:'当前对话'}}});
 await f.plugin.apply(f.ctx);await flush();
 assert.ok(f.requests.includes('/api/projects/project/progress?conversationId=conversation'));
 assert.equal(f.productionLabel(),'当前对话');
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'other',production:{label:'其他对话'}}});
 assert.equal(f.productionLabel(),'当前对话');
 f.message({type:'frame:state',projectId:'project',state:{conversationId:'conversation',production:{label:'当前对话更新'}}});
 assert.equal(f.productionLabel(),'当前对话更新');
 f.dispose();
});

test('独立对话页事件流携带对话 ID，拒绝不匹配的事件',async()=>{
 const f=fixture({search:'?frame=1&session=parent&project=project&conversation=conversation'});
 await f.plugin.apply(f.ctx);
 assert.equal(f.events[0].url,'/api/projects/project/events?conversationId=conversation');
 f.events[0].onmessage({data:JSON.stringify({conversationId:'conversation',production:{label:'本页状态'}})});
 f.events[0].onmessage({data:JSON.stringify({conversationId:'other',production:{label:'其他状态'}})});
 assert.equal(f.productionLabel(),'本页状态');
 f.dispose();
});
