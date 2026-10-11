import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {nativeSnapshotChanges} from './snapshot-changes.mjs';
const key=history=>history.map(entry=>JSON.stringify(entry));
const labels={'hypit-edit':'更新画面与动效','hypit-commit':'更新剪辑','hypit-mutation':'调整画面属性','hypit-timing':'调整片段节奏','hypit-replace-media':'替换素材','change':'调整视频','timeline':'调整时间线','batch':'批量修改','batch-text':'修改文案','chat-timing':'调整播放节奏','reference-apply':'采用参考方案'};
export class TurnChanges{
 constructor(service){this.service=service;this.dir=path.join(service.dataRoot,'turn-changes');this.records=new Map();}
 async init(){await fs.mkdir(this.dir,{recursive:true});for(const file of await fs.readdir(this.dir)){if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;try{const item=JSON.parse(await fs.readFile(path.join(this.dir,file),'utf8'));if(item.id&&Array.isArray(item.videos))this.records.set(item.id,item);}catch{}}return this;}
 async record({projectId,conversationId,turnId,title,before,after,operation,args,beforeSnapshot,afterSnapshot}){
  if(!labels[operation]||before.revision===after.revision)return;
  let item=[...this.records.values()].find(r=>r.turnId===turnId&&r.conversationId===conversationId);
  if(!item){item={id:crypto.randomUUID(),projectId,conversationId,turnId,title,created:new Date().toISOString(),videos:[]};this.records.set(item.id,item);}
  const videoId=after.videoId||'v-default';let video=item.videos.find(v=>v.videoId===videoId);
  if(!video){video={videoId,name:after.name,baseRevision:before.revision,baseHistory:key(before.history||[]),ownedHistory:[],changes:[]};item.videos.push(video);}
  const prior=new Set(key(before.history||[])),added=key(after.history||[]).filter(entry=>!prior.has(entry));video.ownedHistory.push(...added);video.revision=after.revision;
  const changes=nativeSnapshotChanges(beforeSnapshot,afterSnapshot);
  for(const shot of after.shots||[]){const old=before.shots?.find(s=>s.id===shot.id);if(old&&old.duration!==shot.duration)changes.push({label:`${shot.name||'镜头'}：${old.duration}s → ${shot.duration}s`,start:shot.start||0,entityId:shot.id});}
  for(const text of after.texts||[]){const old=before.texts?.find(t=>t.id===text.id);if(old&&old.text!==text.text)changes.push({label:'修改'+(text.label||'文案'),entityId:text.id,start:after.shots?.find(s=>s.captionId===text.id)?.start||0});}
  if(!changes.length)changes.push({label:args?.options?.label||labels[operation],start:Number.isFinite(args?.start)?args.start:0,scope:'video'});
  video.changes.push(...changes);item.updated=new Date().toISOString();await this.save(item);return this.public(item);
 }
 public(item){return item?{id:item.id,turnId:item.turnId,title:item.title,created:item.created,undone:!!item.undone,videos:item.videos.map(({videoId,name,revision,changes})=>({videoId,name,revision,changes})),undoAvailable:!item.undone&&item.videos.length===1&&item.videos[0].ownedHistory.length>0}:null;}
 latest(conversationId,turnId){return this.public([...this.records.values()].findLast(r=>r.conversationId===conversationId&&(!turnId||r.turnId===turnId)));}
 historyOrigin(projectId,entry){const value=JSON.stringify(entry);const record=[...this.records.values()].findLast(r=>r.projectId===projectId&&r.videos.some(v=>v.ownedHistory.includes(value)));return record?{kind:'agent',conversationId:record.conversationId,title:record.title,turnId:record.turnId}:{kind:'user',title:'你'};}
 async save(item){const file=path.join(this.dir,item.id+'.json');await fs.writeFile(file+'.tmp',JSON.stringify(item),{mode:0o600});await fs.rename(file+'.tmp',file);}
 async undo(projectId,id){
  const item=this.records.get(id);if(!item||item.projectId!==projectId||item.undone||item.videos.length!==1)throw Error('本轮改动不能整体撤销');
  const video=item.videos[0];return this.service.withVideoContext(projectId,video.videoId,()=>this.service.exclusive(projectId,async()=>{
   let p=await this.service.get(projectId);const history=key(p.history||[]),expected=[...video.baseHistory,...video.ownedHistory];
   if(p.revision!==video.revision||JSON.stringify(history)!==JSON.stringify(expected))throw Object.assign(Error('之后已有其他修改，请在版本记录中选择恢复，避免覆盖后续工作'),{status:409});
   for(let n=0;n<video.ownedHistory.length;n++)p=await this.service.undo(projectId,p.revision);
   item.undone=true;await this.save(item);return p;
  }));
 }
}
