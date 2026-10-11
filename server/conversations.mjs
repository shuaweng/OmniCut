import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {interruptMessages} from './chat-events.mjs';
import {validVideoId,DEFAULT_VIDEO_ID} from './video-context.mjs';
import {readStoredRecord,CorruptRecordError} from './record-recovery.mjs';
const videoTargets=ids=>{if(!Array.isArray(ids)||!ids.length||ids.length>20||ids.some(id=>!validVideoId(id)))throw Error('对话视频目标无效');return [...new Set(ids)];};

const validId=/^(?:p|c)-[a-f0-9]{12}$/;
const validProjectId=/^p-[a-f0-9]{12}$/;
const recordObject=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const validActive=value=>recordObject(value)&&Object.entries(value).every(([projectId,id])=>validProjectId.test(projectId)&&typeof id==='string'&&validId.test(id));
const validConversation=(value,id)=>recordObject(value)&&(value.id===undefined||value.id===id)&&(value.projectId===undefined?validProjectId.test(id):typeof value.projectId==='string'&&validProjectId.test(value.projectId))&&(value.messages===undefined||Array.isArray(value.messages)&&value.messages.every(recordObject))&&['title','status','created','updated'].every(key=>value[key]===undefined||typeof value[key]==='string')&&(value.targetVideoIds===undefined||Array.isArray(value.targetVideoIds)&&value.targetVideoIds.every(validVideoId));
const titleFrom=text=>String(text||'').trim().split(/[\n。！？]/)[0].slice(0,30)||'新对话';
const metadata=s=>({displayStatus:s.status==='idle'?(s.outcome||(s.messages?.at(-1)?.role==='error'?'failed':'idle')):s.status,id:s.id,projectId:s.projectId,title:s.title||'新对话',status:s.status||'idle',updated:s.updated,created:s.created,archived:!!s.archived,sessionId:s.sessionId,targetVideoIds:s.targetVideoIds||[DEFAULT_VIDEO_ID],hasMessages:!!s.messages?.length});

// Conversation state remains compatible with the old project-named chat file.
// Project IDs identify legacy/default conversations; additional ones use c- IDs.
export class ConversationStore {
 constructor(dataRoot){this.dir=path.join(dataRoot,'chats');this.states=new Map();this.active=new Map();this.queue=Promise.resolve();this.recoveryDiagnostics=[];this.corruptRecords=new Map();this.activeFile=path.join(this.dir,'active.json');this.activeWritable=true;}
 async init(){
  await fs.mkdir(this.dir,{recursive:true});
  try{const value=await readStoredRecord(this.activeFile,{label:'当前对话',validate:validActive,allowMissing:true});if(value)this.active=new Map(Object.entries(value));}
  catch(error){
   if(!(error instanceof CorruptRecordError))throw error;this.recoveryDiagnostics.push(error.diagnostic);
   // Keep damaged active.json unchanged. A separate healthy pointer preserves
   // new selections across restarts without overwriting the recovery source.
   this.activeFile=path.join(this.dir,'.active-recovered.json');
   try{const value=await readStoredRecord(this.activeFile,{label:'恢复后的当前对话',validate:validActive,allowMissing:true});if(value)this.active=new Map(Object.entries(value));}
   catch(recoveryError){if(!(recoveryError instanceof CorruptRecordError))throw recoveryError;this.recoveryDiagnostics.push(recoveryError.diagnostic);this.activeWritable=false;}
  }
  for(const file of await fs.readdir(this.dir)){
   const id=file.slice(0,-5);if(!file.endsWith('.json')||!validId.test(id))continue;
   let s;try{s=await readStoredRecord(path.join(this.dir,file),{label:'对话',validate:value=>validConversation(value,id)});}
   catch(error){if(!(error instanceof CorruptRecordError))throw error;this.recoveryDiagnostics.push(error.diagnostic);this.corruptRecords.set(id,error.diagnostic);continue;}
   s.id=id;s.projectId??=id;s.messages??=[];s.title??=titleFrom(s.messages.find(m=>m.role==='user')?.text);s.created??=new Date((await fs.stat(path.join(this.dir,file))).birthtimeMs).toISOString();s.updated??=s.created;
   if(s.status==='running')s.messages.push({role:'error',text:'上次任务被中断，已完成的修改保留。'});
   s.status='idle';s.waitRegistered=false;
   if(s.resuming){s.messages.push({role:'error',text:'自动接续被中断，已完成的结果保留，请继续当前对话。'});delete s.resuming;}
   interruptMessages(s);this.states.set(id,s);
  }
  // A damaged default conversation never gets overwritten by ensure(). Give
  // the project an independent healthy conversation when none remains.
  for(const id of this.corruptRecords.keys())if(validProjectId.test(id)&&![...this.states.values()].some(s=>s.projectId===id&&!s.archived))await this.create(id,{title:'新对话'});
  return this;
 }
 ensure(projectId,conversationId=projectId){
  if(!/^p-[a-f0-9]{12}$/.test(projectId)||!validId.test(conversationId))throw Error('对话不存在');
  if(this.corruptRecords.has(conversationId))throw new CorruptRecordError(this.corruptRecords.get(conversationId));
  let s=this.states.get(conversationId);
  if(!s){if(conversationId!==projectId)throw Error('对话不存在');s={id:conversationId,projectId,title:'新对话',status:'idle',messages:[],created:new Date().toISOString(),updated:new Date().toISOString()};this.states.set(conversationId,s);this.persist(conversationId);}
  if(s.projectId!==projectId)throw Error('对话不属于当前项目');return s;
 }
 get(id){const s=this.states.get(id);if(s)return s;return this.ensure(id);}
 enqueue(fn){const task=this.queue.then(fn);this.queue=task.catch(e=>console.error('保存对话失败:',e.message));return task;}
 persist(id){const s=this.get(id);s.updated=new Date().toISOString();const content=JSON.stringify(s);return this.enqueue(async()=>{const file=path.join(this.dir,id+'.json');await fs.writeFile(file+'.tmp',content);await fs.rename(file+'.tmp',file);});}
 async list(projectId){if(!validProjectId.test(projectId))throw Error('对话不存在');if(!this.corruptRecords.has(projectId))this.ensure(projectId);return {conversations:[...this.states.values()].filter(s=>s.projectId===projectId).map(metadata).sort((a,b)=>b.updated.localeCompare(a.updated)),activeConversationId:this.activeId(projectId),recoveryDiagnostics:this.recoveryDiagnostics};}
 activeId(projectId){const id=this.active.get(projectId),s=this.states.get(id);return s&&s.projectId===projectId&&!s.archived?id:[...this.states.values()].find(s=>s.projectId===projectId&&!s.archived)?.id||projectId;}
 async activate(projectId,id){const s=this.ensure(projectId,id);if(s.archived)throw Error('请先恢复这段对话');this.active.set(projectId,id);if(this.activeWritable){const content=JSON.stringify(Object.fromEntries(this.active)),file=this.activeFile;await this.enqueue(async()=>{await fs.writeFile(file+'.tmp',content);await fs.rename(file+'.tmp',file);});}return metadata(s);}
 async create(projectId,{title,targetVideoIds=[DEFAULT_VIDEO_ID]}={}){
  if(!validProjectId.test(projectId))throw Error('对话不存在');if(!this.corruptRecords.has(projectId))this.ensure(projectId);const id='c-'+crypto.randomBytes(6).toString('hex'),now=new Date().toISOString();
  const s={id,projectId,targetVideoIds:videoTargets(targetVideoIds),title:title?this.validateTitle(title):'新对话',titleEdited:!!title,status:'idle',messages:[],created:now,updated:now};this.states.set(id,s);await this.persist(id);await this.activate(projectId,id);return metadata(s);
 }
 validateTitle(title){if(typeof title!=='string'||!title.trim()||title.trim().length>60||/[\x00-\x1f]/.test(title))throw Error('对话名称需为 1–60 个字符');return title.trim();}
 async patch(projectId,id,input){
  const s=this.ensure(projectId,id);
  if(input.targetVideoIds!==undefined)s.targetVideoIds=videoTargets(input.targetVideoIds);
  if(input.title!==undefined){s.title=this.validateTitle(input.title);s.titleEdited=true;}
  if(input.archived!==undefined){if(typeof input.archived!=='boolean')throw Error('归档状态无效');if(input.archived&&['running','waiting'].includes(s.status))throw Error('请先停止这段对话，再归档');s.archived=input.archived;}
  await this.persist(id);return metadata(s);
 }
 nameFromMessage(id,text){const s=this.get(id);if(!s.titleEdited&&(!s.title||s.title==='新对话'))s.title=titleFrom(text);}
 own(id,kind,job,origin){
  if(!job?.id)return;const s=this.get(id),key=kind+':'+job.id;let changed=false;
  // Display ownership also includes manual UI submissions. Only the Agent RPC
  // path supplies the captured user-request token; never infer it from a date.
  if(origin?.kind==='agent'&&typeof origin.turnId==='string'&&origin.turnId){
   s.agentTaskRequests??={};s.agentTaskRequests[key]={turnId:origin.turnId,...(origin.rpcId?{rpcId:origin.rpcId}:{})};changed=true;
  }
  if(!this.owner(s.projectId,kind,job.id)){s.ownedTasks??=[];s.ownedTasks.push(key);changed=true;}
  if(changed)this.persist(id);
 }
 owner(projectId,kind,id){const key=kind+':'+id;return [...this.states.values()].find(s=>s.projectId===projectId&&s.ownedTasks?.includes(key))?.id;}
 jobs(projectId,id,kind,items){return items.map(j=>{const conversationId=this.owner(projectId,kind,j.id)||projectId;return {...j,conversationId};}).filter(j=>j.conversationId===id);}
 projectIds(projectId){return [...this.states.values()].filter(s=>s.projectId===projectId).map(s=>s.id);}
}
