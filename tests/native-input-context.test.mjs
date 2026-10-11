import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectService} from '../server/project.mjs';
import {SkillLibrary} from '../server/skill-library.mjs';
import {createAgentBridge} from './fixtures/isolated-agent-bridge.mjs';
import {conversationWorkspace} from '../server/conversation-workspace.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<600;i++){if(await fn())return;await delay(25);}throw Error('native input fixture timed out');}
function stream(res,delta,reason='stop'){
 const chunk=(value,finish=null)=>({id:'local-input-only',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta:value,finish_reason:finish}]});
 res.writeHead(200,{'content-type':'text/event-stream'});res.end(`data: ${JSON.stringify(chunk(delta))}\n\ndata: ${JSON.stringify(chunk({},reason))}\n\ndata: [DONE]\n\n`);
}
function contextCall(res,index){stream(res,{role:'assistant',tool_calls:[{index:0,id:'context-'+index,type:'function',function:{name:'get_project_context',arguments:'{}'}}]},'tool_calls');}
function latestContext(body){const item=body.messages.findLast(m=>m.role==='tool');return JSON.parse(typeof item.content==='string'?item.content:item.content.filter(p=>p.type==='text').map(p=>p.text).join(''));}

test('native user input synchronizes scoped references, fixed brand, lazy skills and variant cwd before requests',{timeout:60000},async t=>{
 // All provider traffic is a local HTTP fixture. DSH and every project, skill,
 // session and media record live under this disposable root; no .env is read.
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-input-')));
 const service=new ProjectService(dir,async()=>{}),skills=new SkillLibrary({service,availableDependencies:[]});
 const p=await service.create('引用验证'),variant=await service.createVariant(p.id,{name:'变体'}),foreign=await service.createBlank('其他项目'),foreignVideo=await service.createVariant(foreign.id,{name:'其他视频'});
 await fs.appendFile(path.join(service.projectDir(p.id),'productions',variant.videoId,'look.svs'),'\n');
 const actualVariant=await service.getVideo(p.id,variant.videoId),brand={brandId:'b-0123456789ab',version:1,snapshot:{name:'固定品牌',version:1,visualRules:'保持原蓝色'}};
 const metaFile=path.join(service.projectDir(p.id),'project.json'),meta=JSON.parse(await fs.readFile(metaFile,'utf8'));meta.brand=brand;await fs.writeFile(metaFile,JSON.stringify(meta));
 const requests=[],errors=[],prior={},exports=[{id:'one',projectId:p.id,videoId:'v-default',status:'done'},{id:'two',projectId:p.id,videoId:variant.videoId,status:'done'}];let held,bridge;
 const mock=http.createServer(async(req,res)=>{try{let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);requests.push(body);assert.equal(req.headers.authorization,'Bearer fixture-input-only');assert.match(req.url,/chat\/completions$/);
  if(requests.length===1||requests.length===3||requests.length===7)contextCall(res,requests.length);
  else if(requests.length===2)held=res;
  else if(requests.length===5)stream(res,{role:'assistant',tool_calls:[{index:0,id:'cross-stage',type:'function',function:{name:'stage_export',arguments:JSON.stringify({videoId:variant.videoId,jobId:'two'})}}]},'tool_calls');
  else stream(res,{role:'assistant',content:'NATIVE_INPUT_COMPLETE'});
 }catch(e){errors.push(e);res.writeHead(500);res.end('{}');}});
 await new Promise((r,j)=>{mock.once('error',j);mock.listen(0,'127.0.0.1',r);});
 const values={AGENT_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'fixture-input-only',DEEPSEEK_MODEL:'deepseek-flash',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+mock.address().port,CREATIVE_ENABLED:'disabled',CREATIVE_API_KEY:'',AGENT_API_KEY:'',FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json'),HTTP_PROXY:'',HTTPS_PROXY:'',ALL_PROXY:'',NO_PROXY:'localhost,127.0.0.1',http_proxy:'',https_proxy:'',all_proxy:'',no_proxy:'localhost,127.0.0.1'};
 for(const [key,value] of Object.entries(values)){prior[key]=process.env[key];process.env[key]=value;}await fs.writeFile(values.FRAME_MCP_CONFIG,'{"servers":[]}');
 t.after(async()=>{held?.destroy();await bridge?.close();mock.closeAllConnections();await new Promise(r=>mock.close(r));for(const [key,value] of Object.entries(prior))if(value===undefined)delete process.env[key];else process.env[key]=value;await fs.rm(dir,{recursive:true,force:true});});
 await fs.mkdir(path.join(dir,'exports','two'),{recursive:true});await fs.writeFile(path.join(dir,'exports','two','final.mp4'),'ISOLATED_STAGING_BYTES');
 bridge=await createAgentBridge({service,skills,getExportStatus:async(pid,id)=>{assert.equal(pid,p.id);assert.equal(service.currentVideoId(pid),variant.videoId);return exports.find(job=>job.id===id);},references:{list:()=>[],subscribe:()=>()=>{},configuration:async()=>({provider:'gemini',model:'gemini-local-declaration',mode:'video-audio',configured:false})},nativeWeb:true,nativePort:0,getExports:(pid,all=false)=>exports.filter(e=>e.projectId===pid&&(all||e.videoId===service.currentVideoId(pid)))});assert.equal(bridge.ready,true,bridge.error);
 const cid=(await bridge.createConversation(p.id,{title:'引用'})).id;
 const ref=(id,video,revision)=>({id,projectId:p.id,videoId:video,kind:'range',revision,startFrame:0,endFrameExclusive:30,frameRate:{numerator:30,denominator:1},label:id});
 const first=ref('原视频','v-default',p.revision),second=ref('变体',variant.videoId,actualVariant.revision);
 await bridge.configureInput(p.id,{conversationId:cid,references:[first]});
 await assert.rejects(bridge.configureInput(p.id,{conversationId:cid,references:[{...second,videoId:foreignVideo.videoId}]}),/不属于当前项目/);
 await assert.rejects(bridge.configureInput(p.id,{conversationId:cid,references:[{...second,projectId:foreign.id}]}),/不属于当前项目/);
 assert.equal(bridge.input(p.id,cid).references[0].id,first.id,'failed references must not replace valid input');
 const sessionId=await bridge.ensure(p.id,cid),entry=await fetch(bridge.authURL,{redirect:'manual'}),cookie=entry.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 async function rpc(text,mode='queue',targetSession=sessionId){
  const endpoint='session/prompt',r=await fetch(new URL('/api/'+endpoint,bridge.authURL),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args:{request:{sessionId:targetSession,requestId:crypto.randomUUID(),mode,content:[{type:'text',text}]}}}})});
  assert.equal(r.status,200);const result=(await r.json()).result;assert.equal(result.ok,true,JSON.stringify(result.error));
 }
 await rpc('比较这个片段，但先处理当前视频');await until(()=>requests.length===2&&held);
 const initial=latestContext(requests[1]);assert.deepEqual(initial.brand,brand);assert.equal(initial.videoUnderstandingConfiguration.mode,'video-audio');assert.equal(initial.conversation.references.length,1);assert.equal(bridge.input(p.id,cid).references.length,0);
 assert.equal(initial.workspace.directory,conversationWorkspace(dir,p.id,cid));assert.equal(initial.videoId,'v-default');assert.ok(!JSON.stringify(requests[0]).includes('next-turn-hook'));
 const item=await skills.import({files:{'SKILL.md':'---\nname: next-turn-hook\ndescription: 调整当前视频开场。\n---\n沿用当前视频和素材，先读取现有工程再编辑开场。'}});
 await skills.enable(p.id,item.id,true,{defer:true});await bridge.refreshSkills(p.id);
 await assert.rejects(fs.access(path.join(initial.workspace.directory,'.skills',item.id,'SKILL.md')),{code:'ENOENT'});
 const turnId=bridge.state(p.id,cid).turnId;
 await bridge.configureInput(p.id,{conversationId:cid,references:[second]});await rpc('补充比较变体片段，保持当前任务','steer');stream(held,{role:'assistant',content:'准备继续'});held=null;
 await until(()=>requests.length>=4&&bridge.state(p.id,cid).status==='idle');assert.equal(errors.length,0,errors[0]?.message);
 const next=latestContext(requests[3]);assert.equal(bridge.state(p.id,cid).turnId,turnId,'steering input must remain in this production turn');assert.equal(next.conversation.references.length,2);assert.deepEqual(new Set(next.conversation.targetVideoIds),new Set(['v-default',variant.videoId]));assert.equal(next.conversation.references.find(r=>r.id===second.id).stale,false,'each reference uses its own video revision');assert.equal(bridge.input(p.id,cid).references.length,0);assert.ok(JSON.stringify(requests[2]).includes('next-turn-hook'),'new user input refreshes the native skill catalog before calling the model');assert.ok(next.skills.some(s=>s.id===item.id));
 await rpc('复制变体已有成片供检查，不导出新片');await until(()=>requests.length===6&&bridge.state(p.id,cid).status==='idle');const staged=latestContext(requests[5]);assert.equal(staged.videoId,variant.videoId);assert.equal(staged.workspaceDirectory,await fs.realpath(path.join(dir,'workspaces',p.id,'conversations',cid,'videos',variant.videoId)));assert.ok(path.isAbsolute(staged.file));assert.equal(await fs.readFile(staged.file,'utf8'),'ISOLATED_STAGING_BYTES');
 await bridge.select(p.id,{conversationId:cid,videoId:'v-default',selectedId:'title'});assert.equal(bridge.state(p.id,cid).selection.videoId,'v-default');
 await bridge.configureInput(p.id,{conversationId:cid,videoId:variant.videoId});assert.equal(bridge.state(p.id,cid).selection,null);
 const variantSession=await bridge.ensure(p.id,cid);assert.notEqual(variantSession,sessionId);const inspection=await bridge.inspectNative(p.id,false,cid);assert.equal(inspection.cwd,path.join(dir,'workspaces',p.id,'conversations',cid,'videos',variant.videoId));
 await rpc('在变体工程中继续编辑，不重做已有素材','queue',variantSession);await until(()=>requests.length===8&&bridge.state(p.id,cid).status==='idle');const variantContext=latestContext(requests[7]);assert.equal(variantContext.videoId,variant.videoId);assert.equal(variantContext.workspace.directory,inspection.cwd);assert.ok(JSON.stringify(requests[6]).includes('比较这个片段'),'changing immutable cwd preserves prior conversation history');
 assert.equal(bridge.state(p.id,cid).projectExports.length,2);
 const updates=[];const unsubscribe=await service.withVideoContext(p.id,variant.videoId,()=>bridge.subscribe(p.id,value=>updates.push(value),cid));await bridge.configureInput(p.id,{conversationId:cid,preferences:{image:{provider:'musk'}}});await until(()=>updates.length);assert.equal(updates.at(-1).videoId,variant.videoId,'subscriber keeps its video even when publish runs in another context');unsubscribe();
 assert.equal((await service.withVideoContext(p.id,variant.videoId,()=>bridge.state(p.id,cid))).exports.length,0,'exports remain both conversation-owned and video-scoped');
});
