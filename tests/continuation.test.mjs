import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {ImageGenerationService} from '../server/image-generation.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
import {createAgentBridge} from '../server/agent.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<160;i++){if(await fn())return;await delay(50);}throw Error('等待超时');}
async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-continuation-')),service=new ProjectService(dir,async()=>{}),project=await service.create('隔离任务接续');let release;
 const ready=new Promise(r=>release=r),images=new ImageGenerationService({service,getConfig:async()=>({ARK_API_KEY:'mock-only'}),fetcher:async()=>{await ready;const b=await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url));return new Response(JSON.stringify({data:[{b64_json:b.toString('base64')}]}));}});await images.init();const tasks=new TaskRegistry().register('image',images);const bridges=[];
 t.after(async()=>{release();for(const b of bridges)await b.close();tasks.close();await images.close();await fs.rm(dir,{recursive:true,force:true});});return {dir,service,project,images,tasks,release,bridges};
}
async function mockModel(t,handler){let count=0;const server=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;let step;try{step=handler(JSON.parse(raw));}catch(e){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));return;}count++;const call=step.reasoningOnly?{role:'assistant',reasoning_content:'分析中'}:step.name?{role:'assistant',tool_calls:[{index:0,id:'call-'+count,type:'function',function:{name:step.name,arguments:JSON.stringify(step.args||{})}}]}:{role:'assistant',content:step.text||'已提交'};const event=(delta,finish_reason=null)=>({id:'m'+count,object:'chat.completion.chunk',created:1,model:'deepseek-chat',choices:[{index:0,delta,finish_reason}]});res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify(event(call))+'\n\ndata: '+JSON.stringify(event({},step.name?'tool_calls':'stop'))+'\n\ndata: [DONE]\n\n');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const keys=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{DEEPSEEK_API_KEY:'local-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1',DEEPSEEK_MODEL:'deepseek-chat'});t.after(()=>{server.close();for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});return ()=>count;}
function lastTurn(body){const i=body.messages.findLastIndex(m=>m.role==='user'),content=body.messages[i].content,raw=typeof content==='string'?content:content.find(c=>c.type==='text')?.text;return {prompt:JSON.parse(raw.slice(raw.indexOf('{'))),tools:body.messages.slice(i+1).filter(m=>m.role==='tool').map(m=>JSON.parse(typeof m.content==='string'?m.content:m.content[0].text))};}

test('真实 DSH 跨异步图片、剪辑、导出连续执行；不用第二条用户消息', {timeout:30000},async t=>{
 const f=await fixture(t);let exports=[];f.tasks.register('export',{list:()=>exports});
 await mockModel(t,body=>{const {prompt,tools}=lastTurn(body);
  if(!prompt.taskContinuation){if(!tools.length)return {name:'generate_image',args:{operationId:'opening',prompt:'橙色商品背景'}};if(tools.length===1)return {name:'await_tasks',args:{taskIds:[tools[0].taskId],instruction:'将生成图片用于第一个镜头，然后导出'}};return {text:'正在生成'};}
  if(prompt.taskContinuation.results[0].kind==='image'){
   if(!tools.length)return {name:'apply_project_changes',args:{revision:prompt.project.revision,type:'shot',shotId:'shot-1',assetFile:prompt.taskContinuation.results[0].result.assetFile}};
   if(tools.length===1)return {name:'export_video',args:{revision:tools[0].revision}};
   if(tools.length===2)return {name:'await_tasks',args:{taskIds:['export:'+tools[1].id],instruction:'报告导出结果'}};
   return {text:'正在导出'};
  }return {text:'完整任务已完成'};
 });
 const bridge=await createAgentBridge({...f,exportVideo:async id=>{const job={id:'export-test',projectId:id,status:'running'};exports.push(job);setTimeout(()=>{job.status='done';job.download='/local-result';f.tasks.notify(id);},200);return job;},getExports:()=>exports});f.bridges.push(bridge);assert.equal(bridge.ready,true,bridge.error);
 await bridge.prompt(f.project.id,{text:'生成一张背景，用于第一个镜头并导出'});await until(()=>bridge.state(f.project.id).status==='waiting');f.release();
 await until(()=>bridge.state(f.project.id).messages.some(m=>m.text==='完整任务已完成')&&bridge.state(f.project.id).status==='idle');const state=bridge.state(f.project.id),p=await f.service.get(f.project.id);assert.equal(state.messages.filter(m=>m.role==='user').length,1);assert.equal(state.continuations,2);assert.ok(state.messages.some(m=>m.text==='正在生成'));assert.ok(state.messages.some(m=>m.text==='正在导出'));assert.equal(f.images.list(p.id).length,1);assert.equal(exports.length,1);assert.equal(p.shots[0].assetFile,p.assets[0].filename);assert.deepEqual(p.shots.slice(1),f.project.shots.slice(1));
});

test('等待期间停止后，任务即使完成也不会自动修改作品', {timeout:20000},async t=>{
 const f=await fixture(t);const calls=await mockModel(t,body=>{const {tools}=lastTurn(body);if(!tools.length)return {name:'generate_image',args:{operationId:'stop-test',prompt:'生成背景'}};if(tools.length===1)return {name:'await_tasks',args:{taskIds:[tools[0].taskId],instruction:'继续剪辑'}};return {text:'等待生成'};});
 const bridge=await createAgentBridge(f);f.bridges.push(bridge);await bridge.prompt(f.project.id,{text:'生成图片后剪辑'});await until(()=>bridge.state(f.project.id).status==='waiting');const before=calls();await bridge.cancel(f.project.id);f.release();await Promise.all(f.images.work.values());await delay(200);assert.equal(calls(),before);assert.equal((await f.service.get(f.project.id)).revision,f.project.revision);assert.equal(bridge.state(f.project.id).awaiting,null);
});

test('服务重启恢复等待，复用原生成任务并接续原会话', {timeout:25000},async t=>{
 const f=await fixture(t);await mockModel(t,body=>{const {prompt,tools}=lastTurn(body);if(prompt.taskContinuation)return {text:'恢复成功'};if(!tools.length)return {name:'generate_image',args:{operationId:'restart',prompt:'生成背景'}};if(tools.length===1)return {name:'await_tasks',args:{taskIds:[tools[0].taskId],instruction:'完成后报告'}};return {text:'等待生成'};});
 const first=await createAgentBridge(f);f.bridges.push(first);await first.prompt(f.project.id,{text:'生成一张图片'});await until(()=>first.state(f.project.id).status==='waiting');await first.close();f.release();await Promise.all(f.images.work.values());const second=await createAgentBridge(f);f.bridges.push(second);await until(()=>second.state(f.project.id).messages.some(m=>m.text==='恢复成功'));assert.equal(f.images.list(f.project.id).length,1);assert.equal(second.state(f.project.id).messages.filter(m=>m.role==='user').length,1);
});

test('新的用户指令替代旧等待，不被稍后完成的任务抢回控制', {timeout:20000},async t=>{
 const f=await fixture(t);const calls=await mockModel(t,body=>{const {prompt,tools}=lastTurn(body);if(prompt.userRequest==='新的指令')return {text:'已切换到新指令'};if(!tools.length)return {name:'generate_image',args:{operationId:'supersede',prompt:'生成背景'}};if(tools.length===1)return {name:'await_tasks',args:{taskIds:[tools[0].taskId],instruction:'继续原任务'}};return {text:'等待'};});
 const bridge=await createAgentBridge(f);f.bridges.push(bridge);await bridge.prompt(f.project.id,{text:'生成图片并剪辑'});await until(()=>bridge.state(f.project.id).status==='waiting');await bridge.prompt(f.project.id,{text:'新的指令'});await until(()=>bridge.state(f.project.id).status==='idle');const before=calls();f.release();await Promise.all(f.images.work.values());await delay(150);assert.equal(calls(),before);assert.equal(bridge.state(f.project.id).awaiting,null);assert.equal((await f.service.get(f.project.id)).revision,f.project.revision);
});

test('只有思考没有正文或操作时明确报错，不显示假完成', {timeout:15000},async t=>{
 const f=await fixture(t);await mockModel(t,()=>({reasoningOnly:true}));const bridge=await createAgentBridge(f);f.bridges.push(bridge);await bridge.prompt(f.project.id,{text:'执行测试'});await until(()=>bridge.state(f.project.id).status==='idle');assert.ok(bridge.state(f.project.id).messages.some(m=>m.role==='error'&&m.text.includes('未返回可见答复')));
});
