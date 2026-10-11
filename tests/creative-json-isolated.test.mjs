import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeJson,parseCreativeJson} from '../server/creative-model.mjs';

const value={summary:'标题遮挡商品',issues:[{start:12,end:14,observation:'文字包含 {括号} 与 "引号"'}],uncertainties:['仅有抽样帧']};
const json=JSON.stringify(value);
const preface='English analysis of the supplied frames. Timing remains uncertain.\n\n';

test('完整纯 JSON、围栏及唯一的最终对象可以恢复，嵌套结构不成为额外候选',()=>{
 for(const text of [json,'```json\n'+json+'\n```',preface+json,preface+'```JSON\n'+JSON.stringify(value,null,2)+'\n```'])assert.deepEqual(parseCreativeJson(text),value);
});

test('多个候选、截断对象、嵌套残片、未闭合围栏及尾随解释均不能恢复',()=>{
 for(const text of [
  preface+json+'\n'+json,
  'Option A: '+json+'\nFinal:\n'+json,
  preface+json.slice(0,-1),
  preface+'{"draft":\n'+json,
  preface+'```json\n'+json,
  preface+json+'\nAdditional explanation.',
  preface+'{"summary":"a",}\n',
  'Only inline: '+json,
 ])assert.throws(()=>parseCreativeJson(text),/理解结果格式无效/);
});

test('完成的本地流式响应只恢复业务 JSON，原文回调仍收到完整前言且不重试',async()=>{
 const raw=preface+json,env={CREATIVE_API_KEY:'isolated-header-only',CREATIVE_BASE_URL:'https://offline.invalid',CREATIVE_PROTOCOL:'anthropic-messages'};
 let calls=0,saved;
 const fetcher=async()=>{
  calls++;
  const events=[{type:'content_block_delta',delta:{type:'text_delta',text:raw}},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}];
  return new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
 };
 const result=await creativeJson({env,system:'local only',content:[],fetcher,onRawResult:async raw=>{await Promise.resolve();saved=raw;}});
 assert.equal(calls,1);assert.equal(saved.text,raw);assert.equal(result.text,raw);assert.deepEqual(result.value,value);assert.ok(!JSON.stringify(result.value).includes('English analysis'));
});

test('完整 JSON 文本不能绕过流式截断或输出上限检查',async()=>{
 const env={CREATIVE_API_KEY:'isolated-header-only',CREATIVE_BASE_URL:'https://offline.invalid'};
 for(const [stop,finished,error]of [['max_tokens',true,/输出上限/],[undefined,false,/连接中断/]]){
  let callbacks=0,calls=0;
  const events=[{type:'content_block_delta',delta:{type:'text_delta',text:preface+json}},...(stop?[{type:'message_delta',delta:{stop_reason:stop}}]:[]),...(finished?[{type:'message_stop'}]:[])];
  await assert.rejects(creativeJson({env,system:'local only',content:[],onRawResult:()=>{callbacks++;},fetcher:async()=>{calls++;return new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});}}),error);
  assert.equal(calls,1);assert.equal(callbacks,0);
 }
});
