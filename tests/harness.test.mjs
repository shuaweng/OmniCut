import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {createAgentBridge} from '../server/agent.mjs';

test('真实 DSH loop 经本地模拟模型调用受控工具，并把字幕移动后返回回复', {timeout:35000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-harness-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=new ProjectService(dir);const project=await service.create('隔离的 Agent 测试');let calls=0,done=false;
 const mock=http.createServer(async(req,res)=>{let b='';for await(const x of req)b+=x;const body=JSON.parse(b);calls++;const tools=body.messages.filter(x=>x.role==='tool');let delta,reason='tool_calls';
 if(!tools.length)delta={role:'assistant',tool_calls:[{index:0,id:'call_context',type:'function',function:{name:'get_project_context',arguments:'{}'}}]};
 else if(tools.length===1){const context=JSON.parse(typeof tools[0].content==='string'?tools[0].content:tools[0].content[0].text);delta={role:'assistant',tool_calls:[{index:0,id:'call_change',type:'function',function:{name:'apply_project_changes',arguments:JSON.stringify({type:'position',y:72,revision:context.revision})}}]};}
 else{delta={role:'assistant',content:'已将字幕上移到 72%，其他内容保持原样。'};reason='stop';done=true;}
 res.writeHead(200,{'content-type':'text/event-stream'});const chunk=(d,finish=null)=>({id:'mock-'+calls,object:'chat.completion.chunk',created:1,model:'frame-mock',choices:[{index:0,delta:d,finish_reason:finish}]});res.write('data: '+JSON.stringify(chunk(delta))+'\n\n');res.write('data: '+JSON.stringify(chunk({},reason))+'\n\n');res.end('data: [DONE]\n\n');});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));t.after(()=>mock.close());
 const prior={key:process.env.DEEPSEEK_API_KEY,base:process.env.DEEPSEEK_BASE_URL,model:process.env.DEEPSEEK_MODEL};process.env.DEEPSEEK_API_KEY='test-local-only';process.env.DEEPSEEK_BASE_URL='http://127.0.0.1:'+mock.address().port+'/v1';process.env.DEEPSEEK_MODEL='frame-mock';
 const bridge=await createAgentBridge({service});t.after(()=>{bridge.close();for(const [key,value] of Object.entries({DEEPSEEK_API_KEY:prior.key,DEEPSEEK_BASE_URL:prior.base,DEEPSEEK_MODEL:prior.model})){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 assert.equal(bridge.ready,true,bridge.error);await bridge.prompt(project.id,{text:'把字幕往上移 4%',selectedId:'caption-1',mode:'free'});
 for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,100));if(done&&bridge.state(project.id).status==='idle')break;}
 assert.equal((await service.get(project.id)).y,72,JSON.stringify(bridge.state(project.id)));assert.ok(calls>=3);assert.ok(bridge.state(project.id).messages.some(m=>m.role==='assistant'&&m.text.includes('72%')),JSON.stringify(bridge.state(project.id)));
 await bridge.close();const resumed=await createAgentBridge({service});t.after(()=>resumed.close());assert.ok(resumed.state(project.id).messages.some(m=>m.role==='assistant'));await resumed.prompt(project.id,{text:'确认当前修改已经保留',selectedId:'caption-1',mode:'free'});for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));if(resumed.state(project.id).status==='idle')break;}assert.ok(resumed.state(project.id).messages.filter(m=>m.role==='assistant').length>=2,JSON.stringify(resumed.state(project.id)));await resumed.close();
});

test('真实 Harness 可读取镜头素材并只修改指定镜头', {timeout:35000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-shot-agent-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=new ProjectService(dir);const project=await service.create('镜头工具测试');let calls=0,observed=false;
 const mock=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),results=body.messages.filter(m=>m.role==='tool');calls++;let delta,reason='tool_calls';
 if(!results.length)delta={role:'assistant',tool_calls:[{index:0,id:'read_shots',type:'function',function:{name:'get_project_context',arguments:'{}'}}]};
 else if(results.length===1){const c=JSON.parse(typeof results[0].content==='string'?results[0].content:results[0].content[0].text);observed=c.shots.length===3&&Array.isArray(c.assets);delta={role:'assistant',tool_calls:[{index:0,id:'edit_shot',type:'function',function:{name:'apply_project_changes',arguments:JSON.stringify({revision:c.revision,type:'shot',shotId:'shot-2',duration:5})}}]};}
 else{delta={role:'assistant',content:'第二个镜头已改为 5 秒。'};reason='stop';}
 res.writeHead(200,{'content-type':'text/event-stream'});const event=(d,finish=null)=>({id:'shot-mock-'+calls,object:'chat.completion.chunk',created:1,model:'frame-mock',choices:[{index:0,delta:d,finish_reason:finish}]});res.end('data: '+JSON.stringify(event(delta))+'\n\ndata: '+JSON.stringify(event({},reason))+'\n\ndata: [DONE]\n\n');});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));t.after(()=>mock.close());
 const names=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL'],before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 process.env.DEEPSEEK_API_KEY='test-only';process.env.DEEPSEEK_BASE_URL='http://127.0.0.1:'+mock.address().port+'/v1';process.env.DEEPSEEK_MODEL='frame-mock';
 const bridge=await createAgentBridge({service});t.after(async()=>{await bridge.close();for(const k of names){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}});
 assert.equal(bridge.ready,true,bridge.error);await bridge.prompt(project.id,{text:'只将第二个镜头改为 5 秒',selectedId:'caption-2',mode:'free'});
 for(let i=0;i<100&&bridge.state(project.id).status!=='idle';i++)await new Promise(r=>setTimeout(r,100));
 assert.equal(observed,true);const after=await service.get(project.id);assert.deepEqual(after.shots.map(s=>s.duration),[4,5,4]);assert.equal(after.history.length,1);assert.equal(after.duration,13);
 assert.ok(bridge.state(project.id).messages.some(m=>m.role==='assistant'&&m.text.includes('5 秒')));
});

test('真实 DSH 原生事件在最终回复前送出文本增量和 reasoning', {timeout:20000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-stream-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=new ProjectService(dir),p=await service.create('流式测试');let finalSent=false;const wireThinking=[];
 const mock=http.createServer(async(req,res)=>{
  let request='';for await(const part of req)request+=part;const body=JSON.parse(request);wireThinking.push({thinking:body.thinking?.type,effort:body.reasoning_effort,maxTokens:body.max_tokens||body.max_completion_tokens});res.writeHead(200,{'content-type':'text/event-stream'});
  const emit=(delta,finish=null)=>res.write('data: '+JSON.stringify({id:'stream',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason:finish}]})+'\n\n');
  emit({role:'assistant',reasoning_content:'先核对项目。'});await new Promise(r=>setTimeout(r,150));
  emit({content:'正在'});await new Promise(r=>setTimeout(r,200));emit({content:'修改'});await new Promise(r=>setTimeout(r,200));
  finalSent=true;emit({content:'文案。'});emit({},'stop');res.end('data: [DONE]\n\n');
 });await new Promise(r=>mock.listen(0,'127.0.0.1',r));t.after(()=>mock.close());
 const names=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL'],prior=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{DEEPSEEK_API_KEY:'test-local',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+mock.address().port+'/v1',DEEPSEEK_MODEL:'deepseek-flash'});
 const bridge=await createAgentBridge({service});t.after(async()=>{await bridge.close();for(const k of names){if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];}});
 let partial=false,reasoning=false;bridge.subscribe(p.id,s=>{if(!finalSent&&s.messages.some(m=>m.text==='正在'&&m.status==='streaming'))partial=true;if(s.messages.some(m=>m.reasoning==='先核对项目。'))reasoning=true;});
 await bridge.prompt(p.id,{text:'测试流式'});for(let i=0;i<100&&bridge.state(p.id).status!=='idle';i++)await new Promise(r=>setTimeout(r,100));
 assert.ok(partial,'最终回复之前必须收到 DSH 的文本增量');assert.ok(reasoning,'传递模型实际返回的 reasoning');
 assert.equal(bridge.state(p.id).messages.filter(m=>m.role==='assistant').length,1);assert.equal(bridge.state(p.id).messages.at(-1).text,'正在修改文案。');assert.deepEqual(wireThinking[0],{thinking:'enabled',effort:'max',maxTokens:393216});
 await bridge.prompt(p.id,{text:'旧客户端兼容测试',thinking:false});for(let i=0;i<100&&bridge.state(p.id).status!=='idle';i++)await new Promise(r=>setTimeout(r,100));assert.deepEqual(wireThinking[1],{thinking:'enabled',effort:'max',maxTokens:393216});
});
