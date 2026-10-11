import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {captureJobVideo,withJobVideo} from './job-video.mjs';
import {readStoredRecord,CorruptRecordError} from './record-recovery.mjs';

const clone=value=>structuredClone(value);
const fpsOf=snapshot=>snapshot?.space?.frameRate?.numerator/snapshot?.space?.frameRate?.denominator;
const round=value=>Number(value.toFixed(6));
const validAudio=audio=>audio&&[audio.timelineStart,audio.timelineEnd,audio.trimStart,audio.trimEnd,audio.playbackRate,audio.phase].every(Number.isFinite)&&audio.timelineStart>=0&&audio.timelineEnd>audio.timelineStart&&audio.trimStart>=0&&audio.trimEnd>audio.trimStart&&audio.playbackRate>0&&audio.phase>=0&&typeof audio.loop==='boolean';
const audioClips=snapshot=>(snapshot?.tracks||[]).flatMap(track=>(track.clips||[]).filter(clip=>validAudio(clip.audio)).map(clip=>({id:clip.id,trackId:track.id,name:clip.display?.title||clip.authoredId||clip.id,startFrame:clip.startFrame,endFrameExclusive:clip.endFrameExclusive,audio:clip.audio})));

/** Real source events projected onto one terminal native audio placement. No BPM grid. */
export function mapBeatGuides(analysis,binding,clip,snapshot){
 const audio=clip.audio,fps=fpsOf(snapshot),warnings=[];
 if(!validAudio(audio)||!Number.isFinite(fps)||fps<=0)throw Error('原生音轨未公开可靠的取段和播放速率');
 const guides=[],sourceOrigin=binding.sourceOrigin,sourceLength=audio.trimEnd-audio.trimStart;
 const append=(sourceTime,kind,confidence,index)=>{
  const sourceBeat=sourceTime-sourceOrigin;
  if(sourceBeat<audio.trimStart-1e-6||sourceBeat>=audio.trimEnd-1e-6)return;
  let displacement=sourceBeat-audio.trimStart-audio.phase;
  if(audio.loop){displacement=((displacement%sourceLength)+sourceLength)%sourceLength;}
  let repeat=0;
  do{
   const time=audio.timelineStart+(displacement+repeat*sourceLength)/audio.playbackRate,frame=Math.round(time*fps);
   if(time>=audio.timelineEnd-1e-6)break;
   if(time>=audio.timelineStart-1e-6&&frame>=0&&frame<snapshot.space.frameCount)guides.push({id:binding.id+':'+kind+':'+index+':'+repeat,bindingId:binding.id,analysisId:analysis.id,clipId:clip.id,assetFile:analysis.assetFile,frame,time:round(time),sourceTime,kind,confidence});
   repeat++;
  }while(audio.loop&&repeat<20000&&guides.length<20000);
 };
 for(const [index,time] of analysis.beats.entries())append(time,'beat',analysis.confidenceDetails?.onsets??analysis.confidence,index);
 for(const [index,time] of (analysis.downbeats||[]).entries())append(time,'downbeat',analysis.confidenceDetails?.downbeats??analysis.confidence,index);
 for(const [index,item] of (analysis.strongBeatCandidates||[]).entries())append(item.time,'accent-candidate',item.confidence,index);
 if(guides.length>=20000)warnings.push('节拍参考数量过多，已限制显示；请缩短音乐使用范围。');
 if(!guides.some(item=>item.kind==='beat'||item.kind==='downbeat'))warnings.push('当前音乐取段未覆盖已分析的拍点。');
 return {guides:guides.sort((a,b)=>a.frame-b.frame),warnings};
}

export class BeatGuidesService{
 constructor({service,beats,snapshot}){Object.assign(this,{service,beats,snapshot});this.dir=path.join(service.dataRoot,'beat-guides');this.records=new Map();}
 key(projectId,videoId){return projectId+':'+videoId;}
 file(projectId,videoId){return path.join(this.dir,projectId,videoId+'.json');}
 async init(){
  await fs.mkdir(this.dir,{recursive:true});this.recoveryDiagnostics=[];
  for(const projectId of (await fs.readdir(this.dir)).filter(id=>/^p-[a-f0-9]{12}$/.test(id)))for(const filename of (await fs.readdir(path.join(this.dir,projectId))).filter(name=>/^(?:v-default|v-[a-f0-9]{12})\.json$/.test(name))){
   const videoId=filename.slice(0,-5);try{const record=await readStoredRecord(this.file(projectId,videoId),{label:'节拍绑定',validate:value=>value?.projectId===projectId&&value.videoId===videoId&&Array.isArray(value.bindings)&&value.bindings.every(item=>item&&/^guide-[a-f0-9]{20}$/.test(item.id)&&typeof item.clipId==='string'&&/^beats-[a-f0-9]{24}$/.test(item.analysisId)&&typeof item.assetFile==='string'&&typeof item.assetSha==='string'&&Number.isFinite(item.sourceOrigin)&&item.sourceOrigin>=0&&typeof item.enabled==='boolean')});this.records.set(this.key(projectId,videoId),record);}catch(error){if(!(error instanceof CorruptRecordError))throw error;this.recoveryDiagnostics.push(error.diagnostic);}
  }return this;
 }
 listSync(projectId,{videoId=this.service.currentVideoId(projectId)}={}){return clone(this.records.get(this.key(projectId,videoId))?.bindings||[]);}
 list(projectId,options={}){const target=captureJobVideo(this.service,projectId,options);return withJobVideo(this.service,target,()=>this.listSync(projectId,target));}
 async persist(record){await fs.mkdir(path.dirname(this.file(record.projectId,record.videoId)),{recursive:true});const file=this.file(record.projectId,record.videoId),temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(record,null,2));await fs.rename(temp,file);this.records.set(this.key(record.projectId,record.videoId),record);}finally{await fs.rm(temp,{force:true});}}
 bind(projectId,input,snapshot){const target=captureJobVideo(this.service,projectId,input);return withJobVideo(this.service,target,()=>this.service.exclusive(projectId,async()=>{
  const current=snapshot??await this.snapshot?.(projectId);if(!current)throw Error('请先读取当前原生音轨');
  if(input.revision!==current.revision)throw Object.assign(Error('工程已更新，请重新读取音轨后绑定'),{status:409});
  const clip=audioClips(current).find(item=>item.id===input.clipId);if(!clip)throw Error('请选择时间线上的音乐片段');
  const analysis=await this.beats.get(projectId,input.analysisId,target);if(analysis.stale)throw Error('音乐或分析版本已改变，请重新分析');
  if(input.assetFile!==analysis.assetFile)throw Error('节拍分析与选中的音频素材不一致');
  const audio=clip.audio,direct=audio.sourceAssetPath==='assets/'+analysis.assetFile;
  if(audio.sourceAssetPath&&!direct)throw Error('此音轨使用其他素材，请选择对应的音频分析');
  let sourceOrigin=0;
  if(!direct){if(input.confirmedSource!==true||!Number.isFinite(input.sourceOrigin)||input.sourceOrigin<0)throw Error('派生音频无法自动确认源起点；请明确确认素材与源起点');sourceOrigin=input.sourceOrigin;}
  else if(input.sourceOrigin!==undefined&&input.sourceOrigin!==0)throw Error('原生直连素材的源起点是 0；音轨裁切已由原生 trim 处理');
  if(typeof input.enabled!=='undefined'&&typeof input.enabled!=='boolean')throw Error('节拍参考开关无效');
  const id='guide-'+crypto.createHash('sha256').update(clip.id).digest('hex').slice(0,20),binding={id,projectId,videoId:target.videoId,clipId:clip.id,analysisId:analysis.id,assetFile:analysis.assetFile,assetSha:analysis.assetSha,sourceOrigin,sourceMode:direct?'native-source':'explicit-origin',sourceSignature:audio.sourceSignature??null,resource:audio.resource,enabled:input.enabled??true,created:new Date().toISOString()};
  const bindings=this.listSync(projectId,target).filter(item=>item.id!==id);if(bindings.length>=60)throw Error('当前视频的节拍绑定过多');bindings.push(binding);await this.persist({...target,bindings});return this.load(projectId,current,target);
 }));}
 load(projectId,snapshot,options={}){const target=captureJobVideo(this.service,projectId,options);return withJobVideo(this.service,target,async()=>{
  const current=snapshot??await this.snapshot?.(projectId),bindings=this.listSync(projectId,target),clips=audioClips(current),guides=[],warnings=[];
  if(!current)return {...target,revision:null,bindings,clips,guides,warnings:['还没读到影片的时间线，节拍参考暂时对不上。']};
  for(const binding of bindings.filter(item=>item.enabled)){
   const clip=clips.find(item=>item.id===binding.clipId);if(!clip){warnings.push('绑定的音乐片段已移除或不再公开可靠时间：'+binding.clipId);continue;}
   try{
    const analysis=await this.beats.get(projectId,binding.analysisId,target);if(analysis.stale||analysis.assetSha!==binding.assetSha)throw Error('素材或节拍分析已改变，请重新分析并绑定');
    if(binding.sourceMode==='native-source'&&clip.audio.sourceAssetPath!=='assets/'+binding.assetFile)throw Error('音轨已改用其他来源，请重新绑定');
    if(binding.sourceSignature!==null?binding.sourceSignature!==clip.audio.sourceSignature:binding.resource!==clip.audio.resource)throw Error('音轨源处理已改变，请重新确认素材和源起点');
    const mapped=mapBeatGuides(analysis,binding,clip,current);guides.push(...mapped.guides);warnings.push(...(analysis.warnings||[]),...mapped.warnings);
    if(binding.sourceMode==='explicit-origin')warnings.push('派生源的起点采用手动确认值；源处理改变后需重新确认。');
   }catch(error){warnings.push(error.message);}
  }
  return {...target,revision:current.revision,bindings,clips,guides:guides.sort((a,b)=>a.frame-b.frame),warnings:[...new Set(warnings)]};
 });}
}
