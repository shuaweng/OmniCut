import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {selectPreviewFrames,probeMediaFile,ProductionPreviewService} from '../server/production-preview.mjs';
import {createRenderProgress,estimateRenderTimeout,renderFailure} from '../server/render-progress.mjs';
const run=promisify(execFile),snapshot={space:{frameCount:96,frameRate:{numerator:24,denominator:1}},tracks:[{id:'visual',clips:[{id:'a',startFrame:0,endFrameExclusive:48},{id:'b',startFrame:48,endFrameExclusive:96}]}]};

test('选帧使用真实原生帧时钟，排序去重、切点两侧和间隔采样有界',()=>{
 assert.deepEqual(selectPreviewFrames(snapshot,{times:[2,0,2]}).frames,[0,48]);
 assert.deepEqual(selectPreviewFrames(snapshot,{auto:'cuts'}).frames,[0,47,48,95]);
 assert.equal(selectPreviewFrames(snapshot,{auto:'every:0.001s',maxFrames:4}).sampled,true);
 assert.deepEqual(selectPreviewFrames(snapshot,{auto:'every:0.001s',maxFrames:4}).frames,[0,32,63,95]);
 assert.deepEqual(selectPreviewFrames(snapshot,{times:[3.99]}).frames,[95]);
 assert.throws(()=>selectPreviewFrames(snapshot,{times:[4]}),/片长/);
 assert.throws(()=>selectPreviewFrames(snapshot,{auto:'beats'}),/没有可靠的节拍/);
 assert.deepEqual(selectPreviewFrames({...snapshot,previewBeatFrames:[24,72]},{auto:'beats'}).frames,[24,72]);
});

test('节拍预览只使用映射到当前版本的 beat/downbeat，排除能量候选',async()=>{
 const guide={projectId:'p',videoId:'v-default',revision:'r1',guides:[{frame:24,kind:'beat'},{frame:48,kind:'accent-candidate'},{frame:72,kind:'downbeat'}],warnings:['没有自动猜测小节拍']};
 const preview=new ProductionPreviewService({service:{dataRoot:'/fixture'},root:'/fixture',beatGuides:{load:async()=>guide}});
 const result=await preview.loadBeatFrames('p',snapshot,{videoId:'v-default',revision:'r1'});assert.deepEqual(result.snapshot.previewBeatFrames,[24,72]);assert.equal(result.warnings.length,1);
 await assert.rejects(preview.loadBeatFrames('p',snapshot,{videoId:'v-default',revision:'r2'}),/映射版本已改变/);
});

test('stderr 分块读取原生 verbose 帧数，步骤数不会伪装成帧数',()=>{
 let clock=0;const progress=createRenderProgress({snapshot,now:()=>clock});
 progress.pushStderr('  · Working · 2/3 steps complete · 1 rendering frames · 1s\n');assert.equal(progress.status().framesCompleted,0);
 clock=10000;progress.pushStderr('    hyperframes.local: rendering fra');progress.pushStderr('mes · 24/96 frames\n');assert.equal(progress.status().framesCompleted,24);
 const before=progress.deadlineAt();clock=90000;progress.pushStderr('    hyperframes.local: rendering frames · 30/96 frames\n');assert.ok(progress.deadlineAt()>before);
 const failed=progress.finish('',{message:'worker 0 frame 55: timed out'});assert.equal(failed.failure.frame,55);assert.equal(failed.failure.affectedEntities[0].entityId,'b');
 assert.ok(estimateRenderTimeout({duration:30,fps:60,width:1080,height:1920})>240000);
 assert.equal(renderFailure('unknown source error',snapshot).frame,undefined);
});

test('成片探测实际元数据、首音轨响度与静帧区间，只使用临时生成媒体',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-probe-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const file=path.join(dir,'fixture.mp4');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=160x120:r=24:d=1','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',file]);
 const result=await probeMediaFile(file,{run});assert.equal(result.width,160);assert.equal(result.height,120);assert.equal(result.fps,24);assert.equal(result.audioTracks,1);assert.ok(result.loudness.integratedLUFS<0);assert.ok(result.blackIntervals[0].duration>.8);assert.ok(result.staticIntervals[0].duration>.8);assert.equal(result.analysis.complete,true);
 // Existing exports follow their saved video/revision, even after the current project changes.
 const jobId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',exportDir=path.join(dir,'exports',jobId);await fs.mkdir(exportDir,{recursive:true});await fs.copyFile(file,path.join(exportDir,'final.mp4'));await fs.writeFile(path.join(exportDir,'job.json'),JSON.stringify({projectId:'p',videoId:'v-default',revision:'exported',status:'done'}));
 const service={dataRoot:dir,currentVideoId:()=> 'v-default',get:async()=>({revision:'newer',assets:[]})},preview=new ProductionPreviewService({service,root:path.resolve(import.meta.dirname,'..'),run});
 const selected=await preview.previewFrames('p',{jobId,times:[0,.5],grid:false,sampleDuration:.25});assert.equal(selected.source,'export');assert.equal(selected.revision,'exported');assert.deepEqual(selected.frames.map(f=>f.frame),[0,12]);assert.ok(selected.frames.every(f=>f.url.includes('videoId=v-default')&&f.image.data&&!f.reference));assert.equal(selected.sample.duration,.25);assert.ok(selected.sample.url.endsWith('sample.mp4?videoId=v-default'));
 const metadata=JSON.parse(await fs.readFile(path.join(dir,'production-previews',selected.previewId,'preview.json'),'utf8'));assert.ok(metadata.frames.every(f=>!f.image));assert.ok((await preview.file('p',selected.previewId,'sample.mp4')).mediaType==='video/mp4');
 const recovered=await preview.recoverPreview('p',{previewId:selected.previewId,revision:'exported'});assert.equal(recovered.recovered,true);assert.equal(recovered.revision,'exported');assert.ok(recovered.frames[0].image.data);
 await assert.rejects(preview.recoverPreview('p',{previewId:selected.previewId,revision:'newer'}),/版本与记录不一致/);
 // A project preview remains readable after a later edit. Recovery never starts a renderer.
 metadata.source='project';metadata.frames[0].path='/untrusted/metadata/path.png';await fs.writeFile(path.join(dir,'production-previews',selected.previewId,'preview.json'),JSON.stringify(metadata));
 const fromOldProject=await preview.recoverPreview('p',{previewId:selected.previewId,revision:'exported'});assert.equal(fromOldProject.source,'project');assert.ok(fromOldProject.frames[0].image.data);assert.notEqual(fromOldProject.frames[0].path,'/untrusted/metadata/path.png');
 service.currentVideoId=()=> 'v-other';await assert.rejects(preview.recoverPreview('p',{previewId:selected.previewId,revision:'exported'}),/不属于当前视频/);
});

test('版本冲突在启动原生预览前拒绝，文件读取校验当前视频归属',async t=>{
 const dataRoot=await fs.mkdtemp(path.join(os.tmpdir(),'frame-preview-guard-'));t.after(()=>fs.rm(dataRoot,{recursive:true,force:true}));let calls=0;
 const service={dataRoot,currentVideoId:()=> 'v-default',get:async()=>({revision:'current',native:{}}),exclusive:async(id,fn)=>fn()};
 const preview=new ProductionPreviewService({service,engine:{root:'/fixture',run:async()=>{calls++;}},studios:{resource:async()=>{calls++;}}});
 await assert.rejects(preview.previewFrames('p',{revision:'old'}),/画面已更新/);assert.equal(calls,0);
 const id='pv-'+'a'.repeat(24),dir=path.join(dataRoot,'production-previews',id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'preview.json'),JSON.stringify({projectId:'p',videoId:'v-other',frames:[{name:'frame-000000000.png'}]}));
 await assert.rejects(preview.file('p',id,'frame-000000000.png'),/不属于当前视频/);
});
