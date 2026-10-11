import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {agentRuntimeEnvironment} from '../server/agent-model.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let index=0;index<600;index++){if(fn())return;await delay(25);}throw Error('isolated thinking RPC timed out');}

test('Opus defaults to medium adaptive thinking and preserves native reasoning view types',{timeout:60000},async t=>{
 // Entire DSH home, profile and sessions are disposable. The only provider is
 // this loopback HTTP fixture; no application .env or existing project is read.
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-opus-thinking-'));
 const profile=path.join(dir,'profiles/frame-native');await fs.mkdir(profile,{recursive:true});
 for(const name of ['package.json','cordis.yml'])await fs.copyFile(path.join(root,'harness/profiles/frame-native',name),path.join(profile,name));
 let patch=await fs.readFile(path.join(root,'harness/profiles/frame-native/cordis.patch.yml'),'utf8');
 for(const filename of ['creative-director.mjs','plugin.mjs','disable-parent-git-changes.mjs','frame-ui/index.mjs','mcp-bootstrap.mjs'])patch=patch.replaceAll(`'../../${filename}'`,`'${path.join(root,'harness',filename)}'`);
 await fs.writeFile(path.join(profile,'cordis.patch.yml'),patch);await fs.writeFile(path.join(dir,'no-mcp.json'),'{"servers":[]}');
 const requests=[],ipc=[],errors=[];let child,step=0;
 const mock=http.createServer(async(req,res)=>{
  try{
   let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);requests.push(body);
   assert.match(new URL(req.url,'http://localhost').pathname,/messages$/);assert.equal(req.headers['x-api-key'],'local-thinking-only');
   assert.equal(body.model,'claude-opus-5-5');assert.equal(body.max_tokens,32768);
   assert.deepEqual(body.thinking,{type:'adaptive',display:'summarized'});assert.equal(body.output_config.effort,'medium');assert.equal(body.temperature,undefined);assert.equal(body.thinking.budget_tokens,undefined);
   const events=[['message_start',{type:'message_start',message:{id:'local-thinking',type:'message',role:'assistant',model:body.model,content:[],stop_reason:null,usage:{input_tokens:10,output_tokens:0}}}],['content_block_start',{type:'content_block_start',index:0,content_block:{type:'thinking',thinking:'',signature:''}}],['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'LOCAL_REASONING_FIXTURE'}}],['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'local-unchanged-signature'}}],['content_block_stop',{type:'content_block_stop',index:0}],['content_block_start',{type:'content_block_start',index:1,content_block:{type:'text',text:''}}],['content_block_delta',{type:'content_block_delta',index:1,delta:{type:'text_delta',text:'已核对画面，继续制作。'}}],['content_block_stop',{type:'content_block_stop',index:1}],['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}}],['message_stop',{type:'message_stop'}]];
   step++;res.writeHead(200,{'content-type':'text/event-stream'});res.end(events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
  }catch(error){errors.push(error);res.writeHead(500);res.end('{}');}
 });
 await new Promise((resolve,reject)=>{mock.once('error',reject);mock.listen(0,'127.0.0.1',resolve);});
 t.after(async()=>{if(child&&child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+mock.address().port;
 const env={PATH:process.env.PATH,HOME:dir,TMPDIR:dir,DSH_HOME:dir,FRAME_NATIVE_DSH:'1',FRAME_DSH_PORT:'0',FRAME_CODE_ROOT:path.join(dir,'workspaces'),FRAME_SESSION_DIR:path.join(dir,'sessions'),FRAME_DSH_STORAGE:path.join(dir,'storage'),FRAME_SKILLS_DIR:path.join(root,'harness/skills'),FRAME_HYPIT_SKILLS_DIR:path.join(root,'engines/video/skills'),FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json'),FRAME_PROTECTED_CONFIG:'{}',DEEPSEEK_API_KEY:'local-deepseek-only',DEEPSEEK_BASE_URL:base,DEEPSEEK_MODEL:'deepseek-flash',CREATIVE_API_KEY:'local-thinking-only',CREATIVE_BASE_URL:base,CREATIVE_PROTOCOL:'anthropic-messages',CREATIVE_MODEL:'claude-opus-5-5',FRAME_AGENT_ROUTE:'frame-deepseek',FRAME_AGENT_MODEL:'deepseek-flash',CREATIVE_ENABLED:'paused',DSH_TELEMETRY_DISABLED:'1',DSH_PRODUCT_ANALYTICS_DISABLED:'1',NO_PROXY:'localhost,127.0.0.1'};
 child=spawn(process.execPath,[path.join(root,'engines/agent/runtime/dsh/lib/bin.js'),'--profile','frame-native'],{cwd:dir,env,stdio:['ignore','pipe','pipe','ipc']});
 let logs='';child.stdout.on('data',part=>logs+=part);child.stderr.on('data',part=>logs+=part);child.on('message',message=>{
  ipc.push(message);if(message.type!=='tool')return;
  if(message.operation==='input-ready')child.send({type:'tool-result',id:message.id,value:{ready:true}});

 });
 await until(()=>{assert.equal(child.exitCode,null,logs.slice(-1800));return ipc.some(message=>message.type==='ready');});
 const authURL=ipc.find(message=>message.type==='ready').authURL,entry=await fetch(authURL,{redirect:'manual'}),cookie=entry.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const scope={projectId:'p-0123456789ab',conversationId:'c-aaaaaaaaaaaa'};child.send({type:'ensure',requestId:'preview-ensure',...scope});await until(()=>ipc.some(message=>message.requestId==='preview-ensure'));
 const sessionId=ipc.find(message=>message.requestId==='preview-ensure').sessionId;assert.ok(sessionId);
 const rpc=async(endpoint,args)=>{const response=await fetch(new URL('/api/'+endpoint,authURL),{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({type:'client-request',rpcId:crypto.randomUUID(),method:endpoint,payload:{args}})});assert.equal(response.status,200);const result=(await response.json()).result;assert.equal(result.ok,true,JSON.stringify(result.error));return result.value;};
 // Native settings can persist a user's different default into the source
 // profile. Select this local fixture route explicitly within its own session.
 await rpc('session/selectModel',{request:{sessionId,provider:'frame-creative',model:'claude-opus-5-5'}});
 await rpc('session/prompt',{request:{sessionId,requestId:crypto.randomUUID(),mode:'queue',content:[{type:'text',text:'只查看已保存画面'}]}});
 try{await until(()=>{const failure=ipc.find(item=>item.type==='event'&&item.event.type==='turn/end'&&item.event.data.reason?.kind==='error');if(failure)throw Error(JSON.stringify(failure.event.data.reason)+'; mock='+errors.map(error=>error.message).join(';'));return step===1&&ipc.some(message=>message.type==='status'&&message.status==='idle');});}catch(error){throw Error(error.message+'; requests='+step+'; '+logs.slice(-1600),{cause:error});}
 assert.equal(errors.length,0,errors[0]?.message);
 const message=ipc.findLast(item=>item.type==='event'&&item.event.type==='assistant/message').event.data.message;
 assert.deepEqual(message.content.map(block=>block.type),['reasoning','text']);
 assert.equal(message.content[0].text,'LOCAL_REASONING_FIXTURE');assert.equal(message.content[1].text,'已核对画面，继续制作。');
 assert.equal(message.source.replayState.blocks[0].thinkingSignature,'local-unchanged-signature');
 const require=createRequire(new URL('../engines/video/package.json',import.meta.url));
 const {tsImport}=await import(pathToFileURL(require.resolve('tsx/esm/api')).href);
 const {toAssistantBlocks}=await tsImport('../engines/agent/source/packages/client/ui-chat/src/client/conversation-nodes/event-projection.ts',import.meta.url);
 const blocks=toAssistantBlocks(message.content);assert.deepEqual(blocks.map(block=>block.kind),['reasoning','text'],'native Chat projection must feed reasoning to ReasoningRow rather than response Markdown');
 assert.equal(agentRuntimeEnvironment({}).FRAME_CREATIVE_REASONING_EFFORT,'medium');
 assert.equal(agentRuntimeEnvironment({CREATIVE_REASONING_EFFORT:'low'}).FRAME_CREATIVE_REASONING_EFFORT,'low');
});
