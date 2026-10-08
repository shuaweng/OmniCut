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
const messageText=message=>typeof message.content==='string'?message.content:(message.content||[]).filter(part=>part.type==='text').map(part=>part.text).join('');

test('真实 DSH 的 9 镜头方案可生成 13 张图片，重复操作保持同一 requestId',{timeout:60000},async t=>{
  const dataRoot=await fs.mkdtemp(path.join(os.tmpdir(),'frame-media-generation-policy-'));
  const service=new ProjectService(dataRoot,async()=>{});
  const blank=await service.createBlank('本地媒体生成策略验证');
  const project=await service.plan(blank.id,{
    duration:36,ratio:'9:16',
    scenes:Array.from({length:9},(_,index)=>({id:'scene-'+(index+1),name:'镜头 '+(index+1),start:index*4,end:(index+1)*4,visual:'保留原镜头方案'}))
  });
  const metadataFile=path.join(service.dir(project.id),'project.json');
  const metadataBefore=await fs.readFile(metadataFile,'utf8');
  const sourceBefore=await service.raw(project.id);
  const mcpFile=path.join(dataRoot,'mcp.json');
  await fs.writeFile(mcpFile,JSON.stringify({servers:[]}));

  // The bridge uses an in-memory provider stub: no real image API or billing.
  const jobs=new Map(),submissions=[];
  let providerCalls=0;
  const images={
    list:projectId=>[...jobs.values()].filter(job=>job.projectId===projectId),
    async create(projectId,input){
      assert.equal(projectId,project.id);
      submissions.push({...input});
      if(!jobs.has(input.requestId)){
        providerCalls++;
        jobs.set(input.requestId,{id:input.requestId,taskId:'image:'+input.requestId,projectId,status:'succeeded',name:input.name,created:new Date().toISOString()});
      }
      return jobs.get(input.requestId);
    }
  };
  const tasks=new TaskRegistry().register('image',images);
  const keys=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','FRAME_MCP_CONFIG','CREATIVE_ENABLED','CREATIVE_API_KEY','CREATIVE_MODEL','CREATIVE_BASE_URL','CREATIVE_PROTOCOL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'];
  const prior=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const prompt='LOCAL_MEDIA_POLICY_13_UNIQUE_AND_ONE_RETRY';
  const done='LOCAL_MEDIA_POLICY_DONE';
  const modelErrors=[],toolResults=[];
  let modelRequests=0,bridge;
  const model=http.createServer(async(req,res)=>{
    try{
      let raw='';for await(const part of req)raw+=part;
      const body=JSON.parse(raw);
      assert.ok(body.messages.some(message=>message.role==='user'&&messageText(message)===prompt),'模型只接受本地测试提示');
      const step=modelRequests++;
      const result=body.messages.findLast(message=>message.role==='tool');
      if(result)toolResults.push(JSON.parse(messageText(result)));
      const operation=Math.min(step+1,13);
      const delta=step<14?{
        role:'assistant',tool_calls:[{index:0,id:'local-media-'+step,type:'function',function:{name:'generate_image',arguments:JSON.stringify({operationId:'image-'+operation,prompt:'本地测试图片 '+operation,name:'测试图片 '+operation})}}]
      }:{role:'assistant',content:done};
      const chunk=(value,finish=null)=>({id:'local-media-policy',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta:value,finish_reason:finish}]});
      res.writeHead(200,{'content-type':'text/event-stream'});
      res.end('data: '+JSON.stringify(chunk(delta))+'\n\ndata: '+JSON.stringify(chunk({},step<14?'tool_calls':'stop'))+'\n\ndata: [DONE]\n\n');
    }catch(error){
      modelErrors.push(error.message);
      res.writeHead(500);res.end(JSON.stringify({error:{message:error.message}}));
    }
  });
  t.after(async()=>{
    try{
      await bridge?.close();
      tasks.close();
      if(model.listening){model.closeAllConnections();await new Promise(resolve=>model.close(resolve));}
    }finally{
      for(const key of keys)if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];
      await fs.rm(dataRoot,{recursive:true,force:true});
    }
  });
  await new Promise((resolve,reject)=>{model.once('error',reject);model.listen(0,'127.0.0.1',resolve);});
  for(const key of keys)delete process.env[key];
  Object.assign(process.env,{
    DEEPSEEK_API_KEY:'local-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+model.address().port,DEEPSEEK_MODEL:'deepseek-flash',
    FRAME_MCP_CONFIG:mcpFile,CREATIVE_ENABLED:'disabled',NO_PROXY:'127.0.0.1,localhost'
  });

  bridge=await createAgentBridge({service,images,tasks,nativeWeb:true,nativePort:0});
  assert.equal(bridge.ready,true,bridge.error);
  await bridge.prompt(project.id,{text:prompt});
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
    assert.deepEqual(modelErrors,[],'本地模型协议应正常完成');
    const state=bridge.state(project.id);
    if(state.status==='idle'&&state.messages.some(message=>message.text===done))break;
    await delay(50);
  }
  const state=bridge.state(project.id);
  assert.equal(state.status,'idle',JSON.stringify(state.messages.slice(-3)));
  assert.ok(state.messages.some(message=>message.text===done),'14 次工具调用应在同一轮完成');
  assert.equal(modelRequests,15);
  assert.equal(submissions.length,14,'每次 generate_image 均应经过真实 bridge 到达媒体服务');
  assert.equal(toolResults.length,14);
  assert.equal(new Set(submissions.slice(0,13).map(input=>input.operationId)).size,13);
  assert.equal(new Set(submissions.slice(0,13).map(input=>input.requestId)).size,13);
  assert.ok(submissions.every(input=>typeof input.requestId==='string'&&input.requestId.length>0));
  assert.equal(submissions[13].operationId,submissions[12].operationId);
  assert.equal(submissions[13].requestId,submissions[12].requestId,'重复操作必须复用 requestId');
  assert.deepEqual(toolResults[13],toolResults[12],'重复操作应返回原任务');
  assert.equal(new Set(toolResults.map(result=>result.id)).size,13);
  assert.equal(providerCalls,13,'重复 requestId 不应再次触发模拟计费');
  assert.equal(jobs.size,13);
  assert.equal(state.images.length,13);
  assert.ok(state.images.every(job=>job.status==='succeeded'));
  assert.equal(state.tasks.length,13);
  assert.equal(state.messages.filter(message=>message.role==='user').length,1);
  assert.deepEqual((await service.get(project.id)).productionPlan,project.productionPlan);
  assert.equal(await fs.readFile(metadataFile,'utf8'),metadataBefore,'生成不能修改镜头方案或工程元数据');
  assert.deepEqual(await service.raw(project.id),sourceBefore,'生成不能改写时间线');
});
