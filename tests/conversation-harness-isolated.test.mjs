import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Session} from '@deepseek-ai/dsh-session';
import {validateStoredEvents} from '@deepseek-ai/dsh-session-persistence';
import {apply} from '../harness/plugin.mjs';

// This fixture only exercises IPC routing and detached DSH session records.
// It never launches DSH, a provider, a child process, or a network listener.
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-conversation-harness-'));
 const prior={native:process.env.FRAME_NATIVE_DSH,root:process.env.FRAME_CODE_ROOT,send:process.send};
 process.env.FRAME_NATIVE_DSH='1';process.env.FRAME_CODE_ROOT=dir;
 const hooks=new Map(),agents=new Map(),saved=new Map(),tools=new Map(),jobs=new Map();
 const messages=[],created=[],flushed=[],jobAccess=[];
 let receive,nextJob=0,nextRequest=0;
 const on=(name,callback)=>{const callbacks=hooks.get(name)||[];callbacks.push(callback);hooks.set(name,callbacks);return()=>{};};
 const makeAgent=(sessionId,meta,seed=[])=>({session:Session.create(sessionId,seed,{version:4,id:sessionId,createdAt:1,isSeeded:false,...meta}),ctx:{on:()=>()=>{}},status:'idle',cancelled:0,prompts:[],cancel(){this.cancelled++;},followup(message){this.prompts.push(message);}});
 const ctx={on,agents:{get:id=>agents.get(id),async create(options){created.push(options);await Promise.resolve();const agent=makeAgent(options.sessionId,options.meta,options.seed);agents.set(agent.session.id,agent);saved.set(agent.session.id,agent);return {agent};},async resume({resumeSessionId}){const agent=saved.get(resumeSessionId);if(!agent)throw Error('missing session');agents.set(resumeSessionId,agent);return {agent};}},
  tools:{register:def=>tools.set(def.name,def)},agentPresets:{mount:async()=>{},serviceFor:()=>({pruneSession:()=>0,compactNow:async()=>true})},
  sessionPersistence:{stat:async id=>saved.has(id)?{header:saved.get(id).session.header}:undefined,open:async id=>({read:async()=>({events:saved.get(id).session.snapshotEvents()}),close:async()=>{}})},
  sessions:{get:id=>agents.get(id)?.session,flush:async session=>{flushed.push(session.id);}},workspaceRegistry:{create:async()=>({attachSession:async()=>{}})},connection:{authenticatedUrl:url=>url},
  jobs:{start(options){const id='job-'+(++nextJob);jobs.set(id,{owner:options.owner,...options.run({updateProgress(){}})});return id;},wait(id,timeout,owner){assert.equal(owner,jobs.get(id).owner);jobAccess.push(['wait',id,owner]);return jobs.get(id).done;},kill(id,owner){assert.equal(owner,jobs.get(id).owner);jobAccess.push(['kill',id,owner]);jobs.get(id).cancel();},remove(id,owner){assert.equal(owner,jobs.get(id).owner);jobAccess.push(['remove',id,owner]);}},
 };
 process.send=message=>{messages.push(message);if(message.type==='tool')queueMicrotask(()=>receive({type:'tool-result',id:message.id,value:message.operation==='await-tasks'?{waitId:'shared-wait'}:{ok:true}}));};
 const before=new Set(process.listeners('message'));apply(ctx);receive=process.listeners('message').find(listener=>!before.has(listener));
 t.after(async()=>{for(const dispose of hooks.get('dispose')||[])dispose();if(prior.send===undefined)delete process.send;else process.send=prior.send;for(const [key,value]of [['FRAME_NATIVE_DSH',prior.native],['FRAME_CODE_ROOT',prior.root]])if(value===undefined)delete process.env[key];else process.env[key]=value;await fs.rm(dir,{recursive:true,force:true});});
 const emit=async(name,...args)=>{for(const callback of hooks.get(name)||[])await callback(...args);};
 const ensure=async scope=>{const requestId='ensure-'+(++nextRequest);await receive({type:'ensure',...scope,requestId});const result=messages.findLast(message=>message.requestId===requestId);assert.equal(result.type,'session',JSON.stringify(result));return agents.get(result.sessionId);};
 const execute=(name,agent,args={})=>tools.get(name).execute(args,{agent,signal:new AbortController().signal});
 return {dir,ctx,hooks,agents,saved,messages,created,flushed,jobs,jobAccess,makeAgent,receive,emit,ensure,execute,tools};
}

const projectId='p-0123456789ab',a={projectId,conversationId:'c-aaaaaaaaaaaa'},b={projectId,conversationId:'c-bbbbbbbbbbbb'};

test('parallel conversations keep distinct sessions, persistent bindings and code copies',async t=>{
 const f=await fixture(t);
 const [first,same,second,legacy]=await Promise.all([f.ensure(a),f.ensure(a),f.ensure(b),f.ensure({projectId})]);
 assert.equal(first,same);assert.notEqual(first,second);assert.equal(f.created.length,3);
 assert.equal(first.session.header.cwd,path.join(f.dir,projectId,'conversations',a.conversationId));
 assert.equal(second.session.header.cwd,path.join(f.dir,projectId,'conversations',b.conversationId));
 assert.equal(legacy.session.header.cwd,path.join(f.dir,projectId));
 const binding=first.session.snapshotEvents().find(event=>event.type==='frame/conversation');
 assert.deepEqual(binding.data,a);assert.equal(binding.ignorable,true);
 assert.doesNotThrow(()=>validateStoredEvents(first.session.header,structuredClone(first.session.snapshotEvents())));
 await f.receive({type:'prompt',...a,prompt:'first'});await f.receive({type:'prompt',...b,prompt:'second'});
 assert.equal(first.prompts.length,1);assert.equal(second.prompts.length,1);
 await f.receive({type:'cancel',...a});assert.equal(first.cancelled,1);assert.equal(second.cancelled,0);
 await f.emit('agent/status',{agent:second,status:'running'});
 assert.deepEqual(f.messages.at(-1),{type:'status',...b,status:'running'});
 await f.receive({type:'ensure',projectId,conversationId:'c-cccccccccccc',sessionId:first.session.id,requestId:'foreign'});
 assert.match(f.messages.at(-1).error,/其他对话/);
 await f.receive({type:'ensure',projectId,conversationId:'../escape',requestId:'invalid'});
 assert.match(f.messages.at(-1).error,/ID 无效/);
});

test('waits route settlement and cancellation to their conversation and exact native owner',async t=>{
 const f=await fixture(t),first=await f.ensure(a),second=await f.ensure(b);
 const args={taskIds:['export:one'],instruction:'report'};
 const one=JSON.parse(await f.execute('await_tasks',first,args)),two=JSON.parse(await f.execute('await_tasks',second,args));
 assert.notEqual(one.jobId,two.jobId);
 assert.equal(f.jobs.get(one.jobId).owner,first.session.id);assert.equal(f.jobs.get(two.jobId).owner,second.session.id);
 await f.receive({type:'cancel',...a});
 assert.ok(f.jobAccess.some(([type,id])=>type==='kill'&&id===one.jobId));
 assert.ok(!f.jobAccess.some(([type,id])=>type==='kill'&&id===two.jobId));
 await f.receive({type:'tasks-settled',...b,waitId:'shared-wait',result:{ok:true}});
 assert.deepEqual(await f.jobs.get(two.jobId).done,{status:'completed',result:'{"ok":true}'});
 assert.equal(f.flushed.at(-1),second.session.id);
 assert.deepEqual(f.messages.at(-1),{type:'wait-delivered',...b,waitId:'shared-wait',ownerSessionId:second.session.id});
});

test('child tools inherit conversation ownership without overwriting parent events',async t=>{
 const f=await fixture(t),parent=await f.ensure(a);
 const child=f.makeAgent('child-session',{cwd:parent.session.header.cwd,parentSession:parent.session.id,origin:'subagent'});f.agents.set(child.session.id,child);
 const before=f.messages.length;
 await f.emit('agent/assistant-stream',{agent:child,frame:{type:'text',text:'child'}});
 await f.emit('session/event',child.session,{type:'turn/end',data:{}});
 await f.emit('agent/status',{agent:child,status:'running'});
 await f.emit('agent/inbox/claimed',{agent:child,message:{source:{kind:'user'},content:[]}});
 assert.equal(f.messages.length,before);
 await f.execute('get_project_context',child);
 assert.deepEqual(f.messages.findLast(message=>message.type==='tool').conversationId,a.conversationId);
 assert.equal(f.messages.findLast(message=>message.type==='tool').ownerSessionId,child.session.id);
 const waiting=JSON.parse(await f.execute('await_tasks',child,{taskIds:['export:child'],instruction:'child report'}));
 assert.equal(f.jobs.get(waiting.jobId).owner,child.session.id);
 await f.receive({type:'tasks-settled',...a,waitId:'shared-wait',result:{child:true}});
 assert.equal(f.flushed.at(-1),child.session.id);
 assert.equal(f.messages.at(-1).ownerSessionId,child.session.id);
 assert.ok(f.tools.has('read_project_conversation'));
});

test('homepage retained session stays unbound and rejects model execution',async t=>{
 const f=await fixture(t);
 await f.receive({type:'ensure-home',requestId:'home'});
 const home=f.agents.get('frame-home-composer');
 assert.equal(f.messages.at(-1).sessionId,home.session.id);
 assert.deepEqual(await f.hooks.get('agent/pre-step')[0]({agent:home},()=>assert.fail('homepage executed a step')),{kind:'reject'});
 await assert.rejects(f.hooks.get('agent/request')[0]({agent:home},()=>assert.fail('homepage requested a model')),/首页输入框/);
 const guard=f.messages.length;await f.emit('agent/status',{agent:home,status:'running'});assert.equal(f.messages.length,guard);
 await assert.rejects(f.execute('get_project_context',home),/未绑定项目/);
 await f.receive({type:'ensure',...a,sessionId:home.session.id});assert.match(f.messages.at(-1).error,/首页输入框/);
});
