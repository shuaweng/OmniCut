import {sourceFiles} from './native-engine.mjs';
import {localizeStudioSnapshot} from '../src/studio-language.js';

export function sendStudioResource(req,res,r){
 const headers={'content-type':r.type||'application/octet-stream','cache-control':r.headers?.['cache-control']||'no-store'};
 // These are part of the native storyboard protocol, not optional metadata.
 // Without them the UI cannot consume the atlas and leaves its body unread.
 for(const key of ['content-range','accept-ranges','content-disposition','x-hypit-storyboard-count','x-hypit-storyboard-columns','x-hypit-storyboard-rows','x-hypit-storyboard-tile-width','x-hypit-storyboard-tile-height','x-hypit-storyboard-sample-fps'])if(r.headers?.[key])headers[key]=r.headers[key];
 if(r.frameRevision)headers['x-frame-revision']=r.frameRevision;
 headers['content-length']=req.method==='HEAD'?(r.headers?.['content-length']||r.body.length):r.body.length;
 res.writeHead(r.status,headers);res.end(req.method==='HEAD'?undefined:r.body);
}

// Project lifecycle adapter around Hypit's original HTTP editing protocol.
// No duplicate parameter serializer, timeline math, XML editor or renderer.
export class StudioHost{
 constructor({service,engine,studios,notify=()=>{}}){Object.assign(this,{service,engine,studios,notify});this.clientRevisions=new Map();this.serial=Date.now();}
 async mutate(id,input){return this.service.exclusive(async()=>{
  const p=await this.service.get(id);if(input.revision!==p.revision)throw Error('项目已更新，请重新读取');
  const mutations=input.mutations||[input];
  if(!Array.isArray(mutations)||!mutations.length||mutations.length>100)throw Error('请选择有效的场景修改');
  const before=await sourceFiles(this.service.dir(id));
   try{for(const mutation of mutations){
    await this.studios.mutate(id,{...mutation,revision:(await this.service.get(id)).revision});
    await this.studios.accept(id);
   }}catch(e){
   // Hypit rolls back an individual failed transaction. Restore the whole
   // batch too, so a failed multi-field edit never leaves half an adjustment.
   await this.engine.replaceFiles(this.service.dir(id),await sourceFiles(this.service.dir(id)),before);
   await this.studios.stop(id);throw e;
  }
  await this.engine.recordStudio(id,before,input,await this.studios.currentSpace(id));
  await this.studios.accept(id);this.notify(id);
  return {project:await this.service.get(id),snapshot:await this.studios.snapshot(id)};
 });}
 async resource(id,name,search='',{method='GET',body,revision,range}={}){
  const read=method==='GET'||method==='HEAD';
  if(read){
   if(!/^(session|document|visual\.html|library|surface-preview|artifact|feedback|locales|(?:storyboard|material)\/res_[a-zA-Z0-9._:-]+)$/.test(name))throw Error('未知场景资源');
   let r,p;
   for(let attempt=0;attempt<3;attempt++){
    r=await this.studios.resource(id,'/__studio/'+name+search,undefined,{method,range});
    if(name!=='session')break;
    p=await this.service.get(id);
    if(r.frameRevision===p.revision&&r.sessionPort===this.studios.sessions.get(id)?.port)break;
    if(attempt===2)throw Error('工程正在更新，请稍后再读取场景');
   }
   if(/(?:json|html)/.test(r.type||'')){
    r.body=Buffer.from(r.body.toString().replaceAll('/__studio/','/__studio/projects/'+id+'/'));
    if(name==='session'){
     const data=JSON.parse(r.body),nativeRevision=data.revision;
     const key=p.revision+':'+r.sessionPort+':'+nativeRevision;
     let current=this.clientRevisions.get(id);
     if(current?.key!==key){current={key,revision:++this.serial,nativeRevision,frameRevision:p.revision};this.clientRevisions.set(id,current);}
     // A Studio subprocess may restart at revision 1 after an Agent commit.
     // Preserve a monotonic UI revision so upstream Stage/code refresh too.
     data.revision=current.revision;data.frameRevision=p.revision;
     for(const track of data.tracks||[])for(const clip of track.clips){const label=p.native?.labels?.[clip.authoredId]||p.native?.labels?.[clip.display?.title]||p.native?.labels?.[clip.id?.split(':entity:').at(-1)];if(label)clip.display={...clip.display,title:label};}
     r.body=Buffer.from(JSON.stringify(localizeStudioSnapshot(data)));
     delete r.headers?.['content-length'];
    }
   }
   return r;
  }
  if(!['PUT:source','PUT:artifact-name','POST:mutation','POST:feedback'].includes(method+':'+name))throw Error('不支持的场景操作');
  return this.service.exclusive(async()=>{
   const p=await this.service.get(id);if(revision!==p.revision)throw Error('项目已更新，请刷新场景后重试');
   if(name==='source'||name==='mutation'){
    const current=this.clientRevisions.get(id);
    if(!current||body?.revision!==current.revision||current.frameRevision!==revision)throw Error('场景已更新，请等待画面刷新后重试');
    body={...body,revision:current.nativeRevision};
   }
   const before=await sourceFiles(this.service.dir(id));
   const r=await this.studios.resource(id,'/__studio/'+name+search,body,{method});
   if(r.status>=200&&r.status<300){
    const after=await sourceFiles(this.service.dir(id));
    if(JSON.stringify(before)!==JSON.stringify(after))await this.engine.recordStudio(id,before,{type:name},await this.studios.currentSpace(id));
    await this.studios.accept(id);this.notify(id);
    r.frameRevision=(await this.service.get(id)).revision;
   }
   return r;
  });
 }
}
