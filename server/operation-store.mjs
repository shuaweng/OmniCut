import {promises as fs} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readStoredRecord,CorruptRecordError} from './record-recovery.mjs';

const idPattern=/^[a-f0-9-]{36}$/;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
 return typeof value==='string'?value.trim():value;
}
function label(value,fallback){
 if(value===undefined)return fallback;
 if(typeof value!=='string'||!value.trim()||value.length>120)throw Error('制作操作身份无效');
 return value.trim();
}

// Editing a time range or saving a plan again does not create a new production.
// Explicit ids take precedence; older plans use their creative content, rather
// than the volatile timestamp or the whole project's revision, as the boundary.
export function productionIdentity(project,explicit){
 if(explicit!==undefined)return label(explicit);
 if(project.productionPlan?.id)return label(project.productionPlan.id);
 if(project.productionPlan?.productionId)return label(project.productionPlan.productionId);
 const plan=project.productionPlan;
 return plan?'plan-'+hash({referenceId:plan.referenceId,ratio:plan.ratio,scenes:(plan.scenes||[]).map(({id,visual,voiceover})=>({id,visual,voiceover}))}).slice(0,24):'project-'+project.id;
}

export function mediaOperationIdentity({projectId,productionId,operation,operationId,operationVersion,attemptId,input,configuration}){
 const identity={projectId,productionId:label(productionId),operation,operationId:label(operationId),operationVersion:label(operationVersion,'1'),attemptId:label(attemptId,'initial')};
 // A label, editing revision, or conversation turn does not change generated
 // pixels/sound. A changed prompt/reference/model is a distinct request version.
 const {name,revision,confirmed,requestId,operationId:ignoredOperation,productionId:ignoredProduction,operationVersion:ignoredVersion,attemptId:ignoredAttempt,...generation}=input||{};
 if(typeof generation.resolution==='string')generation.resolution=generation.resolution.toLowerCase();
 identity.inputHash=hash({generation,configuration});
 return {...identity,key:hash(identity)};
}

export function unknownOperation(id,operation){
 return {status:'unknown',operationId:id,operation,canRetry:false,message:'尚未收到操作结果；这不表示操作失败，已提交的任务可能仍在执行。',nextAction:{tool:'get_operation_status',arguments:{operationId:id}}};
}

export class OperationStore{
 constructor(dataRoot){this.dir=path.join(dataRoot,'operations');this.records=new Map();this.mediaKeys=new Map();this.inflight=new Map();this.queue=Promise.resolve();this.loadDiagnostics=[];}
 async init(){
  await fs.mkdir(this.dir,{recursive:true});
  for(const file of await fs.readdir(this.dir)){
   if(!/^[a-f0-9-]{36}\.json$/.test(file))continue;
   let record;
   try{record=await readStoredRecord(path.join(this.dir,file),{label:'生成与操作记录',validate:value=>value&&value.id===file.slice(0,-5)&&typeof value.projectId==='string'&&['running','unknown','completed','failed'].includes(value.status)&&typeof value.created==='string'&&(value.kind==='media'?value.identity&&/^[a-f0-9]{64}$/.test(value.identity.key)&&typeof value.identity.operation==='string':value.kind==='rpc'&&typeof value.conversationId==='string'&&typeof value.operation==='string')});}
   catch(error){if(!(error instanceof CorruptRecordError))throw error;this.loadDiagnostics.push(error.diagnostic);continue;}
   if(record.status==='running'){record.status='unknown';await this.save(record);}
   this.records.set(record.id,record);
   if(record.kind==='media')this.mediaKeys.set(record.identity.key,record);
  }
  return this;
 }
 async save(record){
  record.updated=new Date().toISOString();
  const file=path.join(this.dir,record.id+'.json'),temp=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(temp,JSON.stringify(record),{mode:0o600});await fs.rename(temp,file);
 }
 exclusive(work){const pending=this.queue.then(work);this.queue=pending.catch(()=>{});return pending;}
 async beginRPC(id,{projectId,conversationId,operation,args}){
  if(!idPattern.test(id))throw Error('操作 ID 无效');
  return this.exclusive(async()=>{
   const previous=this.records.get(id);
   if(previous){if(previous.projectId!==projectId||previous.conversationId!==conversationId||previous.inputHash!==hash({operation,args}))throw Error('操作 ID 已用于其他请求');return {record:previous,fresh:false};}
   const record={id,kind:'rpc',projectId,conversationId,operation,inputHash:hash({operation,args}),status:'running',created:new Date().toISOString()};
   await this.save(record);this.records.set(id,record);return {record,fresh:true};
  });
 }
 async finishRPC(id,{result,error}){
  const record=this.records.get(id);if(!record||record.kind!=='rpc')return;
  record.status=error?'failed':'completed';if(error)record.error=String(error);else{record.result=result;delete record.error;}
  await this.save(record);
 }
 status(projectId,id,conversationId){
  const record=this.records.get(id);
  if(!record||record.projectId!==projectId||(record.kind==='rpc'&&record.conversationId!==conversationId))throw Error('此对话没有该操作记录');
  return {operationId:record.id,operation:record.operation||record.identity.operation,status:record.status,created:record.created,updated:record.updated,canRetry:false,...(record.identity?{identity:record.identity}:{}),...(record.result!==undefined?{result:record.result}:{}),...(record.error?{error:record.error}:{}),...(record.status==='unknown'?{message:'服务曾中断或响应尚未确认，请核对已有任务；不会自动重发。'}:{})};
 }
 listMedia(projectId){
  return [...this.mediaKeys.values()].filter(record=>record.projectId===projectId).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,60).map(record=>({requestId:record.id,productionId:record.identity.productionId,operation:record.identity.operation,operationId:record.identity.operationId,operationVersion:record.identity.operationVersion,attemptId:record.identity.attemptId,submissionStatus:record.status,...(record.result?.taskId?{taskId:record.result.taskId}:{}),...(record.result?.assetFile?{assetFile:record.result.assetFile}:{})}));
 }
 async inspect(projectId,id,conversationId,lookup){
  // Authenticate the receipt before following its paid-operation link.
  this.status(projectId,id,conversationId);
  const record=this.records.get(id),media=record.kind==='media'?record:this.records.get(record.mediaRequestId);
  if(media){
   const current=await lookup?.(media.identity.operation,media.id);
   if(current){
    media.result=current;media.status='completed';delete media.error;await this.save(media);
    if(record!==media&&record.status!=='completed'){record.result=current;record.status='completed';delete record.error;await this.save(record);}
   }
  }
  return this.status(projectId,id,conversationId);
 }
 async runMedia(scope,execute,lookup){
  const identity=mediaOperationIdentity(scope);
  const {record,fresh,deferred}=await this.exclusive(async()=>{
   const previous=this.mediaKeys.get(identity.key);if(previous)return {record:previous,fresh:false};
   if(this.loadDiagnostics.length&&identity.attemptId==='initial')throw Error('本地生成记录损坏，无法确认原请求是否已提交。已知任务仍可复用；请先修复或恢复记录，不能把未知历史当作未生成而重新付费。');
   const record={id:crypto.randomUUID(),kind:'media',projectId:scope.projectId,identity,status:'running',created:new Date().toISOString()};
   await this.save(record);this.records.set(record.id,record);this.mediaKeys.set(identity.key,record);
   const deferred=Promise.withResolvers();deferred.promise.catch(()=>{});this.inflight.set(record.id,deferred.promise);return {record,fresh:true,deferred};
  });
  if(scope.rpcId){const receipt=this.records.get(scope.rpcId);if(receipt?.kind==='rpc'&&receipt.projectId===scope.projectId){receipt.mediaRequestId=record.id;await this.save(receipt);}}
  if(!fresh){
   if(this.inflight.has(record.id))return this.inflight.get(record.id);
   const current=await lookup?.(record.id);
   if(current){record.result=current;record.status='completed';delete record.error;await this.save(record);return current;}
   if(record.result!==undefined)return record.result;
   if(record.status==='failed')throw Error(record.error||'该生成操作未成功；明确重生成时使用新的 attemptId');
   return unknownOperation(record.id,scope.operation);
  }
  // Reserve and persist before invoking the media service. A second turn, a
  // child agent, or a second conversation receives this same request id.
  void (async()=>{
   try{const result=await execute(record.id);record.result=result;record.status='completed';await this.save(record);deferred.resolve(result);}
   catch(error){record.status='failed';record.error=String(error.message||error).slice(0,1000);await this.save(record);deferred.reject(error);}
   finally{this.inflight.delete(record.id);}
  })().catch(error=>deferred.reject(error));
  return deferred.promise;
 }
}
