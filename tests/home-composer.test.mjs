import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SlotCore} from '@deepseek-ai/dsh-client-ui-slots';
import {ProjectService} from '../server/project.mjs';
import {createAgentBridge} from '../server/agent.mjs';

test('native composer can be shadowed without re-declaring its attachment slot',()=>{
 const core=new SlotCore();
 core.register({name:'root',children:{'conversation.composer.bar':{kind:'single',scope:'session-maybe'}}},()=>null);
 const native=()=>null;
 core.register({name:'conversation.composer.bar',locale:'conversation',inject:()=>({}),children:{'conversation.input.attachments':{kind:'single',scope:'session-maybe'}}},native);
 const original=core.entries('conversation.composer.bar')[0];
 const dispose=core.register({name:'conversation.composer.bar',priority:-30,locale:original.locale,inject:original.inject},()=>null);
 assert.equal(core.entriesOfSlot('conversation.composer.bar')[0].options.priority,-30);
 assert.ok(core.spec('conversation.input.attachments'));
 dispose();assert.equal(core.entriesOfSlot('conversation.composer.bar')[0].component,native);
});

test('homepage draft reuses one native scope across visits and restart without making projects or model calls',{timeout:45000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-home-native-'));
 const service=new ProjectService(dir,async()=>{});let calls=0,bridge;
 const server=http.createServer((_req,res)=>{calls++;res.writeHead(500);res.end('{}');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const values={DEEPSEEK_API_KEY:'local-only',DEEPSEEK_BASE_URL:'http://127.0.0.1:'+server.address().port,DEEPSEEK_MODEL:'deepseek-flash',CREATIVE_ENABLED:'disabled',CREATIVE_API_KEY:'',FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json')};
 const prior=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));Object.assign(process.env,values);
 t.after(async()=>{await bridge?.close();server.closeAllConnections();server.close();for(const [key,value]of Object.entries(prior))if(value===undefined)delete process.env[key];else process.env[key]=value;await fs.rm(dir,{recursive:true,force:true});});
 bridge=await createAgentBridge({service,nativeWeb:true,nativePort:0});assert.ok(bridge.ready,bridge.error);
 const ids=await Promise.all([bridge.ensureHome(),bridge.ensureHome()]);
 assert.deepEqual(ids,['frame-home-composer','frame-home-composer']);
 assert.deepEqual(await service.list(),[]);assert.equal(calls,0);
 await bridge.close();bridge=await createAgentBridge({service,nativeWeb:true,nativePort:0});assert.ok(bridge.ready,bridge.error);
 assert.equal(await bridge.ensureHome(),ids[0]);assert.deepEqual(await service.list(),[]);assert.equal(calls,0);
});
