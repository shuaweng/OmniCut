import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {promises as fs} from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ProjectService} from '../server/project.mjs';import {createAgentBridge} from '../server/agent.mjs';import {TaskRegistry} from '../server/task-registry.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn){for(let i=0;i<400;i++){if(await fn())return;await delay(50);}throw Error('等待原生框架超时');}
async function fixture(t,handler){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-native-test-')),service=new ProjectService(dir,async()=>{}),p=await service.create('原生隔离验证');let n=0;
 const server=http.createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;const b=JSON.parse(raw);let step;try{step=handler(b,++n);}catch(e){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));return;}const delta=step.tool?{role:'assistant',tool_calls:[{index:0,id:'native-'+n,type:'function',function:{name:step.tool,arguments:JSON.stringify(step.args||{})}}]}:{role:'assistant',content:step.text||'已完成'};const chunk=(delta,finish_reason=null)=>({id:'native',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]});res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+JSON.stringify(chunk(delta))+'\n\ndata: '+JSON.stringify(chunk({},step.tool?'tool_calls':'stop'))+'\n\ndata: [DONE]\n\n');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const keys=['DEEPSEEK_API_KEY','DEEPSEEK_BASE_URL','DEEPSEEK_MODEL','FRAME_MCP_CONFIG'],prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{DEEPSEEK_API_KEY:'local-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+server.address().port,DEEPSEEK_MODEL:'deepseek-flash'});const bridges=[];
 t.after(async()=>{for(const b of bridges)await b.close();server.close();for(const k of keys)if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];await fs.rm(dir,{recursive:true,force:true});});return {dir,service,p,bridges};}
function text(m){return typeof m.content==='string'?m.content:m.content?.filter(p=>p.type==='text').map(p=>p.text).join('')||'';}
test('原生配置加载压缩、裁剪、Skills、MCP 与代码工具，代码产物经校验入库',{timeout:45000},async t=>{
 const seen=[],results=[];let toolNames=[],limit;
 const f=await fixture(t,(b,n)=>{toolNames=b.tools.map(t=>t.function.name);limit=b.max_tokens??b.max_completion_tokens;results.push(...b.messages.filter(m=>m.role==='tool').map(text));
  const steps=[{tool:'skill',args:{name:'video-workspace'}},{tool:'write',args:{file_path:'hello.txt',content:'native DSH workspace'}},{tool:'read',args:{file_path:'hello.txt'}},{tool:'mcp__fixture__ping',args:{}},{tool:'bash',args:{description:"生成本地测试图片",command:"ffmpeg -v error -f lavfi -i color=c=orange:s=64x64 -frames:v 1 -y result.png"}},{tool:'publish_workspace_asset',args:{file:'result.png'}}];if(n===8){const result=JSON.parse(text(b.messages.findLast(m=>m.role==='tool')));return {tool:'stage_asset',args:{assetFile:result.filename}};}return steps[n-1]||(n===7?{tool:'publish_workspace_asset',args:{file:'result.png'}}:{text:'原生能力验证完成'});});
 const mcpFile=path.join(f.dir,'mcp.mjs');await fs.writeFile(mcpFile,`import readline from 'node:readline';for await(const line of readline.createInterface({input:process.stdin})){const m=JSON.parse(line);if(m.id===undefined)continue;let result=m.method==='initialize'?{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:m.method==='tools/list'?{tools:[{name:'ping',description:'本地测试',inputSchema:{type:'object',properties:{}}}]}:m.method==='tools/call'?{content:[{type:'text',text:'mcp-ok'}]}:{};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');}`);
 const config=path.join(f.dir,'mcp.json');await fs.writeFile(config,JSON.stringify({servers:[{transport:'stdio',serverName:'fixture',command:process.execPath,args:[mcpFile],cwd:f.dir}]}));process.env.FRAME_MCP_CONFIG=config;
 const b=await createAgentBridge({...f,nativeWeb:true,nativePort:0});f.bridges.push(b);assert.equal(b.ready,true,b.error);await b.ensure(f.p.id);const info=await b.inspectNative(f.p.id);assert.equal(info.compaction,true);assert.equal(info.toolResultPruner,true);assert.equal(info.cwd,path.join(f.dir,'workspaces',f.p.id));
 await b.prompt(f.p.id,{text:'验证本地工具'});await until(()=>b.state(f.p.id).status==='idle');
 assert.equal(limit,393216);for(const name of ['read','write','edit','bash','skill','job_output','mcp__fixture__ping'])assert.ok(toolNames.includes(name),name);
 assert.equal(await fs.readFile(path.join(info.cwd,'hello.txt'),'utf8'),'native DSH workspace');assert.ok(results.some(x=>x.includes('mcp-ok')));assert.ok(results.some(x=>x.includes('publish_workspace_asset')),'加载了真实技能正文');
 const assets=(await f.service.get(f.p.id)).assets;assert.equal(assets.length,1,JSON.stringify(b.state(f.p.id).messages));assert.equal(assets[0].kind,'image');assert.equal(assets[0].provenance.provider,'code');const staged=await fs.readdir(path.join(info.cwd,'input'));assert.equal(staged.length,1);assert.deepEqual(await fs.readFile(path.join(info.cwd,'input',staged[0])),await fs.readFile(path.join(info.cwd,'result.png')));
});
test('原生 Jobs 完成通知驱动同一 Agent 接续，不再由 Frame 拼接下一条 prompt',{timeout:35000},async t=>{
 let calls=0,notification=false;const f=await fixture(t,(b,n)=>{calls++;notification ||= b.messages.some(m=>text(m).includes('native-job-result'));const notice=b.messages.filter(m=>m.role==='user').map(text).findLast(x=>/background job \S+.*finished/.test(x));if(notice&&!notification)return {tool:'job_output',args:{job_id:notice.match(/background job (\S+)/)[1]}};if(n===1)return {tool:'await_tasks',args:{taskIds:['export:one'],instruction:'完成后报告结果'}};return {text:notification?'原生通知已接续':'等待结果'};});
 const job={id:'one',projectId:f.p.id,status:'running'},tasks=new TaskRegistry().register('export',{list:()=>[job]});t.after(()=>tasks.close());const b=await createAgentBridge({...f,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);assert.equal(b.ready,true,b.error);
 await b.prompt(f.p.id,{text:'等待导出并报告'});try{await until(()=>b.state(f.p.id).status==='waiting');}catch(e){throw Error(e.message+' '+JSON.stringify({calls,status:b.state(f.p.id).status,awaiting:b.state(f.p.id).awaiting,messages:b.state(f.p.id).messages.slice(-8)}));}job.status='done';job.download='native-job-result';tasks.notify(f.p.id);
 try{await until(()=>b.state(f.p.id).messages.some(m=>m.text==='原生通知已接续'));}catch(e){throw Error(e.message+' '+JSON.stringify({calls,status:b.state(f.p.id).status,awaiting:b.state(f.p.id).awaiting,messages:b.state(f.p.id).messages.slice(-8)}));}assert.ok(calls>=3);assert.equal(b.state(f.p.id).messages.filter(m=>m.role==='user').length,1);assert.equal(b.state(f.p.id).awaiting,null);
});

test('等待可跨 DSH 重启恢复；重复初始化不会重复会话或提交媒体任务',{timeout:35000},async t=>{
 let waits=0;const f=await fixture(t,(b,n)=>{
  const notice=b.messages.filter(m=>m.role==='user').map(text).findLast(x=>/background job \S+.*finished/.test(x));
  if(b.messages.some(m=>m.role==='tool'&&text(m).includes('restored-result')))return {text:'重启后已完成'};
  if(notice)return {tool:'job_output',args:{job_id:notice.match(/background job (\S+)/)[1]}};
  if(n===1){waits++;return {tool:'await_tasks',args:{taskIds:['export:restore'],instruction:'完成后报告'}};}
  return {text:'等待导出'};
 });
 const job={id:'restore',projectId:f.p.id,status:'running'},tasks=new TaskRegistry().register('export',{list:()=>[job]});t.after(()=>tasks.close());
 let b=await createAgentBridge({...f,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);
 const ids=await Promise.all([b.ensure(f.p.id),b.ensure(f.p.id),b.ensure(f.p.id)]);assert.equal(new Set(ids).size,1);
 await b.prompt(f.p.id,{text:'等候导出'});await until(()=>b.state(f.p.id).status==='waiting');await b.close();
 job.status='done';job.download='restored-result';
 b=await createAgentBridge({...f,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);
 await until(()=>b.state(f.p.id).messages.some(m=>m.text==='重启后已完成'));
 assert.equal(b.state(f.p.id).sessionId,ids[0]);assert.equal(waits,1);assert.equal(b.state(f.p.id).awaiting,null);
});

test('停止等待不会在媒体完成后自动复活 Agent',{timeout:35000},async t=>{
 let calls=0;const f=await fixture(t,(b,n)=>{calls++;return n===1?{tool:'await_tasks',args:{taskIds:['export:cancel'],instruction:'报告结果'}}:{text:'等待中'};});
 const job={id:'cancel',projectId:f.p.id,status:'running'},tasks=new TaskRegistry().register('export',{list:()=>[job]});t.after(()=>tasks.close());
 const b=await createAgentBridge({...f,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);await b.prompt(f.p.id,{text:'等候导出'});await until(()=>b.state(f.p.id).status==='waiting');
 await b.cancel(f.p.id);job.status='done';tasks.notify(f.p.id);const before=calls;await delay(350);assert.equal(calls,before);assert.equal(b.state(f.p.id).awaiting,null);assert.equal(b.state(f.p.id).status,'idle');
});

test('真实 DSH 裁剪与压缩写入持久会话，压缩后仍能继续',{timeout:35000},async t=>{
 let summaryRequests=0;const f=await fixture(t,(b,n)=>{
  if(n===3){summaryRequests++;return {text:'<summary>Goal: verify compaction. Completed: read large.txt. Continue responding without further actions.</summary>'};}
  if(n===1)return {tool:'read',args:{file_path:'large.txt'}};
  return {text:'读取完成'};
 });
 const b=await createAgentBridge({...f,nativeWeb:true,nativePort:0});f.bridges.push(b);await b.ensure(f.p.id);const info=await b.inspectNative(f.p.id);
 await fs.writeFile(path.join(info.cwd,'large.txt'),Array.from({length:180},(_,i)=>'line '+i+' '+('test content '.repeat(12))).join('\n'));
 await b.prompt(f.p.id,{text:'读取 large.txt'});await until(()=>b.state(f.p.id).status==='idle');
 const compact=await b.inspectNative(f.p.id,true);assert.equal(compact.compacted,true,JSON.stringify(compact));assert.ok(summaryRequests>0);
 const sessionFiles=await fs.readdir(path.join(f.dir,'sessions'),{recursive:true});let log='';for(const file of sessionFiles)if(file.endsWith('.jsonl'))log+=await fs.readFile(path.join(f.dir,'sessions',file),'utf8');
 assert.ok(log.includes('compaction/prune'),'持久化裁剪');assert.ok(log.includes('compaction/summary'),'持久化压缩');
 await b.prompt(f.p.id,{text:'继续'});await until(()=>b.state(f.p.id).status==='idle');assert.equal(b.state(f.p.id).messages.at(-1).text,'读取完成');
});

test('原生 Agent 生成配音、去重、等待后自动入轨，下一轮可修改手动音轨',{timeout:45000},async t=>{
 const {AudioGenerationService}=await import('../server/audio-generation.mjs');const {run}=await import('../server/project.mjs');
 let stage=0,taskId,assetFile,revision,trackId,providerCalls=0;
 const f=await fixture(t,(b,n)=>{
  const last=b.messages.findLast(m=>m.role==='tool'),result=last?text(last):'';
  if(stage===0){stage++;return {tool:'generate_audio',args:{operationId:'narration-one',kind:'speech',text:'你好'}};}
  if(stage===1){taskId=JSON.parse(result).taskId;stage++;return {tool:'generate_audio',args:{operationId:'narration-one',kind:'speech',text:'你好'}};}
  if(stage===2){assert.equal(JSON.parse(result).taskId,taskId);stage++;return {tool:'await_tasks',args:{taskIds:[taskId],instruction:'完成后添加旁白'}};}
  const notice=b.messages.filter(m=>m.role==='user').map(text).findLast(x=>/background job \S+.*finished/.test(x));
  if(stage===3){if(!notice)return {text:'等待声音'};stage++;return {tool:'job_output',args:{job_id:notice.match(/background job (\S+)/)[1]}};}
  if(stage===4){stage++;return {tool:'get_project_context',args:{}};}
  if(stage===5){const p=JSON.parse(result);assert.ok(p.audioConfiguration);assetFile=p.assets.find(a=>a.kind==='audio').filename;revision=p.revision;stage++;return {tool:'edit_audio_track',args:{revision,type:'audio',action:'add',assetFile,role:'narration',start:1,duration:1}};}
  if(stage===6){const p=JSON.parse(result);assert.equal(p.audioTracks.length,1);stage++;return {text:'旁白已加入'};}
  if(stage===7){stage++;return {tool:'get_project_context',args:{}};}
  if(stage===8){const p=JSON.parse(result);trackId=p.audioTracks.find(a=>a.role==='music').id;stage++;return {tool:'edit_audio_track',args:{revision:p.revision,type:'audio',action:'update',trackId,gain:.15,fadeIn:.1}};}
  return {text:'手动音轨已修改'};
 });
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=330:duration=2','-y',path.join(f.dir,'tone.wav')]);const bytes=await fs.readFile(path.join(f.dir,'tone.wav'));let release;const gate=new Promise(r=>release=r);
 const audio=new AudioGenerationService({service:f.service,getConfig:async()=>({ELEVENLABS_API_KEY:'local-fixture'}),fetcher:async()=>{providerCalls++;await gate;return Response.json({audio_base64:bytes.toString('base64')});}});await audio.init();const tasks=new TaskRegistry().register('audio',audio);t.after(async()=>{release();tasks.close();await audio.close();});
 const b=await createAgentBridge({...f,audio,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);assert.equal(b.ready,true,b.error);
 await b.prompt(f.p.id,{text:'生成一句旁白并放到第 1 秒'});await until(()=>b.state(f.p.id).status==='waiting');release();
 await until(()=>b.state(f.p.id).status==='idle'&&b.state(f.p.id).messages.some(m=>m.text==='旁白已加入'));
 let p=await f.service.get(f.p.id);assert.equal(p.audioTracks[0].start,1);assert.equal(providerCalls,1);assert.equal(p.assets.length,1);
 p=await f.service.change(p.id,p.revision,{type:'audio',action:'add',assetFile,role:'music',duration:2,gain:.5});
 await b.prompt(p.id,{text:'把我手动添加的配乐调低至 15%，加一点淡入'});await until(()=>b.state(p.id).status==='idle'&&b.state(p.id).messages.some(m=>m.text==='手动音轨已修改'));
 p=await f.service.get(p.id);assert.equal(p.audioTracks.find(a=>a.id===trackId).gain,.15);assert.equal(p.audioTracks.length,2);assert.equal(providerCalls,1);
});

test('素材完成可解除同一轮 job_output 阻塞，不等模型先结束',{timeout:35000},async t=>{
 let jobId,waiting=false,completed=false;
 const f=await fixture(t,(body,n)=>{
  const last=body.messages.findLast(m=>m.role==='tool'),result=last?text(last):'';
  if(n===1)return {tool:'await_tasks',args:{taskIds:['export:blocking'],instruction:'直接读取完成结果',nextStep:'检查成片'}};
  if(n===2){jobId=JSON.parse(result).jobId;waiting=true;return {tool:'job_output',args:{job_id:jobId,wait:true,timeout_ms:10000}};}
  if(result.includes('blocking-result'))completed=true;
  return {text:completed?'同轮等待已解除':'未取得结果'};
 });
 const job={id:'blocking',projectId:f.p.id,status:'running'},tasks=new TaskRegistry().register('export',{list:()=>[job]});t.after(()=>tasks.close());
 const b=await createAgentBridge({...f,tasks,nativeWeb:true,nativePort:0});f.bridges.push(b);await b.prompt(f.p.id,{text:'生成后同轮等待'});
 await until(()=>waiting);assert.equal(b.state(f.p.id).status,'running');job.status='done';job.download='blocking-result';tasks.notify(f.p.id);
 await until(()=>completed&&b.state(f.p.id).status==='idle');assert.equal(b.state(f.p.id).awaiting,null);
});

test('DSH 加载原版 Hypit Skill，用原生选区和 mutation 编辑手改工程',{timeout:45000},async t=>{
 const {NativeEngine}=await import('../server/native-engine.mjs'),{NativeRuntime}=await import('../server/native-runtime.mjs');
 const {StudioManager}=await import('../server/studio-manager.mjs'),{StudioHost}=await import('../server/studio-host.mjs');
 const {root,hypit,run}=await import('../server/project.mjs'),{importAsset}=await import('../server/assets.mjs');
 let offered=false,skillLoaded=false,selected=false;
 const f=await fixture(t,(body,n)=>{
  offered ||= !body.tools.some(t=>t.function.name==='compose_video')&&body.tools.some(t=>t.function.name==='edit_hypit_scene');
  const result=text(body.messages.findLast(m=>m.role==='tool')||{});
  if(n===1)return {tool:'skill',args:{name:'hypit'}};
  if(n===2){skillLoaded=result.includes('Author Packages')&&result.includes('Hypit');return {tool:'get_project_context',args:{}};}
  if(n===3){const context=JSON.parse(result);selected=context.selection?.entity?.id===clip.id;return {tool:'inspect_hypit_scene',args:{}};}
  if(n===4){const scene=JSON.parse(result),c=scene.tracks.flatMap(t=>t.clips).find(c=>c.id===clip.id),gain=c.inspector.find(p=>p.label==='Gain');return {tool:'edit_hypit_scene',args:{mutation:JSON.stringify({revision:scene.revision,mutations:[{type:'parameter.adjust',entityId:c.id,parameterId:gain.id,value:gain.controlValue/2}]})}};}
  return {text:'已调整选中音轨，保留手动编辑'};
 });
 const blank=await f.service.createBlank('原生协作隔离验证');
 const image=await importAsset(f.service.dir(blank.id),await fs.readFile(path.join(root,'sample-assets/sage-tumbler.png')),'商品.png');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=220:duration=2','-y',path.join(f.dir,'music.wav')]);
 const audio=await importAsset(f.service.dir(blank.id),await fs.readFile(path.join(f.dir,'music.wav')),'配乐.wav');
 const engine=new NativeEngine({service:f.service,root,hypit,run});f.service.engine=engine;engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 await engine.compose(blank.id,blank.revision,{output:{width:320,height:480,fps:24},duration:2,shots:[{id:'product',kind:'image',assetFile:image.filename,start:0,duration:2}],audio:[{id:'music',assetFile:audio.filename,start:0,duration:2,gain:.2}]});
 await fs.appendFile(path.join(f.service.dir(blank.id),'main.svml'),'\n<!-- 用户手动组件，不可覆盖 -->');
 const studios=new StudioManager({service:f.service,root,hypit,prepare:id=>engine.runtime.prepare(f.service.dir(id))}),host=new StudioHost({service:f.service,engine,studios});
 t.after(async()=>{for(const id of studios.sessions.keys())await studios.stop(id);});
 const snapshot=id=>studios.snapshot(id),initial=await snapshot(blank.id),clip=initial.tracks.flatMap(t=>t.clips).find(c=>c.inspector.some(p=>p.label==='Gain'));
 const b=await createAgentBridge({...f,engine,snapshot,studioMutation:(id,input)=>host.mutate(id,input),nativeWeb:true,nativePort:0});f.bridges.push(b);
 await b.select(blank.id,{nativeSelection:{kind:'clip',clipId:clip.id},playhead:12});
 await b.prompt(blank.id,{text:'把选中的音乐音量改成 0.1，保留其他手动编辑，不生成素材'});
 await until(()=>b.state(blank.id).status==='idle');assert.equal(offered,true);assert.equal(skillLoaded,true,'加载原仓库的真实技能内容');assert.equal(selected,true,'Agent 知道用户在 Studio 的真实选区');
 const final=await snapshot(blank.id);assert.equal(Number(final.tracks.flatMap(t=>t.clips).find(c=>c.id===clip.id).inspector.find(p=>p.label==='Gain').value),.1);
 assert.ok((await fs.readFile(path.join(f.service.dir(blank.id),'main.svml'),'utf8')).includes('用户手动组件，不可覆盖'));
 assert.equal((await f.service.get(blank.id)).assets.length,2);
});
