import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {Context} from '@deepseek-ai/cordis';
import AgentRegistry from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import LlmRuntime,{LlmAdapter,ToolCallId,createUserMessage} from '@deepseek-ai/dsh-llm';
import SessionStore from '@deepseek-ai/dsh-session';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import SubagentRuntime from '@deepseek-ai/dsh-subagent';
import * as Director from '../harness/creative-director.mjs';
import {directorBrief,directorHandoff,validateDirectorOutput} from '../harness/creative-contract.mjs';
import {ProjectService} from '../server/project.mjs';
import {ReferenceService,validatePlan} from '../server/reference.mjs';
import {proposal,review} from './fixtures/creative-results.mjs';

const response=value=>typeof value==='string'?[
  {type:'block-start',index:0,blockType:'text'},
  {type:'text-delta',index:0,text:value},{type:'block-end',index:0,block:{type:'text',text:value}},
  {type:'usage',usage:{inputTokens:1,outputTokens:1}},{type:'finish',reason:{kind:'stop'}},
]:[
  {type:'block-start',index:0,blockType:'tool-call'},
  {type:'block-end',index:0,block:{type:'tool-call',id:ToolCallId('local-'+Math.random()),name:value.name,arguments:JSON.stringify(value.args)}},
  {type:'usage',usage:{inputTokens:1,outputTokens:1}},{type:'finish',reason:{kind:'tool-calls'}},
];
class StubAdapter extends LlmAdapter{
  constructor(script){super();this.script=script;this.requests=[];}
  resolveModel(provider,model){return Promise.resolve({provider,id:model,name:model,defaultMaxTokens:32768});}
  async *stream(options){this.requests.push(options);const next=this.script.shift();assert.notEqual(next,undefined,'本地stub没有剩余响应');for(const chunk of response(next))yield chunk;}
}

test('导演模式、UTF-8配置与交接转换不接受畸形结果',()=>{
  assert.equal(Director.briefByteLimit({}),30000);
  assert.equal(Director.briefByteLimit({CREATIVE_BRIEF_MAX_BYTES:'45000'}),45000);
  assert.throws(()=>Director.briefByteLimit({CREATIVE_BRIEF_MAX_BYTES:'3e4'}));
  assert.equal(Director.LIMITS.outputTokens,32768);
  assert.equal(directorBrief('旧调用').mode,'proposal');
  assert.deepEqual(directorBrief('mode: review\r\n抽帧观察'),{mode:'review',brief:'抽帧观察'});
  assert.throws(()=>directorBrief('mode: guess\n简报'));
  assert.throws(()=>Director.validateBrief([{type:'text',text:'中'.repeat(Math.floor(Director.LIMITS.briefBytes/3)+1)}]));
  assert.deepEqual(validateDirectorOutput('review',review),review);
  const handoff=directorHandoff('proposal',proposal);
  assert.deepEqual(JSON.parse(handoff.productionPlanInput.scenes),proposal.scenes);
  assert.equal(JSON.parse(handoff.productionPlanInput.creative).claim,proposal.claim);
  assert.throws(()=>directorHandoff('proposal',{...proposal,scenes:[{...proposal.scenes[0],end:21}]}));
  assert.throws(()=>directorHandoff('review',{...review,issues:[{...review.issues[0],confidence:1.1}]}));
  assert.throws(()=>directorHandoff('review',{kind:'review',keep:[]}));
});

test('原生结构化工具提交两类结果、拒绝畸形与正文，第六次允许第七次拒绝',{timeout:15000},async t=>{
  // Only memory-backed native services and scripted adapters are mounted.
  // No profile, .env, HTTP provider, application session or project is loaded.
  const ctx=new Context();
  for(const plugin of [LlmRuntime,SessionStore,SessionProjectionRegistry,SystemPrompt])await ctx.plugin(plugin);
  await ctx.plugin(ToolRuntime,{mode:'native'});await ctx.plugin(AgentRegistry);
  await ctx.plugin(AgentLoop,{agents:[]});await ctx.plugin(SubagentRuntime);await ctx.plugin(Director);
  const call=(index,mode)=>({name:'creative_director',args:{description:'本地导演验证'+index,prompt:`mode: ${mode}\n仅根据简报和提供的观察判断，20秒9:16。`}});
  const parentStub=new StubAdapter([call(1,'proposal'),call(2,'review'),call(3,'review'),call(4,'proposal'),call(5,'review'),call(6,'proposal'),call(7,'proposal'),'本地完成',call(8,'proposal'),'新轮完成']);
  const malformed={...review,issues:[{...review.issues[0],priority:'critical'}]};
  const childStub=new StubAdapter([proposal,review,malformed,'未提交有效结构',proposal,review,proposal,proposal].map(value=>typeof value==='string'?value:{name:'structured_output',args:value}));
  ctx.llm.registerAdapter(['parent-stub'],parentStub);ctx.llm.registerAdapter(['frame-creative'],childStub);
  const handle=await ctx.agents.create({sessionId:'isolated-director-parent',meta:{agentPreset:'frame'},agentOptions:{provider:'parent-stub',model:'local'}});
  const parent=handle.agent;t.after(()=>handle.dispose());
  parent.followup(createUserMessage({content:[{type:'text',text:'PARENT_CANARY 创作'}],source:{kind:'user'}}));await parent.whenIdle();
  const toolEvents=parent.session.snapshotEvents().filter(event=>event.type==='tool/result');
  assert.equal(toolEvents.length,7);
  const handoffs=toolEvents.filter(event=>!event.data.message.isError).map(event=>JSON.parse(event.data.message.content[0].text));
  assert.deepEqual(handoffs.map(item=>item.kind),['proposal','review','proposal','review','proposal']);
  assert.equal(handoffs[0].productionPlanInput.creative,directorHandoff('proposal',proposal).productionPlanInput.creative);
  assert.equal(toolEvents[2].data.message.isError,true,'malformed native capture must fail');
  assert.match(JSON.stringify(toolEvents[2]),/structured_output/);
  assert.equal(toolEvents[6].data.message.isError,true);
  assert.match(JSON.stringify(toolEvents[6]),/6 次/);
  assert.equal(childStub.requests.length,7,'六次启动中畸形提交需要一次修正步骤；第七次委派不发模型请求');
  for(const request of childStub.requests){
    assert.deepEqual(request.tools.map(tool=>tool.name),['structured_output']);
    assert.equal(request.maxTokens,32768);assert.doesNotMatch(JSON.stringify(request.messages),/PARENT_CANARY/);
  }
  assert.equal(childStub.requests[0].tools[0].parameters.properties.kind.const,'proposal');
  assert.equal(childStub.requests[1].tools[0].parameters.properties.kind.const,'review');
  assert.ok(childStub.requests[3].messages.some(message=>message.role==='tool'&&message.isError===true),'原生结构校验错误必须交回子模型，而不是提交成功');
  parent.followup(createUserMessage({content:[{type:'text',text:'新轮'}],source:{kind:'user'}}));await parent.whenIdle();
  assert.equal(childStub.requests.length,8);assert.equal(ctx.sessionProjections.stateOf(parent.session,'frameCreativeBudget'),1);
});

test('普通计划与参考改编保存完整导演交接，参考再次同步不丢字段',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-creative-handoff-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const service=new ProjectService(directory,async()=>{}),project=await service.createBlank('隔离计划');
  const input=directorHandoff('proposal',proposal).productionPlanInput;
  const parsed={...input,scenes:JSON.parse(input.scenes),creative:JSON.parse(input.creative)};
  const saved=await service.plan(project.id,parsed);
  assert.equal(saved.productionPlan.creative.memory,proposal.memory);assert.deepEqual(saved.productionPlan.scenes,proposal.scenes);
  const references=new ReferenceService({service,getConfig:async()=>({})});await references.init();
  const referenceId='12345678-1234-1234-1234-123456789abc';
  const item={id:referenceId,projectId:project.id,videoId:'v-default',status:'ready',version:1,created:new Date().toISOString(),duration:20,ratio:'9:16',brief:'隔离参考',plan:validatePlan({summary:'原片观察',audio:'无声音证据',uncertainties:'仅抽帧',scenes:proposal.scenes.map(scene=>({id:scene.id,route:scene.route,sourceStart:scene.start,sourceEnd:scene.end,duration:scene.end-scene.start,role:scene.name,observation:'提供的抽帧观察',preserve:'银线关系',prompt:'原描述',voiceover:'',caption:''}))},20)};
  references.items.set(item.id,item);await references.save(item);
  const changed=await references.updateProductionPlan(project.id,item.id,parsed);
  assert.equal(changed.productionPlan.creative.claim,proposal.claim);assert.deepEqual(changed.productionPlan.scenes,proposal.scenes);
  assert.equal(references.get(project.id,item.id).plan.scenes[0].sfx,proposal.scenes[0].sfx);
  await references.syncPlan(item);const reloaded=await service.get(project.id);assert.deepEqual(reloaded.productionPlan.creative,JSON.parse(input.creative));
  const reopened=new ReferenceService({service,getConfig:async()=>({})});await reopened.init();await reopened.syncPlan(reopened.get(project.id,item.id));
  assert.equal((await service.get(project.id)).productionPlan.scenes[1].transition,'');
  await assert.rejects(service.plan(project.id,{...parsed,creative:'{"unknown":"bad"}'}),/未知字段/);
});
