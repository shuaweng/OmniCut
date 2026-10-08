import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../harness/frame-ui/client.js',import.meta.url),'utf8');

async function fixture(){
 const entries=[],events=[],cleanups=[],styles=[];
 let plugin,running=false;
 const nativeTail=()=>null,nativeProcess=()=>null;
 for(const [key,component] of [['turn-tail',nativeTail],['turn-process',nativeProcess]])entries.push({options:{name:'conversation.chat.node',key,priority:0},locale:'chat',inject:()=>({}),component});
 const ctx={
  effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup);},
  sessions:{refresh:async()=>{},binding:()=>({eventSource:{getSnapshot:()=>({entries:[2,3].flatMap(turn=>[
   {event:{type:'tool/call',data:{turn,callId:'image-'+turn,name:'generate_image'}}},
   {event:{type:'tool/result',data:{turn,message:{toolCallId:'image-'+turn,content:[{type:'text',text:'{"id":"job"}'}]}}}},
  ])})}})},layout:{beginNavigation(){}},uiWorkspace:{openSession(){}},
  locale:{addLanguage:()=>()=>{},register:()=>()=>{},getLocale:()=>({active:'zh-Hans-x-frame'})},
  slots:{inject:(_name,fn)=>fn(),entries:name=>entries.filter(entry=>entry.options.name===name),register:(options,component)=>{const entry={options,component};entries.push(entry);return()=>entries.splice(entries.indexOf(entry),1);}},
 };
 const window={addEventListener(){},removeEventListener(){},__ModuleLoader__:{load:({factory})=>{plugin=factory(()=>({createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_subscribe,get)=>get()}));}}};
 vm.runInNewContext(source,{window,parent:window,location:{origin:'http://frame.test',search:'?frame=1&session=parent&project=project&conversation=conversation'},document:{querySelector:()=>null,createElement:()=>({remove(){}}),head:{append:style=>styles.push(style)}},EventSource:class{constructor(){events.push(this);}close(){}},URLSearchParams,AbortSignal,console,queueMicrotask});
 await plugin.apply(ctx);
 const turns=new Map([1,2,3].map(turn=>[turn,{turn,status:'closed',start:{time:turn*100,seq:turn*10,data:{turn}},end:{time:turn*100+40,seq:turn*10+8,data:{turn,reason:{kind:'completed'}}},steps:[]}]));
 const nodes=new Map([1,2].map(turn=>['user-'+turn,{kind:'user',data:{source:{kind:'user'},time:turn*100+1},location:{kind:'turn',turn:turns.get(turn)}}]));
 nodes.set('continuation',{kind:'turn-trigger',data:{source:{kind:'tool-jobs'},time:301},location:{kind:'turn',turn:turns.get(3)}});
 const snapshot={order:[...nodes.keys()],nodes:{get:key=>nodes.get(key),values:()=>[...nodes.values()]},timeline:{turnOrder:[1,2,3],turns},locations:{getTurn:turn=>[...nodes].filter(([,node])=>node.location.turn.turn===turn).map(([key])=>key)}};
 const render=(key,{turn=3,sessionId='parent'}={})=>{
  const wrapper=key==='turn-tail'?entries.find(entry=>entry.options.id==='frame-media'):entries.find(entry=>entry.options.name==='conversation.chat.node'&&entry.options.key===key&&entry.options.priority===-20);
  assert.ok(wrapper,`${key} must use the native node extension`);
  const closing={finalNode:{seq:turn*10+6,messageId:'answer-'+turn},blocks:[{kind:'text',text:'内容'}]};
  const node={kind:key,data:{turn,seq:turn*10+8,closing},location:{kind:'turn',turn:turns.get(turn)}};
  const turnProcess={foldable:true,hasContent:true,open:false,setOpen(){}};
  const props={node,turn:turns.get(turn),sessionId,turnProcess,useSession:selector=>selector({running}),useChat:selector=>selector(snapshot),t:key=>key};
  return {result:wrapper.component(props),props};
 };
 return {render,entries,styles,nativeTail,nativeProcess,pageOutUsers:()=>{snapshot.order=snapshot.order.filter(key=>nodes.get(key)?.kind!=='user');},setRunning:value=>{running=value;},setLive:value=>events[0].onmessage({data:JSON.stringify({conversationId:'conversation',sessionId:'parent',turnStarted:201,tasks:[],...value})}),dispose:()=>{for(const cleanup of cleanups.reverse())cleanup();}};
}

const hasPending=result=>result.children.some(child=>child?.props?.['data-frame-turn-pending']!==undefined);

test('当前制作轮的等待和自动接续均隐藏结束动作，保留正文及素材插槽',async t=>{
 const f=await fixture();t.after(f.dispose);
 assert.equal(f.entries.filter(entry=>entry.options.key==='turn-tail').length,1,'不替换原生尾部所有者和反馈插槽');
 assert.match(f.styles.map(style=>style.textContent).join(''),/\[data-turn-tail\]:has\(\[data-frame-turn-pending\]\)\s*>\s*\[data-clock="end"\]\s*\{display:none!important/);
 for(const live of [{status:'running'},{status:'waiting'},{status:'idle',awaiting:{id:'wait'}},{status:'idle',resuming:'wait'},{status:'idle',tasks:[{id:'image:1',kind:'image',status:'running',created:new Date(210).toISOString()}]}]){
  f.setLive(live);
  for(const turn of [2,3]){
   const {result,props}=f.render('turn-tail',{turn});
   assert.equal(hasPending(result),true,`native turn ${turn}: ${JSON.stringify(live)}`);
   assert.equal(props.node.data.closing.finalNode.messageId,'answer-'+turn,'不得修改原生持久化节点');
   assert.ok(result.children.some(child=>child?.props?.className==='frame-turn-media'),'素材卡片仍保留');
  }
 }
});

test('当前轮状态尚未读到或原生仍在运行时，不能提前显示结束动作',async t=>{
 const f=await fixture();t.after(f.dispose);
 assert.equal(hasPending(f.render('turn-tail').result),true);
 f.setLive({status:'idle'});f.setRunning(true);
 assert.equal(hasPending(f.render('turn-tail').result),true);
});

test('历史已完成轮和子代理视图不受主任务的等待状态影响，完成后恢复原生动作',async t=>{
 const f=await fixture();t.after(f.dispose);f.setLive({status:'waiting'});
 for(const options of [{turn:1},{sessionId:'child'}]){
  assert.equal(hasPending(f.render('turn-tail',options).result),false);
  const {result,props}=f.render('turn-process',options);
  assert.equal(result.props.node,props.node);
 }
 f.setLive({status:'idle'});
 assert.equal(hasPending(f.render('turn-tail').result),false);
 f.setLive({status:'running',turnStarted:350});
 assert.equal(hasPending(f.render('turn-tail').result),false,'新请求先到 Frame、用户节点未到时保留上一请求的完成动作');
 f.setLive({status:'idle',outcome:'stopped',tasks:[{kind:'image',status:'running',created:new Date(210).toISOString()}]});
 assert.equal(hasPending(f.render('turn-tail').result),false,'用户已停止不继续显示任务进行中');
});

test('进行中的制作不标记已完成，同时保留原生过程展开交互',async t=>{
 const f=await fixture();t.after(f.dispose);f.setLive({status:'waiting'});
 const {result,props}=f.render('turn-process');
 assert.equal(result.type,f.nativeProcess);
 assert.equal(result.props.node.location.turn.end,undefined);
 assert.equal(result.props.node.location.turn.status,'closed','原生过程行仍可显示');
 assert.equal(result.props.turnProcess,props.turnProcess);
 assert.notEqual(result.props.t('message.turnProcess.worked'),'message.turnProcess.worked');
 assert.ok(props.node.location.turn.end,'不得修改原生时间线');
});

test('起始用户消息分页移出窗口后，同一请求的各接续段仍等待整体完成',async t=>{
 const f=await fixture();t.after(f.dispose);f.pageOutUsers();f.setLive({status:'waiting'});
 for(const turn of [2,3]){
  assert.equal(hasPending(f.render('turn-tail',{turn}).result),true,`接续段 ${turn} 不得提前出现结束动作`);
  assert.equal(f.render('turn-process',{turn}).result.props.node.location.turn.end,undefined);
 }
 assert.equal(hasPending(f.render('turn-tail',{turn:1}).result),false,'保留请求开始前的已完成历史');
 const {result,props}=f.render('turn-process',{turn:1});
 assert.equal(result.props.node,props.node);
});
