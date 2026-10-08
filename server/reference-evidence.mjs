import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {run} from './project.mjs';

export function referenceFrameTimes(duration,boundaries=[]){
 if(!Number.isFinite(duration)||duration<=0)throw Error('参考视频时长无效');
 const last=Math.max(0,duration-.05),count=Math.min(72,Math.max(2,Math.ceil(duration*2))),times=Array.from({length:count},(_,i)=>last*i/(count-1));
 // Uniform coverage plus the strongest visual changes; a short insert should not disappear between samples.
 const cuts=boundaries.filter(b=>Number.isFinite(b.at)&&b.at>0&&b.at<duration).sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,12);
 for(const cut of cuts)for(const offset of [-.08,.08]){const at=Math.max(0,Math.min(last,cut.at+offset));if(!times.some(t=>Math.abs(t-at)<.035))times.push(at);}
 return times.sort((a,b)=>a-b).map(t=>Math.round(t*1000)/1000);
}

export async function extractReferenceFrames(file,dir,times){
 const target=path.join(dir,'frames');await fs.mkdir(target,{recursive:true});
 const frames=times.map((at,i)=>({at,file:path.join(target,`frame-${String(i).padStart(3,'0')}.jpg`)}));let index=0;
 await Promise.all(Array.from({length:3},async()=>{while(index<frames.length){const frame=frames[index++];await run('ffmpeg',['-v','error','-ss',String(frame.at),'-i',file,'-frames:v','1','-vf','scale=896:896:force_original_aspect_ratio=decrease','-q:v','3','-y',frame.file],{timeout:20000,maxBuffer:1e6});}}));
 return frames;
}

export async function referenceTranscript(transcriptions,item){
 if(!item.hasAudio)return {status:'no-audio',text:'',words:[],limitation:'原片没有音轨。'};
 const existing=transcriptions?.list(item.projectId).filter(t=>t.assetFile===item.assetFile).sort((a,b)=>(b.updated||b.created||'').localeCompare(a.updated||a.created||''));
 let job=existing?.find(t=>t.status==='succeeded');
 try{
  if(!job){
   const config=await transcriptions?.configuration();
   // Do not silently upload the audio to an unrelated cloud service when local ASR is unavailable.
   if(!config?.local)return {status:'unavailable',text:'',words:[],limitation:'本地语音识别未启用；未读取音轨，不推测原片旁白、音乐或音色。'};
   job=existing.find(t=>['queued','running'].includes(t.status));
   if(!job)job=await transcriptions.create(item.projectId,{requestId:crypto.randomUUID(),assetFile:item.assetFile,languageCode:'zh'});
   await transcriptions.work.get(job.id);job=transcriptions.jobs.get(job.id)||job;
  }
  if(job.status!=='succeeded')return {status:'unavailable',taskId:job.taskId||'transcript:'+job.id,text:'',words:[],limitation:'本地语音识别未完成；不能把没有识别结果当成没有旁白。'};
  const words=(job.words||[]).filter(w=>typeof w.text==='string'&&Number.isFinite(w.start)&&Number.isFinite(w.end)).map(({text,start,end})=>({text,start,end}));
  return {status:'transcribed',taskId:'transcript:'+job.id,provider:job.provider,model:job.model,language:job.language,text:job.text,words,limitation:'台词和时间来自语音识别，可能有误识别；没有听取原始音轨，不能据此判断口音、音色、音乐、音效或混音。'};
 }catch{return {status:'unavailable',text:'',words:[],limitation:'本地语音识别暂不可用；未核实原片台词和音轨。'};}
}

export const AUDIO_LIMITATION='基于关键帧与语音转录分析，未直接听取原音轨；发音、口音、音色、音乐与混音仍需试听。';
export function applyEvidenceLimits(result,media,item){
 const limitation=item.hasAudio?AUDIO_LIMITATION:'原片没有音轨。';
 const next={...result,audio:media.transcript?.status==='transcribed'?`语音识别转录：${media.transcript.text}\n${limitation}`:media.transcript?.limitation||limitation,uncertainties:[result.uncertainties,limitation,'画面依据带时间戳的抽样帧，未覆盖的瞬间和连续运动不能认定为已核实。'].filter(Boolean).join('\n')};
 if(item.purpose==='quality'&&Array.isArray(next.issues))next.issues=next.issues.filter(issue=>!['发音','混音','口音','音色','音乐','音效'].includes(issue.category));
 return next;
}
