import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {run} from './project.mjs';
import {assetPath} from './assets.mjs';
import {captureJobVideo,withJobVideo} from './job-video.mjs';
import {readStoredRecord,CorruptRecordError} from './record-recovery.mjs';

export const BEAT_ANALYSIS_VERSION='rms-onsets-autocorrelation-10ms@1';
const rate=8000,hop=80,window=160;
const round=value=>Number(value.toFixed(4));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted[Math.floor(sorted.length/2)]:0;};
const clamp=value=>Math.max(0,Math.min(1,value));

// This measures acoustic attack periodicity. Energy accents are not proof of meter.
export function analyzeBeatPCM(bytes,{start=0,sampleRate=rate}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length%2||sampleRate!==rate)throw Error('节拍分析需要 8000 Hz 单声道 PCM16');
 const rms=[],flux=[];
 for(let at=0;at+window<=bytes.length/2;at+=hop){let energy=0;for(let i=at;i<at+window;i++)energy+=(bytes.readInt16LE(i*2)/32768)**2;rms.push(Math.sqrt(energy/window));}
 const duration=bytes.length/2/rate,peak=Math.max(0,...rms),warnings=['拍点是本地能量起音估计；强拍候选只表示声音重音，无法确认小节第一拍。'];
 if(peak<.0001||rms.length<200)return {bpm:null,beats:[],downbeats:[],strongBeatCandidates:[],tempoCandidates:[],confidence:0,confidenceDetails:{tempo:0,downbeats:0},status:'insufficient-evidence',duration:round(duration),warnings:[...warnings,peak<.0001?'音频接近静音，无法分析节拍。':'片段太短，无法可靠估计速度。']};
 for(let i=0;i<rms.length;i++){
  let baseline=0;for(let j=Math.max(0,i-8);j<i;j++)baseline+=rms[j];baseline/=Math.min(i,8)||1;
  flux.push(Math.max(0,rms[i]-baseline));
 }
 const mid=median(flux),mad=median(flux.map(value=>Math.abs(value-mid))),maximum=Math.max(...flux),threshold=Math.max(mid+4*mad,maximum*.1,.00005),onsets=[];
 for(let i=2;i<flux.length-2;i++){
  if(flux[i]<threshold||flux[i]<flux[i-1]||flux[i]<=flux[i+1]||flux[i]<flux[i-2]||flux[i]<flux[i+2])continue;
  const onset={frame:i,time:start+(i*hop+window/2)/rate,strength:flux[i]/maximum};
  if(onsets.length&&i-onsets.at(-1).frame<12){if(onset.strength>onsets.at(-1).strength)onsets[onsets.length-1]=onset;}else onsets.push(onset);
 }
 const correlations=[];
 for(let lag=25;lag<=150;lag++){
  let xy=0,xx=0,yy=0;for(let i=0;i+lag<flux.length;i++){xy+=flux[i]*flux[i+lag];xx+=flux[i]**2;yy+=flux[i+lag]**2;}
  correlations[lag]=xx&&yy?xy/Math.sqrt(xx*yy):0;
 }
 const candidates=[];
 for(let lag=25;lag<=150;lag++){
  if(correlations[lag]<(correlations[lag-1]||0)||correlations[lag]<(correlations[lag+1]||0))continue;
  const anchor=onsets.reduce((best,item)=>item.strength>(best?.strength||0)?item:best,undefined);let aligned=0,total=0;
  for(const onset of onsets){const phase=anchor?Math.abs((onset.frame-anchor.frame)/lag-Math.round((onset.frame-anchor.frame)/lag)):1;total+=onset.strength;if(phase<.12)aligned+=onset.strength;}
  const bpm=6000/lag,coherence=total?aligned/total:0,prior=Math.exp(-Math.abs(Math.log(bpm/120))),score=correlations[lag]*.7+coherence*.25+prior*.05;
  candidates.push({bpm:round(bpm),correlation:round(correlations[lag]),coherence:round(coherence),score:round(score),lag});
 }
 candidates.sort((a,b)=>b.score-a.score);const best=candidates[0],stable=onsets.length>=6&&best?.correlation>=.42&&best?.coherence>=.6;
 const alternatives=candidates.filter(candidate=>!best||Math.abs(candidate.bpm-best.bpm)>3).slice(0,4),ambiguous=stable&&alternatives.some(candidate=>candidate.correlation>best.correlation*.8&&[.5,2].some(ratio=>Math.abs(candidate.bpm/best.bpm-ratio)<.05));
 const confidence=stable?Math.min(ambiguous ? .75 : 1,clamp((best.correlation*.75+best.coherence*.25)*Math.min(1,onsets.length/12))):0;
 if(!stable)warnings.push('未找到稳定的音乐周期；起音候选不宜作为准确卡点依据。');
 if(ambiguous)warnings.push('存在半速或倍速候选，BPM 需要结合听音确认。');
 const accents=onsets.map(onset=>onset.strength),accentThreshold=Math.max(.6,median(accents)*1.45);
 return {bpm:stable?best.bpm:null,beats:onsets.map(onset=>round(onset.time)),downbeats:[],strongBeatCandidates:onsets.filter(onset=>onset.strength>=accentThreshold).map(onset=>({time:round(onset.time),confidence:round(Math.min(.8,onset.strength*.8)),kind:'energy-accent',verifiedDownbeat:false})),tempoCandidates:(best?[best,...alternatives]:[]).map(({lag,...candidate})=>candidate),confidence:round(confidence),confidenceDetails:{tempo:round(confidence),onsets:round(Math.min(.85,onsets.length/12)),downbeats:0},status:stable?'estimated':'insufficient-evidence',duration:round(duration),warnings};
}

export class BeatAnalysisService{
 constructor({service,runner=run,version=BEAT_ANALYSIS_VERSION}){Object.assign(this,{service,runner,version});this.dir=path.join(service.dataRoot,'beat-analysis');this.work=new Map();this.listeners=new Set();this.records=new Map();}
 remember(record){this.records.set([record.projectId,record.videoId,record.id].join(':'),record);return record;}
 async init(){
  this.recoveryDiagnostics=[];const base=path.join(this.dir,'records');await fs.mkdir(base,{recursive:true});
  for(const projectId of (await fs.readdir(base)).filter(id=>/^p-[a-f0-9]{12}$/.test(id)))for(const videoId of (await fs.readdir(path.join(base,projectId))).filter(id=>/^(?:v-default|v-[a-f0-9]{12})$/.test(id)))for(const filename of (await fs.readdir(path.join(base,projectId,videoId))).filter(name=>/^beats-[a-f0-9]{24}\.json$/.test(name))){
   try{const record=await readStoredRecord(path.join(base,projectId,videoId,filename),{label:'节拍分析',validate:value=>value?.projectId===projectId&&value.videoId===videoId&&value.id===filename.slice(0,-5)&&/^[a-f0-9]{64}$/.test(value.assetSha)&&Array.isArray(value.beats)&&value.beats.every(time=>Number.isFinite(time)&&time>=0)&&Array.isArray(value.downbeats)&&typeof value.created==='string'});let stale=record.version!==this.version;
    try{stale||=await withJobVideo(this.service,record,async()=>sha(await fs.readFile(await assetPath(this.service.dir(projectId),record.assetFile)))!==record.assetSha);}catch(error){if(error.code!=='ENOENT'&&error.status!==404)throw error;stale=true;}this.remember({...record,stale});
   }catch(error){if(!(error instanceof CorruptRecordError))throw error;this.recoveryDiagnostics.push(error.diagnostic);}
  }
  return this;
 }
 listSync(projectId,{assetFile,videoId=this.service.currentVideoId(projectId)}={}){return [...this.records.values()].filter(record=>record.projectId===projectId&&record.videoId===videoId&&(!assetFile||record.assetFile===assetFile)).sort((a,b)=>b.created.localeCompare(a.created)).map(record=>structuredClone(record));}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 analyze(projectId,input){const target=captureJobVideo(this.service,projectId,input);return withJobVideo(this.service,target,()=>this.analyzeInVideo(projectId,input));}
 async analyzeInVideo(projectId,{assetFile,start=0,end}={}){
  const project=await this.service.get(projectId),asset=project.assets.find(item=>item.filename===assetFile&&item.kind==='audio');if(!asset)throw Object.assign(Error('请选择当前项目的音频素材'),{status:404});
  end??=asset.duration;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>asset.duration+.001||end-start>600)throw Error('节拍分析时间范围无效，最长 600 秒');
  const file=await assetPath(this.service.dir(projectId),assetFile),bytes=await fs.readFile(file),assetSha=sha(bytes),key=sha(JSON.stringify({assetSha,version:this.version,start,end})),id='beats-'+key.slice(0,24),cache=path.join(this.dir,'cache',id+'.json');let measured,cached=true;
  try{measured=JSON.parse(await fs.readFile(cache,'utf8'));if(measured.assetSha!==assetSha||measured.version!==this.version)throw Error('节拍缓存身份无效');}
  catch(error){if(error.code!=='ENOENT')throw error;cached=false;let task=this.work.get(key);if(!task){task=this.measure(file,{start,end,assetSha,id,cache}).finally(()=>this.work.delete(key));this.work.set(key,task);}measured=await task;}
  const result={...measured,projectId,videoId:project.videoId||this.service.currentVideoId(projectId),assetFile,assetId:asset.id,assetName:asset.name,cached,stale:false};
  await this.write(path.join(this.dir,'records',projectId,result.videoId,id+'.json'),result);this.remember(result);for(const listener of this.listeners){try{listener(result);}catch{}}return result;
 }
 async measure(file,{start,end,assetSha,id,cache}){
  const {stdout}=await this.runner('ffmpeg',['-v','error','-i',file,'-ss',String(start),'-t',String(end-start),'-map','0:a:0','-ac','1','-ar',String(rate),'-f','s16le','-'],{encoding:'buffer',timeout:90000,maxBuffer:10e6});
  const analysis=analyzeBeatPCM(stdout,{start}),result={id,assetSha,version:this.version,method:this.version,analyzedRange:{start,end:start+analysis.duration},timeBasis:'source-audio-seconds',...analysis,segments:[{start,end:start+analysis.duration,bpm:analysis.bpm,confidence:analysis.confidence}],created:new Date().toISOString(),limitations:['未识别音乐拍号，也未确认小节第一拍。','时间线映射需由调用方结合 timelineStart、trimStart 与 playbackRate 处理。']};await this.write(cache,result);return result;
 }
 async write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}}
 get(projectId,id,{videoId=this.service.currentVideoId(projectId)}={}){return withJobVideo(this.service,{projectId,videoId},async()=>{
  if(!/^beats-[a-f0-9]{24}$/.test(id))throw Object.assign(Error('节拍分析不存在'),{status:404});let result;try{result=JSON.parse(await fs.readFile(path.join(this.dir,'records',projectId,videoId,id+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')throw Object.assign(Error('节拍分析不存在'),{status:404});throw error;}
  const project=await this.service.get(projectId),asset=project.assets.find(item=>item.filename===result.assetFile);let stale=!asset||result.version!==this.version;if(asset)stale||=sha(await fs.readFile(await assetPath(this.service.dir(projectId),result.assetFile)))!==result.assetSha;return this.remember({...result,stale});
 });}
 list(projectId,{assetFile,videoId=this.service.currentVideoId(projectId)}={}){return withJobVideo(this.service,{projectId,videoId},async()=>{
  const names=await fs.readdir(path.join(this.dir,'records',projectId,videoId)).catch(error=>{if(error.code==='ENOENT')return [];throw error;});const results=[];for(const name of names.filter(value=>/^beats-[a-f0-9]{24}\.json$/.test(value))){const result=await this.get(projectId,name.slice(0,-5),{videoId});if(!assetFile||result.assetFile===assetFile)results.push(result);}return results.sort((a,b)=>b.created.localeCompare(a.created));
 });}
 async close(){await Promise.allSettled(this.work.values());}
}
