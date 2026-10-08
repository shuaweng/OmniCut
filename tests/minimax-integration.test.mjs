import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService,run} from '../server/project.mjs';
import {GenerationService} from '../server/generation.mjs';
import {AudioGenerationService} from '../server/audio-generation.mjs';
import {ReferenceService} from '../server/reference.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
import {SettingsStore} from '../server/settings.mjs';
import {updateAssetMetadata} from '../server/assets.mjs';
import {minimaxVideoBody,minimaxSpeechEvidence} from '../server/minimax.mjs';
async function setup(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-minimax-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const service=new ProjectService(dir,async()=>{}),p=await service.createBlank('测试广告','15秒3:4广告');const video=path.join(dir,'clip.mp4'),audio=path.join(dir,'voice.mp3'),silent=path.join(dir,'silent.mp3');await run('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:s=320x480:d=4','-f','lavfi','-i','sine=frequency=440:duration=4','-c:v','libx264','-c:a','aac','-y',video]);await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-y',audio]);await run('ffmpeg',['-v','error','-f','lavfi','-i','anullsrc=r=44100:cl=mono','-t','2','-y',silent]);return {dir,service,p,video:await fs.readFile(video),audio:await fs.readFile(audio),silent:await fs.readFile(silent)};}
const config={MINIMAX_API_KEY:'isolated-minimax-secret',MINIMAX_VIDEO_MODEL:'MiniMax-H3',VIDEO_PROVIDER:'minimax',SPEECH_PROVIDER:'minimax',MUSIC_PROVIDER:'minimax'};
test('H3 使用官方 V2，持久任务恢复与有声素材共享，不自动升级或重复收费',async t=>{
 const f=await setup(t),calls=[];const fetcher=async(url,o)=>{calls.push({url,o});if(url.endsWith('/v2/video_generation'))return Response.json({task_id:'424010985738629'});if(url.includes('/v2/query/'))return Response.json({task:{status:'succeeded',content:{url:'https://cdn.hailuoai.com/video.mp4'}}});assert.equal(o.headers,undefined);return new Response(f.video);};
 const g=new GenerationService({service:f.service,getConfig:async()=>config,fetcher,autoPoll:false});await g.init();const req={requestId:crypto.randomUUID(),autoApply:false,prompt:'商品特写',duration:4,audio:true,imageFile:null,confirmed:true,ratio:'3:4'};const j=await g.create(f.p.id,req);await g.create(f.p.id,req);g.close();assert.equal(calls.length,1);const body=JSON.parse(calls[0].o.body);assert.equal(body.model,'MiniMax-H3');assert.equal(body.resolution,'768P');assert.equal(body.ratio,'3:4');assert.equal(body.generate_audio,undefined);
 const resume=new GenerationService({service:f.service,getConfig:async()=>({...config,VIDEO_PROVIDER:'seedance'}),fetcher,autoPoll:false});await resume.init();t.after(()=>resume.close());const done=await resume.poll(j.id);assert.equal(done.status,'succeeded',done.error);assert.equal(done.hasAudio,true);assert.equal((await f.service.get(f.p.id)).assets[0].provenance.provider,'minimax');assert.doesNotMatch(await fs.readFile(path.join(g.dir,j.id+'.json'),'utf8'),/isolated-minimax|base64/);assert.throws(()=>minimaxVideoBody({resolution:'2K',duration:6},'MiniMax-H3-Max',[]),/支持/);
});
test('Speech2.8 与 Music3.0 返回真实音频，静音服务产物阻止入库',async t=>{
 const f=await setup(t),calls=[];let silent=false;const audio=new AudioGenerationService({service:f.service,getConfig:async()=>config,fetcher:async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return Response.json({base_resp:{status_code:0},data:{audio:(silent?f.silent:f.audio).toString('hex')}});}});await audio.init();t.after(()=>audio.close());
 for(const kind of ['speech','music']){const j=await audio.create(f.p.id,{requestId:crypto.randomUUID(),kind,text:'让热爱开场',prompt:kind==='music'?'明亮电子乐':'',duration:15});await Promise.all(audio.work.values());assert.equal(audio.get(f.p.id,j.id).status,'succeeded');}
 assert.equal(calls[0].body.model,'speech-2.8-hd');assert.equal(calls[0].body.language_boost,'Chinese');assert.equal(calls[1].body.model,'music-3.0');assert.equal(calls[1].body.is_instrumental,true);assert.equal(calls[1].body.music_length_ms,undefined);
 silent=true;const j=await audio.create(f.p.id,{requestId:crypto.randomUUID(),kind:'speech',text:'测试'});await Promise.all(audio.work.values());assert.equal(audio.get(f.p.id,j.id).status,'failed');assert.equal(audio.get(f.p.id,j.id).errorCode,'SILENT_AUDIO');assert.equal((await f.service.get(f.p.id)).assets.length,2);
});
test('设置保存、改名、计划、素材版本、只读审片与转写结果在同一工程闭环',async t=>{
 const f=await setup(t),store=new SettingsStore(path.join(f.dir,'.env'));const saved=await store.save({minimaxApiKey:config.MINIMAX_API_KEY,minimaxVideoModel:'MiniMax-H3',minimaxSpeechModel:'speech-2.8-hd',minimaxMusicModel:'music-3.0',minimaxVoiceId:'Chinese (Mandarin)_Lyrical_Voice',minimaxRegion:'cn',videoProvider:'minimax',speechProvider:'minimax',musicProvider:'elevenlabs'});assert.equal(saved.minimaxConfigured,true);assert.doesNotMatch(JSON.stringify(saved),/isolated-minimax/);
 await f.service.rename(f.p.id,{name:'测试成片',expectedName:f.p.name});await f.service.plan(f.p.id,{duration:15,ratio:'3:4',scenes:[{name:'开场',start:0,end:15,visual:'产品特写'}]});const {importAsset}=await import('../server/assets.mjs');const a=await importAsset(f.service.dir(f.p.id),f.video,'开场.mp4'),b=await importAsset(f.service.dir(f.p.id),f.video,'开场修正版.mp4');await updateAssetMetadata(f.service.dir(f.p.id),{assetFile:b.filename,replaces:a.filename,scene:'开场'});assert.equal((await f.service.get(f.p.id)).assets.find(x=>x.id===a.id).editorialStatus,'superseded');
 const refs=new ReferenceService({service:f.service,getConfig:async()=>({ARK_API_KEY:'isolated'}),prepare:async()=>({boundaries:[]}),analyze:async()=>({summary:'字幕挡住商品',issues:[{start:2,end:3,category:'字幕',fix:'移至安全区'}]}),review:()=>assert.fail('质检不能进入复刻规划')});await refs.init();const before=await f.service.raw(f.p.id);const item=await refs.create(f.p.id,{requestId:crypto.randomUUID(),purpose:'quality',assetFile:a.filename,brief:'检查声画'});await refs.close();const registry=new TaskRegistry().register('reference',refs);t.after(()=>registry.close());assert.equal(registry.get(f.p.id,'reference:'+item.id).result.analysis.issues.length,1);assert.deepEqual(await f.service.raw(f.p.id),before);
 const transcript=registry.project('transcript',{id:'test',status:'succeeded',assetFile:'voice.mp3',text:'你好',words:[{text:'你好',start:0,end:1}]});assert.equal(transcript.result.text,'你好');assert.equal(transcript.result.words[0].end,1);
});

test('MiniMax 原生词级字幕保留真实时间，不把词均分成伪造的逐字时间',()=>{const result=minimaxSpeechEvidence([{timestamped_words:[{word:'热爱',time_begin:600,time_end:1120}]}]);assert.deepEqual(result.words,[{text:'热爱',start:.6,end:1.12}]);assert.equal(result.evidence.passages[0].chars.length,0);assert.equal(minimaxSpeechEvidence([{timestamped_words:[{word:'错误',time_begin:1000,time_end:0}]}]),null);});
