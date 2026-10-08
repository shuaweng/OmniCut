import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {TranscriptionService,nativeTranscriptEvidence} from '../server/transcription.mjs';
import {TaskRegistry} from '../server/task-registry.mjs';
import {alignCaptions} from '../harness/skills/frame-commercial-video/scripts/align-captions.mjs';

const transcript={format:'hypit.transcript@1',language:'zh',audio_seconds:2,passages:[{text:'你好',start_seconds:.2,end_seconds:1,words:[{text:'你',start_seconds:.2,end_seconds:.5,score:.9},{text:'好',start_seconds:.6,end_seconds:1,score:.8}]}]};
test('原生证据保留测量时序与缺失值，字幕使用同一份证据',()=>{
 const evidence=nativeTranscriptEvidence(transcript);
 assert.deepEqual(alignCaptions(evidence,['你好']),[{text:'你好',start:.2,end:1}]);
 const incomplete=structuredClone(transcript);incomplete.passages[0].words[0]={text:'你'};
 const word=nativeTranscriptEvidence(incomplete).passages[0].words[0];
 assert.equal(word.startSample,undefined);
 assert.throws(()=>alignCaptions(nativeTranscriptEvidence(incomplete),['你好']),/时间戳无效/);
});
test('本地转写复用原生程序和 CLI，排队、重试与 Agent 任务结果贯通',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-transcription-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const projectId='p-0123456789ab',assetFile=crypto.randomUUID()+'.wav';
 await fs.mkdir(path.join(dir,'assets'));await fs.mkdir(path.join(dir,'template'));
 await fs.writeFile(path.join(dir,'template/hypit.runtime.json'),'{}');
 await fs.writeFile(path.join(dir,'assets',assetFile.slice(0,-4)+'.asset.json'),JSON.stringify({filename:assetFile,kind:'audio',duration:2,name:'测试旁白'}));
 const calls=[];const service={dataRoot:dir,dir:()=>dir,get:async()=>({assets:[{filename:assetFile,kind:'audio',duration:2,name:'测试旁白'}]})};
 const engine={root:dir,hypit:'isolated-hypit',ensurePackageRoot:async()=>{},runtime:{prepare:async()=>{}},run:async(_command,args)=>{calls.push(args);if(args[0]==='transcribe')await fs.writeFile(args[args.indexOf('--to')+1],JSON.stringify(transcript));return {stdout:'{}'};}};
 const local=new TranscriptionService({service,engine,getConfig:async()=>({HYPIT_WHISPERX:'enabled'})});await local.init();
 const input={requestId:crypto.randomUUID(),assetFile};const first=await local.create(projectId,input);await local.create(projectId,input);await local.close();
 const registry=new TaskRegistry().register('transcript',local);t.after(()=>registry.close());
 const task=registry.get(projectId,first.taskId);
 assert.equal(task.status,'succeeded',task.error);assert.equal(task.result.provider,'whisperx');assert.equal(task.result.words[0].start,.2);
 assert.equal(calls.filter(x=>x[0]==='transcribe').length,1);
 assert.deepEqual(calls.map(x=>x[0]),['programs','transcribe']);
 assert.equal(calls[1][calls[1].indexOf('--language')+1],'zh');
 assert.equal((await local.configuration()).configured,true);
 assert.equal((await new TranscriptionService({service,getConfig:async()=>({ELEVENLABS_API_KEY:'isolated'})}).configuration()).provider,'elevenlabs');
});
