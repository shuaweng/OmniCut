import {withJobVideo,jobVideoId,validJobVideo,captureJobVideo} from './job-video.mjs';
import {minimaxConfig,minimaxAudioBody,minimaxAudioBytes,minimaxResult,minimaxSpeechEvidence,validateMinimaxDownload} from './minimax.mjs';
import {run} from './project.mjs';
import {mediaFailure} from './media-errors.mjs';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {assetPath,importAsset} from './assets.mjs';
import {publicSettings} from './settings.mjs';
import {configurationCapabilities,audioCapabilities,resolveAudioSelection,AUDIO_KINDS,AUDIO_DURATION,AUDIO_SPEED} from './media-capabilities.mjs';
import {readStoredRecord,CorruptRecordError,validStoredTask,isStorageFailure} from './record-recovery.mjs';
import {prepareVoiceChange} from './voice-change-audio.mjs';
const ELEVEN='https://api.elevenlabs.io/v1', MIMO='https://api.xiaomimimo.com/v1';
const kinds=AUDIO_KINDS;
const clean=(e,key)=>String(e?.message||'声音生成失败').replaceAll(key||'\0','[已隐藏]').replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);
const text=(value,max,label,required=false)=>{if(value===undefined&&!required)return '';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(label+'无效');return value.trim();};
export async function readLimited(response,max){const parts=[];let length=0;for await(const chunk of response.body||[]){length+=chunk.length;if(length>max){throw Error('声音结果超过大小限制');}parts.push(chunk);}return Buffer.concat(parts);}
async function checked(response){if(response.ok)return response;const raw=await readLimited(response,16000);let detail;try{const data=JSON.parse(raw);detail=data.detail?.message||data.error?.message||data.base_resp?.status_msg||data.message;}catch{}const e=Error((typeof detail==='string'&&/missing.*permission/i.test(detail)?'API Key 缺少调用权限':response.status===401?'API Key 无效':response.status===403?'当前 Key 没有该声音服务权限':response.status===410?'服务商已停止提供此接口':response.status===402?'声音服务余额或套餐不足':response.status===429?'声音服务请求受限':'声音服务返回 '+response.status)+(typeof detail==='string'?'：'+detail:''));e.definitive=response.status>=400&&response.status<500&&response.status!==408;throw e;}
export function normalizeAlignment(value){if(!value)return null;const c=value.characters,s=value.character_start_times_seconds,e=value.character_end_times_seconds;if(!Array.isArray(c)||!Array.isArray(s)||!Array.isArray(e)||c.length>12000||c.length!==s.length||c.length!==e.length)return null;let last=0;for(let i=0;i<c.length;i++){if(typeof c[i]!=='string'||!Number.isFinite(s[i])||!Number.isFinite(e[i])||s[i]<last||e[i]<s[i]||e[i]>600)return null;last=s[i];}return {characters:c,starts:s,ends:e};}
export class AudioGenerationService {
 constructor({service,getConfig,fetcher=fetch}){Object.assign(this,{service,getConfig,fetcher});this.dir=path.join(service.dataRoot,'audio-generations');this.jobs=new Map();this.listeners=new Set();this.queue=Promise.resolve();this.work=new Map();this.closed=false;}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 public(job){const {hash,inputHash,...result}=job;return {...result,...(job.error?{failure:mediaFailure(job.errorCode,job.error)}:{}),videoId:jobVideoId(job),taskId:'audio:'+job.id};}
 list(projectId){return [...this.jobs.values()].filter(j=>j.projectId===projectId).map(j=>this.public(j));}
 get(projectId,id){const job=this.jobs.get(id);if(!job||job.projectId!==projectId)throw Error('声音任务不存在');return job;}
 async capabilities(input={}){return audioCapabilities(publicSettings(await this.getConfig()),input);}
 async configuration(){const c=publicSettings(await this.getConfig());return {capabilities:configurationCapabilities('audio',c),musicProvider:c.musicProvider,minimaxConfigured:c.minimaxConfigured,minimaxSpeechModel:c.minimaxSpeechModel,minimaxVoiceId:c.minimaxVoiceId,minimaxMusicModel:c.minimaxMusicModel,minimaxMusicAccess:'仅历史付费账户；不支持精确时长，按实际时长剪辑',speechProvider:c.speechProvider,elevenlabsConfigured:c.elevenlabsConfigured,mimoConfigured:c.mimoConfigured,elevenlabsSpeechModel:c.elevenlabsSpeechModel,elevenlabsVoiceId:c.elevenlabsVoiceId,mimoVoice:c.mimoVoice,recentFailures:[...this.jobs.values()].filter(j=>j.status==='failed'&&![...this.jobs.values()].some(ok=>ok.status==='succeeded'&&ok.provider===j.provider&&ok.kind===j.kind&&ok.model===j.model&&(ok.created||'')>(j.created||''))).sort((a,b)=>(a.created||'').localeCompare(b.created||'')).slice(-4).map(j=>({kind:j.kind,provider:j.provider,created:j.created,...mediaFailure(j.errorCode,j.error)}))};}
 async persist(job){job.videoId=jobVideoId(job);job.updated=new Date().toISOString();const dest=path.join(this.dir,job.id+'.json');await fs.writeFile(dest+'.tmp',JSON.stringify(job,null,2),{mode:0o600});await fs.rename(dest+'.tmp',dest);for(const fn of this.listeners){try{fn(this.public(job));}catch{}}}
 async init(){await fs.mkdir(this.dir,{recursive:true});this.recoveryDiagnostics=[];for(const file of await fs.readdir(this.dir)){if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;let j;try{j=await readStoredRecord(path.join(this.dir,file),{label:'声音任务',validate:j=>validStoredTask(j,file.slice(0,-5))&&validJobVideo(j)});}catch(error){if(!(error instanceof CorruptRecordError))throw error;this.recoveryDiagnostics.push(error.diagnostic);continue;}this.jobs.set(j.id,j);if(['running','saving'].includes(j.status)){try{await fs.access(path.join(this.dir,j.id+'.'+j.extension));await this.ingest(j);}catch(error){if(isStorageFailure(error))throw error;j.status='unknown';j.error='上次请求结果未确认，未重复提交';await this.persist(j);}}}}
 create(projectId,input){const target=captureJobVideo(this.service,projectId,input);const task=this.queue.then(()=>withJobVideo(this.service,target,()=>this.start(projectId,input)));this.queue=task.catch(()=>{});return task;}
 async start(projectId,input){
  if(this.closed)throw Error('声音服务已停止');
  if(!input||!/^[a-f0-9-]{36}$/.test(input.requestId)||!kinds.includes(input.kind))throw Error('声音生成参数无效');
  const request={...(input.model?{model:input.model}:{}),kind:input.kind,text:text(input.text,3000,'配音文案'),prompt:text(input.prompt,2000,'声音描述'),voiceId:text(input.voiceId,160,'音色'),referenceFile:text(input.referenceFile,100,'参考声音'),provider:text(input.provider,30,'服务商'),duration:input.duration??null,languageCode:input.languageCode||(/[\u3400-\u9fff]/.test(input.text||'')?'zh':null),speed:input.speed??1};
  if(request.languageCode!==null&&!/^[a-z]{2}$/.test(request.languageCode))throw Error('配音语言代码无效');if(!Number.isFinite(request.speed)||request.speed<AUDIO_SPEED.min||request.speed>AUDIO_SPEED.max)throw Error('语速需为 0.7–1.2');
  if(['speech','voice-design','voice-clone'].includes(request.kind)&&!request.text)throw Error('请填写配音文案');
  if(['music','sound','voice-design'].includes(request.kind)&&!request.prompt)throw Error('请填写声音描述');
  if(AUDIO_DURATION[request.kind]){const {min,max}=AUDIO_DURATION[request.kind];if(!Number.isFinite(request.duration)||request.duration<min||request.duration>max)throw Error(`生成时长需为 ${min}–${max} 秒`);}
  const inputHash=crypto.createHash('sha256').update(JSON.stringify({projectId,...request})).digest('hex');
  const prior=this.jobs.get(input.requestId);if(prior){if(prior.projectId!==projectId||jobVideoId(prior)!==jobVideoId(captureJobVideo(this.service,projectId))||prior.inputHash!==inputHash)throw Error('任务 ID 已用于其他声音请求');return this.public(prior);}
  const p=await this.service.get(projectId),env=await this.getConfig();
  const selection=resolveAudioSelection(publicSettings(env),request),provider=selection.provider;
  if(!selection.supported)throw Error('所选服务不支持该声音任务');
  if(request.kind==='voice-change'&&provider!=='elevenlabs')throw Error('更换音色请选择 ElevenLabs');
  if(request.kind==='voice-change'&&(request.prompt||request.speed!==1||request.duration!==null))throw Error('更换音色保留原声音的表达与节奏，不接受声音描述、变速或指定时长');
  if(provider==='minimax'&&!['speech','music'].includes(request.kind))throw Error('MiniMax 目前接入配音和配乐，音效请选择 ElevenLabs');
  const key=provider==='minimax'?env.MINIMAX_API_KEY:provider==='elevenlabs'?env.ELEVENLABS_API_KEY:env.MIMO_API_KEY;if(!key)throw Error('请在模型设置中填写 '+(provider==='minimax'?'MiniMax':provider==='elevenlabs'?'ElevenLabs':'小米 MiMo')+' API Key');
  if(input.model&&(typeof input.model!=='string'||input.model.length>160||!/^[-a-zA-Z0-9_.]+$/.test(input.model)))throw Error('声音模型无效');
  const model=selection.storedModelId;
  const voiceId=request.voiceId||(provider==='minimax'?(env.MINIMAX_VOICE_ID||'male-qn-qingse'):provider==='elevenlabs'?env.ELEVENLABS_VOICE_ID||'EXAVITQu4vr4xnSDxMaL':env.MIMO_VOICE||'mimo_default');
  if(provider==='elevenlabs'&&!/^[a-zA-Z0-9_-]{1,160}$/.test(voiceId))throw Error('音色 ID 无效');
  if(provider==='minimax'&&request.kind==='speech'&&(!voiceId||voiceId.length>160||/[\r\n]/.test(voiceId)))throw Error('MiniMax 音色 ID 无效');
  if(provider==='mimo'&&request.kind==='speech'&&!['mimo_default','冰糖','茉莉','苏打','白桦','Mia','Chloe','Milo','Dean'].includes(voiceId))throw Error('MiMo 预置音色无效');
  // Never silently reinterpret a delivery instruction as spoken narration.
  if(provider==='elevenlabs'&&request.kind==='speech'&&request.prompt)throw Error('ElevenLabs 请在文案中使用所选模型支持的情绪标签，或选 MiMo 使用独立风格描述');
  let reference,sourceAsset;
  if(request.kind==='voice-change'){
   sourceAsset=p.assets.find(a=>a.filename===request.referenceFile&&a.kind==='audio');
   if(!sourceAsset||!['.wav','.mp3'].includes(path.extname(sourceAsset.filename))||['music','effect'].includes(sourceAsset.provenance?.audioRole))throw Error('请选择当前项目的 MP3 或 WAV 干声旁白，不要使用配乐、音效或混音成片');
   if(sourceAsset.duration>300)throw Error('更换音色的参考声音不能超过 5 分钟，请先取段');
   const sourcePath=await assetPath(this.service.dir(projectId),sourceAsset.filename);
   if((await fs.stat(sourcePath)).size>32e6)throw Error('参考声音不能超过 32 MB');
   reference=await fs.readFile(sourcePath);
  }
  if(request.kind==='voice-clone'){const asset=p.assets.find(a=>a.filename===request.referenceFile&&a.kind==='audio');if(!asset||!['.wav','.mp3'].includes(path.extname(asset.filename)))throw Error('请选择当前项目的 MP3 或 WAV 参考声音');const bytes=await fs.readFile(await assetPath(this.service.dir(projectId),asset.filename));if(bytes.length>7e6)throw Error('参考声音不能超过 7 MB');reference='data:audio/'+(asset.filename.endsWith('.wav')?'wav':'mpeg')+';base64,'+bytes.toString('base64');}
  const label=({'speech':'配音','music':'背景配乐','sound':'动作音效','voice-design':'音色设计','voice-clone':'同音色配音','voice-change':'更换音色'})[request.kind];
  const displayName=text(input.name,60,'素材名称')||(request.text?label+' · '+request.text.slice(0,16):label);
  const job={id:input.requestId,projectId,videoId:this.service.currentVideoId?.(projectId)||'v-default',inputHash,...request,name:displayName,provider,model,voiceId,extension:provider==='mimo'?'wav':'mp3',status:'running',created:new Date().toISOString(),...(sourceAsset?{sourceAssetId:sourceAsset.id,sourceDuration:sourceAsset.duration,alignmentSource:'transcription-required'}:{})};this.jobs.set(job.id,job);await this.persist(job);
  const work=withJobVideo(this.service,job,()=>this.execute(job,key,reference)).finally(()=>this.work.delete(job.id));this.work.set(job.id,work);work.catch(()=>{});return this.public(job);
 }
 execute(job,key,reference){return withJobVideo(this.service,job,()=>this.executeInVideo(job,key,reference));}
 async executeInVideo(job,key,reference){let received=false;try{
  let url,payload,headers={'content-type':'application/json'};
  if(job.provider==='minimax'){const cfg=minimaxConfig(await this.getConfig());url=cfg.baseUrl+(job.kind==='speech'?'/v1/t2a_v2':'/v1/music_generation');headers.Authorization='Bearer '+key;payload=minimaxAudioBody(job);}
  else if(job.provider==='elevenlabs'){
   headers['xi-api-key']=key;
   if(job.kind==='voice-change'){
    url=ELEVEN+'/speech-to-speech/'+encodeURIComponent(job.voiceId)+'?output_format=mp3_44100_128';
    delete headers['content-type'];
    payload=new FormData();payload.set('audio',new Blob([reference],{type:job.referenceFile.endsWith('.wav')?'audio/wav':'audio/mpeg'}),job.referenceFile);payload.set('model_id','eleven_multilingual_sts_v2');
   }
   else if(job.kind==='speech'){url=ELEVEN+'/text-to-speech/'+encodeURIComponent(job.voiceId)+'/with-timestamps?output_format=mp3_44100_128';payload={text:job.text,model_id:job.model,...(job.languageCode?{language_code:job.languageCode}:{}),voice_settings:{speed:job.speed??1}};}
   else if(job.kind==='music'){url=ELEVEN+'/music?output_format=mp3_44100_128';payload={prompt:job.prompt,music_length_ms:Math.round(job.duration*1000),model_id:job.model,force_instrumental:true};}
   else {url=ELEVEN+'/sound-generation?output_format=mp3_44100_128';payload={text:job.prompt,duration_seconds:job.duration,model_id:job.model};}
  }else{url=MIMO+'/chat/completions';headers.Authorization='Bearer '+key;payload={model:job.model,messages:[...(job.prompt?[{role:'user',content:job.prompt}]:[]),{role:'assistant',content:job.text}],audio:{format:'wav',...(job.kind==='voice-design'?{optimize_text_preview:false}:{voice:reference||job.voiceId})},stream:false};}
  const response=await checked(await this.fetcher(url,{method:'POST',headers,body:payload instanceof FormData?payload:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(240000)}));received=true;
  let bytes;
  if(job.provider==='minimax'){const data=JSON.parse((await readLimited(response,65e6)).toString('utf8'));bytes=minimaxAudioBytes(data);job.providerDuration=(data.extra_info?.audio_length||data.extra_info?.music_duration)/1000||null;if(job.kind==='speech'){job.alignmentSource='transcription-required';let evidence=minimaxSpeechEvidence(data.data);if(!evidence&&data.data?.subtitle_file){try{const r=await checked(await this.fetcher(validateMinimaxDownload(data.data.subtitle_file),{redirect:'error',signal:AbortSignal.timeout(20000)}));evidence=minimaxSpeechEvidence(JSON.parse((await readLimited(r,2e6)).toString()));}catch{job.alignmentWarning='字幕时序暂不可用，可对已生成的配音进行语音识别';}}if(evidence)Object.assign(job,evidence);}}
  else if(job.kind==='speech'||job.provider==='mimo'){const data=JSON.parse((await readLimited(response,48e6)).toString());const encoded=job.provider==='mimo'?data.choices?.[0]?.message?.audio?.data:data.audio_base64;if(typeof encoded!=='string'||!encoded.length||encoded.length>44e6||!/^[A-Za-z0-9+/=\s]+$/.test(encoded))throw Error('服务未返回有效声音');bytes=Buffer.from(encoded,'base64');job.alignment=normalizeAlignment(data.normalized_alignment||data.alignment);}
  else bytes=await readLimited(response,32e6);
  const dest=path.join(this.dir,job.id+'.'+job.extension);await fs.writeFile(dest+'.tmp',bytes,{mode:0o600});await fs.rename(dest+'.tmp',dest);job.status='saving';await this.persist(job);await this.ingest(job);
 }catch(e){job.status=e.definitive?'failed':received?'blocked':'unknown';job.error=clean(e,key);if(job.provider==='minimax'&&job.kind==='music'&&/停止提供此接口/.test(job.error)){job.errorCode='MUSIC_API_UNAVAILABLE';job.error='MiniMax Music 3.0 API 当前不可用（HTTP 410），请在默认服务中选择 ElevenLabs 配乐。';}await this.persist(job);}}
 ingest(job){return withJobVideo(this.service,job,()=>this.ingestInVideo(job));}
 async ingestInVideo(job){
  let file=path.join(this.dir,job.id+'.'+job.extension),extension=job.extension;
  const {stderr}=await run('ffmpeg',['-hide_banner','-i',file,'-af','volumedetect','-f','null','-'],{timeout:30000,maxBuffer:1e6});const peak=Number(stderr.match(/max_volume:\s*([\d.-]+) dB/)?.[1]);job.audioQuality={peakDb:Number.isFinite(peak)?peak:null,checked:true};if(/max_volume:\s*-inf/.test(stderr)||Number.isFinite(peak)&&peak< -60){job.status='failed';job.errorCode='SILENT_AUDIO';job.error='生成的声音接近静音，未加入素材。请调整声音描述后重新生成。';await this.persist(job);return;}
  if(job.kind==='voice-change'){
   const outputFile=path.join(this.dir,job.id+'.matched.wav');
   if(!job.voiceChange||!await fs.access(outputFile).then(()=>true,()=>false)){
    const sourceFile=await assetPath(this.service.dir(job.projectId),job.referenceFile);
    job.voiceChange={sourceAssetId:job.sourceAssetId,providerOutputFile:path.basename(file),processedFile:path.basename(outputFile),...await prepareVoiceChange({sourceFile,providerFile:file,outputFile})};
    await this.persist(job);
   }
   file=outputFile;extension='wav';job.audioQuality={peakDb:job.voiceChange.loudness.output.peakDb,truePeakDb:job.voiceChange.loudness.output.truePeakDb,checked:true};
  }
  let p=await this.service.get(job.projectId),asset=p.assets.find(a=>a.provenance?.taskId==='audio:'+job.id);
  if(!asset)asset=await importAsset(this.service.dir(job.projectId),await fs.readFile(file),(job.name||({'speech':'配音','music':'背景配乐','sound':'动作音效','voice-design':'音色设计','voice-clone':'同音色配音','voice-change':'更换音色'}[job.kind]))+'.'+extension,{videoId:jobVideoId(job),taskId:'audio:'+job.id,provider:job.provider,model:job.model,audioRole:['speech','voice-design','voice-clone','voice-change'].includes(job.kind)?'narration':job.kind==='music'?'music':'effect',text:job.text||undefined,voiceId:job.voiceId,...(job.kind==='voice-change'?{operation:'voice-change',alignmentSource:'transcription-required',sourceAssetId:job.sourceAssetId,voiceChange:job.voiceChange}:{}),inputAssetIds:p.assets.filter(a=>a.filename===job.referenceFile).map(a=>a.id)});
  job.assetFile=asset.filename;job.assetId=asset.id;job.actualDuration=asset.duration;job.status='succeeded';delete job.error;await this.persist(job);
 }
 async voices(provider='elevenlabs'){const env=await this.getConfig();if(provider==='minimax'){const cfg=minimaxConfig(env);try{const r=await checked(await this.fetcher(cfg.baseUrl+'/v1/get_voice',{method:'POST',headers:{Authorization:'Bearer '+cfg.key,'content-type':'application/json'},body:JSON.stringify({voice_type:'all'}),redirect:'error',signal:AbortSignal.timeout(20000)}));const data=minimaxResult(JSON.parse((await readLimited(r,4e6)).toString()));return [...(data.system_voice||[]),...(data.voice_cloning||[]),...(data.voice_generation||[])].slice(0,300).map(v=>({id:v.voice_id,name:v.voice_name||v.voice_id,language:null,languages:[]}));}catch(e){throw Error(clean(e,cfg.key));}}if(!env.ELEVENLABS_API_KEY)throw Error('请先保存 ElevenLabs API Key');try{const r=await checked(await this.fetcher(ELEVEN+'/voices',{headers:{'xi-api-key':env.ELEVENLABS_API_KEY},redirect:'error',signal:AbortSignal.timeout(20000)}));const data=JSON.parse((await readLimited(r,4e6)).toString());return (data.voices||[]).slice(0,200).filter(v=>typeof v.voice_id==='string'&&typeof v.name==='string').map(v=>({id:v.voice_id,name:v.name.slice(0,100),language:v.labels?.language||null,accent:v.labels?.accent||null,gender:v.labels?.gender||null,verifiedLanguages:(v.verified_languages||[]).map(l=>({language:l.language,model:l.model_id})),languages:[...new Set([v.labels?.language,...(v.verified_languages||[]).map(l=>l.language)].filter(Boolean))],previewUrl:v.verified_languages?.find(l=>l.language==='zh')?.preview_url||v.preview_url||null}));}catch(e){throw Error(clean(e,env.ELEVENLABS_API_KEY));}}
 async close(){this.closed=true;await Promise.allSettled(this.work.values());}
}
