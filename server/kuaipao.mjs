import {promises as fs} from 'node:fs';
import path from 'node:path';
import {imageExtension} from './musk.mjs';

// GPT Image 2.5 is served by the image gateway's v1 API, not the main site or v2.
export const KUAIPAO_BASE='https://image.kuaipao.pro/v1';
export const KUAIPAO_MODELS=['gpt-image-2.5-1k','gpt-image-2.5-2k','gpt-image-2.5-4k'];
export const KUAIPAO_MODEL=KUAIPAO_MODELS[1];
export const KUAIPAO_SIZES={
 '1k':{'1440x2560':'720x1280','2560x1440':'1280x720','2048x2048':'1024x1024','2368x1776':'1152x864','1776x2368':'864x1152'},
 '2k':{'1440x2560':'1440x2560','2560x1440':'2560x1440','2048x2048':'2048x2048','2368x1776':'2368x1776','1776x2368':'1776x2368'},
 '4k':{'1440x2560':'2160x3840','2560x1440':'3840x2160','2048x2048':'2880x2880','2368x1776':'3328x2496','1776x2368':'2496x3328'},
};
export function kuaipaoConfig(env){
 if(!env.KUAIPAO_API_KEY)throw Error('请在模型设置中填写快跑 API Key');
 const model=env.KUAIPAO_IMAGE_MODEL||KUAIPAO_MODEL;
 if(!KUAIPAO_MODELS.includes(model))throw Error('请选择快跑 GPT Image 2.5 模型');
 return {key:env.KUAIPAO_API_KEY,model};
}
export function kuaipaoSizes(model){return KUAIPAO_SIZES[model.split('-').at(-1)];}
export async function kuaipaoImageRequest(values,config,files=[]){
 const size=kuaipaoSizes(config.model)?.[values.size];if(!size)throw Error('不支持的图片尺寸');
 if(files.length>4)throw Error('最多使用 4 张参考图');
 // Explicit dimensions avoid the gateway's small "auto" fallback even on 4K models.
 const params={model:config.model,prompt:values.prompt,size,quality:values.quality==='premium'?'high':'auto',n:1,response_format:'url'};
 if(!files.length)return {route:'/images/generations',body:JSON.stringify(params),headers:{'content-type':'application/json'},size,quality:params.quality};
 const form=new FormData();for(const [key,value]of Object.entries(params))form.set(key,String(value));
 for(const file of files){
  const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(file).toLowerCase()];
  if(!mime)throw Error('参考图请使用 PNG、JPG 或 WebP');
  const bytes=await fs.readFile(file);if(bytes.length>12e6)throw Error('参考图不能超过 12 MB');
  form.append('image',new Blob([bytes],{type:mime}),path.basename(file));
 }
 return {route:'/images/edits',body:form,headers:{},size,quality:params.quality};
}
const clean=(text,key)=>String(text||'快跑图片生成失败').replaceAll(key||'\0','[已隐藏]').replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);
async function limitedBytes(response,limit){
 if(Number(response.headers.get('content-length'))>limit)throw Error('图片结果超过大小限制');
 const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>limit)throw Error('图片结果超过大小限制');parts.push(part);}return Buffer.concat(parts);
}
export function validateKuaipaoDownload(raw){
 const u=new URL(raw),allowed=['image.kuaipao.pro','apac.ossforai.com'];
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!allowed.includes(u.hostname))throw Error('图片下载地址不在已验证的服务域名内');
 return u.href;
}
export async function requestKuaipaoImage(request,config,fetcher=fetch){
 if(!['/images/generations','/images/edits'].includes(request.route))throw Error('快跑图像接口无效');
 const response=await fetcher(KUAIPAO_BASE+request.route,{method:'POST',headers:{Authorization:'Bearer '+config.key,...request.headers},body:request.body,redirect:'error',signal:AbortSignal.timeout(600000)});
 let data;try{data=JSON.parse((await limitedBytes(response,18e6)).toString('utf8'));}catch{
  const error=Error(`快跑图片请求失败（${response.status}）`);error.code=String(response.status);error.definitive=response.status>=400&&response.status<500&&response.status!==408;throw error;
 }
 if(!response.ok||data.error){const error=Error(clean(data.error?.message||data.message||`快跑图片请求失败（${response.status}）`,config.key));error.code=String(data.error?.code||response.status);error.definitive=response.ok||response.status>=400&&response.status<500&&response.status!==408;throw error;}
 const item=data.data?.find(item=>item.url||item.b64_json);
 if(item?.url)return {url:validateKuaipaoDownload(item.url)};
 if(typeof item?.b64_json==='string'&&item.b64_json.length&&item.b64_json.length<=16e6){const bytes=Buffer.from(item.b64_json,'base64');return {bytes,extension:imageExtension(bytes)};}
 const error=Error('快跑未返回可读取的图片结果');error.received=true;throw error;
}
export async function downloadKuaipaoImage(raw,fetcher=fetch){
 const response=await fetcher(validateKuaipaoDownload(raw),{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok){const error=Error('生成图片下载失败，可恢复下载');error.code=String(response.status);throw error;}
 const bytes=await limitedBytes(response,12e6);if(!bytes.length)throw Error('生成图片为空');
 return {bytes,extension:imageExtension(bytes)};
}
