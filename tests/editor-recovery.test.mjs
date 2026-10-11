import test from 'node:test';
import assert from 'node:assert/strict';
import {createExportMonitor} from '../src/export-monitor.js';
import {createEditorDrafts} from '../src/editor-drafts.js';
import {requestJSON} from '../src/request.js';
import {publicSettings} from '../server/settings.mjs';
import {creativeConfiguration} from '../server/creative-model.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const clock=()=>{const pending=new Map();let n=0;return {setTimer:fn=>{pending.set(++n,fn);return n;},clearTimer:id=>pending.delete(id),async next(){const [id,fn]=pending.entries().next().value||[];if(fn){pending.delete(id);await fn();}}};};

test('导出视图跨项目切换不会串状态，返回可继续查询，双击只提交一次',async()=>{
 const update=[],calls=[],submitted=deferred(),queried=deferred(),timers=clock();
 const monitor=createExportMonitor({...timers,onUpdate:(id,j)=>update.push([id,j.status]),request:async(url,method)=>{
  calls.push([url,method]);if(method==='POST')return submitted.promise;return queried.promise;
 }});
 monitor.enter('A');const one=monitor.start('A',{revision:4});await monitor.start('A',{revision:4});
 assert.equal(calls.filter(x=>x[1]==='POST').length,1);
 monitor.enter('B');submitted.resolve({id:'job-A',status:'running'});await one;
 assert.deepEqual(update,[['A','submitting']]);
 monitor.enter('A');monitor.enter('B');queried.resolve({id:'job-A',status:'done'});await tick();
 assert.deepEqual(update,[['A','submitting'],['A','running']]);
 monitor.enter('A');assert.deepEqual(update.at(-1),['A','done']);monitor.leave();
});

test('导出读取断连会重连，不丢任务也不重新提交',async()=>{
 const timers=clock(),update=[];let reads=0,posts=0;
 const monitor=createExportMonitor({...timers,onUpdate:(_,j)=>update.push(j),request:async(_,method)=>{
  if(method==='POST'){posts++;return {id:'A',status:'running'};}
  if(++reads===1)throw Error('连接中断');return {id:'A',status:'done'};
 }});
 monitor.enter('P');await monitor.start('P',{revision:1});await tick();
 assert.equal(update.at(-1).connectionError,'连接中断');await timers.next();
 assert.equal(update.at(-1).status,'done');assert.equal(posts,1);monitor.leave();
});

test('页面刷新后可认领服务器仍在导出的任务，不能双重提交',async()=>{
 const pending=deferred();let posts=0;
 const monitor=createExportMonitor({onUpdate:()=>{},request:async(_,method)=>{if(method==='POST')posts++;return pending.promise;}});
 monitor.enter('P');monitor.reconcile('P',[{id:'existing',status:'running',created:new Date().toISOString()}]);
 const current=await monitor.start('P',{revision:3});assert.equal(current.id,'existing');assert.equal(posts,0);monitor.leave();pending.resolve({id:'existing',status:'done'});await tick();
});

test('提交响应丢失后查询近期同版本任务，不采用旧成片、不重复导出',async()=>{
 const timers=clock(),update=[];let posts=0,reads=0;
 const monitor=createExportMonitor({...timers,onUpdate:(_,j)=>update.push(j),request:async(_,method)=>{
  if(method==='POST'){posts++;throw Error('响应丢失');}
  reads++;return reads===1?[{id:'old',revision:2,status:'done',created:'2000-01-01T00:00:00Z'}]:[{id:'new',revision:2,status:'done',created:new Date().toISOString()}];
 }});
 monitor.enter('P');await assert.rejects(monitor.start('P',{revision:2}),/响应丢失/);
 await monitor.start('P',{revision:2});assert.equal(posts,1);
 await timers.next();assert.equal(monitor.current('P').status,'unknown');
 await timers.next();assert.equal(monitor.current('P').id,'new');monitor.leave();
});

function control({id,value,defaultValue=value,tagName='INPUT',type='text',form=null,entity=''}={}){
 return {id,value,defaultValue,tagName,type,name:'value',closest:selector=>selector==='form'?form:entity?{dataset:{draftEntity:entity}}:null,getAttribute:()=>null,dispatchEvent(){this.events=(this.events||0)+1;},focus(){},setSelectionRange(){}};
}
const view=nodes=>({querySelectorAll:()=>nodes,contains:node=>nodes.includes(node)});
test('工程刷新保留输入，但不触发自动保存；成功保存的新值不恢复为旧值',()=>{
 const drafts=createEditorDrafts(),draft=control({id:'caption',value:'正在修改的文案',defaultValue:'旧文案'});
 drafts.capture('P/captions',view([draft]));
 const next=control({id:'caption',value:'其他对话的新文案'});assert.equal(drafts.restore('P/captions',view([next])),true);
 assert.equal(next.value,'正在修改的文案');assert.equal(next.events,undefined);
 drafts.capture('P/captions',view([next]));
 const saved=control({id:'caption',value:'正在修改的文案'});assert.equal(drafts.restore('P/captions',view([saved])),false);
 drafts.capture('P/captions',view([saved]));assert.equal(drafts.restore('P/captions',view([control({id:'caption',value:'新的后续改动'})])),false);
});
test('镜头、项目的草稿互不混用',()=>{
 const drafts=createEditorDrafts(),form={dataset:{time:'move'}};
 drafts.capture('P/scene',view([control({value:'2.5',defaultValue:'1',form,entity:'shot-A'})]));
 const other=control({value:'9',form,entity:'shot-B'});drafts.restore('P/scene',view([other]));assert.equal(other.value,'9');
 const foreign=control({value:'1',form,entity:'shot-A'});drafts.restore('Q/scene',view([foreign]));assert.equal(foreign.value,'1');
});
test('409 保留可识别冲突原因；没有明确地址时密钥不隐式发往第三方',async()=>{
 await assert.rejects(requestJSON('/fixture','POST',{}, {fetcher:async()=>new Response(JSON.stringify({error:'草稿冲突',code:'WORKSPACE_BASE_CONFLICT'}),{status:409})}),error=>error.status===409&&error.code==='WORKSPACE_BASE_CONFLICT');
 const env={CREATIVE_API_KEY:'synthetic-key',AGENT_PROVIDER:'anthropic',AGENT_KEY_SOURCE:'creative'};
 const settings=publicSettings(env);assert.equal(settings.creativeBaseUrl,'');assert.equal(settings.creativeConfigured,false);assert.equal(settings.agentConfigured,false);
 assert.throws(()=>creativeConfiguration(env),/接口地址/);
 const explicit=publicSettings({...env,CREATIVE_BASE_URL:'https://chosen.example.invalid'});assert.equal(explicit.agentConfigured,true);assert.equal(explicit.creativeBaseUrl,'https://chosen.example.invalid');
});
