import {promises as fs} from 'node:fs';
import path from 'node:path';
import {assetPath} from './assets.mjs';
import {whisperxModel} from './native-runtime.mjs';
import {interpretWhisperXTranscript} from '../engines/video/packages/whisperx/src/transcript.ts';

export function nativeTranscriptEvidence(transcript){
 if(transcript?.format!=='hypit.transcript@1'||!Array.isArray(transcript.passages)||!(transcript.audio_seconds>0))throw Error('本地语音服务未返回有效转录结果');
 return {passages:interpretWhisperXTranscript({segments:transcript.passages.map(p=>({start:p.start_seconds,end:p.end_seconds,words:p.words.map(w=>({text:w.text,start:w.start_seconds,end:w.end_seconds,score:w.score}))}))},Math.round(transcript.audio_seconds*16000))};
}
export class TranscriptionService{
 constructor({service,getConfig,engine=service.engine}){Object.assign(this,{service,getConfig,engine});this.dir=path.join(service.dataRoot,'transcriptions');this.jobs=new Map();this.listeners=new Set();this.work=new Map();this.queue=Promise.resolve();this.creates=Promise.resolve();}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 public(j){return {...j,taskId:'transcript:'+j.id};}
 list(id){return [...this.jobs.values()].filter(j=>j.projectId===id).map(j=>this.public(j));}
 async configuration(){const env=await this.getConfig(),local=env.HYPIT_WHISPERX==='enabled';return {provider:local?'whisperx':'elevenlabs',model:local?whisperxModel:'scribe_v2',configured:local||Boolean(env.ELEVENLABS_API_KEY),local,wordTimestamps:true,speakerDiarization:!local,...(local?{languages:['zh','en'],defaultLanguage:'zh'}:{})};}
 async init(){await fs.mkdir(this.dir,{recursive:true});for(const f of await fs.readdir(this.dir)){if(!/^[a-f0-9-]{36}\.json$/.test(f))continue;const j=JSON.parse(await fs.readFile(path.join(this.dir,f),'utf8'));if(['running','queued'].includes(j.status)){j.status='interrupted';j.error='上次字幕识别被中断，请重新识别';await this.save(j);}this.jobs.set(j.id,j);}}
 async save(j){j.updated=new Date().toISOString();const file=path.join(this.dir,j.id+'.json');await fs.writeFile(file+'.tmp',JSON.stringify(j,null,2));await fs.rename(file+'.tmp',file);for(const fn of this.listeners){try{fn(j);}catch{}}}
 create(projectId,input){const work=this.creates.then(()=>this.start(projectId,input));this.creates=work.catch(()=>{});return work;}
 async start(projectId,input){
  if(!/^[a-f0-9-]{36}$/.test(input.requestId))throw Error('任务 ID 无效');
  if(input.languageCode!==undefined&&!['zh','en'].includes(input.languageCode))throw Error('本地字幕识别请选择中文或英文');
  const old=this.jobs.get(input.requestId);if(old){if(old.projectId!==projectId||old.assetFile!==input.assetFile||(old.requestedLanguage||'zh')!==(input.languageCode||'zh'))throw Error('任务 ID 已使用');return this.public(old);}
  const p=await this.service.get(projectId),a=p.assets.find(a=>a.filename===input.assetFile&&['audio','video'].includes(a.kind));if(!a||a.kind==='video'&&!a.hasAudio)throw Error('请选择包含语音的素材');
  const env=await this.getConfig(),local=env.HYPIT_WHISPERX==='enabled';if(local&&!this.engine?.runtime)throw Error('本地字幕服务尚未连接');if(!local&&!env.ELEVENLABS_API_KEY)throw Error('请启用本地字幕识别，或配置 ElevenLabs API Key');
  const j={id:input.requestId,projectId,name:a.name+' · 字幕',assetFile:a.filename,actualDuration:a.duration,provider:local?'whisperx':'elevenlabs',kind:'transcription',model:local?whisperxModel:'scribe_v2',requestedLanguage:input.languageCode||'zh',status:local?'queued':'running',phase:local?'等待识别':'正在识别',created:new Date().toISOString()};this.jobs.set(j.id,j);await this.save(j);
  const operation=local?this.queue.then(()=>this.executeLocal(j)):this.execute(j,env.ELEVENLABS_API_KEY);if(local)this.queue=operation.catch(()=>{});
  const tracked=operation.finally(()=>this.work.delete(j.id));this.work.set(j.id,tracked);tracked.catch(()=>{});return this.public(j);
 }
 async executeLocal(j){
  try{
   j.status='running';j.phase='准备本地字幕识别';await this.save(j);
   const dir=path.join(this.dir,j.id),runtime=path.join(dir,'hypit.runtime.json'),output=path.join(dir,'transcript.json');await fs.mkdir(dir,{recursive:true});
   await fs.copyFile(path.join(this.engine.root,'template/hypit.runtime.json'),runtime);await this.engine.ensurePackageRoot(dir);await this.engine.runtime.prepare(dir);
   // Keep model lifecycle, audio normalization and measured timing in the upstream runtime.
   await this.engine.run(this.engine.hypit,['programs','up','--endpoint','whisperx.frame','--workspace',dir,'--runtime',runtime,'--max-wait-ms','120000','--json'],{cwd:dir,timeout:240000,maxBuffer:2e6});
   j.phase='识别语音并对齐字幕';await this.save(j);
   const media=await assetPath(this.service.dir(j.projectId),j.assetFile);
   await this.engine.run(this.engine.hypit,['transcribe',media,'--to',output,'--language',j.requestedLanguage,'--workspace',dir,'--runtime',runtime,'--json'],{cwd:dir,timeout:660000,maxBuffer:4e6});
   const transcript=JSON.parse(await fs.readFile(output,'utf8'));j.evidence=nativeTranscriptEvidence(transcript);j.language=transcript.language;
   j.words=j.evidence.passages.flatMap(p=>p.words.map(w=>({text:w.text,...(w.startSample!==undefined?{start:w.startSample/16000,end:w.endSampleExclusive/16000}:{}),...(w.score!==undefined?{score:w.score}:{})})));
   if(!j.words.some(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)))throw Error('没有识别到带时间戳的语音');
   j.text=transcript.passages.map(p=>p.words.map(w=>w.text).join(j.language==='zh'?'':' ')).join(j.language==='zh'?'':' ');j.actualDuration=transcript.audio_seconds;j.unalignedWords=j.words.filter(w=>!Number.isFinite(w.start)).length;j.status='succeeded';j.phase='字幕时序已就绪';
  }catch(e){j.status='failed';j.phase='识别未完成';const raw=String(e.stdout||e.stderr||e.message);let reason=raw;try{reason=JSON.parse(raw).error?.message||raw;}catch{}j.error=reason.replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(-700);}
  await this.save(j);
 }
 async execute(j,key){try{const bytes=await fs.readFile(await assetPath(this.service.dir(j.projectId),j.assetFile));const form=new FormData();form.set('model_id',j.model);form.set('file',new Blob([bytes]),j.assetFile);form.set('timestamps_granularity','character');form.set('diarize','true');form.set('tag_audio_events','false');const r=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':key},body:form,redirect:'error',signal:AbortSignal.timeout(180000)});const d=await r.json();if(!r.ok)throw Error(d.detail?.message||d.detail||'语音识别失败 '+r.status);j.text=d.text;j.words=d.words;j.language=d.language_code;const valid=(d.words||[]).filter(w=>w.type!=='audio_event'&&Number.isFinite(w.start)&&Number.isFinite(w.end));if(!valid.length)throw Error('服务未返回带时序的语音');j.evidence={passages:[{words:valid.map(w=>({text:w.text,startSample:Math.round(w.start*16000),endSampleExclusive:Math.round(Math.min(w.end,j.actualDuration)*16000)})),chars:valid.flatMap((w,i)=>(w.characters||[]).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)).map(c=>({char:c.text,wordIndex:i,startSample:Math.round(c.start*16000),endSampleExclusive:Math.round(Math.min(c.end,j.actualDuration)*16000)})))}]};j.status='succeeded';j.phase='字幕时序已就绪';}catch(e){j.status='failed';j.error=String(e.message).replaceAll(key,'[已隐藏]').slice(0,500);}await this.save(j);}
 async close(){await Promise.allSettled(this.work.values());}
}
