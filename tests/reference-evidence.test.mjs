import test from 'node:test';
import assert from 'node:assert/strict';
import {creativeJson} from '../server/creative-model.mjs';
import {referenceFrameTimes,referenceTranscript,applyEvidenceLimits} from '../server/reference-evidence.mjs';

test('创意理解流式兼容两种协议，截断时不接受部分方案',async()=>{
 const frames=[{type:'image',mimeType:'image/jpeg',data:'c2FtcGxl'},{type:'text',text:'判断实际画面'}];
 for(const protocol of ['anthropic-messages','openai-completions']){
  const env={CREATIVE_API_KEY:'test-creative-key',CREATIVE_BASE_URL:'https://creative.test/v1',CREATIVE_PROTOCOL:protocol};
  const fetcher=async(url,options)=>{
   const body=JSON.parse(options.body);assert.equal(body.max_tokens,32768);assert.equal(body.stream,true);
   assert.equal(url,protocol==='anthropic-messages'?'https://creative.test/v1/messages':'https://creative.test/v1/chat/completions');
   const content=body.messages.at(-1).content;assert.equal(content[0].type,protocol==='anthropic-messages'?'image':'image_url');
   const events=protocol==='anthropic-messages'?[{type:'content_block_delta',delta:{type:'text_delta',text:'{"summary":"实拍红色瓶盖"}'}},{type:'message_delta',delta:{stop_reason:'end_turn'},usage:{output_tokens:12}},{type:'message_stop'}]:[{choices:[{delta:{content:'{"summary":"实拍红色瓶盖"}'},finish_reason:null}]},{choices:[{delta:{},finish_reason:'stop'}]},'[DONE]'];
   return new Response(events.map(e=>'data: '+(typeof e==='string'?e:JSON.stringify(e))+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
  };
  assert.equal((await creativeJson({env,system:'只依据证据',content:frames,fetcher})).value.summary,'实拍红色瓶盖');
  await assert.rejects(creativeJson({env,system:'',content:frames,fetcher:async()=>new Response('data: {"choices":[{"delta":{"content":"{\\"summary\\":\\"不完整\\"}"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}})}),/输出上限/);
 }
});

test('参考关键帧覆盖头尾和快速插剪；转录复用且不把音轨未核实当成功',async()=>{
 const times=referenceFrameTimes(30,[{at:1.13,score:.8},{at:29.3,score:.7}]);assert.equal(times[0],0);assert.equal(times.at(-1),29.95);assert.ok(times.some(t=>Math.abs(t-1.05)<.04));assert.ok(times.length<=96);
 let created=0;const job={id:'known',assetFile:'video.mp4',status:'succeeded',text:'大宝天天见',provider:'whisperx',words:[{text:'大宝',start:1,end:2}]};
 const item={projectId:'project',assetFile:'video.mp4',hasAudio:true,purpose:'quality'};
 const transcript=await referenceTranscript({list:()=>[job],create:()=>{created++;}},item);assert.equal(created,0);assert.equal(transcript.status,'transcribed');assert.deepEqual(transcript.words,job.words);
 const unavailable=await referenceTranscript({list:()=>[],configuration:async()=>({local:false}),create:()=>{created++;}},item);assert.equal(created,0);assert.equal(unavailable.status,'unavailable');
 const result=applyEvidenceLimits({audio:'我听到了英式口音',issues:[{category:'发音',observation:'英式口音'},{category:'字幕',observation:'标签遮挡瓶盖'}]}, {transcript},item);
 assert.equal(result.issues.length,1);assert.match(result.audio,/语音识别转录：大宝天天见/);assert.doesNotMatch(result.audio,/英式口音/);assert.match(result.uncertainties,/未直接听取/);
});
