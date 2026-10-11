import {createRequire} from 'node:module';

// The UI keeps every original rendered frame. The model receives a bounded
// view of that evidence, not 24 full-resolution PNGs in every later request.
// DSH still owns durable attachments, history offload and request projection.
// Resolve the same Sharp installation as the native attachment service; using
// the video engine's second libvips copy in this process can crash on macOS.
const require=createRequire(import.meta.url);
const MODEL_IMAGE_COUNT=4,MODEL_IMAGE_BYTES=1024*1024;
const FRAME_IMAGE_BYTES=192*1024,SHEET_IMAGE_BYTES=256*1024,DETAIL_IMAGE_BYTES=384*1024;
let sharp;
const evenlySpaced=(items,count)=>count>=items.length?items:count===1?[items[Math.floor((items.length-1)/2)]]:Array.from({length:count},(_,i)=>items[Math.round(i*(items.length-1)/(count-1))]);
export async function assertPreviewImages(ctx,exec){
 const attachments=ctx.get('attachments'),llm=ctx.get('llm');
 if(!attachments)throw Error('预览图片需要原生附件服务');
 const routed=exec.agent.session.requestHeader()?.config;
 const provider=routed?.provider??exec.agent.options?.provider,modelId=routed?.model??exec.agent.options?.model;
 if(!llm||!provider||!modelId)throw Error('无法确定当前模型的图片能力');
 const model=await llm.resolveModelInfo(provider,modelId,exec.signal);
 if(!Array.isArray(model?.inputModalities))throw Error('当前模型能力信息不完整，无法确认图片输入；请检查原生模型能力设置');
 if(!model.inputModalities.includes('image'))throw Error('当前模型不支持图片；请在原生模型选择中选择支持图片的模型后查看预览');
 return attachments;
}

export async function preparePreviewRequest(ctx,exec,args){
 await assertPreviewImages(ctx,exec);
 const request={...args};
 // Rendering and admission are separate: even a one-image deployment can
 // inspect an overview sheet while the user opens all original frames.
 const frameLimit=24;
 const exact=request.frames||request.times;
 if(exact&&new Set(exact).size>frameLimit)throw Error('本次明确指定了 '+new Set(exact).size+' 帧，一次最多渲染 24 帧，请分批查看');
 request.maxFrames=Math.min(request.maxFrames??(exact?new Set(exact).size:12),frameLimit);
 return request;
}

async function modelImage(item,{maxBytes,longEdge},limits){
 const {mimeType,mediaType=mimeType,data}=item.image;
 if(!limits.mediaTypes.includes(mediaType)||typeof data!=='string'||!data.length||data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('预览图片编码无效');
 if(data.length>Math.ceil(limits.maxImageBytes/3)*4)throw Error('预览图片超过原生附件大小限制');
 const bytes=Buffer.from(data,'base64');if(bytes.toString('base64')!==data)throw Error('预览图片编码无效');if(bytes.length>limits.maxImageBytes)throw Error('预览图片超过原生附件大小限制');
 sharp||=require('sharp');
 const metadata=await sharp(bytes).metadata();
 if(!metadata.width||!metadata.height)throw Error('预览图片没有有效尺寸');
 // Keep already-small images byte-identical. A targeted one-frame request
 // retains enough resolution to judge screenshot text and title boundaries.
 if(bytes.length<=maxBytes&&Math.max(metadata.width,metadata.height)<=longEdge)return {data:bytes,mediaType,width:metadata.width,height:metadata.height};
 for(const edge of [longEdge,Math.round(longEdge*.8),Math.round(longEdge*.6)]){
  for(const quality of [84,72,60]){
   const output=await sharp(bytes).rotate().resize({width:edge,height:edge,fit:'inside',withoutEnlargement:true}).flatten({background:'#171615'}).jpeg({quality,mozjpeg:true}).toBuffer({resolveWithObject:true});
   if(output.data.length<=maxBytes)return {data:output.data,mediaType:'image/jpeg',width:output.info.width,height:output.info.height};
  }
 }
 throw Error('预览缩略图无法在当前消息大小内保持可读，请一次只检查 1–2 个具体时间点');
}

export async function preparePreviewImages(ctx,result,exec){
 if(result.status==='unknown')return {preview:result,images:[]};
 const store=ctx.get('attachments'),limits=store.imageLimits;
 const frames=(result.frames||[]).filter(item=>item?.image),sheet=(result.contactSheet||result.grid)?.image?(result.contactSheet||result.grid):null;
 if(!frames.length&&!sheet)throw Error('预览没有返回真实图片，不能据文件路径声称已检查画面');
 const count=Math.min(MODEL_IMAGE_COUNT,limits.maxImagesPerMessage),budget=Math.min(MODEL_IMAGE_BYTES,limits.maxMessageImageBytes);
 const selected=evenlySpaced(frames,Math.max(0,count-(sheet?1:0))),candidates=[...(sheet?[{item:sheet,kind:'contact-sheet'}]:[]),...selected.map(item=>({item,kind:'frame'}))];
 const inputs=[],modelImageOrder=[];let total=0;
 for(const {item,kind} of candidates){
  exec.signal?.throwIfAborted();
  const detailed=frames.length===1&&!sheet,maxBytes=Math.min(detailed?DETAIL_IMAGE_BYTES:kind==='contact-sheet'?SHEET_IMAGE_BYTES:FRAME_IMAGE_BYTES,Math.floor(budget/candidates.length),limits.maxImageBytes);
  const input=await modelImage(item,{maxBytes,longEdge:detailed?2048:kind==='contact-sheet'?1600:1280},limits);
  total+=input.data.length;
  if(total>budget)throw Error('预览图片超过受控消息大小，请减少选帧');
  inputs.push({...input,name:item.name||'预览画面 '+(item.timecode??item.time??item.at??inputs.length)});
  modelImageOrder.push({image:inputs.length,kind,...(kind==='frame'?{frame:item.frame,time:item.time??item.at,timecode:item.timecode}:{}),width:input.width,height:input.height});
 }
 exec.signal?.throwIfAborted();
 const images=await store.saveImages(inputs);
 exec.signal?.throwIfAborted();
 const preview=JSON.parse(JSON.stringify(result,(key,value)=>key==='image'?undefined:value));
 const remaining=frames.filter(item=>!selected.includes(item)).map(item=>({frame:item.frame,time:item.time??item.at,timecode:item.timecode}));
 const modelView=JSON.parse(JSON.stringify({imageOrder:modelImageOrder,frameCount:frames.length,framesNotSentIndividually:remaining,encodedBytes:total,instruction:remaining.length?'模型收到全局拼图（如有）及部分缩略图；不能据此声称逐帧检查全部细节。字幕、边距、人脸和转场疑点使用 preview_frames，times 传 1–2 个具体秒数并设 grid:false；用户仍可打开本次所有原始帧。':'本次所选画面已作为图片提供；仍是静帧抽样，不能据此判断运动过程或声音。'}));
 return {preview:{...preview,evidenceMode:'rendered-frames',modelReadableImages:images.length,modelView},images};
}

export const previewImageOutput={
 schema:{type:'object',additionalProperties:true},
 // Native presentation metadata stays in the durable log for Frame's UI,
 // but is never serialized into a provider request. Keep every original URL
 // and exact range reference there, rather than trimming user inspection.
 presentationMeta:(_args,value)=>({preview:value.preview}),
 render:(_args,value)=>{
  const p=value.preview;
  const summary=p.status==='unknown'?p:{previewId:p.previewId||p.id,projectId:p.projectId,videoId:p.videoId,revision:p.revision,nativeRevision:p.nativeRevision,source:p.source,jobId:p.jobId,frameRate:p.frameRate,sampled:p.sampled,evidenceMode:p.evidenceMode,modelReadableImages:p.modelReadableImages,modelView:p.modelView,
   frames:(p.frames||[]).map(frame=>({frame:frame.frame,time:frame.time??frame.at,timecode:frame.timecode})),
   ...(p.sample?{sample:{url:p.sample.url,start:p.sample.start,duration:p.sample.duration,silent:p.sample.silent}}:{}),warnings:p.warnings||[]};
  return [{type:'text',text:JSON.stringify(summary)},...value.images.map(attachment=>({type:'image',attachment}))];
 },
};
