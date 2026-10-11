#!/usr/bin/env node
// Real local integration proof. Every project and native state directory is
// created under tmp; only the explicit proof media/report enter repo output/.
// No model, credentials, user data, external renderer install or upload.
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';

const fixture=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="360" viewBox="0 0 160 360">
<rect x="54" y="10" width="52" height="47" rx="9" fill="#00eddf"/>
<rect x="21" y="53" width="118" height="287" rx="32" fill="#ff00c8"/>
<path d="M40 107h80v106H40z" fill="#ffe8f8"/>
<path d="M56 126h48v16H56zm0 33h48v10H56zm0 25h31v10H56z" fill="#ff00c8"/>
</svg>\n`;

export function compositionSource({width=360,height=640,fps=24,duration=6}={}){
 return `<?svml using="@hypit/markup@1"?>
<svml>
 <import as="time" from="@hypit/timeline-author@1"/><import as="space" from="@hypit/spatial@1"/>
 <import as="asset" from="@hypit/media@1"/><import as="film" from="@hypit/film@1"/>
 <import as="render" from="@hypit/render-hyperframes@1"/><import as="look" source="./look.svs"/>
 <import as="product-motion" from="@frame/product-spotlight@1"/>
 <import as="text-motion" from="@frame/character-reveal@1"/>
 <time:Clock id="clock" frame-rate="${fps}"/><time:Timeline id="program" clock={clock} end="${duration}s"/>
 <space:Canvas id="canvas" width="${width}" height="${height}"/>
 <asset:Font id="font" src="./assets/FrameSans-Regular.otf" weight="400" style="normal"/>
 <asset:Image id="product" src="./assets/proof-product.png"/>
 <product-motion:ImageMotion id="product-shot" timeline={program.timeline} canvas={canvas} font={font}
  image={product} start="2s" end="${duration}s" title="原生图片" subtitle="真实图片输入" background="#10322e"
  color="#f1e5c4" accent="#d2bf88" secondary="#4d6557" intensity="0" z="10"/>
 <text-motion:Motion id="text-overlay" timeline={program.timeline} canvas={canvas} font={font}
  start="2s" end="${duration}s" title="逐字叠层" subtitle="同一 Film · 可编辑"
  transparent="true" background="#ffffff" color="#ffffff" accent="#efca76" secondary="#334f4a"
  x="50" y="80" scale="0.75" z="60"/>
 <film:Film id="main" canvas={canvas} timeline={program.timeline} appearance={look.film.main}>
  <film:Track source={product-shot.track}/><film:Track source={text-overlay.track}/>
 </film:Film>
 <render:Video id="final" composition={main.composition} timeline={program.timeline}/>
</svml>\n`;
}

async function pixels(video,seconds,width,height){
 const {stdout}=await run('ffmpeg',['-v','error','-ss',String(seconds),'-i',video,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{encoding:'buffer',maxBuffer:width*height*4,timeout:15000});
 assert.equal(stdout.length,width*height*3,'decoded frame byte count');
 let imagePixels=0,textPixels=0,uncoveredPixels=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const offset=(y*width+x)*3,r=stdout[offset],g=stdout[offset+1],b=stdout[offset+2];
  if(r>170&&b>115&&g<110&&x>width*.5&&y>height*.18&&y<height*.7)imagePixels++;
  if(y>height*.65&&r>195&&g>195&&b>195)textPixels++;
  // Left top corner is outside all authored decorative and text shapes. An
  // opaque white overlay would wipe the intentionally dark base here.
  if(x<width*.08&&y<height*.08&&r<55&&g<95&&b<90)uncoveredPixels++;
 }
 return {imagePixels,textPixels,uncoveredPixels};
}

export async function verifyMotionComposition({outputDirectory=path.join(root,'output/motion-gallery-proof')}={}){
 const isolated=await fs.mkdtemp(path.join(os.tmpdir(),'omnicut-motion-composition-'));
 const previousState=process.env.HYPIT_STATE_HOME;
 process.env.HYPIT_STATE_HOME=path.join(isolated,'native-state');
 const service=new ProjectService(path.join(isolated,'data')),engine=new NativeEngine({service,root,hypit,run});
 service.engine=engine;engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 const width=360,height=640,fps=24,duration=6;
 let workspace;
 try{
  const catalog=await engine.motionLibrary.list();
  const product=catalog.find(item=>item.packageName==='@frame/product-spotlight');
  const text=catalog.find(item=>item.packageName==='@frame/character-reveal');
  assert.ok(product&&text,'both authored packages exist');
  const project=await service.createBlank('隔离验证 · 图片与逐字叠层');
  await engine.motionLibrary.use(project.id,product.id);
  const installed=await engine.motionLibrary.use(project.id,text.id),directory=installed.workspaceDirectory;
  // Rasterize our own vector fixture with the already installed local library.
  // asset:Image accepts SVG when its MIME is explicit, but this runtime's
  // HyperFrames image provider currently supports raster Artifact MIME types.
  const image=await sharp(Buffer.from(fixture)).png().toBuffer();
  await fs.writeFile(path.join(directory,'assets/proof-product.png'),image);
  const source=compositionSource({width,height,fps,duration});
  const style='<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #10322e; }</sheet>\n';
  await fs.writeFile(path.join(directory,'main.svml'),source);
  await fs.writeFile(path.join(directory,'look.svs'),style);
  const committed=await engine.applyWorkspace(project.id,installed.revision);
  assert.equal(committed.duration,duration,'compiled programme duration');
  workspace=service.dir(project.id);await engine.runtime.prepare(workspace);
  console.log(JSON.stringify({stage:'compiled',packages:[product.id,text.id],canvas:[width,height],startSeconds:2,duration}));
  const built=JSON.parse((await engine.run(hypit,['build','render.svrun','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--follow','--json'],{cwd:workspace,timeout:240000,maxBuffer:5e6})).stdout);
  const buildId=built.build?.id||built.buildId||built.id;assert.ok(buildId,'native build id');
  await fs.mkdir(outputDirectory,{recursive:true});
  const video=path.join(outputDirectory,'image-motion-and-transparent-text.mp4');
  await engine.run(hypit,['get',buildId,'--output','final.video','--to',video,'--workspace',workspace,'--json'],{cwd:workspace,timeout:60000,maxBuffer:1e6});
  await Promise.all([fs.writeFile(path.join(outputDirectory,'main.svml'),source),fs.writeFile(path.join(outputDirectory,'look.svs'),style),fs.writeFile(path.join(outputDirectory,'proof-product.svg'),fixture),fs.writeFile(path.join(outputDirectory,'proof-product.png'),image)]);
  const probe=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video],{timeout:15000})).stdout);
  const stream=probe.streams.find(stream=>stream.codec_type==='video');
  assert.equal(stream.width,width);assert.equal(stream.height,height);assert.equal(Number(stream.nb_frames),duration*fps);
  assert.equal(stream.avg_frame_rate,'24/1');assert.ok(Math.abs(Number(probe.format.duration)-duration)<.05);
  const times=[1.958333333,2,2.25,2.75,3.5,5.5],observations=[];
  for(const seconds of times){
   const file=path.join(outputDirectory,'frame-'+String(seconds.toFixed(3)).replace('.','-')+'.png');
   await run('ffmpeg',['-v','error','-ss',String(seconds),'-i',video,'-frames:v','1','-y',file],{timeout:15000});
   observations.push({seconds,file,...await pixels(video,seconds,width,height)});
  }
  const before=observations[0],start=observations[1],settled=observations[4],last=observations[5];
  const checks={
   imageHiddenBeforeWindow:before.imagePixels===0,
   imageStartsFromLocalClock:start.imagePixels<Math.max(15,settled.imagePixels*.03),
   actualImageVisible:settled.imagePixels>300,
   textStartsFromLocalClock:start.textPixels<Math.max(15,settled.textPixels*.04),
   actualOverlayVisible:settled.textPixels>50,
   baseSurvivesTransparentOverlay:settled.uncoveredPixels>width*.08*height*.08*.8,
   imageSurvivesTransparentOverlay:last.imagePixels>settled.imagePixels*.8,
  };
  const sheet=path.join(outputDirectory,'contact-sheet.jpg');
  await run('ffmpeg',['-v','error','-i',video,'-vf','fps=2,scale=180:320,tile=6x2','-frames:v','1','-q:v','2','-y',sheet],{timeout:15000});
  const record={renderer:'Hypit / Hyperframes local',packages:[product.id,text.id],width,height,fps,duration,frames:Number(stream.nb_frames),buildId,window:{startSeconds:2,endSeconds:duration},video,contactSheet:sheet,observations,checks,imageArtifact:{mediaType:'image/png',fixture:'Local self-authored SVG rasterized with existing sharp',svgRuntimeSupport:'An earlier native render with explicit image/svg+xml compiled but failed: HyperFrames does not support Artifact media type image/svg+xml'},note:'Pixel checks cover the controlled fixture, entrance timing and transparent layering. Review the real frames/video for layout and motion quality; this is not a model quality score.'};
  await fs.writeFile(path.join(outputDirectory,'verification.json'),JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record,null,2));
  for(const [name,passed]of Object.entries(checks))assert.equal(passed,true,name);
  return record;
 }finally{
  if(workspace)await engine.run(hypit,['runtime','down','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--json'],{timeout:10000,maxBuffer:1e6}).catch(()=>{});
  if(previousState===undefined)delete process.env.HYPIT_STATE_HOME;else process.env.HYPIT_STATE_HOME=previousState;
  await fs.rm(isolated,{recursive:true,force:true});
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{await verifyMotionComposition();}catch(error){console.error(error.stdout||error.stderr||error.stack||error.message);process.exitCode=1;}
}
