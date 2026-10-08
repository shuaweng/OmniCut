import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {interruptMessages} from './chat-events.mjs';

const validId=/^(?:p|c)-[a-f0-9]{12}$/;
const titleFrom=text=>String(text||'').trim().split(/[\n。！？]/)[0].slice(0,30)||'新对话';
const metadata=s=>({displayStatus:s.status==='idle'?(s.outcome||(s.messages?.at(-1)?.role==='error'?'failed':'idle')):s.status,id:s.id,projectId:s.projectId,title:s.title||'新对话',status:s.status||'idle',updated:s.updated,created:s.created,archived:!!s.archived,sessionId:s.sessionId,hasMessages:!!s.messages?.length});

// Conversation state remains compatible with the old project-named chat file.
// Project IDs identify legacy/default conversations; additional ones use c- IDs.
export class ConversationStore {
 constructor(dataRoot){this.dir=path.join(dataRoot,'chats');this.states=new Map();this.active=new Map();this.queue=Promise.resolve();}
 async init(){
  await fs.mkdir(this.dir,{recursive:true});
  try{this.active=new Map(Object.entries(JSON.parse(await fs.readFile(path.join(this.dir,'active.json'),'utf8'))));}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const file of await fs.readdir(this.dir)){
   const id=file.slice(0,-5);if(!file.endsWith('.json')||!validId.test(id))continue;
   const s=JSON.parse(await fs.readFile(path.join(this.dir,file),'utf8'));
   s.id=id;s.projectId??=id;s.messages??=[];s.title??=titleFrom(s.messages.find(m=>m.role==='user')?.text);s.created??=new Date((await fs.stat(path.join(this.dir,file))).birthtimeMs).toISOString();s.updated??=s.created;
   if(s.status==='running')s.messages.push({role:'error',text:'上次任务被中断，已完成的修改保留。'});
   s.status='idle';s.waitRegistered=false;
   if(s.resuming){s.messages.push({role:'error',text:'自动接续被中断，已完成的结果保留，请继续当前对话。'});delete s.resuming;}
   interruptMessages(s);this.states.set(id,s);
  }
  return this;
 }
 ensure(projectId,conversationId=projectId){
  if(!/^p-[a-f0-9]{12}$/.test(projectId)||!validId.test(conversationId))throw Error('对话不存在');
  let s=this.states.get(conversationId);
  if(!s){if(conversationId!==projectId)throw Error('对话不存在');s={id:conversationId,projectId,title:'新对话',status:'idle',messages:[],created:new Date().toISOString(),updated:new Date().toISOString()};this.states.set(conversationId,s);this.persist(conversationId);}
  if(s.projectId!==projectId)throw Error('对话不属于当前项目');return s;
 }
 get(id){const s=this.states.get(id);if(s)return s;return this.ensure(id);}
 enqueue(fn){const task=this.queue.then(fn);this.queue=task.catch(e=>console.error('保存对话失败:',e.message));return task;}
 persist(id){const s=this.get(id);s.updated=new Date().toISOString();const content=JSON.stringify(s);return this.enqueue(async()=>{const file=path.join(this.dir,id+'.json');await fs.writeFile(file+'.tmp',content);await fs.rename(file+'.tmp',file);});}
 async list(projectId){this.ensure(projectId);return {conversations:[...this.states.values()].filter(s=>s.projectId===projectId).map(metadata).sort((a,b)=>b.updated.localeCompare(a.updated)),activeConversationId:this.activeId(projectId)};}
 activeId(projectId){const id=this.active.get(projectId),s=this.states.get(id);return s&&s.projectId===projectId&&!s.archived?id:[...this.states.values()].find(s=>s.projectId===projectId&&!s.archived)?.id||projectId;}
 async activate(projectId,id){const s=this.ensure(projectId,id);if(s.archived)throw Error('请先恢复这段对话');this.active.set(projectId,id);const content=JSON.stringify(Object.fromEntries(this.active));await this.enqueue(()=>fs.writeFile(path.join(this.dir,'active.json'),content));return metadata(s);}
 async create(projectId,{title}={}){
  this.ensure(projectId);const id='c-'+crypto.randomBytes(6).toString('hex'),now=new Date().toISOString();
  const s={id,projectId,title:title?this.validateTitle(title):'新对话',titleEdited:!!title,status:'idle',messages:[],created:now,updated:now};this.states.set(id,s);await this.persist(id);await this.activate(projectId,id);return metadata(s);
 }
 validateTitle(title){if(typeof title!=='string'||!title.trim()||title.trim().length>60||/[\x00-\x1f]/.test(title))throw Error('对话名称需为 1–60 个字符');return title.trim();}
 async patch(projectId,id,input){
  const s=this.ensure(projectId,id);
  if(input.title!==undefined){s.title=this.validateTitle(input.title);s.titleEdited=true;}
  if(input.archived!==undefined){if(typeof input.archived!=='boolean')throw Error('归档状态无效');if(input.archived&&['running','waiting'].includes(s.status))throw Error('请先停止这段对话，再归档');s.archived=input.archived;}
  await this.persist(id);return metadata(s);
 }
 nameFromMessage(id,text){const s=this.get(id);if(!s.titleEdited&&(!s.title||s.title==='新对话'))s.title=titleFrom(text);}
 own(id,kind,job){if(!job?.id)return;const s=this.get(id);if(this.owner(s.projectId,kind,job.id))return;s.ownedTasks??=[];const key=kind+':'+job.id;if(!s.ownedTasks.includes(key))s.ownedTasks.push(key);this.persist(id);}
 owner(projectId,kind,id){const key=kind+':'+id;return [...this.states.values()].find(s=>s.projectId===projectId&&s.ownedTasks?.includes(key))?.id;}
 jobs(projectId,id,kind,items){return items.map(j=>{const conversationId=this.owner(projectId,kind,j.id)||projectId;return {...j,conversationId};}).filter(j=>j.conversationId===id);}
 projectIds(projectId){return [...this.states.values()].filter(s=>s.projectId===projectId).map(s=>s.id);}
}
