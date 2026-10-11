import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {proposal} from './fixtures/creative-results.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<600;i++){if(fn())return;await delay(25);}throw Error('isolated DSH model policy timed out');}
function openai(res,delta,finish='stop'){
 const chunk=(value,reason=null)=>({id:'local-only',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta:value,finish_reason:reason}]});
 res.writeHead(200,{'content-type':'text/event-stream'});res.end(`data: ${JSON.stringify(chunk(delta))}\n\ndata: ${JSON.stringify(chunk({},finish))}\n\ndata: [DONE]\n\n`);
}
function anthropic(res,model,text){
 const structured=typeof text==='object';
 const block=structured?{type:'tool_use',id:'structured-local-only',name:'structured_output',input:{}}:{type:'text',text:''};
 const delta=structured?{type:'input_json_delta',partial_json:JSON.stringify(text)}:{type:'text_delta',text};
 const events=[['message_start',{type:'message_start',message:{id:'local-only',type:'message',role:'assistant',model,content:[],stop_reason:null,usage:{input_tokens:10,output_tokens:0}}}],['content_block_start',{type:'content_block_start',index:0,content:{},content_block:block}],['content_block_delta',{type:'content_block_delta',index:0,delta}],['content_block_stop',{type:'content_block_stop',index:0}],['message_delta',{type:'message_delta',delta:{stop_reason:structured?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:5}}],['message_stop',{type:'message_stop'}]];
 res.writeHead(200,{'content-type':'text/event-stream'});res.end(events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}

test('native model settings, session selection and child whitelist share the actual DSH route',{timeout:60000},async t=>{
 // Settings RPCs persist a profile. Copy the entire profile into a disposable
 // Harness home; neither this process nor DSH loads the application .env.
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-model-policy-'));
 const profile=path.join(dir,'profiles/frame-native');await fs.mkdir(profile,{recursive:true});
 for(const name of ['package.json','cordis.yml'])await fs.copyFile(path.join(root,'harness/profiles/frame-native',name),path.join(profile,name));
 let patch=await fs.readFile(path.join(root,'harness/profiles/frame-native/cordis.patch.yml'),'utf8');
 for(const filename of ['creative-director.mjs','plugin.mjs','disable-parent-git-changes.mjs','frame-ui/index.mjs','mcp-bootstrap.mjs'])patch=patch.replaceAll(`'../../${filename}'`,`'${path.join(root,'harness',filename)}'`);
 await fs.writeFile(path.join(profile,'cordis.patch.yml'),patch);
 await fs.writeFile(path.join(dir,'no-mcp.json'),'{"servers":[]}');
 const requests=[],errors=[],ipc=[];let mainStep=0,child;
 const mock=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);requests.push(body);
   if(new URL(req.url,'http://localhost').pathname.endsWith('/messages')){
    const isDirector=JSON.stringify(body.system).includes('广告创意导演');
    assert.equal(body.model,'claude-sonnet-5-5');assert.equal(req.headers['x-api-key'],'local-agent-only');
    anthropic(res,body.model,isDirector?{...proposal,claim:'CHILD_ROUTE_PROOF'}:'MAIN_ROUTE_PROOF');return;
   }
   assert.match(req.url,/chat\/completions$/);assert.equal(req.headers.authorization,'Bearer local-deepseek-only');
   if(++mainStep<=2){const args={description:'选择创意模型',prompt:'仅根据已确认事实写一个广告开场',provider:'frame-agent',model:mainStep===1?'forbidden-model':'claude-sonnet-5-5'};openai(res,{role:'assistant',tool_calls:[{index:0,id:'select-'+mainStep,type:'function',function:{name:'creative_director',arguments:JSON.stringify(args)}}]},'tool_calls');}
   else openai(res,{role:'assistant',content:'MAIN_INITIAL_PROOF'});
  }catch(error){errors.push(error);res.writeHead(500);res.end('{}');}
 });
 await new Promise((resolve,reject)=>{mock.once('error',reject);mock.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+mock.address().port;
 const env={PATH:process.env.PATH,HOME:dir,TMPDIR:dir,DSH_HOME:dir,FRAME_NATIVE_DSH:'1',FRAME_DSH_PORT:'0',FRAME_CODE_ROOT:path.join(dir,'workspaces'),FRAME_SESSION_DIR:path.join(dir,'sessions'),FRAME_DSH_STORAGE:path.join(dir,'storage'),FRAME_SKILLS_DIR:path.join(root,'harness/skills'),FRAME_HYPIT_SKILLS_DIR:path.join(root,'engines/video/skills'),FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json'),FRAME_PROTECTED_CONFIG:'{}',DEEPSEEK_API_KEY:'local-deepseek-only',DEEPSEEK_BASE_URL:base,DEEPSEEK_MODEL:'deepseek-flash',CREATIVE_API_KEY:'local-creative-only',CREATIVE_BASE_URL:base,CREATIVE_MODEL:'claude-opus-5-5',CREATIVE_PROTOCOL:'anthropic-messages',CREATIVE_ENABLED:'enabled',FRAME_AGENT_ROUTE:'frame-deepseek',FRAME_AGENT_MODEL:'deepseek-flash',FRAME_AGENT_REASONING_EFFORT:'max',FRAME_ANTHROPIC_KEY_ENV:'AGENT_API_KEY',AGENT_API_KEY:'local-agent-only',FRAME_ANTHROPIC_BASE_URL:base,FRAME_ANTHROPIC_MODEL:'claude-sonnet-5-5',FRAME_ANTHROPIC_CONTEXT:'200000',FRAME_ANTHROPIC_MAX_TOKENS:'32768',FRAME_ANTHROPIC_REASONING_EFFORT:'high',DSH_TELEMETRY_DISABLED:'1',DSH_PRODUCT_ANALYTICS_DISABLED:'1',NO_PROXY:'localhost,127.0.0.1'};
 child=spawn(process.execPath,[path.join(root,'engines/agent/runtime/dsh/lib/bin.js'),'--profile','frame-native'],{cwd:dir,env,stdio:['ignore','pipe','pipe','ipc']});
 let logs='';child.stdout.on('data',part=>logs+=part);child.stderr.on('data',part=>logs+=part);child.on('message',message=>{ipc.push(message);if(message.type==='tool'&&message.operation==='input-ready')child.send({type:'tool-result',id:message.id,value:{ready:true}});});
 await until(()=>{assert.equal(child.exitCode,null,logs.slice(-1800));return ipc.some(message=>message.type==='ready');});
 const authURL=ipc.find(message=>message.type==='ready').authURL;
 const entry=await fetch(authURL,{redirect:'manual'});const cookie=entry.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');assert.ok(cookie);
 const rpc=async(endpoint,args,allowFailure=false)=>{
  const response=await fetch(new URL('/api/'+endpoint,authURL),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}})});
  assert.equal(response.status,200);const result=(await response.json()).result;if(allowFailure)return result;assert.equal(result.ok,true,JSON.stringify(result.error));return result.value;
 };
 // The same editable native provider carries both input abilities and output
 // budgets. This writes only the copied temporary profile.
 const modelSettings=await rpc('settings/mutate',{ns:'llm-pi-ai',ops:[{op:'set',path:['providers','frame-agent','models','0','maxTokens'],value:8192},{op:'set',path:['providers','frame-agent','models','0','input'],value:['text']}],expectedRevision:undefined});
 assert.match(await fs.readFile(path.join(profile,'cordis.patch.yml'),'utf8'),/maxTokens: 8192/,'native model settings must persist the edit');
 assert.equal(modelSettings.value.providers['frame-agent'].models[0].maxTokens,8192,'native settings must update the live provider budget');
 const scope={projectId:'p-0123456789ab',conversationId:'c-aaaaaaaaaaaa'};
 child.send({type:'ensure',requestId:'ensure-fixture',...scope});await until(()=>ipc.some(message=>message.requestId==='ensure-fixture'));
 const sessionId=ipc.find(message=>message.requestId==='ensure-fixture').sessionId;assert.ok(sessionId);
 await rpc('session/selectModel',{request:{sessionId,provider:'frame-deepseek',model:'deepseek-flash',reasoningEffort:'max'}});
 const prompt=content=>rpc('session/prompt',{request:{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:content}]}});
 await prompt('PARENT_HISTORY_CANARY 委派创意任务');await until(()=>mainStep===3&&ipc.some(message=>message.type==='status'&&message.status==='idle'));
 assert.equal(errors.length,0,errors[0]?.message);
 const childRequests=requests.filter(body=>body.model==='claude-sonnet-5-5');assert.equal(childRequests.length,1,'被拒绝的白名单外模型不能发起请求');assert.equal(childRequests[0].max_tokens,8192);assert.deepEqual(childRequests[0].tools?.map(tool=>tool.name),['structured_output']);assert.doesNotMatch(JSON.stringify(childRequests[0]),/PARENT_HISTORY_CANARY/);
 assert.ok(requests.some(body=>body.messages.some(message=>message.role==='tool'&&JSON.stringify(message.content).includes('not allowed'))));
 assert.ok(requests.some(body=>body.messages.some(message=>message.role==='tool'&&JSON.stringify(message.content).includes('CHILD_ROUTE_PROOF'))));
 await rpc('session/selectModel',{request:{sessionId,provider:'frame-agent',model:'claude-sonnet-5-5'}});
 await prompt('SWITCH_HISTORY_CANARY 切换后继续同一会话');await until(()=>requests.filter(body=>body.model==='claude-sonnet-5-5').length===2&&ipc.at(-1)?.status==='idle');
 const main=requests.filter(body=>body.model==='claude-sonnet-5-5')[1];assert.equal(main.max_tokens,8192);assert.match(JSON.stringify(main.messages),/PARENT_HISTORY_CANARY/);
 const requestCount=requests.length;
 const image=await rpc('session/prompt',{request:{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'image',mediaType:'image/png',data:'aGVsbG8='}]}},true);
 assert.equal(image.ok,false);assert.equal(image.error.code,'session/attachment-invalid');assert.equal(image.error.details.reason,'MODEL_DOES_NOT_SUPPORT_IMAGES');assert.equal(requests.length,requestCount);
 await rpc('settings/mutate',{ns:'llm-pi-ai',ops:[{op:'set',path:['providers','frame-agent','models','0','maxTokens'],value:4096}],expectedRevision:undefined});
 await prompt('UPDATE_BUDGET_CANARY 按修改后的模型上限继续');await until(()=>requests.filter(body=>body.model==='claude-sonnet-5-5').length===3&&ipc.at(-1)?.status==='idle');
 assert.equal(requests.filter(body=>body.model==='claude-sonnet-5-5')[2].max_tokens,4096);
 const saved=await fs.readFile(path.join(profile,'cordis.patch.yml'),'utf8');assert.match(saved,/4096/);assert.match(saved,/!!js/,'untouched profile expressions remain declarations');assert.doesNotMatch(saved,/local-(agent|creative|deepseek)-only/,'settings edits do not persist fixture credentials');
});
