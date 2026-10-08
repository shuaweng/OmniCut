import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceChatEvent,interruptMessages} from '../server/chat-events.mjs';
import {markdown,withGenerations,messageHTML} from '../src/chat-view.js';
test('Harness 增量、思考、重试、最终提交和工具生命周期不重复',()=>{
 const state={messages:[]};const stream=frame=>reduceChatEvent(state,{type:'stream',frame});
 stream({type:'start',attemptId:'a',turn:1,step:1});
 stream({type:'chunk',attemptId:'a',index:1,chunk:{type:'reasoning-delta',text:'核对素材'}});
 stream({type:'chunk',attemptId:'a',index:2,chunk:{type:'text-delta',text:'已经'}});
 assert.equal(state.messages[0].text,'已经');assert.equal(state.messages[0].status,'streaming');
 stream({type:'chunk',attemptId:'a',index:2,chunk:{type:'text-delta',text:'已经'}});
 assert.equal(state.messages[0].text,'已经');
 reduceChatEvent(state,{type:'event',event:{type:'assistant/message',data:{turn:1,step:1,message:{content:[{type:'text',text:'已经完成'}]}}}});
 assert.equal(state.messages.length,1);assert.equal(state.messages[0].text,'已经完成');assert.equal(state.messages[0].reasoning,'核对素材');
 reduceChatEvent(state,{type:'event',event:{type:'tool/call',data:{callId:'t',name:'validate_video',arguments:'{}'}}});
 assert.equal(state.messages[1].status,'running');
 reduceChatEvent(state,{type:'event',event:{type:'tool/result',data:{message:{toolCallId:'t',isError:true,content:[{type:'text',text:'编译错误'}]}}}});
 assert.equal(state.messages[1].status,'failed');
 stream({type:'start',attemptId:'b',turn:2,step:1});stream({type:'chunk',attemptId:'b',index:7,chunk:{type:'text-delta',text:'旧'}});
 stream({type:'end',attemptId:'b',outcome:{kind:'abandoned'}});stream({type:'start',attemptId:'c',turn:2,step:1});
 stream({type:'chunk',attemptId:'c',index:0,chunk:{type:'text-delta',text:'新'}});
 assert.equal(state.messages[2].text,'新');interruptMessages(state);assert.equal(state.messages[2].status,'interrupted');
});
test('Markdown 转义模型 HTML，拒绝危险链接，保留中文格式',()=>{
 const html=markdown('**完成**\n- 文案\n<script>alert(1)</script>\n[x](javascript:evil)\n[官网](https://example.com)');
 assert.ok(html.includes('<strong>完成</strong>'));assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('DSH 重启后 transient turn 与 durable turn 不同也不串写历史',()=>{
 const state={turnId:'before-restart',messages:[]};
 reduceChatEvent(state,{type:'stream',frame:{type:'start',attemptId:'attempt-1',turn:1,step:1}});
 reduceChatEvent(state,{type:'event',event:{type:'assistant/message',data:{turn:1,step:1,message:{content:[{type:'text',text:'旧回复'}]}}}});
 state.turnId='after-restart';
 reduceChatEvent(state,{type:'stream',frame:{type:'start',attemptId:'attempt-1',turn:1,step:1}});
 reduceChatEvent(state,{type:'stream',frame:{type:'chunk',attemptId:'attempt-1',index:0,chunk:{type:'text-delta',text:'新'}}});
 reduceChatEvent(state,{type:'event',event:{type:'assistant/message',data:{turn:3,step:1,message:{content:[{type:'text',text:'新回复'}]}}}});
 assert.equal(state.messages.length,2);assert.equal(state.messages[0].text,'旧回复');assert.equal(state.messages[1].text,'新回复');assert.equal(state.messages[1].status,'done');
});

test('异步生成结果挂在原工具消息后，重载与进度更新不重复',()=>{
 const p={id:'p-test',shots:[{id:'shot-1'}],assets:[]};
 const messages=[{id:'a',role:'tool',name:'generate_video',result:'{"id":"j1"}'},{id:'b',role:'assistant',text:'已提交'},{id:'c',role:'tool',name:'generate_reference_video',result:'{"jobs":[{"id":"j2"},{"id":"j1"}]}'},{id:'d',role:'tool',name:'generate_video',result:'null'}];
 const jobs=[{id:'j2',shotId:'shot-1',status:'running'},{id:'j1',shotId:'shot-1',status:'queued'},{id:'manual',shotId:'shot-1',created:'2026-10-06'}];
 const first=withGenerations(messages,jobs,p);assert.deepEqual(first.map(m=>m.id),['a','generation:j1','b','c','generation:j2','d','generation:manual']);
 jobs[1]={...jobs[1],status:'succeeded',assetFile:'clip.mp4'};
 const next=withGenerations(messages,jobs,p);assert.deepEqual(next.map(m=>m.id),first.map(m=>m.id));assert.equal(next[1].job.status,'succeeded');assert.ok(messageHTML(next[1]).includes('clip.mp4'));
 assert.deepEqual(messages.map(m=>m.id),['a','b','c','d']);
});

test('同一创作任务自动接续不会覆盖上一段消息或工具结果',()=>{
 const state={turnId:'same-task',segmentId:'first',messages:[]};
 for(const segment of ['first','second']){state.segmentId=segment;reduceChatEvent(state,{type:'event',event:{type:'assistant/message',data:{turn:1,step:1,message:{content:[{type:'text',text:segment}]}}}});reduceChatEvent(state,{type:'event',event:{type:'tool/call',data:{callId:'same-call',name:'get_tasks',arguments:'{}'}}});}
 assert.equal(state.messages.length,4);assert.equal(state.messages[0].text,'first');assert.equal(state.messages[2].text,'second');assert.notEqual(state.messages[1].id,state.messages[3].id);
});
