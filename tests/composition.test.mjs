import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {importAsset} from '../server/assets.mjs';
import {compileComposition} from '../server/composition.mjs';

test('共享素材一键编排真实Hypit，局部修改保留其他轨道且不覆盖代码草稿',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-compose-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const service=new ProjectService(dir,async()=>{}),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});let p=await service.createBlank('编排验证');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','color=c=orange:s=320x480:r=24:d=2','-y',path.join(dir,'clip.mp4')]);
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-y',path.join(dir,'voice.wav')]);
 const video=await importAsset(service.dir(p.id),await fs.readFile(path.join(dir,'clip.mp4')),'演示镜头.mp4');
 const audio=await importAsset(service.dir(p.id),await fs.readFile(path.join(dir,'voice.wav')),'测试声音.wav',{taskId:'audio:local-voice'});await fs.mkdir(path.join(dir,'audio-generations'));await fs.writeFile(path.join(dir,'audio-generations/local-voice.json'),JSON.stringify({alignment:{characters:['你','好'],starts:[.2,.5],ends:[.5,.8]}}));
 const image=await importAsset(service.dir(p.id),await fs.readFile(path.join(root,'sample-assets/sage-tumbler.png')),'商品图.png');
 const spec={output:{width:320,height:480,fps:24},duration:2,shots:[{id:'opening',name:'开场',assetFile:video.filename,start:0,duration:1,trimStart:.5},{id:'ending',name:'尾板',kind:'image',assetFile:image.filename,start:1,duration:1}],audio:[{id:'voice',name:'旁白',assetFile:audio.filename,start:0,duration:2,role:'narration'}],captions:[{audioId:'voice',phrases:['你好']}],texts:[{id:'caption',text:'真实字幕 & <文字>',start:.2,duration:1.5}]};
 const first=await engine.compose(p.id,p.revision,spec);assert.equal(first.duration,2);assert.equal(first.texts.find(t=>t.id==='spoken-voice-0').start,.2);p=await service.get(p.id);assert.equal(p.native.labels['clip-opening'],'开场');
 const before=await fs.readFile(path.join(service.dir(p.id),'main.svml'),'utf8');assert.ok(before.includes('&amp; &lt;文字&gt;'));
 const second=await engine.compose(p.id,p.revision,{patch:{audio:[{id:'voice',gain:.8}],texts:[{id:'caption',box:[7,10,93,22]}]}});assert.deepEqual(second.shots,first.shots);assert.equal(second.audio[0].gain,.8);
 const projectDir=service.dir(p.id),runtime=path.join(projectDir,'hypit.runtime.json');
 t.after(()=>run(hypit,['runtime','down','--workspace',projectDir,'--runtime',runtime,'--json'],{timeout:10000}).catch(()=>{}));
 const built=JSON.parse((await run(hypit,['build',path.join(projectDir,'render.svrun'),'--workspace',projectDir,'--runtime',runtime,'--follow','--json'],{timeout:120000,maxBuffer:6e6})).stdout);
 const buildId=built.build?.id||built.buildId||built.id,dest=path.join(dir,'preview.mp4');await run(hypit,['get',buildId,'--output','final.video','--to',dest,'--workspace',projectDir,'--json'],{timeout:30000});
 const probe=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-of','json',dest])).stdout);assert.ok(probe.streams.some(s=>s.codec_type==='audio'));assert.equal(probe.streams.find(s=>s.codec_type==='video').width,320);
 const workspace=path.join(dir,'workspaces',p.id,'hypit');await fs.appendFile(path.join(workspace,'main.svml'),'\n<!-- 手工创意 -->');
 const synced=await engine.syncAssets(p.id);assert.equal(synced.assets.length,3);assert.ok((await fs.readFile(path.join(workspace,'main.svml'),'utf8')).includes('手工创意'));
 await assert.rejects(engine.compose(p.id,second.revision,{patch:{audio:[{id:'voice',gain:.7}]}}),/未提交/);
 await fs.writeFile(path.join(workspace,'assets',video.filename),'local edit');const conflict=await engine.syncAssets(p.id,[video.filename]);assert.deepEqual(conflict.conflicts,[video.filename]);assert.equal(await fs.readFile(path.join(workspace,'assets',video.filename),'utf8'),'local edit');
});

test('编排拒绝静态图冒充视频、超时取段与镜头空洞',()=>{
 const assets=[{filename:'a.mp4',kind:'video',duration:2},{filename:'b.png',kind:'image',width:100,height:100}],spec={output:{width:320,height:480},duration:2,shots:[{id:'first',assetFile:'a.mp4',start:0,duration:2}]};
 assert.throws(()=>compileComposition({...spec,shots:[{...spec.shots[0],assetFile:'b.png'}]},assets),/冒充/);
 assert.throws(()=>compileComposition({...spec,shots:[{...spec.shots[0],trimStart:1}]},assets),/超出实际/);
 assert.throws(()=>compileComposition({...spec,shots:[{...spec.shots[0],start:1,duration:1}]},assets),/连续/);
});
