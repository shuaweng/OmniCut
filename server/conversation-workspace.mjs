import path from 'node:path';
import {AsyncLocalStorage} from 'node:async_hooks';
const scope=new AsyncLocalStorage();
export function conversationWorkspace(dataRoot,projectId,conversationId){
 const cid=conversationId??scope.getStore()?.conversationId;
 const base=path.join(dataRoot,'workspaces',projectId);
 if(!cid||cid===projectId)return base;
 if(!/^c-[a-f0-9]{12}$/.test(cid))throw Error('对话工作区无效');
 return path.join(base,'conversations',cid);
}
export function withConversationWorkspace(conversationId,fn){return scope.run({conversationId},fn);}
