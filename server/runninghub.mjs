import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {run} from './project.mjs';

export const RUNNINGHUB_BASE='https://www.runninghub.cn';
export const RUNNINGHUB_VIDEO_MODEL='minimax-h3-rh-enhanced';
export const RUNNINGHUB_IMAGE_MODEL='seedream-v5-pro';
export const RUNNINGHUB_VIDEO_RESOLUTIONS=['480p','768p','1080p'];
export function runninghubConfig(env,kind='video'){
 if(!env.RUNNINGHUB_API_KEY)throw Error('请在模型设置中填写 RunningHub API Key');
 const model=kind==='image'?env.RUNNINGHUB_IMAGE_MODEL||RUNNINGHUB_IMAGE_MODEL:env.RUNNINGHUB_VIDEO_MODEL||RUNNINGHUB_VIDEO_MODEL;
 if(model!==(kind==='image'?RUNNINGHUB_IMAGE_MODEL:RUNNINGHUB_VIDEO_MODEL))throw Error('RunningHub 模型配置无效');
 return {provider:'runninghub',key:env.RUNNINGHUB_API_KEY,model,baseUrl:RUNNINGHUB_BASE};
}
const clean=(text,key)=>String(text||'RunningHub 请求失败').replaceAll(key||'\0','[已隐藏]').replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);
export async function runninghubRequest(config,route,body,fetcher=fetch){
 if(config.baseUrl!==RUNNINGHUB_BASE||!route.startsWith('/openapi/v2/'))throw Error('RunningHub 接口地址无效');
 const multipart=body instanceof FormData;
 const response=await fetcher(RUNNINGHUB_BASE+route,{method:'POST',headers:{Authorization:'Bearer '+config.key,...(multipart?{}:{'content-type':'application/json'})},body:multipart?body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(multipart?120000:60000)});
 let data;try{data=await response.json();}catch{throw Error('RunningHub 返回了无法解析的结果');}
 // A failed remote task is still a valid query result, not a polling failure.
 const terminal=data.status==='FAILED'&&data.taskId;
 const code=data.errorCode||(data.code!==undefined&&data.code!==0?data.code:'');
 if(!response.ok||code&&!terminal){
  const error=Error(clean(data.errorMessage||data.message||data.msg||`RunningHub 请求失败（${response.status}）`,config.key));
  error.providerCode=String(code||response.status);error.code=error.providerCode;
  error.definitive=response.status>=400&&response.status<500&&response.status!==408||response.ok&&Boolean(code)&&!['500','1000','1005','1006','1010','1011','1012','1504'].includes(String(code));
  throw error;
 }
 return data;
}
export function validateRunninghubDownload(raw){
 const u=new URL(raw),official=['runninghub.cn','runninghub.ai'];
 const cdn=/^[a-z0-9-]+-1252422369\.cos\.[a-z0-9-]+\.myqcloud\.com$/.test(u.hostname)||u.hostname==='rh-images.xiaoyaoyou.com';
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!(cdn||official.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))))throw Error('RunningHub 返回的素材地址不在已验证的服务域名内');
 return u.href;
}
export async function downloadRunninghub(raw,fetcher=fetch,maxBytes=80e6){
 const r=await fetcher(validateRunninghubDownload(raw),{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error('生成素材下载失败，可恢复查询');
 if(Number(r.headers.get('content-length'))>maxBytes)throw Error('生成素材超过大小限制');
 const parts=[];let size=0;for await(const b of r.body){size+=b.length;if(size>maxBytes)throw Error('生成素材超过大小限制');parts.push(b);}
 if(!size)throw Error('生成素材为空');return Buffer.concat(parts);
}
export function runninghubTask(data,kind){
 const status={QUEUED:'queued',RUNNING:'running',SUCCESS:'succeeded',FAILED:'failed'}[data.status];
 if(!status)throw Error('RunningHub 返回未知任务状态');
 const valid=kind==='image'?/^(jpg|jpeg|png|webp|image)$/i:/^(mp4|mov|webm|video)$/i;
 const outputs=Array.isArray(data.results)?data.results:[];
 const item=outputs.find(r=>r.url&&(valid.test(r.outputType||'')||valid.test(String(r.url).split('?')[0].split('.').at(-1))));
 return {status,content:{video_url:item?.url},url:item?.url,usage:data.usage,error:{code:data.errorCode,message:data.errorMessage}};
}
export function runninghubImageBody(values,imageUrls=[]){
 if(values.prompt.length<5)throw Error('请用至少 5 个字描述画面');
 const [width,height]=values.size.split('x').map(Number);
 // The resolution field overrides width/height. Omit it to preserve the film's ratio.
 return {route:'/openapi/v2/seedream-v5-pro/'+(imageUrls.length?'image-to-image':'text-to-image'),body:{prompt:values.prompt,width,height,outputFormat:'jpeg',...(imageUrls.length?{imageUrls}:{})}};
}
export function runninghubVideoBody(values,content){
 const resolution=(values.resolution||'768p').toLowerCase();
 if(!RUNNINGHUB_VIDEO_RESOLUTIONS.includes(resolution))throw Error('H3 RH Enhanced 支持 480p、768p、1080p');
 if(!['9:16','16:9','1:1','4:3','3:4','21:9'].includes(values.ratio))throw Error('H3 RH Enhanced 需要明确的画面比例');
 const first=content.filter(c=>c.role==='first_frame'),last=content.filter(c=>c.role==='last_frame');
 const images=content.filter(c=>c.role==='reference_image'),videos=content.filter(c=>c.role==='reference_video'),audios=content.filter(c=>c.role==='reference_audio'),driving=content.filter(c=>c.role==='driving_audio');
 if(first.length>1||last.length>1||images.length>9||videos.length>3||audios.length>3||driving.length>1)throw Error('H3 RH Enhanced 参考素材数量超出限制');
 if((first.length||last.length)&&(images.length||videos.length))throw Error('首尾帧和多参考画面需分开使用');
 const audioMode=values.audioMode||(audios.length?'reference_only':'native');
 if(!['native','reference_only','lock_source','remix_source'].includes(audioMode))throw Error('视频声音模式无效');
 if(['lock_source','remix_source'].includes(audioMode)&&!driving.length)throw Error('锁定或改编音轨需要指定驱动音频');
 const mode=first.length||last.length?'i2va':images.length||videos.length||audios.length?'ref2va':'t2va';
 // Official docs still show node IDs. The live API (2026-10-08) requires these aliases.
 const body={prompt:values.prompt,aspectRatio:values.ratio,resolution,duration:values.duration,audioMode};
 if(first.length)body.firstFrameUrl=first[0].image_url.url;
 if(last.length)body.lastFrameUrl=last[0].image_url.url;
 images.forEach((c,i)=>body['refImage'+(i+1)]=c.image_url.url);
 videos.forEach((c,i)=>body['refVideo'+(i+1)]=c.video_url.url);
 audios.forEach((c,i)=>body['refAudio'+(i+1)]=c.audio_url.url);
 if(driving.length)body.driveAudio=driving[0].audio_url.url;
 return {route:'/openapi/v2/rhart-video/minimax-h3-rh-enhanced/'+mode,body};
}
export async function uploadRunninghub(file,config,fetcher=fetch){
 let source=file,temporary;const ext=path.extname(file).toLowerCase();
 // The model accepts PNG/JPG, MP4 and WAV/MP3; keep uploads in those formats.
 const target=['.webp','.avif','.gif','.jpeg'].includes(ext)?'.png':['.mov','.webm'].includes(ext)?'.mp4':['.m4a','.ogg','.flac'].includes(ext)?'.wav':ext;
 try{
  if(target!==ext){temporary=await fs.mkdtemp(path.join(os.tmpdir(),'frame-rh-upload-'));source=path.join(temporary,'reference'+target);await run('ffmpeg',['-v','error','-i',file,...(target==='.png'?['-frames:v','1']:target==='.mp4'?['-c:v','libx264','-crf','20','-c:a','aac','-movflags','+faststart']:['-c:a','pcm_s16le']),'-y',source],{timeout:60000,maxBuffer:1e6});}
  const st=await fs.stat(source);if(st.size>30e6)throw Error('参考素材超过 30 MB，请先裁剪或压缩');
  const mime={'.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav'}[target];if(!mime)throw Error('RunningHub 不支持此参考格式');
  const bytes=await fs.readFile(source),form=new FormData();form.append('file',new Blob([bytes],{type:mime}),'reference'+target);
  let data;
  try{data=await runninghubRequest(config,'/openapi/v2/media/upload/binary',form,fetcher);}
  catch(error){
   // Shared keys can work on model APIs while the separate upload service rejects
   // them. Official model APIs also accept data URIs; never switch providers.
   if(/API Key不存在|ApiKey verification failed/i.test(error.message)){
    if(bytes.length<=5*1024*1024)return `data:${mime};base64,${bytes.toString('base64')}`;
    temporary??=await fs.mkdtemp(path.join(os.tmpdir(),'frame-rh-upload-'));
    const kind=mime.split('/')[0],suffix=kind==='image'?'.jpg':kind==='video'?'.mp4':'.mp3',small=path.join(temporary,'inline'+suffix);
    const scale='scale=w=min(1280\\,iw):h=min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2';
    const options=kind==='image'?['-frames:v','1','-vf','scale=w=min(2560\\,iw):h=min(2560\\,ih):force_original_aspect_ratio=decrease','-q:v','3']:kind==='video'?['-vf',scale,'-c:v','libx264','-crf','23','-maxrate','1800k','-bufsize','3600k','-c:a','aac','-b:a','96k','-movflags','+faststart']:['-c:a','libmp3lame','-b:a','192k'];
    await run('ffmpeg',['-v','error','-i',source,...options,'-y',small],{timeout:60000,maxBuffer:1e6});
    const compact=await fs.readFile(small);
    if(compact.length<=5*1024*1024)return `data:${kind}/${kind==='image'?'jpeg':kind==='video'?'mp4':'mpeg'};base64,${compact.toString('base64')}`;
    error.message='参考素材压缩后仍过大，请先裁剪到 15 秒以内';
   }
   throw error;
  }
  if(!data.data?.download_url)throw Error('RunningHub 未返回参考素材地址');return validateRunninghubDownload(data.data.download_url);
 }finally{if(temporary)await fs.rm(temporary,{recursive:true,force:true});}
}
