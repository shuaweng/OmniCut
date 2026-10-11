import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService} from '../server/project.mjs';
import {TurnChanges} from '../server/turn-changes.mjs';
import {validateReferences,applyProductionPreferences,productionPreferencesFromUserText} from '../server/conversation-input.mjs';
import {videoUnderstandingConfiguration,prepareUnderstandingVideo,understandVideo,normalizeVideoReview} from '../server/video-understanding.mjs';

test('媒体调用沿用用户选择；真实用户改选不会带走另一服务的模型或音色',()=>{
 const preferences={video:{provider:'minimax',model:'MiniMax-H3',resolution:'768P'},speech:{provider:'elevenlabs',model:'eleven_v4',voiceId:'old-voice'}};
 assert.deepEqual(applyProductionPreferences('generate',{prompt:'广告'},preferences),{provider:'minimax',model:'MiniMax-H3',resolution:'768P',prompt:'广告',quality:'configured'});
 assert.throws(()=>applyProductionPreferences('generate',{provider:'seedance',prompt:'广告'},preferences),error=>error.code==='PRODUCTION_SELECTION_CONFLICT');
 const userPreferences=productionPreferencesFromUserText('视频用Seedance，配音用MiniMax');
 const switched=applyProductionPreferences('generate',{provider:'seedance',prompt:'广告'},preferences,{userPreferences});assert.equal(switched.model,undefined);assert.equal(switched.resolution,undefined);
 const voice=applyProductionPreferences('generate-audio',{kind:'speech',provider:'minimax',text:'你好'},preferences,{userPreferences});assert.equal(voice.voiceId,undefined);assert.equal(voice.model,undefined);
 assert.throws(()=>applyProductionPreferences('generate',{model:'MiniMax-H3-Max'},preferences),error=>error.field==='model');
});

test('引用保留审片建议与实际时间基准，不能接受反向区间',()=>{
 const [ref]=validateReferences([{kind:'review',videoId:'v-abcdef123456',revision:'old',startFrame:72,endFrameExclusive:96,frameRate:{numerator:24,denominator:1},label:'尾板错误',suggestion:'保留正确瓶盖'}],{id:'p-abcdef123456',revision:'new'});
 assert.equal(ref.start,3);assert.equal(ref.end,4);assert.equal(ref.stale,true);assert.equal(ref.suggestion,'保留正确瓶盖');assert.throws(()=>validateReferences([{kind:'range',startFrame:5,endFrameExclusive:2}],{}),/时间/);
});

test('理解接口发送完整视频与对照图，固定静态采样且鉴权错误不暴露密钥',async()=>{
 const env={VIDEO_UNDERSTANDING_PROVIDER:'gemini',GEMINI_API_KEY:'fixture-only',GEMINI_VIDEO_MODEL:'gemini-3.8-flash'},video={mimeType:'video/mp4',data:'bWVkaWE='};let calls=0;
 const result=await understandVideo({env,video,prompt:'检查字幕',images:[{mimeType:'image/png',data:'aW1hZ2U='}],fetcher:async(url,request)=>{calls++;assert.ok(url.endsWith('/gemini-3.8-flash:generateContent'));assert.equal(request.headers['x-goog-api-key'],'fixture-only');const body=JSON.parse(request.body),part=body.contents[0].parts[0];assert.deepEqual(part.inlineData,video);assert.equal(part.videoMetadata.fps,4);assert.equal(part.mediaProcessing,'STATIC');assert.equal(body.contents[0].parts.at(-1).inlineData.mimeType,'image/png');return Response.json({candidates:[{content:{parts:[{thought:true,text:'hidden'},{text:JSON.stringify({summary:'已审看',issues:[]})}]}}],usageMetadata:{totalTokenCount:10}});}});
 assert.equal(calls,1);assert.equal(result.value.summary,'已审看');assert.equal(result.samplingFps,4);assert.equal(videoUnderstandingConfiguration(env).configured,true);assert.equal(JSON.stringify(videoUnderstandingConfiguration(env)).includes('fixture-only'),false);
 await assert.rejects(understandVideo({env,video,prompt:'检查',fetcher:async()=>Response.json({error:{message:'fixture-only'}},{status:403})}),error=>!error.message.includes('fixture-only')&&/鉴权/.test(error.message));
 assert.throws(()=>normalizeVideoReview({summary:'结果',issues:[{start:20,end:21}]},15),/时间/);
});

test('转码保留声音，文件过大不截断；只用隔离 runner',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-video-review-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 const video=await prepareUnderstandingVideo('local-fixture.mp4',directory,{runner:async(command,args)=>{assert.equal(command,'ffmpeg');assert.ok(args.includes('0:a?'));assert.ok(args.includes('aac'));await fs.writeFile(args.at(-1),'video-and-audio');}});assert.equal(Buffer.from(video.data,'base64').toString(),'video-and-audio');
 await assert.rejects(prepareUnderstandingVideo('local-fixture.mp4',directory,{runner:async(command,args)=>{const file=await fs.open(args.at(-1),'w');await file.truncate(14000001);await file.close();}}),/过大/);
});

test('整轮撤销恢复两次修改，之后的手动修改会拒绝覆盖',async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-turn-changes-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));const service=new ProjectService(data,async()=>{}),changes=await new TurnChanges(service).init();let p=await service.create('可撤销');
 for(const [id,text] of [['title','新标题'],['caption-1','新字幕']]){const before=p;p=await service.change(p.id,p.revision,{type:'text',id,text});await changes.record({projectId:p.id,conversationId:p.id,turnId:'turn-a',before,after:p,operation:'change',args:{}});}
 const card=changes.latest(p.id);assert.equal(card.videos[0].changes.length,2);assert.equal(card.undoAvailable,true);const restored=await changes.undo(p.id,card.id);assert.equal(restored.history.length,0);assert.equal(changes.latest(p.id).undone,true);
 const before=restored,after=await service.change(p.id,restored.revision,{type:'text',id:'title',text:'助手修改'});await changes.record({projectId:p.id,conversationId:p.id,turnId:'turn-b',before,after,operation:'change',args:{}});const manual=await service.change(p.id,after.revision,{type:'text',id:'title',text:'我的后续修改'});await assert.rejects(changes.undo(p.id,changes.latest(p.id).id),error=>error.status===409);assert.equal((await service.get(p.id)).revision,manual.revision);
});

import {nativeSnapshotChanges} from '../server/snapshot-changes.mjs';
test('原生快照片段比较带真实实体与帧率，不把源码修改泛称为全片更新',()=>{
 const snapshot=(end,text)=>({space:{frameRate:{numerator:24,denominator:1}},tracks:[{id:'picture',clips:[{id:'clip:3',startFrame:48,endFrameExclusive:end,display:{title:'商品特写'},inspector:[{id:'text',label:'Text',value:text}]}]}]});
 const changes=nativeSnapshotChanges(snapshot(120,'之前'),snapshot(96,'之后'));
 assert.equal(changes.length,2);assert.equal(changes[0].label,'商品特写：3s → 2s');assert.equal(changes[0].start,2);assert.equal(changes[1].entityId,'clip:3');assert.equal(changes[1].label,'商品特写：调整文字');
});
