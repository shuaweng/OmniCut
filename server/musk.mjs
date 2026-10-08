import {promises as fs} from 'node:fs';
import path from 'node:path';

export const MUSK_BASE='https://api.muskapi.cc/v1';
export const MUSK_IMAGE_MODEL='gpt-image-2.5-sunburst';
// Keep Frame's five composition ratios while avoiding unnecessarily large images.
export const MUSK_SIZES={'1440x2560':'1152x2048','2560x1440':'2048x1152','2048x2048':'1536x1536','2368x1776':'1536x1152','1776x2368':'1152x1536'};
export function muskConfig(env){
 if(!env.MUSK_API_KEY)throw Error('请在模型设置中填写 Musk API Key');
 const model=env.MUSK_IMAGE_MODEL||MUSK_IMAGE_MODEL;
 if(model!==MUSK_IMAGE_MODEL)throw Error('Musk 图像模型配置无效');
 return {key:env.MUSK_API_KEY,model};
}
export async function muskImageRequest(values,config,files=[]){
 const size=MUSK_SIZES[values.size];if(!size)throw Error('不支持的图片尺寸');
 if(files.length>4)throw Error('最多使用 4 张参考图');
 const params={model:config.model,prompt:values.prompt,size,quality:values.quality==='premium'?'high':'medium',n:1,response_format:'b64_json'};
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
const clean=(text,key)=>String(text||'Musk 图片生成失败').replaceAll(key||'\0','[已隐藏]').replace(/https?:\/\/[^\s"<>]+/g,'[服务地址]').slice(0,350);
async function limitedBytes(response,limit){
 if(Number(response.headers.get('content-length'))>limit)throw Error('图片结果超过大小限制');
 const parts=[];let size=0;for await(const part of response.body){size+=part.length;if(size>limit)throw Error('图片结果超过大小限制');parts.push(part);}return Buffer.concat(parts);
}
export function validateMuskDownload(raw){
 const u=new URL(raw),allowed=['muskapi.cc','blob.core.windows.net'];
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!allowed.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))throw Error('图片下载地址不在已验证的服务域名内');
 return u.href;
}
export function imageExtension(bytes){
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return '.jpg';
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return '.webp';
 throw Error('服务未返回可读取的图片');
}
export async function generateMuskImage(request,config,fetcher=fetch){
 const response=await fetcher(MUSK_BASE+request.route,{method:'POST',headers:{Authorization:'Bearer '+config.key,...request.headers},body:request.body,redirect:'error',signal:AbortSignal.timeout(600000)});
 let data;try{data=JSON.parse((await limitedBytes(response,18e6)).toString('utf8'));}catch(e){if(!response.ok){e.definitive=response.status>=400&&response.status<500&&response.status!==408;e.code=String(response.status);}throw e;}
 if(!response.ok||data.error){
  const error=Error(clean(data.error?.message||data.message||`Musk 图片请求失败（${response.status}）`,config.key));
  error.code=String(data.error?.code||response.status);error.definitive=response.ok||response.status>=400&&response.status<500&&response.status!==408;throw error;
 }
 try{
  const item=data.data?.find(item=>item.b64_json||item.url);let bytes;
  if(item?.b64_json){if(typeof item.b64_json!=='string'||item.b64_json.length>16e6)throw Error('生成图片超过 12 MB');bytes=Buffer.from(item.b64_json,'base64');}
  else if(item?.url){const result=await fetcher(validateMuskDownload(item.url),{redirect:'error',signal:AbortSignal.timeout(120000)});if(!result.ok)throw Error('生成图片下载失败');bytes=await limitedBytes(result,12e6);}
  else throw Error('服务未返回图片结果');
  if(!bytes.length||bytes.length>12e6)throw Error('图片结果为空或超过 12 MB');
  return {bytes,extension:imageExtension(bytes)};
 }catch(e){e.received=true;throw e;}
}
