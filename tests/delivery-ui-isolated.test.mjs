import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../harness/frame-ui/client.js',import.meta.url),'utf8');
function fixture(job,{tool='get_export_status',isError=false,live={}}={}){
 const entries=[],listeners=new Set(),messages=[],styles=[];
 const events=[{event:{type:'tool/call',data:{turn:1,callId:'call',name:tool}}},{event:{type:'tool/result',data:{turn:1,message:{toolCallId:'call',isError,content:[{type:'text',text:JSON.stringify(job)}]}}}}];
 let plugin;
 const window={addEventListener:(name,fn)=>name==='message'&&listeners.add(fn),removeEventListener:()=>{},__ModuleLoader__:{load:({factory})=>{plugin=factory(()=>({createElement:(type,props,...children)=>({type,props,children}),useSyncExternalStore:(_,read)=>read(),useEffect:fn=>fn()}));}}};
 const parent={postMessage:data=>messages.push(data)};
 const ctx={effect:fn=>fn(),sessions:{refresh:async()=>{},binding:()=>({eventSource:{getSnapshot:()=>({entries:events})}})},layout:{beginNavigation:()=>{}},uiWorkspace:{openSession:()=>{}},locale:{addLanguage:()=>()=>{},register:()=>()=>{},getLocale:()=>({active:'zh-Hans-x-frame'})},sidebarRight:{isExpanded:()=>false},sidebarRightTabs:{register:()=>()=>{}},slots:{inject:(_,fn)=>fn(),entries:()=>[],register:(options,component)=>{entries.push({options,component});return()=>{};}}};
 vm.runInNewContext(source,{window,parent,document:{documentElement:{dataset:{}},querySelector:()=>null,createElement:()=>({remove(){}}),head:{append:style=>styles.push(style)}},location:{origin:'http://isolated.test',search:'?frame=1&session=session&project=project&conversation=conversation'},URLSearchParams,AbortSignal,console,fetch:async()=>({ok:true,json:async()=>({})}),queueMicrotask});
 const render=()=>{const snapshot={order:[],nodes:new Map(),timeline:{turnOrder:[1]}};return entries.find(entry=>entry.options.id==='frame-media').component({sessionId:'session',turn:{turn:1,end:{time:2}},useSession:fn=>fn({running:false}),useChat:fn=>fn(snapshot)});};
 const nodes=[];const walk=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value))return value.forEach(walk);if(typeof value.type==='function')return walk(value.type(value.props||{}));nodes.push(value);value.children?.forEach(walk);};
 return {messages,styles,async start(){await plugin.apply(ctx);for(const fn of listeners)fn({origin:'http://isolated.test',source:parent,data:{type:'frame:state',projectId:'project',state:{conversationId:'conversation',status:'idle',exports:[job],images:[job],generations:[job],...live}}});walk(render());return nodes;}};
}
const text=node=>(node.children||[]).map(value=>typeof value==='string'?value:typeof value==='number'?String(value):Array.isArray(value)?value.map(text).join(''):value&&typeof value==='object'?text(value):'').join('');

test('成片卡显示真实导出信息并保存对应文件，快捷操作只预填',async()=>{
 const f=fixture({id:'export-1',status:'done',duration:30,output:{width:1920,height:1080},fileSize:8*1048576,videoId:'v-default'}),nodes=await f.start();
 const metadata=nodes.find(node=>node.props?.className==='frame-delivery-meta');assert.equal(text(metadata),'30.0 秒 · 16:9 · 8.0 MB');
 const save=nodes.find(node=>node.type==='a'&&node.props.className==='frame-delivery-save');assert.equal(save.props.href,'/api/jobs/export-1/download');assert.ok(save.props.download.endsWith('.mp4'));
 const buttons=nodes.filter(node=>node.type==='button');assert.ok(buttons.some(node=>text(node)==='做竖版'));assert.ok(buttons.some(node=>text(node)==='剪 15 秒版'));
 buttons.find(node=>text(node)==='做竖版').props.onClick();assert.equal(f.messages.at(-1).type,'frame:delivery-next');assert.equal(f.messages.at(-1).exportId,'export-1');assert.match(f.messages.at(-1).text,/9:16/);assert.equal(f.messages.at(-1).videoId,'v-default');
});

test('竖版短片不重复提供竖版或15秒操作，缺失信息不伪造',async()=>{
 let f=fixture({id:'short',status:'done',duration:12,output:{width:1080,height:1920}}),nodes=await f.start();let buttons=nodes.filter(node=>node.type==='button').map(text);assert.ok(!buttons.includes('做竖版'));assert.ok(!buttons.includes('剪 15 秒版'));assert.ok(buttons.includes('做开场版本'));
 f=fixture({id:'missing',status:'done'});nodes=await f.start();assert.equal(nodes.some(node=>node.props?.className==='frame-delivery-meta'),false);buttons=nodes.filter(node=>node.type==='button').map(text);assert.ok(!buttons.includes('做竖版'));assert.ok(!buttons.includes('剪 15 秒版'));
});

test('审核失败默认折叠，给调整要求入口而不显示供应商原始错误',async()=>{
 const f=fixture({id:'image-1',status:'failed',error:'provider moderation content rejected token=private-value'},{tool:'generate_image'}),nodes=await f.start();
 const disclosure=nodes.find(node=>node.type==='details'&&node.props.className==='frame-task-details');assert.equal(disclosure.props.open,undefined);assert.ok(nodes.some(node=>node.type==='p'&&text(node)==='这次生成未通过审核，请调整描述。'));assert.ok(!nodes.map(text).join('').includes('private-value'));
 nodes.find(node=>node.type==='button'&&text(node)==='调整描述').props.onClick();assert.equal(f.messages.at(-1).type,'frame:failure-draft');
});

test('未知提交只给核对入口，鉴权错误可直接去设置',async()=>{
 let f=fixture({id:'video-1',status:'unknown',error:'timeout'},{tool:'generate_video'}),nodes=await f.start();nodes.find(node=>node.type==='button'&&text(node)==='核对结果').props.onClick();assert.equal(f.messages.at(-1).type,'frame:task-status');
 f=fixture({id:'image-2',status:'failed',failure:{category:'authentication',message:'invalid key'}},{tool:'generate_image'});nodes=await f.start();nodes.find(node=>node.type==='button'&&text(node)==='模型设置').props.onClick();assert.equal(f.messages.at(-1).type,'frame:settings');
});

test('停止助手后保留已提交任务的真实运行状态',async()=>{
 const job={id:'pending',status:'running'},task={id:'export:pending',kind:'export',status:'running',name:'当前成片'};
 const f=fixture(job,{tool:'export_video',live:{outcome:'stopped',tasks:[task],awaiting:{taskIds:[task.id]}}}),nodes=await f.start();
 const notice=nodes.find(node=>node.props?.className==='frame-stopped-tasks');assert.equal(text(notice),'助手已停止 · 1 项已提交任务仍在处理，结果会保留');
 const row=nodes.find(node=>node.props?.className==='frame-task-row');assert.match(text(row),/进行中/);assert.ok(!nodes.map(text).join('').includes('已取消'));
});
