import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectService } from '../server/project.mjs';
import { createAgentBridge } from '../server/agent.mjs';
import { SettingsStore, publicSettings, validateSettings } from '../server/settings.mjs';
import { validateBrief, LIMITS } from '../harness/creative-director.mjs';

test('创意 Key 独立保存，留空保留，公开配置不泄露，接口校验', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-creative-settings-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new SettingsStore(path.join(dir, '.env'));
  const saved = await store.save({ creativeApiKey: 'creative-local-secret', creativeModel: 'claude-opus-5-5', creativeBaseUrl: 'https://cf.api.fan', creativeProtocol: 'anthropic-messages', creativeEnabled: 'enabled', deepseekApiKey: 'deepseek-local-secret' });
  assert.equal(saved.creativeConfigured, true);
  assert.equal(saved.creativeModel, 'claude-opus-5-5');
  assert.ok(!JSON.stringify(saved).includes('local-secret'));
  await store.save({ creativeApiKey: '', creativeEnabled: 'disabled' });
  const { env } = await store.read();
  assert.equal(env.CREATIVE_API_KEY, 'creative-local-secret');
  assert.equal(env.DEEPSEEK_API_KEY, 'deepseek-local-secret');
  assert.equal(publicSettings(env).creativeEnabled, 'disabled');
  for (const url of ['http://cf.api.fan', 'https://x:y@cf.api.fan', 'https://cf.api.fan?key=secret']) assert.throws(() => validateSettings({ creativeBaseUrl: url }));
  assert.throws(() => validateBrief([{ type: 'image', url: 'local' }]));
  assert.throws(() => validateBrief([{ type: 'text', text: '中'.repeat(Math.floor(LIMITS.briefBytes/3)+1) }]));
});

const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i=0; i<600; i++) { if (fn()) return; await delay(50); } throw Error('DSH 创意委派超时'); }
const text = m => typeof m.content === 'string' ? m.content : m.content?.filter(x=>x.type==='text').map(x=>x.text).join('') || '';

test('真实 DSH 子会话使用 Opus 路由，无父聊天/工具，多阶段六次委派与新轮重置，结果交回 DeepSeek', { timeout: 60000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-creative-native-'));
  const service = new ProjectService(dir, async()=>{}), p = await service.create('创意导演隔离验证');
  const received = [], main = [], errors = []; let stage = 0;
  const server = http.createServer(async (req,res) => {
    try {
      let raw=''; for await (const part of req) raw += part;
      const b=JSON.parse(raw);
      if (new URL(req.url,'http://localhost').pathname.endsWith('/messages')) {
        received.push({body:b, key:req.headers['x-api-key'], url:req.url});
        const say='创意主张：夜色中的眼眸。0–10秒人物，10–22秒产品，22–30秒品牌。';
        const events=[['message_start',{type:'message_start',message:{id:'local-opus',type:'message',role:'assistant',model:'claude-opus-5-5',content:[],stop_reason:null,usage:{input_tokens:100,output_tokens:0}}}],['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:say}}],['content_block_stop',{type:'content_block_stop',index:0}],['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:50}}],['message_stop',{type:'message_stop'}]];
        res.writeHead(200,{'content-type':'text/event-stream'});res.end(events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')); return;
      }
      main.push({body:b, key:req.headers.authorization});
      const call=++stage<=LIMITS.calls+1;
      const delta=call ? {role:'assistant',tool_calls:[{index:0,id:'creative-'+stage,type:'function',function:{name:'creative_director',arguments:JSON.stringify({description:'眼霜广告创意',prompt:'为雅诗兰黛眼霜写30秒16:9广告剧本。仅使用品牌与品类事实，明快高级，不声称功效。'})}}]} : {role:'assistant',content:'创意已收到，由 DeepSeek 继续制作。'};
      const chunk=(delta,finish_reason=null)=>({id:'main-local',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]});
      res.writeHead(200,{'content-type':'text/event-stream'});res.end(`data: ${JSON.stringify(chunk(delta))}\n\ndata: ${JSON.stringify(chunk({},call?'tool_calls':'stop'))}\n\ndata: [DONE]\n\n`);
    } catch(e) { errors.push(e);res.writeHead(500);res.end('{}'); }
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const values={DEEPSEEK_API_KEY:'local-deepseek-only',DEEPSEEK_BASE_URL:base,DEEPSEEK_MODEL:'deepseek-flash',CREATIVE_API_KEY:'local-creative-only',CREATIVE_BASE_URL:base,CREATIVE_MODEL:'claude-opus-5-5',CREATIVE_PROTOCOL:'anthropic-messages',CREATIVE_ENABLED:'enabled',FRAME_MCP_CONFIG:path.join(dir,'no-mcp.json')};
  const prior=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);
  let bridge;
  t.after(async()=>{await bridge?.close();server.closeAllConnections();server.close();for(const [k,v] of Object.entries(prior))if(v===undefined)delete process.env[k];else process.env[k]=v;await fs.rm(dir,{recursive:true,force:true});});
  bridge=await createAgentBridge({service,nativeWeb:true,nativePort:0});assert.equal(bridge.ready,true,bridge.error);
  await bridge.prompt(p.id,{text:'父聊天秘密_CANARY 不应传入创意子会话。创作30秒眼霜广告。'});
  await until(()=>bridge.state(p.id).status==='idle');
  assert.equal(errors.length,0);
  assert.equal(received.length,LIMITS.calls,JSON.stringify({requests:main.map(x=>({model:x.body.model,key:x.key,tools:x.body.tools?.length})),messages:bridge.state(p.id).messages}).slice(-6000));
  for(const {body,key,url} of received){
    assert.equal(key,'local-creative-only');assert.equal(new URL(url,'http://localhost').pathname,'/v1/messages');assert.equal(body.model,'claude-opus-5-5');assert.equal(body.max_tokens,LIMITS.outputTokens);
    assert.equal(body.tools?.length||0,0);assert.ok(!body.thinking || body.thinking.type==='disabled');
    assert.ok(!JSON.stringify(body).includes('CANARY'));
    assert.ok(!JSON.stringify(body).includes('你是 Frame 的电商短视频创作助手'));
    assert.ok(Buffer.byteLength(JSON.stringify(body))<24000, '子代理系统上下文保持精简');
  }
  assert.equal(main[0].key,'Bearer local-deepseek-only');assert.equal(main[0].body.model,'deepseek-flash');
  assert.equal(main[0].body.max_tokens??main[0].body.max_completion_tokens,393216);
  assert.ok(main[0].body.tools.some(t=>t.function.name==='creative_director'));
  assert.ok(main.some(x=>x.body.messages.some(m=>m.role==='tool'&&text(m).includes('夜色中的眼眸'))));
  assert.ok(main.some(x=>x.body.messages.some(m=>m.role==='tool'&&text(m).includes('已完成 6 次'))));
  const files=await fs.readdir(path.join(dir,'sessions'),{recursive:true});let logs='';for(const f of files)if(f.endsWith('.jsonl'))logs+=await fs.readFile(path.join(dir,'sessions',f),'utf8');
  assert.ok(logs.includes('subagent/descriptor'));assert.ok(!logs.includes('frame/creative-call'));assert.ok(!logs.includes('frame/creative-turn'));
  // A new human request renews the budget. Background job wakeups do not.
  await bridge.close();bridge=await createAgentBridge({service,nativeWeb:true,nativePort:0});assert.equal(bridge.ready,true,bridge.error);await bridge.ensure(p.id);
  stage=0;await bridge.prompt(p.id,{text:'请按新要求再创作一版'});await until(()=>bridge.state(p.id).status==='idle');assert.equal(received.length,LIMITS.calls*2);
});
