import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {videoUnderstandingConfiguration,prepareUnderstandingVideo,understandVideo,normalizeVideoReview} from '../server/video-understanding.mjs';

const env={VIDEO_UNDERSTANDING_PROVIDER:'gemini',GEMINI_API_KEY:'synthetic-secret-only',GEMINI_VIDEO_MODEL:'gemini-3.8-flash',GEMINI_BASE_URL:'https://relay.invalid/gemini'};
const video={mimeType:'video/mp4',data:Buffer.from('full-video-and-audio').toString('base64')};
const analysis=JSON.stringify({summary:'画面与原声音轨已检查',issues:[]});
const candidate=(text,finishReason)=>({candidates:[{index:0,content:{parts:[{text}]},...(finishReason?{finishReason}:{})}]});
const sse=(...events)=>events.map(event=>'data: '+(typeof event==='string'?event:JSON.stringify(event))+'\r\n\r\n').join('');
const streamResponse=text=>new Response(text,{headers:{'content-type':'text/event-stream'}});
const request=(fetcher,changes={})=>understandVideo({env:{...env,...changes},video,prompt:'检查实际画面与完整原声',fetcher});
test('分段声音观察转换为可读中文，不显示对象占位文本',()=>{
 const review=normalizeVideoReview({summary:'完成',issues:[],audio:{intro:'开罐声',middle:'音乐',outro:'旁白'},uncertainties:[]},15);
 assert.equal(review.audio,'开头：开罐声\n中段：音乐\n结尾：旁白');assert.equal(review.uncertainties,'');
});
function fragmentedResponse(text){
 const bytes=new TextEncoder().encode(text),sizes=[1,2,7,3,17];let at=0,index=0;
 return new Response(new ReadableStream({pull(controller){if(at===bytes.length){controller.close();return;}const end=Math.min(at+sizes[index++%sizes.length],bytes.length);controller.enqueue(bytes.slice(at,end));at=end;}}),{headers:{'content-type':'text/event-stream; charset=utf-8'}});
}
function safeCategory(category){return error=>{assert.equal(error.category,category);assert.doesNotMatch(error.message,/synthetic-secret-only|relay raw/);return true;};}

test('审片不确定项数组转换为界面文本，空数组不显示原始 JSON',()=>{
 const review={summary:'已审片',issues:[]};
 assert.equal(normalizeVideoReview({...review,uncertainties:['声音时间需复核',{raw:'不显示对象'},'字幕读法需复核']},4).uncertainties,'声音时间需复核\n字幕读法需复核');
 assert.equal(normalizeVideoReview({...review,uncertainties:[]},4).uncertainties,'');
 assert.equal(normalizeVideoReview({...review,uncertainties:'原有文本'},4).uncertainties,'原有文本');
});

test('Gemini 原生调用方式显式选择；带版本后缀的地址只保留一个 v1beta',async()=>{
 assert.equal(videoUnderstandingConfiguration(env).apiMode,'generate');
 assert.throws(()=>videoUnderstandingConfiguration({...env,GEMINI_API_MODE:'automatic'}),/调用方式/);
 for(const base of ['https://relay.invalid/gemini','https://relay.invalid/gemini/v1/','https://relay.invalid/gemini/v1beta/'])for(const mode of ['generate','stream']){
  let calls=0;
  const result=await request(async(url,options)=>{
   calls++;assert.equal(url,'https://relay.invalid/gemini/v1beta/models/gemini-3.8-flash:'+(mode==='stream'?'streamGenerateContent?alt=sse':'generateContent'));
   assert.equal(options.headers['x-goog-api-key'],env.GEMINI_API_KEY);assert.equal(options.redirect,'error');
   return mode==='stream'?streamResponse(sse(candidate(analysis,'STOP'))):Response.json(candidate(analysis,'STOP'));
  },{GEMINI_BASE_URL:base,GEMINI_API_MODE:mode});
  assert.equal(calls,1);assert.equal(result.value.summary,'画面与原声音轨已检查');
 }
});

test('Vertex 原生路由使用 Bearer，google 模型前缀不改变 MEDIUM 思考或完整媒体证据',async()=>{
 const audio={mimeType:'audio/mp3',data:'YXVkaW8='},media={...video,audio},images=[{kind:'source-frame',at:1.25,mimeType:'image/jpeg',data:'ZnJhbWU='},{label:'商品对照图',mimeType:'image/png',data:'aW1hZ2U='}];
 for(const base of ['https://vertex.invalid/api/vertex-ai/','https://vertex.invalid/api/vertex-ai/v1/'])for(const model of ['google/gemini-3.8-flash','gemini-3.8-flash'])for(const mode of ['generate','stream']){
  const settings={...env,GEMINI_BASE_URL:base,GEMINI_VIDEO_MODEL:model,GEMINI_API_MODE:mode};let calls=0;
  assert.equal(videoUnderstandingConfiguration(settings).apiProtocol,'vertex-ai');
  const result=await understandVideo({env:settings,purpose:'quality',video:media,images,prompt:'审片',fetcher:async(url,options)=>{
   calls++;assert.equal(url,'https://vertex.invalid/api/vertex-ai/v1/publishers/google/models/gemini-3.8-flash:'+(mode==='stream'?'streamGenerateContent?alt=sse':'generateContent'));
   assert.equal(options.headers.Authorization,'Bearer '+env.GEMINI_API_KEY);assert.equal(options.headers['x-goog-api-key'],undefined);assert.equal(options.redirect,'error');
   const body=JSON.parse(options.body),parts=body.contents[0].parts;
   assert.deepEqual(body.generationConfig.thinkingConfig,{thinkingLevel:'MEDIUM'});assert.equal(body.generationConfig.responseMimeType,'application/json');
   assert.deepEqual(parts[0],{inlineData:video,videoMetadata:{fps:4}});assert.deepEqual(parts[1].inlineData,audio);
   assert.match(parts[4].text,/同源原片 1.25 秒观察帧/);assert.match(parts.at(-2).text,/商品对照图.*对照资料/);
   const usageMetadata={promptTokensDetails:[{modality:'VIDEO',tokenCount:20},{modality:'AUDIO',tokenCount:12}],thoughtsTokenCount:8,totalTokenCount:42};
   const complete={...candidate(analysis,'FINISH_REASON_STOP'),usageMetadata,modelVersion:'gemini-3.8-flash'};
   return mode==='stream'?fragmentedResponse(sse(candidate(analysis.slice(0,10)),{...complete,candidates:[{...complete.candidates[0],content:{parts:[{text:analysis.slice(10)}]}}]})):Response.json(complete);
  }});
  assert.equal(calls,1);assert.equal(result.value.summary,'画面与原声音轨已检查');assert.equal(result.model,'gemini-3.8-flash');assert.equal(result.usage.thoughtsTokenCount,8);assert.equal(result.usage.promptTokensDetails[1].modality,'AUDIO');
 }
});

test('审片单独选择 Gemini，参考拆解保留原先的创意服务选择',async()=>{
 const roles={...env,VIDEO_UNDERSTANDING_PROVIDER:'creative',VIDEO_REVIEW_PROVIDER:'gemini',CREATIVE_API_KEY:'synthetic-creative-only',CREATIVE_BASE_URL:'https://creative.invalid'};
 assert.equal(videoUnderstandingConfiguration(roles).provider,'creative');
 assert.equal(videoUnderstandingConfiguration(roles,{purpose:'remix'}).provider,'creative');
 assert.equal(videoUnderstandingConfiguration(roles,{purpose:'quality'}).provider,'gemini');
 assert.equal(videoUnderstandingConfiguration({...roles,VIDEO_REVIEW_PROVIDER:''},{purpose:'quality'}).provider,'creative');
 const result=await understandVideo({env:roles,purpose:'quality',video,prompt:'审片',fetcher:async(url,options)=>{assert.deepEqual(JSON.parse(options.body).generationConfig.thinkingConfig,{thinkingLevel:'medium'});return Response.json(candidate(analysis,'STOP'));}});
 assert.equal(result.value.summary,'画面与原声音轨已检查');
});

test('流式分片跨越 UTF-8 和 CRLF，聚合非 thought 文本、模型与累计用量',async()=>{
 const split=analysis.indexOf('原声');
 const first={...candidate(analysis.slice(0,split)),modelVersion:'gemini-fixture',usageMetadata:{promptTokenCount:20}};
 first.candidates[0].content.parts.unshift({thought:true,text:'relay raw synthetic-secret-only'});
 first.candidates.push({index:1,content:{parts:[{text:'不能拼入另一候选'}]},finishReason:'MAX_TOKENS'});
 const multiline=JSON.stringify(first,null,2).split('\n').map(line=>'data: '+line).join('\r\n');
 const payload=': heartbeat\r\nevent: message\r\nid: 1\r\n'+multiline+'\r\n\r\n'+sse(candidate(analysis.slice(split)),{candidates:[{index:0,content:{parts:[{text:'',thoughtSignature:'fixture-signature'}]},finishReason:'STOP'}]},{usageMetadata:{candidatesTokenCount:12,totalTokenCount:32}});
 const result=await understandVideo({env:{...env,GEMINI_API_MODE:'stream'},video,prompt:'审片',images:[{kind:'source-frame',at:1.25,label:'原片帧',mimeType:'image/jpeg',data:'ZnJhbWU='},{label:'商品对照图',mimeType:'image/png',data:'aW1hZ2U='}],fetcher:async(url,options)=>{
  const body=JSON.parse(options.body),parts=body.contents[0].parts;
  assert.deepEqual(parts[0],{inlineData:video,mediaProcessing:'STATIC',videoMetadata:{fps:4}});
  assert.match(parts[2].text,/同源原片 1.25 秒观察帧.*原片帧.*实际可见的观察证据/);assert.deepEqual(parts[3].inlineData,{mimeType:'image/jpeg',data:'ZnJhbWU='});
  assert.match(parts.at(-2).text,/商品对照图.*商品对照资料.*不是视频中的观察证据/);assert.match(body.systemInstruction.parts[0].text,/同源观察帧.*该时刻.*商品对照图.*不能把其内容写成原视频观察/);
  assert.equal(parts.at(-1).inlineData.mimeType,'image/png');assert.equal(body.generationConfig.responseMimeType,'application/json');assert.equal(body.generationConfig.thinkingConfig,undefined);
  return fragmentedResponse(payload);
 }});
 assert.equal(result.text,analysis);assert.equal(result.model,'gemini-fixture');assert.equal(result.samplingFps,4);
 assert.deepEqual(result.usage,{promptTokenCount:20,candidatesTokenCount:12,totalTokenCount:32});
});

test('流式截断、内容阻止和无效响应不接受已经能解析的部分分析',async()=>{
 const cases=[
  ['output_limit',()=>streamResponse(sse(candidate(analysis,'MAX_TOKENS')))],
  ['output_limit',()=>streamResponse(sse(candidate(analysis,'FINISH_REASON_MAX_TOKENS')))],
  ['content',()=>streamResponse(sse(candidate(analysis,'SAFETY')))],
  ['content',()=>streamResponse(sse(candidate(analysis,'FINISH_REASON_SAFETY')))],
  ['content',()=>streamResponse(sse({promptFeedback:{blockReason:'SAFETY',blockReasonMessage:'synthetic-secret-only'}}))],
  ['invalid_response',()=>streamResponse(sse(candidate(analysis,'OTHER')))],
  ['incomplete_response',()=>streamResponse(sse(candidate(analysis)))],
  ['incomplete_response',()=>streamResponse(sse(candidate(analysis),'[DONE]'))],
  ['invalid_response',()=>streamResponse('data: {relay raw synthetic-secret-only\n\n')],
  ['invalid_response',()=>Response.json(candidate(analysis,'STOP'))],
  ['authentication',()=>streamResponse('event: error\ndata: '+JSON.stringify({error:{code:401,message:'relay raw synthetic-secret-only'}})+'\n\n')],
 ];
 for(const [category,response] of cases){let calls=0;await assert.rejects(request(async()=>{calls++;return response();},{GEMINI_API_MODE:'stream'}),safeCategory(category));assert.equal(calls,1);}
 // The non-streaming endpoint also rejects a reported unsuccessful finish.
 await assert.rejects(request(async()=>Response.json(candidate(analysis,'MAX_TOKENS'))),safeCategory('output_limit'));
});

test('服务和连接失败使用固定分类与提示，不泄漏中继响应和密钥',async()=>{
 for(const [status,category] of [[401,'authentication'],[403,'permission'],[429,'quota'],[404,'route'],[400,'invalid_request'],[503,'provider']]){
  await assert.rejects(request(async()=>Response.json({error:{message:'relay raw synthetic-secret-only'}},{status})),safeCategory(category));
 }
 await assert.rejects(request(async()=>Response.json({error:{status:'NOT_FOUND',message:'relay raw synthetic-secret-only'}})),safeCategory('route'));
 await assert.rejects(request(async()=>{throw Error('relay raw synthetic-secret-only');}),safeCategory('network'));
 let reads=0;
 const interrupted=new ReadableStream({pull(controller){if(reads++===0)controller.enqueue(new TextEncoder().encode(sse(candidate(analysis))));else controller.error(Error('relay raw synthetic-secret-only'));}});
 await assert.rejects(request(async()=>new Response(interrupted,{headers:{'content-type':'text/event-stream'}}),{GEMINI_API_MODE:'stream'}),safeCategory('network'));
});

test('JSON 与 SSE 响应均限制总字节数，超限时取消继续读取',async()=>{
 for(const mode of ['generate','stream']){
  let canceled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1000001));},cancel(){canceled=true;}});
  await assert.rejects(request(async()=>new Response(body,{headers:{'content-type':mode==='stream'?'text/event-stream':'application/json'}}),{GEMINI_API_MODE:mode}),safeCategory('output_limit'));
  assert.equal(canceled,true);
 }
});

test('审片转码保留内嵌音轨并另提取同源完整 MP3，同请求第二 Part 提交原声',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-gemini-transport-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const payload=Buffer.from('fixture-complete-video-with-original-audio'),audioPayload=Buffer.from('fixture-complete-same-source-audio');let calls=0;
 const prepared=await prepareUnderstandingVideo('isolated-video.mp4',directory,{hasAudio:true,runner:async(command,args)=>{
  assert.equal(command,'ffmpeg');assert.equal(args[args.indexOf('-i')+1],'isolated-video.mp4');
  for(const forbidden of ['-an','-t','-to','-ss','-frames:v'])assert.equal(args.includes(forbidden),false);
  if(calls++===0){assert.deepEqual(args.filter((arg,index)=>args[index-1]==='-map'),['0:v:0','0:a?']);assert.ok(args.includes('aac'));assert.equal(path.extname(args.at(-1)),'.mp4');await fs.writeFile(args.at(-1),payload);}
  else{assert.deepEqual(args.filter((arg,index)=>args[index-1]==='-map'),['0:a:0']);assert.ok(args.includes('-vn'));assert.equal(args[args.indexOf('-af')+1],'aresample=first_pts=0');assert.equal(args[args.indexOf('-ac')+1],'2');assert.equal(args[args.indexOf('-ar')+1],'48000');assert.equal(args[args.indexOf('-c:a')+1],'libmp3lame');assert.equal(args[args.indexOf('-b:a')+1],'96k');assert.equal(path.extname(args.at(-1)),'.mp3');await fs.writeFile(args.at(-1),audioPayload);}
 }});
 assert.equal(calls,2);assert.equal(prepared.bytes,payload.length);assert.deepEqual(prepared.audio,{mimeType:'audio/mp3',data:audioPayload.toString('base64'),bytes:audioPayload.length});
 await understandVideo({env:{...env,GEMINI_API_MODE:'stream'},video:prepared,prompt:'审片',fetcher:async(url,options)=>{
  const parts=JSON.parse(options.body).contents[0].parts;
  assert.deepEqual(Buffer.from(parts[0].inlineData.data,'base64'),payload);assert.deepEqual(parts[1].inlineData,{mimeType:'audio/mp3',data:audioPayload.toString('base64')});
  assert.match(parts[2].text,/同一原始文件.*0 秒.*重复提交/);assert.match(parts[2].text,/不要把它当成第二条音轨/);
  return streamResponse(sse(candidate(analysis,'STOP')));
 }});
 calls=0;
 const silent=await prepareUnderstandingVideo('isolated-silent.mp4',directory,{hasAudio:false,runner:async(command,args)=>{calls++;assert.equal(path.extname(args.at(-1)),'.mp4');await fs.writeFile(args.at(-1),payload);}});
 assert.equal(calls,1);assert.equal(silent.audio,undefined);
});

test('明确有音轨时提取失败不可省略音频，视频和音频共享 14 MB 上限',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-gemini-audio-budget-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await assert.rejects(prepareUnderstandingVideo('isolated-video.mp4',directory,{hasAudio:true,runner:async(command,args)=>{if(path.extname(args.at(-1))==='.mp3')throw Error('fixture-audio-extraction-failed');await fs.writeFile(args.at(-1),'video');}}),/fixture-audio-extraction-failed/);
 await assert.rejects(prepareUnderstandingVideo('isolated-video.mp4',directory,{hasAudio:true,runner:async(command,args)=>{const file=await fs.open(args.at(-1),'w');await file.truncate(path.extname(args.at(-1))==='.mp4'?13999900:101);await file.close();}}),/视频与音轨.*过大/);
});

test('本地合成延迟立体声音轨：提取后保留视频起点前静音和左右声道',async t=>{
 const execute=promisify(execFile),runner=(command,args,options={})=>execute(command,args,{timeout:15000,maxBuffer:2e6,encoding:'buffer',env:{PATH:process.env.PATH},...options});
 try{await runner('ffmpeg',['-version']);await runner('ffprobe',['-version']);}catch(error){if(error.code==='ENOENT'){t.skip('本地缺少 ffmpeg/ffprobe');return;}throw error;}
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-gemini-audio-alignment-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const source=path.join(directory,'delayed-stereo.mkv');
 await runner('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=64x64:r=24:d=4','-f','lavfi','-i','aevalsrc=0.15*sin(2*PI*660*t)|0.15*sin(2*PI*880*t):s=48000:d=3','-filter_complex','[1:a]asetpts=PTS+1/TB[a]','-map','0:v:0','-map','[a]','-c:v','libx264','-c:a','pcm_s16le','-y',source]);
 const sourceProbe=JSON.parse((await runner('ffprobe',['-v','error','-show_entries','stream=codec_type,start_time','-of','json',source])).stdout.toString());
 assert.equal(Number(sourceProbe.streams.find(stream=>stream.codec_type==='video').start_time),0);
 assert.equal(Number(sourceProbe.streams.find(stream=>stream.codec_type==='audio').start_time),1);
 const prepared=await prepareUnderstandingVideo(source,directory,{hasAudio:true,runner});
 assert.ok(prepared.bytes+prepared.audio.bytes<=14e6);
 const audioFile=path.join(directory,'understanding-audio.mp3'),audioProbe=JSON.parse((await runner('ffprobe',['-v','error','-show_entries','stream=sample_rate,channels','-of','json',audioFile])).stdout.toString());
 assert.equal(Number(audioProbe.streams[0].sample_rate),48000);assert.equal(audioProbe.streams[0].channels,2);
 const pcm=(await runner('ffmpeg',['-v','error','-i',audioFile,'-map','0:a:0','-f','f32le','pipe:1'])).stdout,frames=pcm.length/8;
 assert.ok(Math.abs(frames/48000-4)<.025);
 let firstAudible=-1,silentPeak=0,channelDifference=0;
 for(let frame=0;frame<frames;frame++){
  const left=pcm.readFloatLE(frame*8),right=pcm.readFloatLE(frame*8+4),peak=Math.max(Math.abs(left),Math.abs(right));
  if(firstAudible<0&&peak>.02)firstAudible=frame/48000;
  if(frame<.96*48000)silentPeak=Math.max(silentPeak,peak);
  if(frame>=1.2*48000&&frame<1.4*48000)channelDifference+=(left-right)**2;
 }
 assert.ok(Math.abs(firstAudible-1)<.02,`声音起点应为1秒，实际${firstAudible}`);
 assert.ok(silentPeak<.001,`原始延迟区间应保持静音，峰值${silentPeak}`);
 assert.ok(Math.sqrt(channelDifference/(.2*48000))>.05,'不同的左右声道不能被折叠为同一轨');
});

test('本地竖屏转码按长边限制为1280，小尺寸素材保持原大小',async t=>{
 const execute=promisify(execFile),runner=(command,args,options={})=>execute(command,args,{timeout:15000,maxBuffer:2e6,encoding:'buffer',env:{PATH:process.env.PATH},...options});
 try{await runner('ffmpeg',['-version']);await runner('ffprobe',['-version']);}catch(error){if(error.code==='ENOENT'){t.skip('本地缺少 ffmpeg/ffprobe');return;}throw error;}
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-gemini-portrait-size-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 for(const [name,width,height,expectedWidth,expectedHeight] of [['portrait',1080,1920,720,1280],['small',160,90,160,90]]){
  const source=path.join(directory,name+'.mp4');
  await runner('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=black:s=${width}x${height}:r=24:d=0.1`,'-c:v','libx264','-y',source]);
  await prepareUnderstandingVideo(source,directory,{hasAudio:false,runner});
  const probe=JSON.parse((await runner('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',path.join(directory,'understanding-video.mp4')])).stdout.toString());
  assert.deepEqual(probe.streams[0],{width:expectedWidth,height:expectedHeight});
 }
});
