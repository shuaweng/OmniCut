import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {ProjectService,run} from '../server/project.mjs';
import {BeatAnalysisService,analyzeBeatPCM} from '../server/beat-analysis.mjs';
function clicks(seconds=16){const pcm=Buffer.alloc(seconds*8000*2);for(let at=.5,index=0;at<seconds;at+=.5,index++)for(let i=0;i<320;i++)pcm.writeInt16LE(Math.round((index%4===0?.9:.35)*Math.sin(i/8000*2*Math.PI*800)*Math.exp(-i/150)*32700),(Math.round(at*8000)+i)*2);return pcm;}
function wav(pcm){const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(8000,24);header.writeUInt32LE(16000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);}
test('local pulses produce measured onset times and tempo while accents remain unverified downbeat candidates',()=>{
 const result=analyzeBeatPCM(clicks());assert.ok(Math.abs(result.bpm-120)<1);assert.equal(result.beats.length,31);assert.ok(Math.abs(result.beats[0]-.5)<.03);assert.deepEqual(result.downbeats,[]);assert.ok(result.strongBeatCandidates.length>=7);assert.ok(result.strongBeatCandidates.every(candidate=>candidate.verifiedDownbeat===false));assert.ok(result.confidence<=.75);assert.match(result.warnings.join(' '),/无法确认小节/);
 const silent=analyzeBeatPCM(Buffer.alloc(8000*8));assert.equal(silent.bpm,null);assert.deepEqual(silent.beats,[]);const tone=Buffer.alloc(8000*8);for(let i=0;i<tone.length/2;i++)tone.writeInt16LE(Math.round(Math.sin(i/8000*2*Math.PI*400)*10000),i*2);assert.equal(analyzeBeatPCM(tone).bpm,null);
});
test('ffmpeg decodes a Chinese named audio asset, caches bytes/version/range and restores video-scoped records without provider calls',async t=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-beats-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));const service=new ProjectService(data,async()=>{}),p=await service.createBlank('本地节拍'),variant=await service.createVariant(p.id,{name:'变体'}),id=crypto.randomUUID(),assetFile=id+'.wav';
 const bytes=wav(clicks());await fs.writeFile(path.join(service.projectDir(p.id),'assets',assetFile),bytes);await fs.writeFile(path.join(service.projectDir(p.id),'assets',id+'.asset.json'),JSON.stringify({id,filename:assetFile,name:'中文节奏配乐.wav',kind:'audio',duration:16,created:'2026-10-10T00:00:00Z'}));
 let decodes=0,events=0;const runner=async(...args)=>{decodes++;return run(...args);},beats=new BeatAnalysisService({service,runner});await beats.init();beats.subscribe(()=>events++);
 const first=await beats.analyze(p.id,{assetFile});assert.equal(first.assetName,'中文节奏配乐.wav');assert.equal(first.bpm,120);assert.equal(first.cached,false);const second=await beats.analyze(p.id,{assetFile,videoId:variant.videoId});assert.equal(second.id,first.id);assert.equal(second.cached,true);assert.equal(second.videoId,variant.videoId);assert.equal(decodes,1);assert.equal(events,2);assert.equal(beats.listSync(p.id).length,1);assert.equal(beats.listSync(p.id,{videoId:variant.videoId})[0].id,first.id);
 const resumed=new BeatAnalysisService({service,runner:async()=>assert.fail('恢复不解码')});await resumed.init();assert.equal(resumed.listSync(p.id,{videoId:variant.videoId})[0].stale,false);assert.equal((await resumed.get(p.id,first.id,{videoId:variant.videoId})).assetSha,first.assetSha);
 const cropped=await beats.analyze(p.id,{assetFile,start:2,end:10});assert.notEqual(cropped.id,first.id);assert.ok(cropped.beats.every(at=>at>=2&&at<=10));assert.equal(decodes,2);
 const nextVersion=new BeatAnalysisService({service,runner,version:'fixture-next-version'});const fresh=await nextVersion.analyze(p.id,{assetFile});assert.notEqual(fresh.id,first.id);assert.equal(decodes,3);assert.equal((await nextVersion.get(p.id,first.id)).stale,true);
 await assert.rejects(beats.analyze(p.id,{assetFile:'../中文.wav'}),/音频素材/);await assert.rejects(beats.analyze(p.id,{assetFile,start:12,end:8}),/时间范围/);await beats.close();await resumed.close();await nextVersion.close();
});
