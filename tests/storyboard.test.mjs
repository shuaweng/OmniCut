import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProjectService, run } from '../server/project.mjs';
import { importAsset, assetPath } from '../server/assets.mjs';
async function fixture(t,real=false){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-storyboard-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));const service=new ProjectService(dir,real?undefined:async()=>{});const project=await service.create('隔离镜头测试');return {service,project,dir};}

test('旧项目投影为三个镜头；时长更新重排字幕，撤销恢复整个编排',async t=>{
 const {service:s,project:p}=await fixture(t);assert.equal(p.duration,12);assert.deepEqual(p.shots.map(x=>x.start),[0,4,8]);
 const q=await s.change(p.id,p.revision,{type:'shot',shotId:'shot-1',duration:2.5});assert.equal(q.duration,10.5);assert.deepEqual(q.shots.map(x=>x.start),[0,2.5,6.5]);
 assert.match((await s.raw(p.id)).source,/end="10.5s"/);
 const undone=await s.undo(p.id,q.revision);assert.equal(undone.duration,12);assert.deepEqual(undone.shots,p.shots);
});

test('批量镜头与字幕修改失败时整批回退',async t=>{
 const {service:s,project:p}=await fixture(t);
 await assert.rejects(s.change(p.id,p.revision,{type:'batch',changes:[{type:'shot',shotId:'shot-1',duration:5},{type:'text',id:'caption-1',text:''}]}),/文案/);
 assert.equal((await s.get(p.id)).revision,p.revision);
 await assert.rejects(s.change(p.id,p.revision,{type:'shot',shotId:'shot-1',duration:0}),/时长/);
 await assert.rejects(s.change(p.id,p.revision,{type:'shot',shotId:'shot-1',assetFile:'../../outside.mp4'}),/素材不存在/);
});

test('图片用于独立镜头并通过 Hypit 编译，不影响其余镜头；素材路径受限',async t=>{
 const {service:s,project:p}=await fixture(t,true);
 const a=await importAsset(s.dir(p.id),await fs.readFile(new URL('../sample-assets/sage-tumbler.png',import.meta.url)),'商品图.png');
 let q=await s.change(p.id,p.revision,{type:'batch',changes:[{type:'shot',shotId:'shot-2',assetFile:a.filename,duration:3,fit:'contain'},{type:'text',id:'caption-2',text:'独立镜头'}]});
 assert.equal(q.shots[1].assetFile,a.filename);assert.equal(q.shots[0].assetFile,null);assert.equal(q.shots[2].assetFile,null);assert.equal(q.duration,11);
 assert.equal(q.history.length,1);await assert.rejects(assetPath(s.dir(p.id),'../../.env'),/不存在/);
 q=await s.undo(p.id,q.revision);assert.equal(q.shots[1].assetFile,null);assert.equal(q.assets.length,1);
});

test('视频取段、原声、音乐音量通过真实 Hypit 编译',async t=>{
 const {service:s,project:p,dir}=await fixture(t,true);
 const video=path.join(dir,'sample.mp4'),audio=path.join(dir,'music.wav');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=180x320:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video]);
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','2',audio]);
 const v=await importAsset(s.dir(p.id),await fs.readFile(video),'视频.mp4');const a=await importAsset(s.dir(p.id),await fs.readFile(audio),'音乐.wav');
 assert.equal(v.hasAudio,true);
 let q=await s.change(p.id,p.revision,{type:'shot',shotId:'shot-1',assetFile:v.filename,trimStart:.5,sourceAudio:true,duration:1.5});
 q=await s.change(p.id,q.revision,{type:'music',assetFile:a.filename,gain:.3});
 assert.equal(q.music.gain,.3);assert.equal(q.shots[0].trimStart,.5);assert.equal(q.shots[0].sourceAudio,true);
 await assert.rejects(s.change(p.id,q.revision,{type:'shot',shotId:'shot-1',trimStart:3}),/起点/);
 await assert.rejects(s.change(p.id,q.revision,{type:'music',gain:2}),/音量/);
 q=await s.change(p.id,q.revision,{type:'music',assetFile:null});assert.equal(q.music,null);
});

test('伪装成视频的文件拒绝入库且不遗留文件',async t=>{
 const {service:s,project:p}=await fixture(t);const before=await fs.readdir(path.join(s.dir(p.id),'assets'));
 await assert.rejects(importAsset(s.dir(p.id),Buffer.from('not a video'),'sample.mp4'),/解码/);
 assert.deepEqual(await fs.readdir(path.join(s.dir(p.id),'assets')),before);
});

test('动态新增、排序、复制、删除沿用稳定 ID；空字幕不写演示文案且通过真实编译',async t=>{
 const {service:s,project:p}=await fixture(t,true);
 let q=await s.change(p.id,p.revision,{type:'timeline',action:'add',afterShotId:'shot-1',duration:2});
 const added=q.shots[1];assert.equal(q.shots.length,4);assert.equal(q.texts.find(t=>t.id===added.captionId).text,'');assert.equal(added.duration,2);
 q=await s.change(p.id,q.revision,{type:'text',id:added.captionId,text:'独立新增镜头'});
 q=await s.change(p.id,q.revision,{type:'timeline',action:'move',shotId:added.id,index:3});
 assert.equal(q.shots[3].id,added.id);assert.deepEqual(q.shots.map(s=>s.start),[0,4,8,12]);assert.equal(q.texts.at(-1).text,'独立新增镜头');
 const before=q; q=await s.change(p.id,q.revision,{type:'timeline',action:'duplicate',shotId:added.id});
 const copy=q.shots.at(-1);assert.notEqual(copy.id,added.id);assert.equal(q.texts.at(-1).text,'独立新增镜头');
 q=await s.change(p.id,q.revision,{type:'timeline',action:'delete',shotId:copy.id});assert.deepEqual(q.shots,before.shots);
 q=await s.undo(p.id,q.revision);assert.equal(q.shots.at(-1).id,copy.id);
 const reversed=q.shots.map(s=>s.id).reverse();q=await s.change(p.id,q.revision,{type:'timeline',action:'reorder',shotIds:reversed});assert.deepEqual(q.shots.map(s=>s.id),reversed);
});

test('分割视频延续原素材取段、声音、字幕；不改变总时长且一次撤销完全复原',async t=>{
 const {service:s,project:p,dir}=await fixture(t,true);const file=path.join(dir,'split.mp4');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=180x320:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file]);
 const a=await importAsset(s.dir(p.id),await fs.readFile(file),'分割原声.mp4');
 const before=await s.change(p.id,p.revision,{type:'shot',shotId:'shot-2',assetFile:a.filename,duration:3,trimStart:.5,sourceAudio:true,fit:'contain'});
 const after=await s.change(p.id,before.revision,{type:'timeline',action:'split',shotId:'shot-2',splitAt:1.2});
 assert.equal(after.duration,before.duration);assert.equal(after.shots.length,4);
 assert.deepEqual(after.shots.slice(1,3).map(s=>[s.duration,s.trimStart,s.assetFile,s.sourceAudio,s.fit]),[[1.2,.5,a.filename,true,'contain'],[1.8,1.7,a.filename,true,'contain']]);
 assert.equal(after.texts.find(t=>t.id===after.shots[2].captionId).text,before.texts.find(t=>t.id==='caption-2').text);
 assert.equal(after.shots[3].id,'shot-3');assert.equal(after.shots[3].start,before.shots[2].start);
 const undo=await s.undo(p.id,after.revision);assert.deepEqual(undo.shots,before.shots);assert.deepEqual(undo.texts,before.texts);assert.equal(undo.assets.length,1);
});

test('非法分割排序、已删除 ID、上限和批量失败不会破坏项目',async t=>{
 const {service:s,project:p}=await fixture(t);
 for(const change of [{type:'timeline',action:'split',shotId:'shot-1',splitAt:4},{type:'timeline',action:'split',shotId:'shot-1',splitAt:0},{type:'timeline',action:'reorder',shotIds:['shot-1','shot-1','shot-3']},{type:'timeline',action:'move',shotId:'shot-1',index:8},{type:'timeline',action:'delete',shotId:'shot-deadbeef'}])await assert.rejects(s.change(p.id,p.revision,change));
 await assert.rejects(s.change(p.id,p.revision,{type:'batch',changes:[{type:'timeline',action:'delete',shotId:'shot-2'},{type:'text',id:'caption-2',text:'不能改已删字幕'}]}));assert.equal((await s.get(p.id)).revision,p.revision);
 let q=await s.change(p.id,p.revision,{type:'batch',changes:[{type:'timeline',action:'delete',shotId:'shot-2'},{type:'timeline',action:'delete',shotId:'shot-3'}]});
 await assert.rejects(s.change(p.id,q.revision,{type:'timeline',action:'delete',shotId:'shot-1'}),/至少保留/);
 for(let i=0;i<29;i++)q=await s.change(p.id,q.revision,{type:'timeline',action:'add',duration:.1});
 await assert.rejects(s.change(p.id,q.revision,{type:'timeline',action:'add'}),/30/);assert.equal((await s.get(p.id)).shots.length,30);
 await assert.rejects(s.change(p.id,q.revision,{type:'batch',changes:q.shots.slice(0,4).map(shot=>({type:'shot',shotId:shot.id,duration:180}))}),/10 分钟/);
});
