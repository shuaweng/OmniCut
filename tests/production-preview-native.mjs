// Explicit local demonstration: temporary project, no credentials, no media/model Provider.
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine,sourceFiles} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {StudioManager} from '../server/studio-manager.mjs';
import {ProductionPreviewService} from '../server/production-preview.mjs';
const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-frames-'));process.env.HYPIT_STATE_HOME=path.join(data,'state');
const service=new ProjectService(data),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))});
try{
 let project=await service.createBlank('隔离代码选帧');
 const files=await sourceFiles(path.join(root,'components/brand-reveal'));
 const failureOnly=process.argv.includes('--failure-only');
 if(failureOnly){assert.ok(files['render.js'].includes('return frame=>{'));files['render.js']=files['render.js'].replace('return frame=>{','return frame=>{if(frame===24)throw Error("隔离示例预期异常");');}
 const source=`<?svml using="@hypit/markup@1"?><svml>
 <import as="time" from="@hypit/timeline-author@1"/><import as="space" from="@hypit/spatial@1"/>
 <import as="asset" from="@hypit/media@1"/><import as="film" from="@hypit/film@1"/>
 <import as="render" from="@hypit/render-hyperframes@1"/><import as="look" source="./look.svs"/><import as="reveal" from="@frame/brand-reveal@1"/>
 <time:Clock id="clock" frame-rate="24"/><time:Timeline id="program" clock={clock} end="4s"/><space:Canvas id="canvas" width="320" height="180"/>
 <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
 <reveal:Reveal id="code-scene" timeline={program.timeline} canvas={canvas} font={font} start="0s" end="4s" title="代码预览" subtitle="只渲染指定帧" eyebrow="本地隔离验证" background="#171615" color="#f8f0e6" accent="#ee8654"/>
 <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}><film:Track source={code-scene.track}/></film:Film>
 <render:Video id="final" composition={main.composition} timeline={program.timeline}/></svml>`;
 await fs.copyFile(path.join(root,'fonts/FrameSans-Regular.otf'),path.join(service.dir(project.id),'assets/FrameSans-Regular.otf'));
 project=await engine.edit(project.id,project.revision,{...Object.fromEntries(Object.entries(files).map(([name,text])=>['packages/brand-reveal/'+name,text])),
  'main.svml':source,'look.svs':'<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #171615; }</sheet>',
  'package.json':JSON.stringify({name:'isolated-code-frames',private:true,type:'module',dependencies:{'@frame/brand-reveal':'file:./packages/brand-reveal'}})});
 const preview=new ProductionPreviewService({service,engine,studios});
 if(failureOnly){
  let caught;try{await preview.previewFrames(project.id,{revision:project.revision,times:[0,1],grid:false});}catch(error){caught=error;}
  assert.ok(caught);assert.match(caught.message,/worker 0 frame 24/);assert.match(caught.message,/隔离示例预期异常/);assert.equal((await service.get(project.id)).revision,project.revision);
  assert.deepEqual(await fs.readdir(path.join(data,'production-previews')),[],'失败预览不留下半成品');console.log(JSON.stringify({nativeException:true,failedWorker:0,failedFrame:24,sourceErrorPreserved:true,revisionUnchanged:true,partialFilesRemoved:true}));
 }else{
 const result=await preview.previewFrames(project.id,{revision:project.revision,times:[0,1,3.5],grid:true,sampleDuration:.5});
 assert.equal(result.source,'project');assert.deepEqual(result.frames.map(f=>f.frame),[0,24,84]);assert.equal(result.frames.length,3);assert.ok(result.frames.every(f=>f.image.data&&f.reference.revision===project.revision));assert.ok(result.contactSheet.image.data);assert.equal(result.sample.duration,.5);
 assert.equal((await service.get(project.id)).revision,project.revision);assert.equal(await fs.stat(path.join(service.dir(project.id),'final.mp4')).then(()=>true,()=>false),false,'工程内没有导出整片');
 const cached=await preview.previewFrames(project.id,{revision:project.revision,times:[0,1,3.5],grid:true,sampleDuration:.5});assert.equal(cached.cached,true);
 const gridOut=path.join(os.tmpdir(),'omnicut-native-frames-grid.jpg');await fs.copyFile(result.contactSheet.path,gridOut);
 console.log(JSON.stringify({nativeCodeFrames:result.frames.map(f=>f.frame),sampleSeconds:result.sample.duration,revisionUnchanged:true,noFullExport:true,cacheHit:true,grid:gridOut}));
 }
}finally{studios.close();await fs.rm(data,{recursive:true,force:true});}
