import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {OperationStore,productionIdentity,mediaOperationIdentity} from '../server/operation-store.mjs';
import {createToolRPC,rpcTimeoutFor} from '../harness/tool-rpc.mjs';

// All state is temporary; no settings, real provider, model or credential file
// participates. The fake provider counts requests as if each were chargeable.
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-operation-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const store=await new OperationStore(dir).init(),jobs=new Map(),calls=[];
 const submit=async requestId=>{calls.push(requestId);const result={id:requestId,taskId:'video:'+requestId,status:'queued'};jobs.set(requestId,result);return result;};
 const lookup=id=>jobs.get(id);
 const scope={projectId:'p-0123456789ab',productionId:'summer-cola',operation:'generate',operationId:'G1',input:{prompt:'朋友一起打开可乐',duration:5,ratio:'9:16',resolution:'768p',name:'开罐镜头',revision:'r1'},configuration:{provider:'minimax',model:'MiniMax-H3'}};
 return {dir,store,jobs,calls,submit,lookup,scope};
}

test('same generation survives a new turn, conversation, label and editing revision',async t=>{
 const f=await fixture(t),first=await f.store.runMedia(f.scope,f.submit,f.lookup);
 const second=await f.store.runMedia({...f.scope,conversationId:'c-aaaaaaaaaaaa',turnId:'next-user-turn',input:{...f.scope.input,name:'镜头一',revision:'r2'}},f.submit,f.lookup);
 assert.equal(second.id,first.id);assert.equal(f.calls.length,1);
 const resumed=await new OperationStore(f.dir).init();f.jobs.get(first.id).status='succeeded';
 const third=await resumed.runMedia(f.scope,f.submit,f.lookup);
 assert.equal(third.id,first.id);assert.equal(third.status,'succeeded');assert.equal(f.calls.length,1);
});

test('new plan, changed content/model, logical version and explicit regeneration remain distinct',async t=>{
 const f=await fixture(t);
 const variants=[f.scope,{...f.scope,productionId:'winter-cola'},{...f.scope,operationId:'G2'},{...f.scope,input:{...f.scope.input,prompt:'冬天朋友一起打开可乐'}},{...f.scope,configuration:{provider:'minimax',model:'MiniMax-H3-Max'}},{...f.scope,operationVersion:'2'},{...f.scope,attemptId:'user-requested-retake-1'}];
 const results=[];for(const scope of variants)results.push(await f.store.runMedia(scope,f.submit,f.lookup));
 assert.equal(new Set(results.map(result=>result.id)).size,variants.length);assert.equal(f.calls.length,variants.length);
 const retry=await f.store.runMedia(variants.at(-1),f.submit,f.lookup);assert.equal(retry.id,results.at(-1).id);assert.equal(f.calls.length,variants.length);
});

test('two agents reserving the same request concurrently submit only once',async t=>{
 const f=await fixture(t);let unblock,called=0;
 const slow=async id=>{called++;await new Promise(resolve=>{unblock=resolve;});return f.submit(id);};
 const one=f.store.runMedia(f.scope,slow,f.lookup),two=f.store.runMedia(f.scope,slow,f.lookup);
 while(!unblock)await new Promise(resolve=>setImmediate(resolve));
 unblock();const [first,second]=await Promise.all([one,two]);assert.equal(called,1);assert.equal(first.id,second.id);
});

test('a process restart after reservation cannot silently replay an uncertain paid request',async t=>{
 const f=await fixture(t);let called=0;
 void f.store.runMedia(f.scope,async()=>{called++;return new Promise(()=>{});},f.lookup);
 while(!called)await new Promise(resolve=>setImmediate(resolve));
 const resumed=await new OperationStore(f.dir).init();
 const result=await resumed.runMedia(f.scope,f.submit,f.lookup);
 assert.equal(result.status,'unknown');assert.equal(result.canRetry,false);assert.equal(result.nextAction.tool,'get_operation_status');assert.equal(f.calls.length,0);
 const late={id:result.operationId,status:'queued',taskId:'video:'+result.operationId};f.jobs.set(late.id,late);
 assert.deepEqual((await resumed.inspect(f.scope.projectId,result.operationId,undefined,(_operation,id)=>f.lookup(id))).result,late,'querying the uncertain operation can find its persisted media job without reissuing generation');
 assert.deepEqual(await resumed.runMedia(f.scope,f.submit,f.lookup),late);assert.equal(f.calls.length,0);
});

test('unknown provider responses and failures do not become implicit retries',async t=>{
 const f=await fixture(t);let calls=0;
 const uncertain=async id=>{calls++;return {id,status:'unknown',taskId:'video:'+id};};
 const first=await f.store.runMedia(f.scope,uncertain);
 assert.deepEqual(await f.store.runMedia(f.scope,uncertain),first);assert.equal(calls,1);
 const rejected={...f.scope,operationId:'G2'};
 const fail=async()=>{calls++;throw Error('余额不足');};
 await assert.rejects(f.store.runMedia(rejected,fail),/余额不足/);
 await assert.rejects(f.store.runMedia(rejected,fail),/余额不足/);assert.equal(calls,2);
 await f.store.runMedia({...rejected,attemptId:'explicit-retake'},f.submit,f.lookup);assert.equal(f.calls.length,1);
});

test('plan identity ignores timing edits and explicit production ids isolate a new G1',()=>{
 const project={id:'p-0123456789ab',productionPlan:{ratio:'9:16',duration:15,updated:'first',scenes:[{id:'G1',name:'开罐',visual:'夏日码头',voiceover:'夏天开场',start:0,end:2}]}};
 const edited={...project,revision:'new',productionPlan:{...project.productionPlan,duration:20,updated:'later',scenes:[{...project.productionPlan.scenes[0],start:1,end:4}]}};
 assert.equal(productionIdentity(project),productionIdentity(edited));
 assert.notEqual(productionIdentity(project),productionIdentity(project,'new-campaign'));
 assert.equal(productionIdentity({...project,productionPlan:{...project.productionPlan,id:'saved-plan'}}),'saved-plan');
 const reordered=mediaOperationIdentity({projectId:project.id,productionId:'one',operation:'generate',operationId:'G1',input:{resolution:'768P',prompt:'summer',duration:5}});
 const same=mediaOperationIdentity({projectId:project.id,productionId:'one',operation:'generate',operationId:'G1',input:{duration:5,prompt:'summer',resolution:'768p'}});
 assert.equal(reordered.key,same.key);
});

test('RPC receipt and late completion are durable, scoped and queryable',async t=>{
 const f=await fixture(t),id=crypto.randomUUID(),scope={projectId:f.scope.projectId,conversationId:'c-aaaaaaaaaaaa',operation:'hypit-edit',args:{revision:'one',files:'{}'}};
 const initial=await f.store.beginRPC(id,scope);assert.equal(initial.fresh,true);
 const duplicate=await f.store.beginRPC(id,scope);assert.equal(duplicate.fresh,false);
 assert.equal(f.store.status(scope.projectId,id,scope.conversationId).status,'running');
 assert.throws(()=>f.store.status(scope.projectId,id,'c-bbbbbbbbbbbb'),/没有该操作/);
 await assert.rejects(f.store.beginRPC(id,{...scope,args:{revision:'other'}}),/其他请求/);
 await f.store.finishRPC(id,{result:{revision:'two',validated:true}});
 const restarted=await new OperationStore(f.dir).init();
 assert.deepEqual(restarted.status(scope.projectId,id,scope.conversationId).result,{revision:'two',validated:true});
 const unfinished=crypto.randomUUID();await f.store.beginRPC(unfinished,scope);
 assert.equal((await new OperationStore(f.dir).init()).status(scope.projectId,unfinished,scope.conversationId).status,'unknown');
});

test('a lost RPC response can resolve its original persisted media request after restart',async t=>{
 const f=await fixture(t),rpcId=crypto.randomUUID(),conversationId='c-aaaaaaaaaaaa';
 await f.store.beginRPC(rpcId,{projectId:f.scope.projectId,conversationId,operation:'generate',args:{operationId:'G1'}});
 let submitted;
 void f.store.runMedia({...f.scope,rpcId},async id=>{submitted=id;f.jobs.set(id,{id,taskId:'video:'+id,status:'queued'});return new Promise(()=>{});},f.lookup);
 while(!submitted)await new Promise(resolve=>setImmediate(resolve));
 const restarted=await new OperationStore(f.dir).init();
 assert.equal(restarted.status(f.scope.projectId,rpcId,conversationId).status,'unknown');
 const recovered=await restarted.inspect(f.scope.projectId,rpcId,conversationId,(_operation,id)=>f.lookup(id));
 assert.equal(recovered.status,'completed');assert.equal(recovered.result.id,submitted);assert.equal(f.calls.length,0);
});

test('a damaged ledger is isolated without treating uncertain billing history as an empty history',async t=>{
 const f=await fixture(t),original=await f.store.runMedia(f.scope,f.submit,f.lookup);
 const broken=path.join(f.dir,'operations',crypto.randomUUID()+'.json'),raw='{broken:FAKE_PRIVATE_MARKER';
 await fs.writeFile(broken,raw);
 const restarted=await new OperationStore(f.dir).init();
 assert.equal(restarted.loadDiagnostics.length,1);assert.equal(await fs.readFile(broken,'utf8'),raw);
 const diagnostic=await fs.readFile(broken+'.recovery.json','utf8');assert.ok(!diagnostic.includes('FAKE_PRIVATE_MARKER'));
 assert.equal((await restarted.runMedia(f.scope,f.submit,f.lookup)).id,original.id);
 await assert.rejects(restarted.runMedia({...f.scope,operationId:'G2'},f.submit,f.lookup),/记录损坏/);
 assert.equal(f.calls.length,1,'an unreadable ledger must not silently cause a new charge');
 await restarted.runMedia({...f.scope,operationId:'G2',attemptId:'user-explicit-new-attempt'},f.submit,f.lookup);
 assert.equal(f.calls.length,2);
});

function transportFixture(){
 const callbacks=new Map(),messages=[];let next=0;
 const transport=createToolRPC({send:message=>messages.push(message),setTimer(callback,ms){const id=++next;callbacks.set(id,{callback,ms});return id;},clearTimer:id=>callbacks.delete(id)});
 return {transport,messages,callbacks};
}
test('heavy RPC gets an appropriate window; timeout returns a query identity without resending',async()=>{
 const f=transportFixture(),pending=f.transport.call({projectId:'p-0123456789ab'},'hypit-edit',{files:'{}'},new AbortController().signal);
 const timer=[...f.callbacks.values()][0];assert.equal(timer.ms,300000);assert.ok(rpcTimeoutFor('generate')>60000);
 timer.callback();const result=await pending;
 assert.equal(result.status,'unknown');assert.equal(result.operationId,f.messages[0].id);assert.equal(result.canRetry,false);assert.equal(f.messages.length,1);assert.equal(f.callbacks.size,0);
 assert.equal(f.transport.receive({id:result.operationId,value:{revision:'done'}}),false,'late response is retrieved from durable server receipt, not a dead promise');
});

test('cancelling a tool cleans up transport but does not claim the paid task was cancelled',async()=>{
 const f=transportFixture(),controller=new AbortController();
 const pending=f.transport.call({projectId:'p-0123456789ab'},'generate',{operationId:'G1'},controller.signal);
 controller.abort();await assert.rejects(pending,/已提交的任务保留.*操作 ID/);assert.equal(f.callbacks.size,0);assert.equal(f.messages.length,1);
 await assert.rejects(f.transport.call({},'generate',{},controller.signal),/操作已取消/);assert.equal(f.messages.length,1);
 const normal=f.transport.call({},'context',{});f.transport.receive({id:f.messages.at(-1).id,value:{ok:true}});assert.deepEqual(await normal,{ok:true});assert.equal(f.callbacks.size,0);
});
