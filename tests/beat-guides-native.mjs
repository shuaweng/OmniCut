// A temporary local native programme. No model/media Provider and no existing project.
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine,sourceFiles} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {StudioManager} from '../server/studio-manager.mjs';
import {StudioHost} from '../server/studio-host.mjs';
import {BeatAnalysisService} from '../server/beat-analysis.mjs';
import {BeatGuidesService} from '../server/beat-guides.mjs';
import {buildStudioClient} from '../server/studio-client.mjs';
import {sendStudioResource} from '../server/studio-host.mjs';
const data=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-native-beats-'));process.env.HYPIT_STATE_HOME=path.join(data,'state');
const service=new ProjectService(data),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
const studios=new StudioManager({service,root,hypit,prepare:id=>engine.runtime.prepare(service.dir(id))}),host=new StudioHost({service,engine,studios});
const beats=new BeatAnalysisService({service}),guides=new BeatGuidesService({service,beats,snapshot:id=>studios.snapshot(id)});
try{
 let project=await service.createBlank('隔离原生音乐节拍'),assetId=crypto.randomUUID(),assetFile=assetId+'.wav';
 const pcm=Buffer.alloc(8*8000*2);for(let at=.5;at<8;at+=.5)for(let i=0;i<320;i++)pcm.writeInt16LE(Math.round(Math.sin(i/8000*2*Math.PI*800)*Math.exp(-i/100)*20000),(Math.round(at*8000)+i)*2);
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(8000,24);header.writeUInt32LE(16000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
 await fs.writeFile(path.join(service.dir(project.id),'assets',assetFile),Buffer.concat([header,pcm]));await fs.writeFile(path.join(service.dir(project.id),'assets',assetId+'.asset.json'),JSON.stringify({id:assetId,filename:assetFile,name:'本地拍点音乐.wav',kind:'audio',duration:8,created:new Date().toISOString()}));
 const files=await sourceFiles(path.join(root,'components/brand-reveal'));
 const source=`<?svml using="@hypit/markup@1"?><svml>
 <import as="time" from="@hypit/timeline-author@1"/><import as="space" from="@hypit/spatial@1"/><import as="asset" from="@hypit/media@1"/>
 <import as="pipe" from="@hypit/media-pipeline@1"/><import as="sound" from="@hypit/audio-track@1"/><import as="film" from="@hypit/film@1"/>
 <import as="render" from="@hypit/render-hyperframes@1"/><import as="look" source="./look.svs"/><import as="reveal" from="@frame/brand-reveal@1"/>
 <time:Clock id="clock" frame-rate="30"/><time:Timeline id="program" clock={clock} end="6s"/><space:Canvas id="canvas" width="320" height="180"/>
 <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
 <asset:Audio id="music-file" src="./assets/${assetFile}"/><pipe:Normalize id="music-media" source={music-file} clock={clock} video="none" audio="default" span-authority="audio"/>
 <reveal:Reveal id="code-scene" timeline={program.timeline} canvas={canvas} font={font} start="0s" end="6s" title="本地节拍" subtitle="源2秒开始播放" eyebrow="临时隔离工程" background="#171615" color="#f8f0e6" accent="#ee8654"/>
 <sound:Track id="music" timeline={program.timeline}><sound:Item id="music-clip" source={music-media.media} at="1s" for="3s" trim-start="2s" playback="once-start"/></sound:Track>
 <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}><film:Track source={code-scene.track}/><film:Track source={music.audio}/></film:Film>
 <render:Video id="final" composition={main.composition} timeline={program.timeline}/></svml>`;
 await fs.copyFile(path.join(root,'fonts/FrameSans-Regular.otf'),path.join(service.dir(project.id),'assets/FrameSans-Regular.otf'));
 project=await engine.edit(project.id,project.revision,{...Object.fromEntries(Object.entries(files).map(([name,text])=>['packages/brand-reveal/'+name,text])),'main.svml':source,'look.svs':'<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #171615; }</sheet>','package.json':JSON.stringify({name:'isolated-native-beats',private:true,type:'module',dependencies:{'@frame/brand-reveal':'file:./packages/brand-reveal'}})});
 await beats.init();await guides.init();const analysis=await beats.analyze(project.id,{assetFile});let snapshot=await studios.snapshot(project.id),clip=snapshot.tracks.flatMap(track=>track.clips).find(item=>item.audio);
 assert.ok(clip,'native snapshot exposes actual audio');assert.equal(clip.audio.sourceAssetPath,'assets/'+assetFile);assert.equal(clip.audio.timelineStart,1);assert.equal(clip.audio.trimStart,2);assert.equal(clip.audio.playbackRate,1);
 const bound=await guides.bind(project.id,{analysisId:analysis.id,assetFile,clipId:clip.id,revision:snapshot.revision},snapshot);assert.ok(bound.guides.length);const first=bound.guides.find(item=>item.kind==='beat');assert.equal(first.frame,Math.round((1+first.sourceTime-2)*30));assert.ok(first.time>=1&&first.time<4);
 await assert.rejects(guides.bind(project.id,{analysisId:analysis.id,assetFile:'other.wav',clipId:clip.id,revision:snapshot.revision},snapshot),/不一致/);
 const beforeFrame=first.frame,oldSignature=clip.audio.sourceSignature;
 await host.mutate(project.id,{revision:project.revision,mutations:[{type:'timeline.adjust',entityId:clip.id,gesture:'move',target:{kind:'window',startFrame:60,endFrameExclusive:150}}]});
 snapshot=await studios.snapshot(project.id);clip=snapshot.tracks.flatMap(track=>track.clips).find(item=>item.audio);assert.equal(clip.audio.timelineStart,2);assert.equal(clip.audio.trimStart,2);assert.equal(clip.audio.sourceSignature,oldSignature);const moved=await guides.load(project.id,snapshot);assert.equal(moved.guides.find(item=>item.kind==='beat').frame,beforeFrame+30);
 const restarted=new BeatGuidesService({service,beats});await restarted.init();assert.equal((await restarted.load(project.id,snapshot)).guides.length,moved.guides.length);
 const variant=await service.createVariant(project.id),second=await service.withVideoContext(project.id,variant.videoId,()=>service.createVariant(project.id));assert.equal(variant.name,'隔离原生音乐节拍 · 版本 2');assert.equal(second.name,'隔离原生音乐节拍 · 版本 3');assert.deepEqual(await guides.list(project.id,{videoId:variant.videoId}),[]);
 console.log(JSON.stringify({nativeAudioFacts:true,sourceTrim:2,timelineStartBefore:1,timelineStartAfter:2,nativeMoveRemappedFrames:30,guideCount:moved.guides.length,restored:true,videoIsolation:true,stableVariantNames:true}));
 if(process.argv.includes('--ui')){
  const serve=await buildStudioClient(root,{outputDirectory:path.join(data,'client')});
  const json=(res,value)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  const body=req=>new Promise((resolve,reject)=>{const bytes=[];req.on('data',chunk=>bytes.push(chunk));req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(bytes)));}catch(error){reject(error);}});req.on('error',reject);});
  const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');
   if(url.pathname.startsWith('/hypit-studio/'))return serve(url.pathname,res);
   const api=url.pathname.match(/^\/api\/projects\/(p-[a-f0-9]{12})(?:\/(beats|beat-guides))?$/);
   if(api){if(api[1]!==project.id)throw Error('只允许临时项目');if(!api[2])return json(res,await service.get(project.id));if(api[2]==='beats')return json(res,req.method==='POST'?await beats.analyze(project.id,await body(req)):await beats.list(project.id));return json(res,req.method==='POST'?await guides.bind(project.id,await body(req)):await guides.load(project.id));}
   const studio=url.pathname.match(/^\/__studio\/projects\/(p-[a-f0-9]{12})\/(.+)$/);
   if(studio&&studio[1]===project.id){const resource=await host.resource(project.id,studio[2],url.search,{method:req.method,body:req.method==='POST'||req.method==='PUT'?await body(req):undefined,revision:req.headers['x-frame-revision'],range:req.headers.range});if(studio[2]==='session'&&resource.status===200){const snap=JSON.parse(resource.body);snap.beatGuides=await guides.load(project.id,{...snap,revision:resource.frameRevision});resource.body=Buffer.from(JSON.stringify(snap));}return sendStudioResource(req,res,resource);}
   res.writeHead(404);res.end();
  }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));console.log(JSON.stringify({isolatedUi:'http://127.0.0.1:'+server.address().port+'/hypit-studio/?project='+project.id}));
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});await new Promise(resolve=>server.close(resolve));
 }
}finally{studios.close();await beats.close();await fs.rm(data,{recursive:true,force:true});}
