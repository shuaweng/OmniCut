/**
 * Execute authored browser programs in an opaque-origin frame. The Studio host
 * retains its normal editing APIs; the picture receives only its material and
 * a small playback protocol, never a fetch proxy or an application credential.
 */
export type PreviewBox = { xPx: number; yPx: number; widthPx: number; heightPx: number; stackOrder: number };
export type PreviewInteraction = { kind: "contextmenu" | "pointerdown"; frame: number; x: number; y: number };
type Reply = { id?: number; ready?: boolean; value?: boolean; error?: string; boxes?: Record<string, PreviewBox>; interaction?: PreviewInteraction };
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob: data:; font-src blob: data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const safeJson = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

// Serialized as trusted bootstrap source. Authored code has no parent-DOM
// access, and its own network requests are forbidden by the document CSP.
function previewBootstrap(hostOrigin: string, policy: string): void {
 const connect = (event: MessageEvent): void => {
  if(event.source!==parent||event.origin!==hostOrigin||event.data?.type!=='studio:preview-connect'||!event.ports[0])return;
  window.removeEventListener('message',connect);
  const port=event.ports[0];
  const resourceUrls: string[]=[];
  let currentFrame=0,displayedFrame=0,frameRate=30;
  const contextmenu=(event:MouseEvent):void=>{
   event.preventDefault();
   port.postMessage({interaction:{kind:'contextmenu',frame:displayedFrame,x:event.clientX,y:event.clientY}});
  };
  const boxes = (): Record<string, PreviewBox> => {
   const result: Record<string, PreviewBox>={};
   for(const present of Array.from(document.querySelectorAll<HTMLElement>('[data-hypit-present-id]')).slice(0,2000)){
    const id=present.dataset.hypitPresentId;if(!id)continue;
    const start=Number(present.dataset.start),duration=Number(present.dataset.duration);
    if(Number.isFinite(start)&&Number.isFinite(duration)&&(currentFrame<Math.round(start*frameRate)||currentFrame>=Math.round((start+duration)*frameRate)))continue;
    const drawn=present.querySelector('[data-hypit-element-id="'+CSS.escape(id+':frame')+'"]')||present.querySelector('[data-hypit-element-id]');
    if(!drawn)continue;
    let visible=true;
    for(let node: Element|null=drawn;node;node=node.parentElement){const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0){visible=false;break;}}
    if(!visible)continue;
    const box=drawn.getBoundingClientRect();if(!box.width&&!box.height)continue;
    result[id]={xPx:box.left,yPx:box.top,widthPx:box.width,heightPx:box.height,stackOrder:Number(getComputedStyle(present).zIndex)||0};
   }
   return result;
  };
  type Runtime=Window & {__hypitSeekFrame?:(frame:number)=>Promise<boolean>;__hypitPlayFrame?:(frame:number)=>Promise<boolean>;__hypitSetMuted?:(value:boolean)=>Promise<boolean>;__hypitFrameReady?:Promise<boolean>};
  const runtime=window as Runtime;
  port.onmessage=async ({data}):Promise<void>=>{
   const id=Number(data?.id);
   try{
    if(data?.method==='mount'){
     frameRate=Number.isFinite(data.frameRate)&&data.frameRate>0?data.frameRate:30;
     currentFrame=0;
     let html=String(data.html);
     for(const resource of data.resources||[]){
      if(typeof resource.url!=='string'||!(resource.blob instanceof Blob))throw Error('Invalid preview material');
      const url=URL.createObjectURL(resource.blob);resourceUrls.push(url);
      html=html.replaceAll(resource.url,url);
     }
     // CSP precedes every authored tag and survives removal of its DOM node.
     const meta='<meta http-equiv="Content-Security-Policy" content="'+policy+'">';
     html=/<head\b[^>]*>/i.test(html)?html.replace(/<head\b[^>]*>/i,match=>match+meta):meta+html;
     document.open();document.write(html);document.close();
     await document.fonts.ready;
     await runtime.__hypitFrameReady;
     displayedFrame=0;
     window.addEventListener('contextmenu',contextmenu,true);
     window.addEventListener('pointerdown',(event:PointerEvent)=>port.postMessage({interaction:{kind:'pointerdown',frame:displayedFrame,x:event.clientX,y:event.clientY}}),true);
     port.postMessage({id,ready:true,value:true,boxes:boxes()});
     return;
    }
    const frame=Number(data?.frame);
    if(Number.isFinite(frame))currentFrame=frame;
    let value=false;
    if(data?.method==='seek'&&Number.isFinite(frame))value=!!await runtime.__hypitSeekFrame?.(frame);
    else if(data?.method==='play'&&Number.isFinite(frame))value=!!await runtime.__hypitPlayFrame?.(frame);
    else if(data?.method==='mute')value=!!await runtime.__hypitSetMuted?.(!!data.muted);
    else throw Error('Unsupported preview operation');
    if(value&&Number.isFinite(frame))displayedFrame=frame;
    port.postMessage({id,value,boxes:boxes()});
   }catch(error){port.postMessage({id,error:error instanceof Error?error.message:'Preview failed'});}
  };
  port.start();port.postMessage({ready:true});
 };
 window.addEventListener('message',connect);
}

export function materialUrls(html: string, href = location.href): string[] {
 const params=new URL(href).searchParams;
 const project=params.get('project'),video=params.get('videoId')||'v-default';
 const matches=html.match(/\/__studio\/(?:projects\/p-[a-f0-9]{12}\/(?:videos\/(?:v-[a-f0-9]{12}|v-default)\/)?)?material\/res_[a-zA-Z0-9._:-]+/g)||[];
 const result=[...new Set(matches)];
 if(result.length>200)throw Error('预览素材数量过多');
 for(const url of result){
  const scoped=url.match(/^\/__studio\/projects\/(p-[a-f0-9]{12})\//)?.[1];
  if(project&&scoped!==project)throw Error('预览只能读取当前项目的素材');
  if(!project&&scoped)throw Error('预览素材不属于当前工作台');
  const scopedVideo=url.match(/\/videos\/(v-[a-f0-9]{12}|v-default)\//)?.[1]||'v-default';
  if(project&&scopedVideo!==video)throw Error('预览只能读取当前视频的素材');
 }
 return result;
}

// Studio mints new resource ids for every compile. Keep the bytes of the film
// on screen by content tag, so an edit only downloads media that changed.
type Material={url:string;blob:Blob};
type MaterialCache=Map<string,Blob>;
export async function loadMaterials(urls:readonly string[],cache:MaterialCache,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<{resources:Material[];cache:MaterialCache}>{
 const next:MaterialCache=new Map(),abort=signal?{signal}:{};
 const resources=await Promise.all(urls.map(async url=>{
  // Nothing to reuse on a first load; skip the extra round trip per material.
  const head=cache.size?await fetcher(url,{method:'HEAD',...abort}).catch(error=>{if(signal?.aborted)throw error;return undefined;}):undefined;
  const tag=head?.ok?head.headers.get('etag'):null;
  const held=tag?next.get(tag)||cache.get(tag):undefined;
  if(tag&&held){next.set(tag,held);return {url,blob:held};}
  const response=await fetcher(url,abort);if(!response.ok)throw Error('预览素材读取失败，请重新加载工作台');
  const blob=await response.blob();if(blob.size>256*1024*1024)throw Error('预览素材过大');
  const key=response.headers.get('etag')||tag;if(key)next.set(key,blob);
  return {url,blob};
 }));
 return {resources,cache:next};
}

export function createIsolatedPreview(iframe: HTMLIFrameElement, changed:()=>void=()=>{}, interaction:(value:PreviewInteraction)=>void=()=>{}) {
 iframe.setAttribute('sandbox','allow-scripts');
 iframe.setAttribute('allow','autoplay');
 let port:MessagePort|undefined,generation=0,sequence=0,ready=false,controller:AbortController|undefined;
 let materials:MaterialCache=new Map();
 let measured:Record<string,PreviewBox>={};
 const pending=new Map<number,{resolve:(value:boolean)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 const close=():void=>{
  generation++;ready=false;controller?.abort();port?.close();port=undefined;measured={};
  for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('预览已更新'));}pending.clear();
 };
 const request=(method:string,extra:Record<string,unknown>={}):Promise<boolean>=>{
  if(!port)return Promise.resolve(false);
  const id=++sequence;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('预览响应超时'));},20000);
   pending.set(id,{resolve,reject,timer});port!.postMessage({id,method,...extra});
  });
 };
 const receive=(event:MessageEvent<Reply>):void=>{
  const data=event.data;if(!data||typeof data!=='object')return;
  if(['contextmenu','pointerdown'].includes(data.interaction?.kind||'')&&data.interaction&&[data.interaction.frame,data.interaction.x,data.interaction.y].every(Number.isFinite)){
   interaction(data.interaction);return;
  }
  if(data.boxes&&typeof data.boxes==='object'){
   const next:Record<string,PreviewBox>={};
   for(const [id,box]of Object.entries(data.boxes).slice(0,2000)){
    if(box&&[box.xPx,box.yPx,box.widthPx,box.heightPx,box.stackOrder].every(Number.isFinite)&&box.widthPx>=0&&box.heightPx>=0)next[id]=box;
   }
   measured=next;changed();
  }
  if(data.id===undefined)return;
  const entry=pending.get(data.id);if(!entry)return;
  pending.delete(data.id);clearTimeout(entry.timer);
  if(data.error)entry.reject(Error(data.error));else entry.resolve(data.value===true);
 };
 return {
  measure:(id:string):PreviewBox|undefined=>measured[id],
  seek:(frame:number)=>ready?request('seek',{frame}):Promise.resolve(false),
  play:(frame:number)=>ready?request('play',{frame}):Promise.resolve(false),
  mute:(muted:boolean)=>ready?request('mute',{muted}):Promise.resolve(false),
  async load(html:string,frameRate=30):Promise<boolean>{
   close();const current=generation;controller=new AbortController();
   const loaded=await loadMaterials(materialUrls(html),materials,controller!.signal);
   if(current!==generation)return false;
   materials=loaded.cache;const resources=loaded.resources;
   const bootstrap='('+previewBootstrap.toString()+')('+safeJson(location.origin)+','+safeJson(CSP)+');';
   const connected=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('预览连接超时')),20000);
    iframe.addEventListener('load',()=>{
     if(current!==generation){clearTimeout(timer);resolve();return;}
     const channel=new MessageChannel();port=channel.port1;
     port.onmessage=event=>{if(event.data?.ready&&event.data.id===undefined){clearTimeout(timer);port!.onmessage=receive;resolve();}else receive(event);};
     port.start();iframe.contentWindow?.postMessage({type:'studio:preview-connect'},'*',[channel.port2]);
    },{once:true});
   });
   iframe.srcdoc='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="'+CSP+'"></head><body><script>'+bootstrap+'</script></body></html>';
   await connected;if(current!==generation)return false;
   const mounted=await request('mount',{html,resources,frameRate});if(current!==generation)return false;
   ready=mounted;return mounted;
  },
  destroy:close,
 };
}
