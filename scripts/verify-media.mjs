// Isolated real Hypit render: no saved project, credentials, or paid provider.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { ProjectService,run,hypit,root } from '../server/project.mjs';
import { importAsset } from '../server/assets.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'frame-media-render-'));
const service=new ProjectService(dir);let project=await service.create('编排渲染验证');const workspace=service.dir(project.id);
try {
 const video=path.join(dir,'video.mp4'),audio=path.join(dir,'audio.wav');
 await run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=s=180x320:r=24:duration=3','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3.2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video]);
 await run('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','2',audio]);
 const image=await importAsset(workspace,await fs.readFile(path.join(root,'sample-assets/sage-tumbler.png')),'图片.png');
 const v=await importAsset(workspace,await fs.readFile(video),'视频.mp4');
 const a=await importAsset(workspace,await fs.readFile(audio),'配乐.wav');
 project=await service.change(project.id,project.revision,{type:'batch',changes:[
  {type:'shot',shotId:'shot-1',assetFile:image.filename,duration:1},
  {type:'shot',shotId:'shot-2',assetFile:v.filename,duration:2,trimStart:.5,sourceAudio:true},
  {type:'shot',shotId:'shot-3',assetFile:image.filename,duration:1.5,fit:'contain'},
  {type:'music',assetFile:a.filename,gain:.15},
 ]});
 const {stdout}=await run(hypit,['build',path.join(workspace,'render.svrun'),'--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--follow','--json'],{timeout:240000,maxBuffer:8e6});
 const built=JSON.parse(stdout),id=built.build?.id||built.buildId||built.id;
 const output=path.join(dir,'media-integration.mp4');
 await run(hypit,['get',id,'--output','final.video','--to',output,'--workspace',workspace,'--json'],{timeout:30000,maxBuffer:2e6});
 const probe=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output])).stdout);
 const visual=probe.streams.find(s=>s.codec_type==='video'),sound=probe.streams.find(s=>s.codec_type==='audio');
 assert.equal(visual.width,540);assert.equal(visual.height,960);assert.equal(visual.nb_frames,'135');assert.ok(sound);assert.ok(Math.abs(Number(probe.format.duration)-4.5)<.1);
 const energy=(await run('ffmpeg',['-i',output,'-af','volumedetect','-vn','-sn','-dn','-f','null','-'])).stderr;
 assert.match(energy,/mean_volume: -(?:\d|\.)+ dB/);
 const savedOutput=path.join(root,'output','media-integration-24fps.mp4');await fs.copyFile(output,savedOutput);
 console.log(JSON.stringify({output:savedOutput,duration:probe.format.duration,frames:visual.nb_frames,resolution:[visual.width,visual.height],audio:sound.codec_name,audioMean:energy.match(/mean_volume: ([^\n]+)/)?.[1],build:id}));
} catch(e) {console.error(e.stdout||e.stderr||e.message);process.exitCode=1;}
finally {await run(hypit,['runtime','down','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--json'],{timeout:10000}).catch(()=>{});await fs.rm(dir,{recursive:true,force:true});}
