import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {assetPath} from './assets.mjs';
import {estimateRenderTimeout} from './render-progress.mjs';

const require=createRequire(new URL('../engines/video/package.json',import.meta.url));
const imageRequire=createRequire(import.meta.url);
let api;
async function nativeApi(){return api||=import(pathToFileURL(require.resolve('tsx/esm/api')).href).then(async({tsImport})=>tsImport('../engines/video/packages/hyperframes/src/document.ts',import.meta.url));}
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const timecode=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+(seconds%60).toFixed(2).padStart(5,'0');
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const rate=value=>{const [n,d=1]=String(value||'0').split('/').map(Number);return d&&Number.isFinite(n/d)?n/d:0;};
async function savePreviewRecord(directory,record){const temporary=path.join(directory,'preview-'+crypto.randomUUID()+'.tmp');try{await fs.writeFile(temporary,JSON.stringify(record));await fs.rename(temporary,path.join(directory,'preview.json'));}finally{await fs.rm(temporary,{force:true});}}

export function selectPreviewFrames(snapshot,{frames,times,auto='cuts',maxFrames=12}={}){
 const count=snapshot?.space?.frameCount,frameRate=snapshot?.space?.frameRate;
 if(!Number.isSafeInteger(count)||count<1||!frameRate?.numerator||!frameRate?.denominator)throw fail('当前画面没有有效帧时钟');
 if(!Number.isSafeInteger(maxFrames)||maxFrames<1||maxFrames>24)throw fail('预览每次支持 1–24 帧');
 const fps=frameRate.numerator/frameRate.denominator;
 if(frames!==undefined&&times!==undefined)throw fail('frames 与 times 请选择一种');
 let chosen,automatic=false,automaticSampled=false;
 if(frames!==undefined){if(!Array.isArray(frames)||!frames.length||frames.some(f=>!Number.isSafeInteger(f)))throw fail('frames 需要非空整数帧列表');chosen=frames;}
 else if(times!==undefined){if(!Array.isArray(times)||!times.length||times.some(t=>!Number.isFinite(t)||t<0||t>=count/fps))throw fail('times 需要片长内的秒数列表');chosen=times.map(t=>Math.min(count-1,Math.round(t*fps)));}
 else{
  automatic=true;
  if(auto==='cuts')chosen=[0,count-1,...(snapshot.tracks||[]).filter(t=>t.binding?.facet!=='audio').flatMap(t=>(t.clips||[]).flatMap(c=>[c.startFrame,Math.max(0,c.startFrame-1),c.endFrameExclusive-1]))];
  else if(auto==='beats'){chosen=snapshot.previewBeatFrames??(snapshot.semantic?.anchors||[]).filter(a=>a.kind==='beat'||a.kind==='downbeat').map(a=>a.frame);if(!chosen.length)throw fail('当前版本没有可靠的节拍锚点，请先绑定配乐分析或指定 times');}
  else{
   const every=/^every:(\d+(?:\.\d+)?)s?$/.exec(auto);
   if(!every||Number(every[1])<=0)throw fail('auto 支持 cuts 或 every:秒数，例如 every:2s');
   const step=Math.max(1,Math.round(Number(every[1])*fps));chosen=[];
   // The bounded arithmetic avoids allocating one item per frame for tiny intervals.
   const n=Math.floor((count-1)/step)+1;automaticSampled=n>maxFrames;
   for(let i=0;i<Math.min(n,maxFrames);i++)chosen.push((n<=maxFrames?i:Math.round(i*(n-1)/Math.max(1,maxFrames-1)))*step);
  }
 }
 if(chosen.some(f=>f<0||f>=count))throw fail('预览帧超出当前片长');
 chosen=[...new Set(chosen)].sort((a,b)=>a-b);
 let sampled=automaticSampled;
 if(chosen.length>maxFrames){if(!automatic)throw fail('指定帧数超过 maxFrames，请缩小选择');sampled=true;chosen=Array.from({length:maxFrames},(_,i)=>chosen[Math.round(i*(chosen.length-1)/Math.max(1,maxFrames-1))]);}
 return {frames:chosen,frameRate:{...frameRate},sampled};
}

async function makeGrid(directory,outputs,{root,document}){
 const sharp=imageRequire('sharp'),columns=Math.min(4,Math.ceil(Math.sqrt(outputs.length))),tileWidth=320,tileHeight=Math.max(80,Math.round(tileWidth*document.canvas.height/document.canvas.width)),labelHeight=36;
 const rows=Math.ceil(outputs.length/columns),layers=[];
 for(let i=0;i<outputs.length;i++){
  const item=outputs[i],left=(i%columns)*tileWidth,top=Math.floor(i/columns)*(tileHeight+labelHeight);
  layers.push({input:await sharp(path.join(directory,item.name)).resize(tileWidth,tileHeight,{fit:'contain',background:'#171615'}).png().toBuffer(),left,top});
  // Pango loads the shipped Chinese font; labels stay readable on a host without CJK fonts.
  const text=await sharp({text:{text:xml(item.label),font:'Source Han Sans SC 13',fontfile:path.join(root,'fonts/FrameSans-Regular.otf'),width:tileWidth-20,height:labelHeight-12,rgba:true}}).png().toBuffer();
  layers.push({input:text,left:left+10,top:top+tileHeight+6});
 }
 const file='grid.jpg';await sharp({create:{width:columns*tileWidth,height:rows*(tileHeight+labelHeight),channels:4,background:'#f0ece6'}}).composite(layers).jpeg({quality:88}).toFile(path.join(directory,file));
 return {name:file,mediaType:'image/jpeg',width:columns*tileWidth,height:rows*(tileHeight+labelHeight),path:path.join(directory,file)};
}

/** Fact inspection and conservative heuristics. It never rewrites or normalizes the source file. */
export async function probeMediaFile(file,{run,ffmpeg='ffmpeg',ffprobe='ffprobe',analysisSeconds=300}={}){
 if(typeof run!=='function')throw Error('probeMediaFile 需要本地进程执行器');
 if(!Number.isFinite(analysisSeconds)||analysisSeconds<=0||analysisSeconds>1800)throw fail('探测分析时长需要在 0–1800 秒内');
 const raw=JSON.parse((await run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file],{timeout:30000,maxBuffer:3e6})).stdout),streams=raw.streams||[],video=streams.find(s=>s.codec_type==='video'),audio=streams.filter(s=>s.codec_type==='audio');
 const duration=Number(raw.format?.duration||video?.duration||audio[0]?.duration)||null;
 const result={duration,width:video?.width||null,height:video?.height||null,fps:video?rate(video.avg_frame_rate)||rate(video.r_frame_rate)||null:null,
  audioTracks:audio.length,videoTracks:streams.filter(s=>s.codec_type==='video').length,loudness:null,blackIntervals:[],staticIntervals:[],analysis:{seconds:Math.min(duration||analysisSeconds,analysisSeconds),complete:duration!==null&&duration<=analysisSeconds,heuristic:true},limitations:['黑帧与静帧是阈值检测，暗色设计、停顿和静态尾板可能是预期画面。']};
 if(audio.length>1)result.limitations.push('响度仅测第一条音轨；多音轨混合后的响度需要检查最终封装成片。');
 const args=['-hide_banner','-nostats','-i',file,'-t',String(analysisSeconds)];
 if(video)args.push('-map','0:v:0','-vf','blackdetect=d=0.1:pix_th=0.10:pic_th=0.98,freezedetect=n=-50dB:d=0.5');
 if(audio.length)args.push('-map','0:a:0','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json');
 if(!video&&!audio.length)throw fail('文件中没有可探测的画面或声音');
 args.push('-f','null','-');
 try{
  const execution=await run(ffmpeg,args,{timeout:Math.max(60000,Math.min(600000,analysisSeconds*2000)),maxBuffer:8e6}),log=String(execution.stderr||'');
  for(const match of log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g))result.blackIntervals.push({start:Number(match[1]),end:Number(match[2]),duration:Number(match[3])});
  let freeze;
  for(const match of log.matchAll(/lavfi\.freezedetect\.freeze_(start|end):\s*([\d.]+)/g)){
   if(match[1]==='start')freeze=Number(match[2]);
   else if(freeze!==undefined){const end=Number(match[2]);result.staticIntervals.push({start:freeze,end,duration:end-freeze});freeze=undefined;}
  }
  if(freeze!==undefined){const end=result.analysis.seconds;result.staticIntervals.push({start:freeze,end,duration:Math.max(0,end-freeze),openEnded:true});}
  const loud=/\{\s*"input_i"[\s\S]*?\}/.exec(log);
  if(loud){const values=JSON.parse(loud[0]),finite=v=>Number.isFinite(Number(v))?Number(v):null;result.loudness={integratedLUFS:finite(values.input_i),truePeakDBTP:finite(values.input_tp),rangeLU:finite(values.input_lra),silent:values.input_i==='-inf'};}
  if(video&&Number(video.width)*Number(video.height)<64*64)result.limitations.push('极小画面的黑帧、静帧检测精度有限。');
 }catch(error){result.analysis.complete=false;result.analysis.error=String(error.message||error).slice(-600);result.limitations.push('画面/响度分析未完成，媒体元数据仍有效。');}
 if(!result.analysis.complete)result.limitations.push('只分析所示时长，未分析区间不能据此判定正常。');
 return result;
}

async function rpcPreview(record){
 const url=name=>'/api/projects/'+encodeURIComponent(record.projectId)+'/previews/'+record.id+'/'+encodeURIComponent(name)+'?videoId='+encodeURIComponent(record.videoId);
 const frames=await Promise.all(record.frames.map(async frame=>({...frame,url:url(frame.name),at:frame.time,frameRate:record.frameRate,
  ...(frame.entities?.length===1?{entityId:frame.entities[0].entityId}:{}),
  ...(record.source==='project'?{reference:{id:crypto.randomUUID(),videoId:record.videoId,revision:record.revision,nativeRevision:record.nativeRevision,kind:'range',startFrame:frame.frame,endFrameExclusive:frame.frame+1,frameRate:record.frameRate,label:frame.label}}:{}),
  image:{mimeType:frame.mediaType,data:(await fs.readFile(frame.path)).toString('base64')}})));
 return {...record,previewId:record.id,source:record.source||'project',frames,...(record.grid?{contactSheet:{...record.grid,url:url(record.grid.name),image:{mimeType:record.grid.mediaType,data:(await fs.readFile(record.grid.path)).toString('base64')}}}:{}),...(record.sample?{sample:{...record.sample,url:url(record.sample.name)}}:{})};
}

export class ProductionPreview{
 constructor({service,engine,studios,beatGuides,root=engine?.root,run=engine?.run,ffmpeg='ffmpeg',ffprobe='ffprobe'}={}){Object.assign(this,{service,engine,studios,beatGuides,root,run,ffmpeg,ffprobe,runPreview:engine?.run||run});this.base=path.join(service.dataRoot,'production-previews');this.pending=new Map();}
 scope(id,videoId,fn){return videoId===undefined?fn():this.service.withVideoContext(id,videoId,fn);}
 async loadBeatFrames(id,snapshot,{videoId,revision}){
  if(!this.beatGuides)return {snapshot,warnings:[]};
  const mapped=await this.beatGuides.load(id,{...snapshot,revision},{videoId});
  if(mapped.revision!==revision||mapped.videoId!==videoId)throw fail('节拍映射版本已改变，请重新读取后预览',409);
  const frames=(mapped.guides||[]).filter(g=>g.kind==='beat'||g.kind==='downbeat').map(g=>g.frame);
  if(frames.some(f=>!Number.isSafeInteger(f)||f<0||f>=snapshot.space.frameCount))throw fail('节拍映射超出当前原生时间线');
  return {snapshot:{...snapshot,previewBeatFrames:frames},warnings:mapped.warnings||[]};
 }
 async previewFrames(id,input={}){return this.scope(id,input.videoId,async()=>{
  if(input.sampleDuration!==undefined&&(!Number.isFinite(input.sampleDuration)||input.sampleDuration<=0||input.sampleDuration>3))throw fail('预览片段需要在 0–3 秒内');
  if(input.jobId)return this.previewExport(id,input);
  let prepared;
  // Freeze the exact compiler output and selected material before releasing the edit lock.
  try{await this.service.exclusive(id,async()=>{
   const project=await this.service.get(id),videoId=this.service.currentVideoId?.(id)||'v-default';input={...input,revision:input.revision??project.revision};
   if(project.revision!==input.revision)throw fail('画面已更新，请重新读取后预览',409);
   if(!project.native||project.draft)throw fail('请先保存可编译的原生画面');
   const session=await this.studios.resource(id,'/__studio/session'),picture=await this.studios.resource(id,'/__studio/document');
   if(session.status!==200||picture.status!==200)throw fail('原生画面尚未编译完成，请稍后预览',409);
   if(session.frameRevision!==input.revision||picture.frameRevision!==input.revision||session.sessionPort!==picture.sessionPort)throw fail('画面版本已改变，请重新读取后预览',409);
   let snapshot=JSON.parse(session.body);const document=JSON.parse(picture.body),beats=input.auto==='beats'&&!input.times&&!input.frames?await this.loadBeatFrames(id,snapshot,{videoId,revision:input.revision}):{snapshot,warnings:[]};snapshot=beats.snapshot;
   const selection=selectPreviewFrames(snapshot,input);
   if(snapshot.space.frameCount!==document.frameCount||snapshot.space.frameRate.numerator!==document.frameRate.numerator||snapshot.space.frameRate.denominator!==document.frameRate.denominator)throw fail('原生预览时钟不一致，请稍后重试',409);
   const key=crypto.createHash('sha256').update(JSON.stringify({id,videoId,revision:input.revision,nativeRevision:snapshot.revision,frames:selection.frames,grid:input.grid!==false,sampleDuration:input.sampleDuration})).digest('hex').slice(0,24),previewId='pv-'+key,directory=path.join(this.base,previewId);
   prepared={id:previewId,projectId:id,videoId,revision:input.revision,nativeRevision:snapshot.revision,selection,snapshot,document,directory,warnings:beats.warnings};
   const cached=await fs.readFile(path.join(directory,'preview.json'),'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT')return null;throw error;});
   if(cached){prepared.cached=cached;return;}
   // An identical in-flight request already owns this isolated resource directory.
   if(this.pending.has(previewId))return;
   await fs.mkdir(directory,{recursive:true});
   const sampleRange=input.sampleDuration?{startFrame:selection.frames[0],endFrameExclusive:Math.min(document.frameCount,selection.frames[0]+Math.max(1,Math.round(input.sampleDuration*selection.frameRate.numerator/selection.frameRate.denominator)))}:undefined;
   const {selectHyperframesArtifacts}=await nativeApi(),selectedRanges=selection.frames.map(f=>({startFrame:f,endFrameExclusive:f+1}));if(sampleRange)selectedRanges.push(sampleRange);
   // Native artifact selection requires ordered, disjoint spans. The sample can
   // include selected still frames, so select resources from their union.
   const ranges=[];for(const span of selectedRanges.sort((a,b)=>a.startFrame-b.startFrame)){
    const previous=ranges.at(-1);if(previous&&span.startFrame<=previous.endFrameExclusive)previous.endFrameExclusive=Math.max(previous.endFrameExclusive,span.endFrameExclusive);else ranges.push({...span});
   }
   const artifacts=selectHyperframesArtifacts(document,ranges);if(artifacts.reduce((sum,item)=>sum+item.artifact.size,0)>512*1024*1024)throw fail('选帧所需素材超过 512MB，请缩小时间范围或使用导出成片预览');await fs.mkdir(path.join(directory,'resources'),{recursive:true});
   for(const {artifact} of artifacts){
    if(!/^res_[\w.:-]+$/.test(artifact.resource))throw fail('原生素材标识无效');
    const resource=await this.studios.resource(id,'/__studio/material/'+artifact.resource);
    if(resource.status!==200||resource.frameRevision!==input.revision||resource.sessionPort!==picture.sessionPort||resource.body.length!==artifact.size)throw fail('预览素材已改变，请重新读取后预览',409);
    await fs.writeFile(path.join(directory,'resources',artifact.resource),resource.body);
   }
   if((await this.service.get(id)).revision!==input.revision)throw fail('画面已更新，请重新读取后预览',409);
   const config=JSON.parse(await fs.readFile(path.join(this.service.dir(id),'hypit.runtime.json'),'utf8')),endpoint=Object.values(config.endpoints||{}).find(e=>e.use==='@hypit/provider-hyperframes-local');
   if(!endpoint)throw fail('工程没有配置原生本地渲染器');
   prepared.options={...endpoint.config,ffmpegPath:this.ffmpeg,ffprobePath:this.ffprobe,workers:1,maxWorkers:1,quality:'draft',processTimeoutMs:estimateRenderTimeout({frameCount:selection.frames.length+(sampleRange?sampleRange.endFrameExclusive-sampleRange.startFrame:0),width:document.canvas.width,height:document.canvas.height}),maxRenderedBytes:96*1024*1024};
   await fs.writeFile(path.join(directory,'request.json'),JSON.stringify({request:{document,frames:selection.frames},options:prepared.options,sampleRange}));
  });}catch(error){if(prepared?.directory&&!prepared.cached&&!this.pending.has(prepared.id))await fs.rm(prepared.directory,{recursive:true,force:true});throw error;}
  if(prepared.cached)return rpcPreview({...prepared.cached,cached:true});
  if(this.pending.has(prepared.id))return rpcPreview(await this.pending.get(prepared.id));
  const execution=this.render(prepared,input).finally(()=>this.pending.delete(prepared.id));this.pending.set(prepared.id,execution);return rpcPreview(await execution);
 });}
 async render(prepared,input){
  const {directory,document,snapshot,selection}=prepared;
  try{
   const execution=await this.runPreview(process.execPath,[path.join(this.root,'server/native-preview-runner.mjs'),directory],{timeout:prepared.options.processTimeoutMs+15000,maxBuffer:4e6});
   const rendered=JSON.parse(execution.stdout),outputs=rendered.outputs.map(item=>{const time=item.frame*selection.frameRate.denominator/selection.frameRate.numerator,entities=snapshot.tracks.filter(t=>t.binding?.facet!=='audio').flatMap(t=>t.clips.filter(c=>c.startFrame<=item.frame&&item.frame<c.endFrameExclusive).map(c=>({entityId:c.id,trackId:t.id,label:c.display?.title||'画面片段'})));return {...item,time,timecode:timecode(time),label:'画面 '+timecode(time),entities,mediaType:'image/png',width:document.canvas.width,height:document.canvas.height,path:path.join(directory,item.name)};});
   const grid=input.grid===false?null:await makeGrid(directory,outputs,{root:this.root,document});
   const sample=rendered.sample?{name:rendered.sample.name,path:path.join(directory,rendered.sample.name),mediaType:'video/mp4',start:rendered.sample.startFrame*selection.frameRate.denominator/selection.frameRate.numerator,duration:(rendered.sample.endFrameExclusive-rendered.sample.startFrame)*selection.frameRate.denominator/selection.frameRate.numerator,silent:true}:null;
   const result={id:prepared.id,projectId:prepared.projectId,videoId:prepared.videoId,revision:prepared.revision,nativeRevision:prepared.nativeRevision,source:'project',frameRate:selection.frameRate,sampled:selection.sampled,frames:outputs,...(grid?{grid}:{}),...(sample?{sample}:{}),warnings:[...(prepared.warnings||[]),...(sample?['工程短预览只渲染画面，不含音轨；音画同步请检查导出成片。']:[])],created:new Date().toISOString(),cached:false};
   await savePreviewRecord(directory,result);
   await fs.rm(path.join(directory,'resources'),{recursive:true,force:true});await fs.rm(path.join(directory,'request.json'),{force:true});return result;
  }catch(error){await fs.rm(directory,{recursive:true,force:true});throw fail('原生选帧预览失败：'+String(error.stderr||error.message).slice(-1800),500);}
 }
 async previewExport(id,input){
  if(!/^[a-f0-9-]{36}$/.test(input.jobId))throw fail('成片任务编号无效');
  const project=await this.service.get(id),videoId=this.service.currentVideoId?.(id)||'v-default',exportDirectory=path.join(this.service.dataRoot,'exports',input.jobId),job=JSON.parse(await fs.readFile(path.join(exportDirectory,'job.json'),'utf8'));
  if(job.projectId!==id||(job.videoId||'v-default')!==videoId)throw fail('成片不属于当前视频',404);
  if(job.status!=='done')throw fail('成片尚未完成');
  if(input.revision!==undefined&&input.revision!==job.revision)throw fail('成片版本与请求不一致',409);
  const file=path.join(exportDirectory,'final.mp4'),raw=JSON.parse((await this.run(this.ffprobe,['-v','error','-select_streams','v:0','-show_streams','-show_format','-of','json',file],{timeout:30000,maxBuffer:2e6})).stdout),stream=raw.streams?.[0];
  if(!stream)throw fail('成片没有画面');
  const rational=String(stream.avg_frame_rate||stream.r_frame_rate).split('/').map(Number),frameRate={numerator:rational[0],denominator:rational[1]||1},fps=rate(stream.avg_frame_rate)||rate(stream.r_frame_rate),duration=Number(raw.format?.duration||stream.duration);
  if(!fps||!duration)throw fail('成片缺少有效帧时钟');
  let snapshot={space:{frameRate,frameCount:Number(stream.nb_frames)||Math.floor(duration*fps)},tracks:[]},warnings=[];
  if(job.revision===project.revision&&project.native){snapshot=await this.studios.snapshot(id);if(input.auto==='beats'&&!input.times&&!input.frames){const beats=await this.loadBeatFrames(id,snapshot,{videoId,revision:job.revision});snapshot=beats.snapshot;warnings.push(...beats.warnings);}}
  else if(!input.times&&!input.frames&&(input.auto===undefined||input.auto==='cuts')){input={...input,auto:'every:2s'};warnings.push('该版成片没有可用的镜头切点，已按时间间隔采样。');}
  if(stream.avg_frame_rate!==stream.r_frame_rate)warnings.push('成片可能使用可变帧率，时码按平均帧率计算。');
  const selection=selectPreviewFrames(snapshot,input),key=crypto.createHash('sha256').update(JSON.stringify({id,videoId,jobId:input.jobId,frames:selection.frames,grid:input.grid!==false,sampleDuration:input.sampleDuration})).digest('hex').slice(0,24),previewId='pv-'+key,directory=path.join(this.base,previewId);
  const cached=await fs.readFile(path.join(directory,'preview.json'),'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT')return null;throw error;});
  if(cached)return rpcPreview({...cached,cached:true});
  if(this.pending.has(previewId))return rpcPreview(await this.pending.get(previewId));
  const execution=(async()=>{
   await fs.mkdir(directory,{recursive:true});
   try{
    const outputs=[];
    for(const frame of selection.frames){const at=frame/fps,name='frame-'+String(frame).padStart(9,'0')+'.png';
     // This reads the already-rendered local file, not a second project renderer.
     await this.run(this.ffmpeg,['-v','error','-ss',String(at),'-i',file,'-frames:v','1','-y',path.join(directory,name)],{timeout:30000,maxBuffer:2e6});
     outputs.push({frame,time:at,timecode:timecode(at),label:'成片 '+timecode(at),name,mediaType:'image/png',width:stream.width,height:stream.height,path:path.join(directory,name)});
    }
    const grid=input.grid===false?null:await makeGrid(directory,outputs,{root:this.root,document:{canvas:{width:stream.width,height:stream.height}}});
    let sample;
    if(input.sampleDuration){const start=selection.frames[0]/fps,length=Math.min(input.sampleDuration,duration-start),name='sample.mp4';
     await this.run(this.ffmpeg,['-v','error','-ss',String(start),'-i',file,'-t',String(length),'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','veryfast','-crf','26','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-y',path.join(directory,name)],{timeout:60000,maxBuffer:2e6});
     sample={name,path:path.join(directory,name),mediaType:'video/mp4',start,duration:length};
    }
    const record={id:previewId,projectId:id,videoId,revision:job.revision,jobId:input.jobId,source:'export',frameRate,sampled:selection.sampled,frames:outputs,...(grid?{grid}:{}),...(sample?{sample}:{}),warnings,created:new Date().toISOString(),cached:false};
    await savePreviewRecord(directory,record);return record;
   }catch(error){await fs.rm(directory,{recursive:true,force:true});throw fail('成片选帧失败：'+String(error.stderr||error.message).slice(-1200),500);}
  })().finally(()=>this.pending.delete(previewId));this.pending.set(previewId,execution);return rpcPreview(await execution);
 }
 async recoverPreview(id,{previewId,videoId,revision}={}){return this.scope(id,videoId,async()=>{
  if(!/^pv-[a-f0-9]{24}$/.test(previewId||''))throw fail('预览编号无效',404);
  await this.service.get(id);
  const directory=path.join(this.base,previewId),expectedVideo=this.service.currentVideoId?.(id)||'v-default';
  let record;try{
   const stat=await fs.lstat(directory),metadata=path.join(directory,'preview.json'),metadataStat=await fs.lstat(metadata);
   if(!stat.isDirectory()||stat.isSymbolicLink()||!metadataStat.isFile()||metadataStat.isSymbolicLink())throw fail('原预览记录不可用',404);
   const canonicalBase=await fs.realpath(this.base),canonical=await fs.realpath(directory);if(canonical!==path.join(canonicalBase,previewId))throw fail('原预览目录无效',404);
   record=JSON.parse(await fs.readFile(metadata,'utf8'));
  }catch(error){if(error.code==='ENOENT')throw fail('原预览文件已不可用，请重新预览',404);throw error;}
  if(record.id!==previewId||record.projectId!==id||record.videoId!==expectedVideo)throw fail('预览不属于当前视频',404);
  if(typeof record.revision!=='string'||!record.revision||(revision!==undefined&&record.revision!==revision))throw fail('原预览版本与记录不一致',409);
  if(!['project','export'].includes(record.source)||!Array.isArray(record.frames)||!record.frames.length||record.frames.length>24)throw fail('原预览记录无效');
  const check=async(name,pattern)=>{
   if(typeof name!=='string'||!pattern.test(name))throw fail('原预览文件名无效');
   const file=path.join(directory,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw fail('原预览文件不可用',404);return file;
  };
  // Reconstruct paths from validated filenames. Stored absolute paths are not read capabilities.
  const frames=[];for(const frame of record.frames)frames.push({...frame,path:await check(frame.name,/^frame-\d{9}\.png$/)});
  const grid=record.grid?{...record.grid,path:await check(record.grid.name,/^grid\.jpg$/)}:undefined;
  const sample=record.sample?{...record.sample,path:await check(record.sample.name,/^sample\.mp4$/)}:undefined;
  return rpcPreview({...record,frames,...(grid?{grid}:{}),...(sample?{sample}:{}),cached:true,recovered:true});
 });}
 async file(id,previewId,name,{videoId}={}){return this.scope(id,videoId,async()=>{
  if(!/^pv-[a-f0-9]{24}$/.test(previewId)||! /^(?:frame-\d{9}\.png|grid\.jpg|sample\.mp4)$/.test(name))throw fail('预览文件不存在',404);
  const directory=path.join(this.base,previewId),record=JSON.parse(await fs.readFile(path.join(directory,'preview.json'),'utf8'));
  if(record.projectId!==id||record.videoId!==(this.service.currentVideoId?.(id)||'v-default'))throw fail('预览不属于当前视频',404);
  if(!record.frames.some(f=>f.name===name)&&record.grid?.name!==name&&record.sample?.name!==name)throw fail('预览文件不存在',404);
  return {path:path.join(directory,name),mediaType:name.endsWith('.png')?'image/png':name.endsWith('.mp4')?'video/mp4':'image/jpeg',revision:record.revision};
 });}
 async probeExport(id,input={}){return this.scope(id,input.videoId,async()=>{
  const project=await this.service.get(id),videoId=this.service.currentVideoId?.(id)||'v-default';let file,revision=project.revision;
  if(input.jobId){
   if(!/^[a-f0-9-]{36}$/.test(input.jobId))throw fail('成片任务编号无效');
   const directory=path.join(this.service.dataRoot,'exports',input.jobId),job=JSON.parse(await fs.readFile(path.join(directory,'job.json'),'utf8'));
   if(job.projectId!==id||(job.videoId||'v-default')!==videoId)throw fail('成片不属于当前视频',404);
   if(job.status!=='done')throw fail('成片尚未完成');file=path.join(directory,'final.mp4');revision=job.revision;
  }else if(input.assetFile){
   const asset=project.assets.find(a=>a.filename===input.assetFile);if(!asset||!['video','audio'].includes(asset.kind))throw fail('请选择当前项目的视频或声音素材');file=await assetPath(this.service.dir(id),asset.filename);
  }else throw fail('请指定成片 jobId 或素材 assetFile');
  const result=await probeMediaFile(file,{run:this.run,ffmpeg:this.ffmpeg,ffprobe:this.ffprobe,analysisSeconds:input.analysisSeconds});
  return {projectId:id,videoId,revision,...result,blackFrames:result.blackIntervals,staticFrames:result.staticIntervals,warnings:result.limitations};
 });}
}
export {ProductionPreview as ProductionPreviewService};
