import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService,run} from '../server/project.mjs';
import {importAsset} from '../server/assets.mjs';
import {AudioGenerationService} from '../server/audio-generation.mjs';
import {prepareVoiceChange,compareVoiceTiming} from '../server/voice-change-audio.mjs';

// Deterministic, speech-like amplitude changes only; no provider or real user audio.
function fixtureWav({scale=1,delay=0,spike=false}={}){
 const rate=16000,length=6*rate,bytes=Buffer.alloc(44+length*2);
 bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(length*2,40);
 const pulses=[[.2,.62,.25],[.85,1.3,.38],[1.45,1.83,.22],[2.14,2.49,.3],[2.7,3.31,.42],[3.56,3.85,.18],[4.02,4.74,.32],[5.02,5.53,.27]];
 for(let i=0;i<length;i++){const t=i/rate-delay;let level=0;for(const [a,b,amp] of pulses)if(t>=a&&t<b)level=amp*Math.sin(Math.PI*(t-a)/(b-a));let value=level*Math.sin(2*Math.PI*237*t)*scale;if(spike&&i>=48000&&i<48160)value=.96*Math.sin(2*Math.PI*1000*i/rate);bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+i*2);}
 return bytes;
}
async function directory(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-voice-change-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}

test('换声自动匹配响度并保留原输出，重启不重复生成或二次放大',async t=>{
 const dir=await directory(t),service=new ProjectService(dir,async()=>{}),project=await service.create('隔离换声');
 const original=fixtureWav(),source=await importAsset(service.dir(project.id),original,'原旁白.wav',{audioRole:'narration'});
 await fs.writeFile(path.join(dir,'provider.wav'),fixtureWav({scale:.35}));
 await run('ffmpeg',['-v','error','-i',path.join(dir,'provider.wav'),'-c:a','libmp3lame','-b:a','128k','-y',path.join(dir,'provider.mp3')]);
 const response=await fs.readFile(path.join(dir,'provider.mp3'));let calls=0;
 const audio=new AudioGenerationService({service,getConfig:async()=>({ELEVENLABS_API_KEY:'isolated-test-key'}),fetcher:async(url,options)=>{calls++;assert.match(url,/\/speech-to-speech\/young-voice/);assert.ok(options.body instanceof FormData);assert.equal(options.body.get('model_id'),'eleven_multilingual_sts_v2');return new Response(response);}});
 await audio.init();t.after(()=>audio.close());
 const input={requestId:crypto.randomUUID(),kind:'voice-change',referenceFile:source.filename,voiceId:'young-voice'};
 await audio.create(project.id,input);await Promise.all(audio.work.values());const job=audio.get(project.id,input.requestId);
 assert.equal(job.status,'succeeded',job.error);assert.match(job.assetFile,/\.wav$/);assert.equal(job.alignment,undefined);assert.equal(job.alignmentSource,'transcription-required');
 assert.equal(job.voiceChange.timing.canPreserveTimeline,true,JSON.stringify(job.voiceChange.timing));assert.ok(job.voiceChange.loudness.appliedGainDb>8);
 assert.ok(Math.abs(job.voiceChange.loudness.output.integratedLufs-job.voiceChange.loudness.source.integratedLufs)<.3);assert.ok(job.voiceChange.loudness.output.truePeakDb<=-1.9);
 assert.equal(job.voiceChange.gainCompensationNeeded,false);assert.deepEqual(await fs.readFile(path.join(audio.dir,job.voiceChange.providerOutputFile)),response);
 const asset=(await service.get(project.id)).assets.find(a=>a.id===job.assetId);assert.equal(asset.provenance.voiceChange.timing.canPreserveTimeline,true);
 const accepted=await fs.readFile(path.join(audio.dir,job.voiceChange.processedFile));job.status='saving';await audio.persist(job);
 const resumed=new AudioGenerationService({service,getConfig:async()=>({}),fetcher:()=>assert.fail('必须使用已保存结果，禁止外呼')});await resumed.init();await resumed.close();
 assert.equal(resumed.get(project.id,job.id).assetId,job.assetId);assert.equal((await service.get(project.id)).assets.length,2);assert.deepEqual(await fs.readFile(path.join(audio.dir,job.voiceChange.processedFile)),accepted);assert.equal(calls,1);
});

test('局部包络延迟明确要求重新对齐，峰值限制优先于盲目补足响度',async t=>{
 const dir=await directory(t),source=path.join(dir,'source.wav'),provider=path.join(dir,'provider.wav'),output=path.join(dir,'matched.wav');
 await fs.writeFile(source,fixtureWav());await fs.writeFile(provider,fixtureWav({scale:.1,delay:.16,spike:true}));
 const result=await prepareVoiceChange({sourceFile:source,providerFile:provider,outputFile:output});
 assert.equal(result.timing.canPreserveTimeline,false);assert.equal(result.timing.status,'realign');assert.ok(result.timing.maxLocalOffsetMs>=120);
 assert.equal(result.loudness.peakLimited,true);assert.ok(result.loudness.output.truePeakDb<=-1.9);assert.match(result.nextAction,/重新对齐/);
});

test('恒定音量缺少语音节奏证据，不能宣称可保留字幕时序',async t=>{
 const dir=await directory(t),file=path.join(dir,'tone.wav');await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=1000:duration=2','-y',file]);
 const timing=await compareVoiceTiming(file,file);assert.equal(timing.canPreserveTimeline,false);assert.equal(timing.status,'insufficient-evidence');assert.equal(timing.wordAlignment,'not-provided');
});
