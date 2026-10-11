#!/usr/bin/env node
// Rebuild gallery media from the actual Author Packages in an isolated local
// ProjectService. No user projects, credentials, generation models or downloads.
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ProjectService,root,hypit,run} from '../server/project.mjs';
import {NativeEngine} from '../server/native-engine.mjs';
import {NativeRuntime} from '../server/native-runtime.mjs';
import {motionSource} from '../server/motion-recipe.mjs';

export function previewSource(item,{width=640,height=360,fps=24,duration=item.duration||4,parameters={},packageDirectory=''}={}){
 return motionSource(item,{width,height,fps,duration,parameters,packageDirectory}).source;
}

export async function buildMotionPreviews({component,checkOnly=false}={}){
 const isolated=await fs.mkdtemp(path.join(os.tmpdir(),'frame-motion-gallery-'));
 const previousState=process.env.HYPIT_STATE_HOME;
 process.env.HYPIT_STATE_HOME=path.join(isolated,'native-state');
 const service=new ProjectService(path.join(isolated,'data')),engine=new NativeEngine({service,root,hypit,run});service.engine=engine;
 engine.runtime=new NativeRuntime({root,getConfig:async()=>({})});
 const workspaces=[],results=[];
 try{
  const all=(await engine.motionLibrary.list()).filter(item=>item.origin==='builtin');
  const selected=component?all.filter(item=>item.packageName==='@frame/'+component||item.id===component):all;
  if(!selected.length)throw Error('未找到内置动效 '+component);
  for(const item of selected){
   const started=Date.now(),project=await service.createBlank('隔离画廊 · '+item.name),installed=await engine.motionLibrary.use(project.id,item.id),directory=installed.workspaceDirectory;
   const settings={width:640,height:360,fps:24,duration:item.duration||4,...item.previewSettings,packageDirectory:path.relative(directory,installed.absoluteDirectory)},source=previewSource(item,settings);
   await fs.writeFile(path.join(directory,'main.svml'),source);
   await fs.writeFile(path.join(directory,'look.svs'),'<?svml using="@hypit/svs@1"?><sheet version="1">film.main { background: #171615; }</sheet>');
   const committed=await engine.applyWorkspace(project.id,installed.revision),workspace=service.dir(project.id);
   const result={id:item.id,name:item.name,compiled:true,duration:committed.duration};
   if(!checkOnly){
    workspaces.push(workspace);await engine.runtime.prepare(workspace);
    const built=JSON.parse((await engine.run(hypit,['build','render.svrun','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--follow','--json'],{cwd:workspace,timeout:600000,maxBuffer:5e6})).stdout),buildId=built.build?.id||built.buildId||built.id;
    if(!buildId)throw Error('原生构建没有返回 build id');
    const location=await engine.motionLibrary.locate(item.id),temporary=path.join(isolated,path.basename(location.directory)+'.mp4'),poster=path.join(isolated,path.basename(location.directory)+'.jpg');
    await engine.run(hypit,['get',buildId,'--output','final.video','--to',temporary,'--workspace',workspace,'--json'],{cwd:workspace,timeout:60000,maxBuffer:1e6});
    const probe=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',temporary],{timeout:15000})).stdout),video=probe.streams.find(stream=>stream.codec_type==='video');
    if(video?.width!==settings.width||video.height!==settings.height||Number(video.nb_frames)!==Math.round(settings.fps*settings.duration))throw Error('原生预览的尺寸或帧数不匹配');
    await run('ffmpeg',['-v','error','-ss',String(settings.posterTime??Math.min(2.6,settings.duration*.68)),'-i',temporary,'-frames:v','1','-q:v','2','-y',poster],{timeout:15000});
    const preview=path.join(location.directory,'preview.mp4'),referenceAudio=path.join(location.directory,'audio/reference-mix.wav');
    const hasReferenceAudio=await fs.stat(referenceAudio).then(st=>st.isFile(),()=>false);
    if(hasReferenceAudio)await run('ffmpeg',['-v','error','-i',temporary,'-i',referenceAudio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',String(settings.duration),'-movflags','+faststart','-y',preview],{timeout:30000});
    else await fs.copyFile(temporary,preview);
    await fs.copyFile(poster,path.join(location.directory,'poster.jpg'));
    const record={renderer:'Hypit / Hyperframes',packageName:item.packageName,packageVersion:item.version,logicalImport:item.import,source,width:settings.width,height:settings.height,fps:settings.fps,duration:settings.duration,frames:Number(video.nb_frames),buildId,...(hasReferenceAudio?{audio:'Original reference mix, added locally after native picture render; production audio remains separately authored.'}:{})};
    await fs.writeFile(path.join(location.directory,'preview-source.json'),JSON.stringify(record,null,2)+'\n');
    Object.assign(result,{rendered:true,frames:Number(video.nb_frames),preview:path.join(location.directory,'preview.mp4'),poster:path.join(location.directory,'poster.jpg')});
    await engine.run(hypit,['runtime','down','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--json'],{timeout:15000}).catch(()=>{});
   }
   result.elapsedSeconds=Number(((Date.now()-started)/1000).toFixed(1));results.push(result);console.log(JSON.stringify(result));
  }
  return results;
 }finally{
  for(const workspace of workspaces)await engine.run(hypit,['runtime','down','--workspace',workspace,'--runtime',path.join(workspace,'hypit.runtime.json'),'--json'],{timeout:10000}).catch(()=>{});
  if(previousState===undefined)delete process.env.HYPIT_STATE_HOME;else process.env.HYPIT_STATE_HOME=previousState;
  await fs.rm(isolated,{recursive:true,force:true});
 }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const args=process.argv.slice(2),i=args.indexOf('--component');
 try{await buildMotionPreviews({component:i<0?undefined:args[i+1],checkOnly:args.includes('--check-only')});}catch(error){console.error(error.stdout||error.stderr||error.stack||error.message);process.exitCode=1;}
}
