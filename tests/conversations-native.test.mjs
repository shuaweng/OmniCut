import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {createAgentBridge} from '../server/agent.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const messageText=m=>typeof m.content==='string'?m.content:(m.content||[]).filter(part=>part.type==='text').map(part=>part.text).join('');
async function until(check,label){for(let i=0;i<400;i++){if(await check())return;await delay(50);}throw Error('等待超时：'+label);}

test('真实 DSH 同项目两对话隔离任务、停止和重启后的原生接续',{timeout:90000},async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'frame-conversations-native-'));
 const service=new ProjectService(data,async()=>{}),project=await service.createBlank('本地多对话隔离验证');
 const mcp=path.join(data,'mcp.json');await fs.writeFile(mcp,'{"servers":[]}');
 const jobs=new Map(),requests=[],bridges=[];
 let count=0;
 const model=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const part of req)raw+=part;
   const body=JSON.parse(raw),messages=body.messages;
   const index=messages.findLastIndex(m=>m.role==='user'&&/^(?:CONV|RESTORE)_[AB]$/.test(messageText(m)));
   assert.ok(index>=0,'模型只接受本地测试的显式提示');
   const label=messageText(messages[index]),segment=messages.slice(index),tools=segment.filter(m=>m.role==='tool'),outputs=tools.map(messageText);
   requests.push({label,texts:messages.filter(m=>m.role==='user').map(messageText)});
   let step;
   if(outputs.some(text=>text.includes('task-result-'+label)))step={text:'DONE_'+label};
   else{
    const notice=segment.filter(m=>m.role==='user').map(messageText).findLast(text=>/background job \S+.*finished/.test(text));
    if(notice)step={tool:'job_output',args:{job_id:notice.match(/background job (\S+)/)[1]}};
    else if(!outputs.some(text=>text.includes('export-'+label)))step={tool:'export_video',args:{revision:project.revision,summary:label}};
    else if(!outputs.some(text=>text.includes('"waitId"')))step={tool:'await_tasks',args:{taskIds:['export:export-'+label],instruction:'完成后报告 '+label}};
    else step={text:'WAIT_'+label};
   }
   const delta=step.tool?{role:'assistant',tool_calls:[{index:0,id:'local-'+(++count),type:'function',function:{name:step.tool,arguments:JSON.stringify(step.args)}}]}:{role:'assistant',content:step.text};
   const chunk=(value,finish=null)=>({id:'local-conversations',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta:value,finish_reason:finish}]});
   res.writeHead(200,{'content-type':'text/event-stream'});
   res.end('data: '+JSON.stringify(chunk(delta))+'\n\ndata: '+JSON.stringify(chunk({},step.tool?'tool_calls':'stop'))+'\n\ndata: [DONE]\n\n');
  }catch(error){res.writeHead(500);res.end(JSON.stringify({error:{message:error.message}}));}
 });
 await new Promise(resolve=>model.listen(0,'127.0.0.1',resolve));
 const keys=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','FRAME_MCP_CONFIG','CREATIVE_ENABLED','CREATIVE_API_KEY','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'];
 const prior=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 for(const key of keys)delete process.env[key];
 Object.assign(process.env,{DEEPSEEK_API_KEY:'local-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+model.address().port,DEEPSEEK_MODEL:'deepseek-flash',FRAME_MCP_CONFIG:mcp,CREATIVE_ENABLED:'disabled',NO_PROXY:'127.0.0.1,localhost'});
 const tasks=new TaskRegistry().register('export',{list:id=>[...jobs.values()].filter(job=>job.projectId===id)});
 t.after(async()=>{
  for(const bridge of bridges)await bridge.close();tasks.close();model.closeAllConnections();await new Promise(resolve=>model.close(resolve));
  for(const key of keys)if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];
  await fs.rm(data,{recursive:true,force:true});
 });
 const start=async()=>{
  const bridge=await createAgentBridge({service,tasks,nativeWeb:true,nativePort:0,getExports:id=>[...jobs.values()].filter(job=>job.projectId===id),exportVideo:async(id,_revision,label)=>{
   const job={id:'export-'+label,projectId:id,name:label,status:'running',created:new Date().toISOString()};
   assert.ok(!jobs.has(job.id),'恢复时不能重复提交任务');jobs.set(job.id,job);return job;
  }});
  bridges.push(bridge);assert.equal(bridge.ready,true,bridge.error);return bridge;
 };
 let bridge=await start();
 const a=await bridge.createConversation(project.id,{title:'对话 A'}),b=await bridge.createConversation(project.id,{title:'对话 B'});
 const ids=await Promise.all([bridge.ensure(project.id,a.id),bridge.ensure(project.id,b.id)]);
 assert.notEqual(ids[0],ids[1]);
 const state=id=>bridge.state(project.id,id);
 await Promise.all([bridge.prompt(project.id,{conversationId:a.id,text:'CONV_A'}),bridge.prompt(project.id,{conversationId:b.id,text:'CONV_B'})]);
 await until(()=>state(a.id).status==='waiting'&&state(b.id).status==='waiting','两个会话分别等待');
 assert.deepEqual(state(a.id).exports.map(job=>job.id),['export-CONV_A']);
 assert.deepEqual(state(b.id).exports.map(job=>job.id),['export-CONV_B']);
 assert.deepEqual(state(a.id).tasks.map(job=>job.id),['export:export-CONV_A']);
 assert.deepEqual(state(b.id).tasks.map(job=>job.id),['export:export-CONV_B']);
 assert.ok(state(a.id).messages.some(m=>m.text==='WAIT_CONV_A'));
 assert.ok(state(b.id).messages.some(m=>m.text==='WAIT_CONV_B'));
 await bridge.cancel(project.id,a.id);
 await until(()=>state(a.id).status==='idle','A 停止等待');
 assert.equal(state(b.id).status,'waiting');
 const callsA=requests.filter(item=>item.label==='CONV_A').length;
 for(const label of ['CONV_A','CONV_B'])Object.assign(jobs.get('export-'+label),{status:'done',download:'task-result-'+label});
 tasks.notify(project.id);
 await until(()=>state(b.id).status==='idle'&&state(b.id).messages.some(m=>m.text==='DONE_CONV_B'),'B 独立接续');
 assert.equal(requests.filter(item=>item.label==='CONV_A').length,callsA);
 assert.equal(state(a.id).awaiting,null);
 assert.ok(!state(a.id).messages.some(m=>m.text==='DONE_CONV_B'));
 await Promise.all([bridge.prompt(project.id,{conversationId:a.id,text:'RESTORE_A'}),bridge.prompt(project.id,{conversationId:b.id,text:'RESTORE_B'})]);
 await until(()=>state(a.id).status==='waiting'&&state(b.id).status==='waiting','重启前两个会话分别等待');
 await bridge.close();
 for(const label of ['RESTORE_A','RESTORE_B'])Object.assign(jobs.get('export-'+label),{status:'done',download:'task-result-'+label});
 bridge=await start();
 await until(()=>[a,b].every((item,i)=>state(item.id).status==='idle'&&state(item.id).messages.some(m=>m.text==='DONE_RESTORE_'+(i?'B':'A'))),'重启恢复各自等待');
 assert.deepEqual([state(a.id).sessionId,state(b.id).sessionId],ids);
 assert.equal(jobs.size,4);
 assert.equal(state(a.id).awaiting,null);assert.equal(state(b.id).awaiting,null);
 for(const item of requests){const other=item.label.endsWith('A')?'B':'A';assert.ok(!item.texts.some(text=>new RegExp('^(?:CONV|RESTORE)_'+other+'$').test(text)),'模型上下文不得串入另一段对话');}
 assert.deepEqual(bridge.state(project.id).messages,[],'默认对话未接收其他对话消息');
});
