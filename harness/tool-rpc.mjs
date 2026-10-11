import crypto from 'node:crypto';
import {unknownOperation} from '../server/operation-store.mjs';

const compile=new Set(['hypit-edit','hypit-commit','hypit-compose','hypit-replace-media','hypit-mutation','hypit-timing','change','timeline','batch','batch-text','chat-timing','validate']);
const submit=new Set(['generate','generate-image','generate-audio','reference-analyze','reference-generate','transcribe','hypit-build','export']);
export function rpcTimeoutFor(operation){
 if(operation==='preview-frames')return 300000;
 if(['probe-export','analyze-beats'].includes(operation))return 180000;
 if(operation==='hypit-command')return 900000;
 if(compile.has(operation)||operation==='hypit-import'||operation==='hypit-fork')return 300000;
 if(submit.has(operation))return 240000;
 if(['hypit-checkout','hypit-sync','hypit-index-assets','stage-asset','stage-export','publish-workspace','resume-video','resume-image','tasks','context','hypit-inspect'].includes(operation))return 180000;
 return 60000;
}

// Timeout belongs to the transport, not the operation. The server keeps the
// actual result under this id; losing this response must never trigger a replay.
export function createToolRPC({send,setTimer=setTimeout,clearTimer=clearTimeout,newId=()=>crypto.randomUUID()}){
 const pending=new Map();
 function call(scope,operation,args,signal){
  return new Promise((resolve,reject)=>{
   if(signal?.aborted){reject(Error('操作已取消'));return;}
   const id=newId();let timer;
   const cleanup=()=>{pending.delete(id);clearTimer(timer);signal?.removeEventListener('abort',abort);};
   const abort=()=>{cleanup();reject(Error('操作已取消；已提交的任务保留。操作 ID：'+id));};
   timer=setTimer(()=>{cleanup();resolve(unknownOperation(id,operation));},rpcTimeoutFor(operation));
   pending.set(id,{resolve:value=>{cleanup();resolve(value);},reject:error=>{cleanup();reject(error);}});
   signal?.addEventListener('abort',abort,{once:true});
   try{send({type:'tool',id,...scope,operation,args});}catch(error){cleanup();reject(error);}
  });
 }
 function receive(message){
  const request=pending.get(message.id);if(!request)return false;
  message.error?request.reject(Error(message.error)):request.resolve(message.value);return true;
 }
 function close(){for(const request of [...pending.values()])request.reject(Error('Agent 已停止；已提交的操作仍可查询。'));}
 return {call,receive,close};
}
